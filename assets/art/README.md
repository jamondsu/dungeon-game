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
| cfx_face.png (+ .json) | 256x576, 122 frames | every eye and hat the slimes wear, one 32x32 cell each (named in the .json); hats added by tools/cfx_face_hats.mjs from the rows typed in Creatures.js |
| cfx_ice.png (+ .json) | 52x21, 2 frames | the ice block, whole and cracked, typed by hand (tools/uikit_bake.mjs) |
| cs_sheet.png (+ .json) | 192x96, 16 frames | cosmic effect bits (named in the .json) |
| cs_sigil.png | 128x128 | the cosmic sigil circle (white, tinted in game) |
| el_icon_cosmic.png (+ .json) | 64x16, 4 frames | an element's icon, 4 frames |
| el_icon_fire.png (+ .json) | 64x16, 4 frames | an element's icon, 4 frames |
| el_icon_ice.png (+ .json) | 64x16, 4 frames | an element's icon, 4 frames |
| el_icon_lightning.png (+ .json) | 64x16, 4 frames | an element's icon, 4 frames |
| fx_anger.png (+ .json) | 9x9 | the anger mark over the Voltslime |
| fx_bonk_star.png (+ .json) | 7x7 | stars round its head after the BONK |
| fx_cheer_back.png | 92x60 | the stage's curtains, typed by hand: deep red backdrop pleats lit along their ridges (darker under the valance, spreading at the hem), a drape each side gathered at a gold tieback with a tassel, the valance swagged between gold knots with a cord and drops along its scallops and bulbs along its band (tools/props_bake.mjs cheer) |
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
| fx_ultblock_ban.png (+ .json) | 12x12 | the ult-blocker zone's icon |
| fx_ultblock_drain.png (+ .json) | 12x12 | the ult-blocker zone's icon |
| fx_ult_fi.png (+ .json) | 200x121, 32 frames | the fire and ice ults: meteors, their blast and crater, the Magma Armor's seams and crown of flames, Gale's tornado, the Deep Freeze (and Ice King)'s crown, runes and cracks, the ice shell, meltwater |
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
| lt_coin.png (+ .json) | 20x5, 4 frames | a coin spilling out of a chest, spinning |
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
| slime_m_lightningelem.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_leech_ice.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_leech_lightning.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| fx_enemies_b.png (+ .json) | 256x89, 51 frames | what the newer enemies' attacks throw about, typed by hand: poison globs, claw rakes, blood, Leech gems and portal, rubble, the Encased's shell, the Frost statue, goo tiles, splashes, wisps |
| slime_anchor.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_armored.png (+ .json) | 224x224, 49 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_bud.png (+ .json) | 224x256, 52 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_ceo.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_cheer.png (+ .json) | 224x192, 42 frames | an enemy's recoloured slime body (32x32 frames; 0 and 18 make its idle) |
| slime_diver.png (+ .json) | 224x256, 52 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_encased_armor.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_encased_reborn.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_frost.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_healer.png (+ .json) | 224x256, 50 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_hunter.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_hunter_frenzy.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_leech_cosmic.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_leech_fire.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_armored.png (+ .json) | 224x224, 49 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_armored_E.png (+ .json) | 224x224, 49 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_armored_N.png (+ .json) | 224x224, 49 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_armored_S.png (+ .json) | 224x224, 49 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_armored_W.png (+ .json) | 224x224, 49 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_bud.png (+ .json) | 224x256, 52 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_budcopy.png (+ .json) | 224x224, 49 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_ceo.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_conduit.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_encased.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_frostborn.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_gem.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_mortar.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_ranged.png (+ .json) | 224x256, 53 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_ripplerunner.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_singularity.png (+ .json) | 224x256, 52 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_splitter.png (+ .json) | 224x224, 48 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_tidecaller.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_voidsniper.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_berserker.png (+ .json) | 224x256, 54 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_rooter.png (+ .json) | 224x256, 53 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_sniper.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_m_slime.png (+ .json) | 224x224, 48 frames | the plain enemy slime: the red slime's own frames 0 and 18, then its bite (atk_*) and death (die_*) |
| fx_en_a.png (+ .json) | 256x23, 43 frames | the Spitter's glob, the snipers' shards and slugs, the Mortar's rock, the Rooter's vine and roots, the Healer's crosses, the Berserker's gore (named in the .json) |
| slime_m_waverider.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_m_wishingwell.png (+ .json) | 224x192, 42 frames | an enemy's own slime body (32x32 frames; 0 and 18 make its idle) |
| slime_shade_fire.png (+ .json) | 224x256, 50 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_shade_ice.png (+ .json) | 224x256, 50 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_shade_lightning.png (+ .json) | 224x256, 50 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_shade_void.png (+ .json) | 224x256, 50 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_smasher.png (+ .json) | 224x192, 42 frames | the Smasher, the Tide Mother's guard: the slime sheet in mantis-shrimp green with blue glints |
| slime_void.png (+ .json) | 64x32, 2 frames | the Void Sovereign's body (two 32x32 frames) |
| slime_volt.png (+ .json) | 64x32, 2 frames | the Voltslime's body (two 32x32 frames) |
| slime_wraith.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| slime_wraith_ghost.png (+ .json) | 224x256, 51 frames | an enemy's own slime body, typed by hand (32x32 frames; 0 and 18 make its idle, then its bite atk_*, death die_* and moves) |
| tm_bubble.png (+ .json) | 96x24, 4 frames | a cavitation bubble, wobbling (pale: tinted in game) |
| tm_bubble_s.png | 8x8 | a speck of vapour, as a bubble forms |
| tm_chain.png (+ .json) | 29x10, 4 frames | the Reservoir's binding chains, a piece per direction (e, se, sse, s; flipped for the rest), laid link by link (light grey, tinted per rune) |
| tm_club.png | 10x7 | a Smasher's club (two ride beside it and snap forward on the strike) |
| tm_statue.png | 14x19 | the Reservoir's rune statue (its rune glows in the dark recess) |
| tm_statue_broken.png | 14x19 | the same statue, broken once its rune is undone |
| tm_sym_tide.png | 16x16 | the tide rune's symbol (the other four runes use the element icons) |
| ui_fragment.png | 9x11 | an ult fragment, typed by hand (tools/uikit_bake.mjs) |
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
| shop_stall.png (+ .json) | 511x141, 45 frames | Glurp's stall, typed by hand (tools/shop_bake.mjs): awning stripes per accent + tassel, banners (27/31 wide, chosen/not, per accent), planks per thickness and wood (3-slices), bracket, strap, cobweb, turntable + its felt (grey, tinted in game) |
| shop_wall.png | 40x96 | the stall's back wall: four upright boards, tiled |
| tower_exit.png (+ .json) | 384x48, 8 frames | the Tower's way up: a stone dais between two standing stones, light spiralling into its well |
| ui_kit.png (+ .json) | 256x296, 53 frames | the UI kit, typed by hand (tools/uikit_bake.mjs): 9-slice templates (panel, button normal/hover/pushed, rune stone normal/hover, pill, reward card, boss bar: each frame's `nine` gives its pad and corner sizes; Uikit.js repeats the middle to any size) with white accent layers (`_a`, recoloured in game), the panel's mortar joint, title rule, hairline, divider diamond, rune mark, the ult and gadget sockets with their rims and glow, chain links (small at 45 and 22 degrees, big at 45) and the padlock, the back wall's bricks (5 shades x 3 cuts), the resist dome (white: tinted and added in game) |
| lift_storm.png | 48x28 | the Gauntlet's storm lift: its round deck in a copper ring, the grate glowing |
| lift_storm_cage.png | 48x60 | the storm lift's cage: two coil posts with a charge orb each, the lintel, two front bars, the front of the ring |
| cell_storm.png | 14x22 | a storm cell: a glass tube of charge between copper caps |
| coil_storm.png | 24x40 | the Coil Works' storm coil |
| vault_bars.png | 24x40 | the vault's fence of iron bars |
| vault_gate.png | 24x40 | the vault's gate: copper posts and a lock box |
| junc_i.png (+ .json) | 96x24, 4 frames | a junction box (straight), a frame per quarter turn (the pipes turn, the light doesn't) |
| junc_l.png (+ .json) | 96x24, 4 frames | a junction box (corner), a frame per quarter turn |
| junc_t.png (+ .json) | 96x24, 4 frames | a junction box (three ways), a frame per quarter turn |
| slime_riyal.png (+ .json) | 224x192, 42 frames | Riyal: the slime sheet's layout (0 and 18 drawn, the rest copies of 0), a water slime |
| ench_books.png (+ .json) | 964x249, 49 books | every enchant's book, typed by hand (tools/books_bake.mjs): one frame per book, a strip of 24x24 (8 frames with its own emblem, 4 for a plain one), named ench_book3_<rarity>_<id>; -1 sealed, 5 corrupted |
| fx_boss_door.png | 72x48 | the Void Rift's boss door: a portcullis three tiles wide with the void's seal in the middle |
| isle_link.png | 8x8 | a link of the Isle's bind/unbind chains (typed: tools/isle_bake.mjs, with the pillars and the station minis) |
| isle_lock.png | 12x12 | the padlock on those chains |
| ui_tr.png (+ .json) | 64x24, 4 frames | the Training Ground's panel (a 9-slice, 6 in) and its buttons (9-slices, 4 in: normal, hover, chosen), typed by hand (tools/uikit_bake.mjs) |
| fx_resist.png (+ .json) | 264x308, 84 frames | the resist ring under a resisting enemy, in the floor's perspective: a frame per look (one, two or three elements; grey when grounded) and step (its rune ticks lighting in turn) |
| fx_status.png (+ .json) | 60x12, 6 frames | what's on you, over your head: dripping, bleeding, poisoned, rooted, burning, hexed |
| fx_tower_chunk.png (+ .json) | 44x22, 2 frames | a slab of the Tower's floor (light, dark), falling away as you leave a floor |
| tower_shrine.png (+ .json) | 256x32, 8 frames | the Tower's shrine beside the way up: a stone pedestal, its rune lighting, a boon crystal turning over its bowl |
| gd_ground.png (+ .json) | 511x117, 132 frames | the Dust Garden's ground, which the scene lays a tile (16 px) at a time: grass (the garden's, the Grove's and three between), the cobbled path and its grass edges, a bed's tilled field, the river's banks (a strip each side, laid a column at a time), reeds, bank stones, flower clumps, the fence, the bridge (top, planks, foot); the Underwell's floor, rock, ceiling lip, stalactites and pool banks; the Cloud Sea's sky, cloud bank, its billowing top and lip, the sun |
| gd_water.png (+ .json) | 250x158, 99 frames | the live water's pieces in four waters (river, lake, the Underwell's fluid, the Cloud Sea): a ripple tile (four frames) in three depths, the foam at each bank, a wavelet, a star's twinkle, a lotus |
| gd_crystal.png (+ .json) | 512x126, 90 frames | crystal clusters in the grass, by height (8 to 36) and colour |
| gd3_kiosk.png | 80x74 | the seed kiosk (the scene writes SEEDS on its sign) |
| gd2_tree_0.png, gd2_tree_1.png | 40x48 | a tree: blue-green with fruit; green in blossom |
| gd3_ctree_0.png .. gd3_ctree_2.png | 40x52 | a crystal tree of the Grove (lilac, mint, ice) |
| gd3_well.png | 48x38 | the moonwell |
| gd3_bench.png | 32x22 | the Grove's stone bench |
| gd3_chest.png | 16x16 | the storage chest |
| gd3_dock.png | 32x70 | the Lagoon's dock |
| gd2_stone.png, gd2_runes.png | 24x34 | the waystone, and its runes alone (drawn over it, glowing) |
| gd2_lantern.png | 8x26 | a violet-flamed lantern on its post |
| gd3_menhir.png | 7x14 | one of the Grove's standing stones |
| gd2_shroom0.png .. gd2_shroom2.png | 7x6 | a glowing mushroom (mint, ice, pink) |
| gd6_pot.png | 14x9 | a potted star tree's clay pot |
| gd6_potico.png | 16x16 | a potted star tree, as an icon |
| gd6_plot.png | 48x16 | an orchard plot (tinted when overgrown) |
| gd3_mud.png | 40x22 | the Lagoon's mud patch and its sign |
| gd4_tramp.png | 32x18 | the trampoline |
| gd4_soil.png | 180x100 | a close-up of a bed's soil (the worm game's ground) |
| gd4_sickle.png, gd4_sickleicon.png | 16x16 | the sickle in hand; as a ripe bed's bubble |
| gd4_can_clay.png .. gd4_can_starwell.png | 16x16 | the watering cans: clay, copper, silver, crystal, starwell |
| gd3_rod_twig.png .. gd3_rod_voidcaster.png | 16x16 | the fishing rods: twig, willow, crystal, starweave, voidcaster |
| gd4_rake.png | 16x16 | the rake |
| gd3_fert.png | 16x16 | a sack of fertilizer |
| gd4_drop.png | 9x12 | a drop of water (a bed wants watering) |
| gd5_pack.png | 24x26 | the backpack |
| gd5_hud_book.png, gd5_hud_hammer.png | 24x24 | the garden bar's log book and build hammer |
| gd5_basketB.png, gd5_basketF.png | 96x76 | the seed basket you sow from: its handle and inside (behind you), its front |
| pipe_line_0_1.png | 72x72 | a sewer main's mouth (banded steel), pointing down; pipe_line_1_0 / _0_-1 / _-1_0 point right, up, left |
| pipe_line_1_0.png | 72x72 | a sewer main's mouth, pointing right |
| pipe_line_0_-1.png | 72x72 | a sewer main's mouth, pointing up |
| pipe_line_-1_0.png | 72x72 | a sewer main's mouth, pointing left |
| pipe_pool_0_1.png | 72x72 | a leaking valve's mouth (copper, a handwheel), pointing down |
| pipe_pool_1_0.png | 72x72 | a leaking valve's mouth, pointing right |
| pipe_pool_0_-1.png | 72x72 | a leaking valve's mouth, pointing up |
| pipe_pool_-1_0.png | 72x72 | a leaking valve's mouth, pointing left |
| st_tiles.png | 288x96 | the plain stone dungeon (Tutorial, Level 1, the Tower, Training, tower defense), typed by hand (tools/st_tiles_bake.mjs): row 0 the twelve floor slabs in the code's order, row 1 the wall top, pebbles, bones, skull, the torch sconce, the cobweb, four tiles of open rock (every level's), rows 2-3 the brick face two tiles tall, plain and cracked |
| fx_ground.png (+ .json) | 192x120, 39 frames | what lies on the floor, typed by hand (tools/ground_bake.mjs): flood water and its glints, the pool's edges and round corners, flash-freeze ice, the frost glide's slab, poison sludge, fog, the red light curtains, the crumbling floor's three states, a shot's mark on a wall per element |
| ui_hudbits.png (+ .json) | 141x15, 9 frames | the HUD card's heart (and low), the dash chevrons (ready, short, refused) and the four element icons, typed by hand (tools/hudbits_bake.mjs) |
| fx_rune.png (+ .json) | 234x23, 6 frames | the rune circle under the player, drawn lying flat at the size it's seen, six frames turning it a tick at a time (white, tinted per element; tools/rune_bake.mjs) |
| fx_smoke.png (redrawn) | 64x64 | the smoke puff typed by hand: a lumpy body, a stepped fringe, billow seams (white, tinted in game; tools/smoke_bake.mjs) |
| vfx_void.png (redrawn) | 192x192 | the menus' starfield: near-black night, faint clouds, stars placed by hand (tools/void_bake.mjs) |
| tw_picks.png (+ .json) | 272x16, 17 frames | the Tower's boons, a 16px icon each in its own colour (named by the boon's id) |
| fx_pip.png (+ .json) | 22x11, 2 frames | a boon's tier pip on the pick card: on (tinted by the boon), off |
| map_kit.png (+ .json) | 512x174, 138 frames | the world map's pieces, typed by hand (drawn 2x): the parchment's paper tiles, torn edges, corners, bites, burnt holes (each with a `_m` mask the sheet cuts away), stains and fold creases; a level's inked chamber, its medal per level and sealed, its lock-on ring; the road's strokes per heading and the sea lane's, footprints; label paper (nine-sliced), nails and tears, the compass, the cleared tick, the corner's scrawls, the Training Ground, the Enchanter's Isle (tools/map_bake.mjs, map_art.mjs) |
| mn_lv0-6.png, mn_lv9.png (redrawn) | 132x32 | the level paintings on the map's plaque and the loading card, laid from typed pieces where the old painter put each thing (tools/cards_bake.mjs, cards_art.mjs) |
| mn_card_rule.png | 141x5 | the gold rule under a level's name on the loading card (2x) |
| ui_bootbar.png, ui_bootfill.png | 5x7, 1x5 | the boot screen's loading bar: its frame (nine-sliced) and a column of its fill (2x) |
| map_vig_*.png, map_decor_*.png (redrawn) | as before | the map's vignettes and small details as typed rows: traced onto palettes picked by hand and retouched, the storm redrawn, the same silhouettes (tools/vig_bake.mjs, vig_art.mjs) |
| gd_crops.png (+ .json) | 1022x2045, 1931 frames | the garden's seeds (seed_<id>, 7x5), the orchard's fruit (fruit_<tree>, 16x16) and the crops' growth sheets (<id>_<stage>[b]_<frame>, 32x32, 6 frames; b: standing bare in a tilled field): every crop's every stage (the two feat seeds grow as the Dust Sprout) |
| gd_gull_2.png (+ .json) | 24x12, 2 frames | a gull far off over the Cloud Sea (wings up, wings down) |
| isle_land_disc.png | 210x170 | the Isle's grass and rivers with grass under the dais: what turns (typed tiles laid in the island's outline: tools/isle_land_bake.mjs, which also makes isle_land_top and isle_land_dais) |
| map_kit.png (more frames) | 512x176 | also: an achievement's star per tier (star_1-3), the toast's medal per tier (toast_1-3), a gadget socket and its ring (sock, sock_ring, tinted), the settings' volume pips (pip_on, pip_off, nine-sliced) |
| map_vig_*.png (redrawn again) | as before | the six scenes besides the storm redrawn by hand over the old outlines: flat tones, lit and shaded sides, coursed bricks, banded water; frames are the scene's poses |
| mn_sea_whale/squid/angler/fish/manta/jelly.png (redrawn) | as before | the deep's silhouettes under the Cistern, typed over the old outlines (tools/cards_art.mjs) |
| sky_storm_px.png | 128x128 | the Gauntlet roof's storm cloud: puffs typed by hand, tiling every way, shown at the old 256 tile's size (sky_storm.png is no longer used) |
| mt_wall, mt_glass, mt_mirror, mt_broken, mt_mark_m, mt_mark_g, mt_shard, mt_charge, mt_arm, mt_glorp, mt_pickup, mt_sentry, mt_decoy, mt_items (redrawn) | as before | the Hall of Reflections typed by hand: coursed bricks with lit tops and a crack, the panes' frames bevelled, frost in the mirror's corners, chalk that skips, the shard's second face and glint, the vials, the arm, the things on the floor and the slimes shaded in clean bands with stamped eyes; same sizes and shapes (tools/hall_bake.mjs) |
| fx_rt_top, fx_rt_face, fx_rt_badge, fx_rt_key (redrawn) | as before | the rhythm run typed by hand: the slab's top with a lit lip and a crack, its cut face in courses over strata and a crystal, the dash badge's bevelled rim, the keycap's bevel; same sizes and shapes (tools/rt_bake.mjs) |
| mt_prank_eyes, mt_prank_eyes_half, mt_prank_eyes_shut (redrawn) | as before | lights out, typed by hand as runs: each eye an egg outlined dark (heavier on its shadow side), the brow's shade and the light from below as crescents over the white, a pinprick pupil with a glint, the socket's dim rim and halo in clean bands; half: the lid's edge dipping in the middle with its lashes and their shadow; shut: the closed lashes a pale curve (tools/hall_bake.mjs, hall_pranks.mjs) |
| tut_rift_rim.png | 72x44 | the tutorial pit's rim: broken flagstones round the hole lit from the top left, the far wall going down into violet light, the near edge a dark lip, violet cracks running out across the floor (typed: tools/props_bake.mjs pit) |
| tut_rift_core.png (+ .json) | 70x42 x 8 | the tutorial pit's vortex as it lies on the floor: a dark bowl, a black heart, three arms of light from lavender to violet; 15 degrees a frame (frames 4-7 are 0-3 turned half round), played as tut_rift_spin (typed: tools/props_bake.mjs pit) |
| fx_geode_ring.png (+ .json) | 64x64 x 4 | the Geode's shell blast (it rises, its heart is laid bare, it hops): a ring of light opening to radius 9, 18, 24, 30, shown at twice its pixels, white-hot then cooling to orange and red and breaking up; a quarter typed and laid four ways, its breaks and sparks typed (tools/props_bake.mjs geode; BossFX.geodeBlast) |
| td_towers.png (+ .json) | 491x193, 44 frames | Tower Defense's towers, typed by hand (tools/td_bake.mjs): plate_<type> (20x20 iron plate, its rim in the tower's colour), sky_plate (70x70, the Skyward's 3x3 base), stud (an upgrade bought), and each body on a 40x40 frame centred on the tile: tesla_0-3 (the ring's spark going round), sniper_0-7 / mg_0-7 / cannon_0-7 (N, NE, E ... NW: the turret turns by frames), magnet, healer, fountain_0-2, sky |
| td_fx.png (+ .json) | 501x690, 89 frames | Tower Defense's shots: cannon shells (shell_8/10), bouncing shells spinning (roll_8/10/b_0-3), the bowling ball rolling (bowl_0-3) and its grind (grind_<8 ways>), shade_s/l, the catapult shell and shot, the shotgun's pellets, the magnetizer's orb, the Skyward's shells, an ice spark, and blasts built from typed fire puffs: blast_<o/g/r/m/v/p/t>_0-3 (96x96, shown at the blast's radius) and pop_<o/g/r/m/v/p/t>_0-2 (32x32, the small ones; v/p/t: the void, life and poison wisps') |
| fx_crest.png (+ .json) | disc 48x48, dial 64x64 x 9, star 15x15 (each for fire, ice, lightning, cosmic, plain) | the level-clear crest: a dark disc warming to its middle in a bright rim of the element's colour with a gleam at its upper left (its glyph is ui_hudbits el_<element>, or the gold star for a plain clear), and its dial, a thin ring of 36 ticks with four pointers whose ticks light one after another round it (frames) where it used to turn; quarters typed, laid four ways (tools/props_bake.mjs crest) |
| td_room.png (+ .json) | 481x131, 14 frames | Tower Defense's room, typed by hand (tools/td_bake.mjs): core (120x96, the stepped altar laid from typed flagstones with lit rims, four pillars, two runes, the crystal in its housing; its glow is light), portal_0-3 (40x40, a spawn portal, four arms of light turning), tv (56x62, the wave TV) and tvscr_0-6 (its screen, a band rolling down), table (64x34, Glurp's table with a coin, a gem and an apple) |
| isle_sky.png | 320x133 | the Enchanter's Isle's night, typed by hand (tools/isle_room_bake.mjs): four bands of sky stepping into each other through a hand-set dither, clouds lit from above, stars; tiled across at 4x, its last row on the horizon |
| isle_sea.png | 320x72 | the Isle's sea: rows of swell from the horizon toward you (thin far off, broad near), each a typed strip in its distance's colours; tiled across at 4x, its top on the horizon (the first 47 rows reach a 720-high screen's foot) |
| isle_moon.png, isle_moonpath.png | 15x15, 48x72 | the Isle's moon (lit face, limb, craters) and its road of glints on the swells' faces, widening toward you |
| isle_room_bind/reforge/combine/reseal.png | 320x180 each | each Isle room's ground at 4x: the night over the far rim and its crystal spires, the grass in four typed bands, the flagstone oval round the altar, and the room's own pieces where they always stood (the Binding Ring's four standing stones and the ring inlaid in the flags; the Crucible's broken wall and column; the Twin Pools' columns, pools and gold channels; the Chain Shrine's arch, rubble and candles, in a darker, colder ground) |
| isle_altar_bind/reforge/combine/reseal.png | 48x40, 56x40, 96x36, 40x50 | each room's altar (drawn 3x): the runed plinth, the verdigris crucible on its stone legs, the dais with its gold-capped pedestals, the chained lectern |
| isle_crystal.png (+ .json) | 9 frames ('26_1', '30_2', ... the old h_seed) | the Crucible's crystal clusters, one per spot round it, each its old size |
| isle_ui.png (+ .json) | 35 frames | the Isle's frames, nine-sliced at 2x: rounded fills (white, tinted in game) and rims (greys, tinted) for the picker, the codex (panel, page, tabs, cards, readout) and the reveal cards (plain and lit), a shelf plank and a rule; the satchel per station (sat_top/bot/l/lb/r/rb/lea_<bind/combine/reseal>: its arched mouth, scalloped stitched flap and buckle, sagging stitched bottom, sides tiled down and bowing a pixel out through the middle, leather between) |
| td_wisps.png (+ .json) | 505x225, 175 frames | Tower Defense's wisps, typed by hand (tools/td_wisps_bake.mjs): each body on a frame whose middle is the wisp: light_0-3 (five rays turning), ice, boom_0-3 (spikes turning), void_0-7 (the accretion arc going round), poison_0-3 (bubbles rising), fire_0-2 / fire_m_0-1 / fire_l_0-1 (calm, ramping, ramped flames), fire_pur_0-1 (its purple sun), fire_mul_0-1, fist_0-3 / fist_hit_0-1, phantom_0-3 (the hem rippling), star + ball_0-2 + ball_tr (the Skyward and its shells), life + life_glow + life_ring_0-3 + life_spark; <body>_dim (tired, greyed); fly, trail, to_sleep, sleep_0-1 / sleep_lock_0-1, rest_<type>, bed_<type> (31x20), bedring (white, tinted to the bed's state), muted; and what they throw and leave: sky_ball + scorch, vbolt, lorb, voidlet_0-1 + vmote, barf, ptile + pbub_0-3 (a poison pool and its bubbles), bap / ko (the fist's hits), bomb_0-1 (the boom mark), brittle, shatter, cloud_s/m/l (the phantom's thump ring is laid from these), pud_0-2 / pud_ice (puddle and ice-sheet tiles) and their edges pe_/pi_ n/s/w/e; frozen_0-3 (a frozen enemy's frost, spokes turning), tongue_s/m/l + brand_mark (the light brand's flames and stars); and Tower Defense's own marks: st_<status> (17x17 status icons over a unit; st_stun_0-2, st_atkslow_0-3 animate), orb_s / orb_l / orb_m (scrap), gb_0-1 + gbul_w / gbul_d (the Ghost Buster's ghost and shots), heal_cross, bang (the bomber's alert) |
| gd_trees.png (+ .json) | 968x1139, 336 frames | the orchard's fourteen trees, typed by hand (tools/trees_bake.mjs): <tree>_<stage>_<frame>, 56x56, 6 frames a stage (0 the sapling, 1 young, 2 grown, 3 bearing its fruit), the trunk's foot at (28, 53) |
| gd_catch.png (+ .json) | the garden's catchables, typed by hand (tools/catch_bake.mjs): fish_<id>_<frame>, 32x32, facing left, 8 frames swimming (6 for one drawn whole: an eel, a jelly, a ray) |
| td_foes.png (+ .json) | 503x195, 72 frames | Tower Defense's own foes' marks, typed by hand (tools/td_foes_bake.mjs): horns (the demon's), dp_0-2 (its hell portal opening: quarter, half, full) + dpe_0-3 (the embers circling it, 15 degrees a frame), arrow_v / arrow_r (over it underground; red when it's about to rise), pfire_0-3 (purple fire licking a tower); the angel's ashadow, wing_l / wing_r, halo and hplus (heal motes); arc_0-23 (37x37 portal arc, the portal bringer's outer ring and the mini-portal's) and sarc_0-23 (the bringer's inner arc): one ring typed with each pixel's 15-degree sector as its letter, a frame per palette that lights the arc's sectors; pbcore_p / pbcore_v (the bringer's heart: anchored, travelling), mglow + mcore (the mini-portal's glow and heart), ceobox (the CEO's hit box) |
| td_ui.png (+ .json) | 245x69, 37 frames | Tower Defense's menu icons, typed by hand (tools/td_ui_bake.mjs), in place of the emoji they had (13x13 unless noted): scrap (the gear), base, enemy, skull (the top bar), zzz (9x7, the wisp quarters' sign), shard (9x9, mastery); the shop's wrench, bounce, target, bolt, star, diamond, dizzy, dish, watch, storm, pill, shield, nut, flame, bag, magnet, chain, up, swirl; gravity and wave (the magnetizer's modes); pip (7x7, white, tinted: a tier pip); spikes (41x41, white, tinted: a skill-tree capstone's, round a ui_kit sock_ult_big); t_<tower> (the build menu's tower pictures, shown at 2x in a ui_kit pill slot) |
| gd_catch.png (+ .json) | 1022x395, 344 frames | all fifty fish now typed (tools/catch_bake.mjs), the code painters gone: besides the 27 of the usual shape, the ones drawn whole, 6 frames each: the ember loach, halo eel, rift wyrm and storm eel winding (column by column, the head bobbing less), the puffglow breathing in and out (spines out when it's big), the angler's lure bobbing, the seahorse's fin rippling, the moss turtle paddling, the mudskipper hopping with its eyes rolling, the crawdad's claws snapping, the sky and star whale calves (one drawing, two colourings), the starmote's points turning (four drawn, the rest those turned and mirrored), the nebulite, comet squid, and the Cloud Sea's puffwisp, dewguppy, moon moth, thunderjelly (its bolts flickering), the winged three (breezefin, sunskipper, prismtrout: one fan of feathers beating) and the sunrise koi |
| gd_catch.png (+ .json) | 1022x428, 384 frames | the garden's worms and pets are in it too (tools/catch_bake.mjs), 32x32, 4 frames, their code painters gone: worm_<id>_<frame> (rot worm, grub borer, earthworm, glowworm, starworm, rift worm: each poking out of its hole and swaying, its head held whole), pet_<id>_<frame> (moth sprite opening and folding its wings, glimmerfox swishing its tail, puddlewyrm flapping, star owl blinking) |
| gd3_stardrop.png | 7x7 | the Starfall Grove's secret seed, typed by hand (tools/garden_ui_bake.mjs): a four-point star, a white heart, gold down its arms |
| gd3_drift_dust.png, gd3_drift_fert.png | 8x8 each | what drifts down the river to scoop (tools/garden_ui_bake.mjs): a mote of dust, a little sack of fertiliser with a sprout |
| isle_fx.png (+ .json) | 255x85, 351 frames | the Isle's moving bits and the satchel's small pieces, typed by hand (tools/isle_fx_bake.mjs): spark0-3 (a twinkle, white, tinted), fly0-3 (a firefly), flame0-3 (a candle's flame over the Chain Shrine's candles), rip0-3 (a ripple on the Twin Pools), glint (light down their gold channels), link_d/link_e (a chain link on the diagonal, face and edge on), tab_on/tab_off (the element bookmarks, grey, tinted), stand/stand_on (a weapon's stone stand), sock/sock_x (a rune socket, and one past what the weapon holds), pip, arrow (over the crucible), post (a shelf upright), cstrip (a station card's colour strip), csh_s/m/l (the crystals' shadows), chip0-3 (broken stone round their feet), tf_<room>_<x>_<y>_<0-2> (each room's grass tufts leaning left, still and right, cut from the room's own pixels) |
| gd6_tank_river/lake/cosmic_back.png, _front.png | 48x46 (the pool 48x32) | the garden's three aquariums, typed by hand (tools/tanks_bake.mjs), in two layers round the fish: river (clear water, slanting light, gravel, stones, a driftwood arch; the oak frame with brass corners and the carved cabinet), lake (teal water, silt, crystal shards, an open clam and its pearl; the iron frame with patina, lily pads in flower, the stone plinth), the Underwell pool (the cave-rock ring, the violet fluid turning round its core, crystals on the rim; its near lip over the fish) |
| gd_ui.png (+ .json) | 507x195, 79 frames | the Dust Garden's own UI, typed by hand (tools/gd_ui_bake.mjs), mostly drawn 2x: the diary's pieces that GardenScene._diaryTex lays at half size, repeated, never stretched (cv_fill0-3 leather, cv_t/b/l/r its rim with the tooled gold lines, cv_tl/tr/bl/br the brass corners, cv_emb the gold emblem with its sprig; pg_fill0-3 paper, pg_t/b/l/r + corners its aged edges, pg_gutL/R the gutter's shade, pg_hi the light where it bows, pg_rule, pg_margin, pg_fox0-2 foxing, pg_dipTL/TR/BL/BR its dip into the spine, magenta = cut away; cd_* a specimen card), spine/hband/curl (the spine, its headbands, a page corner curling), the page turn's paper and leather (read from cv_fill0/pg_fill0), the bottom bar's buttons (bar_s, bar_l, _on lit), a hand's slot (slot, slot_on) and its little tank (slotw_river/lake/mud/cosmic), the backpack's item discs (disc, disc_hov, disc_on) and close button (xbtn), the ribbon bookmarks (rib_<chapter>, rib_<chapter>_on) and the Wardrobe's top hat (rib_hat) |
| slime_diver.png (+ .json), fx_enemies_b.png (+ .json) | 224x320, 64 frames; 256x89, 61 frames | (2026-10-29) the Torpedo Diver as a water-gun sniper (tools/enemies_b_bake.mjs): its rifle held low on 0/18, aim_0-3 (raising it, aiming one eye shut, steadying), fire_0-1 (the kick), empty_0-1 (a dry click), refill_0-1 (bubbles off its tank), tank_0-4 (the tank on its back, laid behind the body by the game, its window showing the shots left); the old dive_/zip_ frames are gone. fx_enemies_b adds jet_e/ne/s/se (its slug of water) mz_0-2 (the spray out of its nozzle) and drain_0-2 (a ripple on a water tile it has drunk dry); splash_0-3 now burst where a slug lands |
| ui_ban.png (+ .json) | 31x15, 2 frames | the red ban sign the HUD lays over a locked action's piece (HUD.lockActions: the dash chevrons, the element, each ult gem, the gadget sockets), typed by hand (tools/ban_bake.mjs): ban (a red ring and its slash, lit upper left, a dark rim inside and out, its gaps dimmed), ban_hot (brighter: the flash when a locked key is pressed); 1x on the status card, 2x over the gems and sockets |
| slime_m_blinder.png (+ .json) | 224x256, 54 frames | (2026-10-29) the Blinder's own slime body, typed by hand (tools/blinder_bake.mjs; 32x32 frames; 0 and 18 make its idle): murky violet smoke lit from the top left, a current of paler smoke in its foot, a wisp curling off its crown; atk_0-2 (its bite), puff_0-2 (the tell: swelling up, eyes screwed shut, haze leaking out of its crown and sides), throw_0-2 (the haze heaved out of its front, then slack), die_0-2 |
| fx_blinder.png (+ .json) | 248x22, 14 frames | (2026-10-29) what the Blinder throws, typed by hand (tools/blinder_bake.mjs): haze_0-3 (the rolling bank of haze, its billows lit along their tops, moving on round it), wisp_0-2 (a puff of it: leaking, trailing, thinning), mist_0-2 (the thin, low, fainter band of haze it leaves lying along its way), glint_0-2 (its eyes glinting in the dark before it lunges, laid over its own eyes), blind (the icon over your head while you're nearsighted, in the row beside fx_status's) |
| fx_sniper.png (+ .json) | 117x27, 14 frames | (2026-10-29) the Sniper's own pieces, typed by hand (tools/sniper_bake.mjs): slug_e/ne/s/se (its heavy brass ricochet round, white-hot at the nose, a short amber streak behind; flipped for the other four ways), spark_0-2 (the slug glancing off a wall: a white flash, brass sparks thrown off, the last specks), glint_0-2 (its scope catching the light: the tell before a shot), puff_0-3 (its blink: a puff of its hood's violet smoke opening into a ring and thinning out) |
| fx_winded.png (+ .json) | 20x12, 3 frames | (2026-10-29) WINDED, typed by hand (tools/blinder_bake.mjs): crack_0-1 (cracks laid across the stamina bar while it can't refill), winded (its icon in the row over your head: your dash chevrons gone grey, the front one cracked) |
| slime_m_sniper.png (+ .json) | (unchanged size) | (2026-10-29) the Bankshot's (the Sniper's) eyes recoloured from the Void Sniper's pink to its scope's gold on every typed frame (tools/enemies_a_bake.mjs, its 'w'); the game's face over 0/18 takes the same gold (Creatures.js) |
| fx_fractal.png (+ .json) | 377x20, 29 frames | (2026-10-29) frames added to the Fractal Shard's sheet (tools/fractal_bake.mjs): haze_0-5 (frost with no outline, white thinning to its edge, tinted cyan to deep blue in the game: the Fractal Shard's and Icicle Cannon's trails and bursts, the Fractal Bloom's shatter cloud, the ice chips' cloud; where they crowd they run together), glass_0-2 (crystal_0-2 with no outline or shadow: the Bloom's crystal along its arms, the outlined crystal only at its knots) |
| ui_bounty.png (+ .json) | 113x38, 9 frames | (2026-10-29) the bounties, typed by hand (tools/bounty_bake.mjs), drawn 2x: note (the bounty mark: a notice nailed up, its paper curling, a red wax seal pressed on it), toast_1-3 (the pop-up's medal per tier: the achievements' ring in bronze, silver, gold, the note in its well), k_react / k_skill / k_place (a card's kind: fire meeting ice with a crackle down the seam, an iron shield with a brass boss, a swallowtail pennant; a weapon's card shows the weapon's icon), sc_board (the map's doodle in the corner scrawls' ink: a notice board on two posts, three papers pinned to it), sc_new (a red-ink ! by it when a new bounty has gone up) |
| fx_fractal.png (+ .json) | 1480x32, 89 frames | (2026-10-29) the Fractal Bloom's shatter, typed by hand (tools/fractal_bake.mjs): chunk_0-3 (a big chunk of outlined crystal tumbling, lit from the top left, a bright ridge between its faces: thrown out from the knots), crack_e / crack_ne (a crack of light through the floor, no outline, white at its root and bluer to its forked tips; crack_s / crack_se those turned a quarter, the other four ways flipped both ways in the game) |
| gd_ui.png (+ .json) | (unchanged size) | (2026-10-29) the diary's leather and paper tiles softened (tools/gd_ui_bake.mjs): closer tones, fewer grain pits and paper flecks, fainter foxing (the game also shifts each row of tiles its own way, so they never read as a grid) |
| tr_cursor.png | 24x24 | (2026-10-29) the Training Ground's tile marker, typed by hand (tools/tr_cursor_bake.mjs): four white corner brackets edged dark on their insides, a faint line between them; tinted the brush's way under the pointer while a brush or PLACE is picked |
| mn_icon_pendulum.png (+ .json) | 104x26, 4 frames | (2026-10-29) the Pendulum's shop icon and the one at your shoulder, typed by hand (tools/pendulum_bake.mjs): the Reliquary, a crescent-moon hanger, a twisted gilded rod and a collar over an orb of violet crystal caged in gold bars (a gold band, a cup, stars inside, a gem at its heart); it sways a pixel each way, white sparkles twinkling round it as round the other cosmic weapons |
| fx_pendulum.png (+ .json) | 159x235, 32 frames | (2026-10-29) the Pendulum's pieces, typed by hand (tools/pendulum_bake.mjs), the Reliquary's look: i_pendulum (its icon in the cosmic tray), fly_0..15 (thrown, small, its orb whirling on its chain round the ring you hold it by, sixteen ways: three laid out, the rest flipped across the diagonal and the axes), grow_0, grow_1 and hang_0..4 (the same reliquary typed bigger as it rises over the spot, then big, hanging over the field: a crescent hanger, a twisted rod, a 23px caged orb; each of its five swings drawn afresh, never mirrored, so the light stays on its upper left), tile_0 (a tile of Time Lock on the floor, no outline, flipped at random in the game), edge_n/s/w/e (the field's edge: n typed, the rest flipped and turned a quarter), rw_ring (Rewind's ring, a quarter typed and flipped; thrown wide when the pendulum lands and when the field lets go), tmark_0/1 (the crescent and stopped clock over an enemy held in a Time Lock, its hand twitching a pixel) |
| shop_g2_bell.png (+ .json) | 96x24, 4 frames | (2026-10-29) the Cleansing Bell, typed by hand (tools/pendulum_bake.mjs): a bronze hand bell on a wooden handle, its iron clapper striking one side, ringing, then the other; rings of clean air off it with no outline (the bell over your head when it's rung, too) |
| fx_fractal.png (+ .json) | 1480x32, 89 frames | (2026-10-29) frames added to the Fractal Shard's sheet (tools/fractal_bake.mjs): br0_0-15, br1_0-15, br2_0-15 (the branching spikes: the heavy crystal 24x24, a branch 16x16, a twig 12x12, each 16 ways, br<size>_<k> k sixteenths of a turn clockwise from east; typed east, 22.5 and 45 degrees, the rest those mirrored on the diagonal or turned by quarters pixel for pixel, the side facing the top left lit), brk_0-3 (the crack of light where a spike splits, 17x17, no outline) |
| isle2_night.png | 428x240 | (2026-10-29) the Enchanter's Isle's night, second look, typed by hand (tools/isle2_bake.mjs), at 3x: sky steps through a hand-set dither, a band of soft veil pieces (no edge, they fuse) with its star dust, far islands adrift, a wall of cloud on the horizon lit only where the whole mass faces the moon, the moon (warm top left, cool lower right, three craters), stacks on the horizon, the sea's steps with its crests and the moon's road |
| isle2_clouds.png (+ .json) | 284x13, 7 frames | (2026-10-29) the night's clouds that drift (tools/isle2_bake.mjs): bank/mid/wisp in the far, mid and near palettes (lit tops, no rim, the underside breaking up) |
| isle2_rock.png (+ .json) | 628x587, 4 frames | (2026-10-29) the island's rock all round it, unrolled (tools/isle2_bake.mjs): lit, mid, dark, deep (the same band in each light): the turf's lip, strata parted by uneven seams, boulders, roots, vines, crystals and seeps laid in by hand; the game sweeps it round the island's hand-picked rim and teeth as it turns |
| isle2_isle.png (+ .json) | 512x284, 36 frames | (2026-10-29) what's on the island (tools/isle2_bake.mjs): bind_0-5 (the Binding Ring: a monolith under a rune-orb, its ring of stones lighting in turn), reforge_0-3 (the Crucible between two crystal spires, bubbling under its vapour), combine_0-1 (the Twin Pools under a gold arch), reseal_0-3 (the Chain Shrine: a roofed gate, its bell swinging, blue lanterns, candles), garden_0-2 (the Dust Garden's crystal tree over its bed), dais, bit_tuft/tuft2/flower/stone/bush, float_a/b/c (rocks adrift), shadow_s/m/l, fall_0-3 (a waterfall, no rim, thinning into mist), top (the island's top at rest, 232x200) |
| isle2_ui.png (+ .json) | 252x65, 22 frames | (2026-10-29) the Isle's board, typed by hand (tools/isle2_bake.mjs), nine-sliced at 2x: board (deep indigo bound in gold, 16 corners), board_s / board_d (small ones, 8 corners), rim_s (a white rim to tint), inset (the bookcase's recess), rib (the name ribbon, grey, tinted), tab_fill / tab_rim / gem (a gem tab), plinth, socket / socket_x (a ring of rune stones; one chained past what the weapon holds), plank, bracket, btn_fill / btn_rim (a button's face, tinted, and its gold rim), rule, jewel, crest, strip, plate_fill / plate_rim (a place's name plate) |
| isle2_fx.png (+ .json) | 256x616, 16 frames | (2026-10-29) the Isle's effects (tools/isle2_bake.mjs): wipe_near / wipe_far (200x250 each: the cloud walls that close over the window going into a room and out, each one fused mass with a few soft swells of tone, its edge typed round lumps meeting in clefts, the near one's rim crisp and lit, the far one's dithered away; flipped for the right side), ring0-3 (a ring wave, white, tinted; a quarter typed and flipped, four sizes), glyph0-5 (runes), circle (the summoning circle on the floor, flat 3 to 1, rune notches round it), cw0-2 (cloud pieces) |
| isle2_tufts.png (+ .json) | 512x19, 315 frames | (2026-10-29) each room's swaying tufts (isle_fx's tf_<room>_<x>_<y>_<0-2>) on the rooms' new colours |
| isle2_room_bind/reforge/combine/reseal.png | 320x180 each | (2026-10-29) each Isle room re-lit for the new night (tools/isle2_bake.mjs): its old sky taken out and isle2_night's horizon put behind it, its turf and stone moved onto the island's turf and stone ramps by brightness (the turf darkening toward you and the sides through a dither), every glow, rune, water and flame kept |
| isle2_altar_bind/reforge/combine/reseal.png | (the old sizes) | (2026-10-29) each room's altar on the island's stone ramp, its moss on the turf's; its dark rim kept only below and to the left, the moon's rim above and to the right |
| (isle2_room_*, polished) | | (2026-10-29) the same shapes drawn again (tools/isle2_bake.mjs roomPolish): the floors laid as slabs of their own sizes (typed as regions) with a lit far rim, a face toward you and its shadow on the turf; the ruins in courses of uneven, chipped blocks lit through a dither, outlined only away from the moon and rimmed toward it; the standing stones, rubble, ivy, cracks, runes and candles from their own typed rows on the new ramps, the stones lit as one; soft shadows where things meet the ground; the Crucible's runic channels cut into its flags |
| isle2_cumulus.png (+ .json) | 1023x(see json), 48 frames | (2026-10-29) the cloud cover going in and out of the Isle's rooms (tools/isle2_bake.mjs clouds2): eight cumulus (L1 L2 long, M1 M2, S1 S2 small, T1 T2 towers) at three depths (far paler, mid, near a touch darker), each with a billow frame (<shape>_<depth>_<0-1>); every cloud one volume of hand-typed lumps lit as a whole (near-white lavender tops, lit folds where a lower lump crosses the one behind, violet underside breaking into small rounded lobes), no outline, no straight run over 6 px on any edge |
| isle2_roomfx.png (+ .json) | 389x104, 8 frames | (2026-10-29) ringlit_0-7: the Binding Ring's inlaid circle in eight arcs, each lit (the game lights them in turn round the ring) |
| ui_bounty_paper.png (+ .json) | 511x262, 50 frames | (2026-10-29) the bounty board, typed by hand (tools/bounty_paper_bake.mjs, its cards from tools/bounty_notice_plain.mjs), drawn 2x: nt_plain (the notice: one plain card for every bounty, light parchment, a faint darkening at its edges, its shadow), nt_win (the same card for the win screen), sp_line / sp_pop / sp_list (the scroll's paper: the line under the run clock, the pop-up, the pause menu's list), rl_top / rl_bot / rl_0-2 (a scroll's roll: its rod's knob, its body turning as it unrolls), wd_0-1, wt / wb / wl / wr, wc_tl/tr/bl/br, plq_l/m/r (the wooden board, its frame and nameplate), nail, tack, seal_1-3 (the wax seal per tier: bronze, silver, gold), st_glorp, st_book (the reward's ink stamps), bar_l/m/r, bar_f (the hand-ruled box for the count and its ink), quill (the reroll), done_0 / done_1 (+ _u / _d leaned) (the COMPLETE stamp, wet then dry, crooked), cr_a, cr_b, ball_0-2 (a finished notice crumpling, the ball turning as it's tossed) |
