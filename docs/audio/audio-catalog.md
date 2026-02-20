# 音效语义目录

> 自动生成。`node scripts/audio/generate_audio_catalog.js`
> 10298 条 → 597 组

## 查找流程

1. 搜索本文件的场景关键词（negative/click/sword/heal/alert/shield 等）
2. 找到组后，用 grep 模式在 registry.json 中搜索获取完整 key
3. 变体：末尾 `_01`→`_02` / `_a`→`_b`
4. 试听：`AudioManager.play('key')`

## 概览

| 分类 | 组 | 条 | 说明 |
|------|----|----|------|
| ambient | 10 | 455 | 环境（生存/制作/拾取/家具） |
| bgm | 13 | 350 | BGM（空灵/奇幻/放克/休闲） |
| card | 10 | 111 | 卡牌（翻/洗/抽/放/魔法牌） |
| coins | 8 | 33 | 金币（掉落/奖励/收集） |
| combat | 52 | 1104 | 战斗（剑/斧/拳/弓/盾/爆炸） |
| cyberpunk | 19 | 357 | 赛博朋克（科幻UI/武器） |
| dark_fantasy_studio | 64 | 2961 | ⚠️ **低质量系列**：整体音质偏低，除非语义高度匹配（zombie_voices/ghostly/smashed/riser_impact/steam）否则不考虑使用 |
| dice | 6 | 29 | 骰子（投掷/碰撞/滚动） |
| fantasy | 80 | 530 | 奇幻（弓箭/盾/治疗/火焰） |
| magic | 159 | 1737 | 魔法（施法/元素/光暗/召唤） |
| misc | 1 | 3 | 杂项 |
| monster | 69 | 896 | 怪物（咆哮/攻击/死亡） |
| puzzle | 27 | 148 | 休闲（提示/成功/失败/弹出） |
| status | 21 | 352 | 状态（buff/debuff/治疗/中毒） |
| steampunk | 6 | 194 | 蒸汽朋克（齿轮/蒸汽） |
| stinger | 8 | 22 | 过场（胜利/失败） |
| system | 8 | 174 | 系统（移动/通知/庆祝） |
| token | 8 | 35 | Token（放置/拾取） |
| ui | 28 | 807 | UI（点击/弹窗/通知/信号） |

## ambient

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| character | 16 | `ambient.*character` | character_drink, character_eat, character_... |
| construction | 41 | `ambient.*construction` | build_object, demolition_metal_object, dem... |
| crafting | 66 | `ambient.*crafting` | craft_neutral_material, crafting_food, cra... |
| enviroment | 25 | `ambient.*enviroment` | bonfire, break_rock, broken_box, close_med... |
| home | 59 | `ambient.*home` | chest, close_chest, close_metal_door, clos... |
| inventory | 72 | `ambient.*inventory` | close_inventory, drop_metal_from_inventory... |
| items | 61 | `ambient.*items` | axe, axe_hit_stone, axe_hit_wood, axe_whoo... |
| pick_up_items | 23 | `ambient.*pick_up_items` | pick_up_can, pick_up_cloth, pick_up_matchb... |
| pick_up_materials | 65 | `ambient.*pick_up_materials` | pick_up_dry_wood_stick, pick_up_meat, pick... |
| weapons | 27 | `ambient.*weapons` | attack_metal_spear, attack_wood_spear, bow... |

## bgm

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| bubblegum_rt | 5 | `bgm.*bubblegum_rt` | casual_bubblegum, casual_bubblegum_cut, ca... |
| dance_class_rt | 5 | `bgm.*dance_class_rt` | casual_dance_class, casual_dance_class_cut... |
| ethereal | 50 | `bgm.*ethereal` | cloud_cathedral_rt, enigmatic_badger_rt, e... |
| fantasy | 200 | `bgm.*fantasy` | a_witch_rt, above_rt, black_doves_rt, cabi... |
| field_day_rt | 5 | `bgm.*field_day_rt` | casual_field_day, casual_field_day_cut, ca... |
| funk | 50 | `bgm.*funk` | big_shot_rt, dream_machine_rt, funk_big_sh... |
| lizards_rt | 5 | `bgm.*lizards_rt` | casual_lizards, casual_lizards_cut, casual... |
| observatory_rt | 5 | `bgm.*observatory_rt` | casual_observatory, casual_observatory_cut... |
| pony_ride_rt | 5 | `bgm.*pony_ride_rt` | casual_pony_ride, casual_pony_ride_cut, ca... |
| shopping_rt | 5 | `bgm.*shopping_rt` | casual_shopping, casual_shopping_cut, casu... |
| sunset_rt | 5 | `bgm.*sunset_rt` | casual_sunset, casual_sunset_cut, casual_s... |
| tiki_party_rt | 5 | `bgm.*tiki_party_rt` | casual_tiki_party, casual_tiki_party_cut, ... |
| workshop_rt | 5 | `bgm.*workshop_rt` | casual_workshop, casual_workshop_cut, casu... |

## card

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| fx_boost | 4 | `card.*fx_boost` |  |
| fx_deck_reassemble | 4 | `card.*fx_deck_reassemble` |  |
| fx_discard | 4 | `card.*fx_discard` |  |
| fx_discard_for_gold | 4 | `card.*fx_discard_for_gold` |  |
| fx_dispel | 4 | `card.*fx_dispel` |  |
| fx_flying_cards | 4 | `card.*fx_flying_cards` |  |
| fx_magic_deck | 4 | `card.*fx_magic_deck` |  |
| handling | 70 | `card.*handling` | backgammon, card, card_box_handling, card_... |
| looped | 8 | `card.*looped` | fx_counter_cards, fx_counter_crystals, fx_... |
| loops | 5 | `card.*loops` | abstract_drone_bellish, abstract_drone_cha... |

## coins

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| bet_placed | 5 | `coins.*bet_placed` |  |
| big_coin_drop | 5 | `coins.*big_coin_drop` |  |
| fair_reward | 4 | `coins.*fair_reward` |  |
| gold_pouch_handle | 4 | `coins.*gold_pouch_handle` |  |
| small_coin_drop | 4 | `coins.*small_coin_drop` |  |
| small_coin_drop_long | 1 | `coins.*small_coin_drop_long` |  |
| small_reward | 5 | `coins.*small_reward` |  |
| treasure_box | 5 | `coins.*treasure_box` |  |

## combat

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| blood | 5 | `combat.*blood` | goreblood_blood |
| body_falls | 21 | `combat.*body_falls` | fghtbf_body_fall, fghtbf_body_fall_with_blood |
| body_hit | 22 | `combat.*body_hit` | sfx_body_hit_generic_big, sfx_body_hit_gen... |
| body_hitting_the_ground_with_blood | 5 | `combat.*body_hitting_the_ground_with_blood` | fghtbf_body_hitting_the_ground_with_blood |
| bow | 6 | `combat.*bow` | sfx_weapon_bow_hit, sfx_weapon_bow_shoot |
| break_bone | 48 | `combat.*break_bone` | gorebone_break_bone |
| cloth_whoosh | 23 | `combat.*cloth_whoosh` | whsh_cloth_whoosh |
| distortion_break_bone | 9 | `combat.*distortion_break_bone` | gorebone_distortion_break_bone |
| grab_body_cloth | 20 | `combat.*grab_body_cloth` | fghtgrab_grab_body_clothes |
| gun | 27 | `combat.*gun` | reload, sfx_gun_generic_a_shoot, sfx_gun_g... |
| heavy_axe | 96 | `combat.*heavy_axe` | equip_heavy_axe, goreblood_lethal_blood, g... |
| katana | 193 | `combat.*katana` | double_katana_whoosh, dsgnwhsh_double_kata... |
| kick_punch | 6 | `combat.*kick_punch` | sfx_fight_kick_swoosh, sfx_fight_punch_swoosh |
| knife_stab | 5 | `combat.*knife_stab` | weapknif_knife_stab |
| knife_whoosh | 5 | `combat.*knife_whoosh` | weapknif_knife_whoosh |
| medium_blood_and_bones | 46 | `combat.*medium_blood_and_bones` | goreooze_medium_blood_and_bones |
| metal_claws | 37 | `combat.*metal_claws` | open_close_metal_claws, stab_metal_claws, ... |
| metal_tube_hit_with_whoosh | 5 | `combat.*metal_tube_hit_with_whoosh` | metal_tube_hit_with_whoosh |
| metal_tube_only_hit | 5 | `combat.*metal_tube_only_hit` | metal_tube_only_hit |
| metal_tube_whoosh | 5 | `combat.*metal_tube_whoosh` | metal_tube_whoosh |
| punch_breaking_bones | 15 | `combat.*punch_breaking_bones` | fghtimpt_punch_breaking_bones |
| punch_protection | 17 | `combat.*punch_protection` | fghtimpt_punch_protection |
| punch_whooosh | 19 | `combat.*punch_whooosh` | whsh_punch_whooosh |
| punch_whoosh | 21 | `combat.*punch_whoosh` | fghtimpt_punch_whoosh |
| soft_blood_and_bones | 35 | `combat.*soft_blood_and_bones` | goreooze_soft_blood_and_bones |
| soft_break_bone | 47 | `combat.*soft_break_bone` | gorebone_soft_break_bone |
| special_break_bone | 24 | `combat.*special_break_bone` | gorebone_special_break_bone |
| special_hit | 18 | `combat.*special_hit` | fghtimpt_special_hit |
| special_hit_with_bones_and_blood | 13 | `combat.*special_hit_with_bones_and_blood` | fghtimpt_special_hit_with_bones_and_blood |
| strong_generic_punch | 15 | `combat.*strong_generic_punch` | fghtimpt_strong_generic_punch |
| sword_full_attack | 3 | `combat.*sword_full_attack` | sword_full_attack |
| sword_full_attack_with_blood | 3 | `combat.*sword_full_attack_with_blood` | sword_full_attack_with_blood |
| sword_hit | 3 | `combat.*sword_hit` | sword_hit |
| sword_hit_with_blood | 3 | `combat.*sword_hit_with_blood` | sword_hit_with_blood |
| sword_whoosh | 5 | `combat.*sword_whoosh` | sword_whoosh |
| versatile_punch_hit | 34 | `combat.*versatile_punch_hit` | fghtimpt_versatile_punch_hit |
| versatile_punch_hit_with_blood | 19 | `combat.*versatile_punch_hit_with_blood` | fghtimpt_versatile_punch_hit_with_blood |
| versatile_soft_punch_hit | 11 | `combat.*versatile_soft_punch_hit` | fghtimpt_versatile_soft_punch_hit |
| voice_type_a_sentence_fight | 24 | `combat.*voice_type_a_sentence_fight` | voxmisc_voice_type_a_sentence_fight |
| voice_type_a_sentence_final_round | 7 | `combat.*voice_type_a_sentence_final_round` | voxmisc_voice_type_a_sentence_final_round |
| voice_type_a_sentence_round_one | 9 | `combat.*voice_type_a_sentence_round_one` | voxmisc_voice_type_a_sentence_round_one |
| voice_type_a_sentence_round_two | 15 | `combat.*voice_type_a_sentence_round_two` | voxmisc_voice_type_a_sentence_round_two |
| voice_type_b_phrase_fight | 12 | `combat.*voice_type_b_phrase_fight` | voxmisc_voice_type_b_phrase_fight |
| voice_type_b_phrase_final_round | 5 | `combat.*voice_type_b_phrase_final_round` | voxmisc_voice_type_b_phrase_final_round |
| voice_type_b_phrase_round_one | 4 | `combat.*voice_type_b_phrase_round_one` | voxmisc_voice_type_b_phrase_round_one |
| voice_type_b_phrase_round_two | 5 | `combat.*voice_type_b_phrase_round_two` | voxmisc_voice_type_b_phrase_round_two |
| voice_type_c_phrase_fight | 17 | `combat.*voice_type_c_phrase_fight` | voxmisc_voice_type_c_phrase_fight |
| voice_type_c_phrase_final_round | 8 | `combat.*voice_type_c_phrase_final_round` | voxmisc_voice_type_c_phrase_final_round |
| voice_type_c_phrase_round_one | 11 | `combat.*voice_type_c_phrase_round_one` | voxmisc_voice_type_c_phrase_round_one |
| voice_type_c_phrase_round_two | 13 | `combat.*voice_type_c_phrase_round_two` | voxmisc_voice_type_c_phrase_round_two |
| voices | 68 | `combat.*voices` | female, female_01_breathing, female_01_har... |
| weapon_swoosh | 12 | `combat.*weapon_swoosh` | sfx_weapon_melee_swoosh_big, sfx_weapon_me... |

## cyberpunk

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| android_esque | 21 | `cyberpunk.*android_esque` | robot_cat, robot_monster, robot_rodent_sou... |
| armor | 31 | `cyberpunk.*armor` | armor_kinetic_echo, armor_nanomachines_pla... |
| buzz_and_hum | 16 | `cyberpunk.*buzz_and_hum` | buzz_and_hum, buzzing, buzzing_repeat, com... |
| cyber_vehicles | 16 | `cyberpunk.*cyber_vehicles` | cyber_vehicle, cyber_vehicle_abrupt_halt, ... |
| cybercity_soundscapes | 8 | `cyberpunk.*cybercity_soundscapes` | cybercity_lower_level, cybercity_street_le... |
| devices | 32 | `cyberpunk.*devices` | device_beacon, device_other_side, device_s... |
| digital_nature | 10 | `cyberpunk.*digital_nature` | cyber_bubbles, cyber_fire, cyber_water, di... |
| doors_lifts_and_locks | 11 | `cyberpunk.*doors_lifts_and_locks` | future_door_a_open, future_door_a_sliding_... |
| drones | 15 | `cyberpunk.*drones` | eerie_memory, gentle_hovering, hover_thing... |
| environmental_loops | 13 | `cyberpunk.*environmental_loops` | cyberspace |
| errors_and_alerts | 11 | `cyberpunk.*errors_and_alerts` | a_virus, annoying_machine_error, future_si... |
| hacking | 32 | `cyberpunk.*hacking` | hacking_brain_melt, hacking_breach, hackin... |
| healthy_ui | 24 | `cyberpunk.*healthy_ui` | bleep_bloop, buttons, cyber_click, irratio... |
| irrational_interfaces | 11 | `cyberpunk.*irrational_interfaces` | cyber_discharge, cyber_discharge_long, cyb... |
| lazers_and_tazers | 15 | `cyberpunk.*lazers_and_tazers` | impact_and_fry, loading_lazer, pulsing_vap... |
| machinery | 13 | `cyberpunk.*machinery` | active_machinery, big_machine_breaks, big_... |
| pulse_and_surge | 16 | `cyberpunk.*pulse_and_surge` | cyber_pulse, cyber_surge, mini_electric_sw... |
| vehicles | 32 | `cyberpunk.*vehicles` | vehicle_cr_x1_001_l_to, vehicle_cr_x1_002_... |
| weapons | 30 | `cyberpunk.*weapons` | weapon_carnage, weapon_jackie_tungstenfeet... |

## dark_fantasy_studio

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| abyss | 57 | `dark_fantasy_studio.*abyss` | abyss |
| agony | 29 | `dark_fantasy_studio.*agony` | agony |
| alien_voices | 41 | `dark_fantasy_studio.*alien_voices` | alien_hit_and_death, alien_voices |
| atmosphere_vol1 | 10 | `dark_fantasy_studio.*atmosphere_vol1` | atmos |
| atmosphere_vol2 | 10 | `dark_fantasy_studio.*atmosphere_vol2` | atmos_2 |
| bell | 1 | `dark_fantasy_studio.*bell` | bell |
| birds | 25 | `dark_fantasy_studio.*birds` | birds |
| broken_glass | 42 | `dark_fantasy_studio.*broken_glass` | broken_glass |
| chaos | 49 | `dark_fantasy_studio.*chaos` | chaos |
| cinematic_horror | 52 | `dark_fantasy_studio.*cinematic_horror` | complexe_cinematic_horror |
| cracking_wood | 27 | `dark_fantasy_studio.*cracking_wood` | noise_alchemy_craking_wood |
| creature | 20 | `dark_fantasy_studio.*creature` | creature |
| creepy_loops | 55 | `dark_fantasy_studio.*creepy_loops` | creepy_loops |
| creepy_wind | 80 | `dark_fantasy_studio.*creepy_wind` | creepy_wind |
| crow | 46 | `dark_fantasy_studio.*crow` | crow |
| cyborg | 60 | `dark_fantasy_studio.*cyborg` | cyborg |
| dark_horns | 51 | `dark_fantasy_studio.*dark_horns` | dark_horns |
| deep_space_danger | 40 | `dark_fantasy_studio.*deep_space_danger` | noise_alchemy_deep_space_danger |
| dimensional_portal | 100 | `dark_fantasy_studio.*dimensional_portal` | dimensional_portal, dimensional_portal_10_... |
| dissonant_vocals | 39 | `dark_fantasy_studio.*dissonant_vocals` | dissonant_vocals |
| dragon | 49 | `dark_fantasy_studio.*dragon` | dragon |
| dragon_wings | 22 | `dark_fantasy_studio.*dragon_wings` | noise_alchemy_dragon_wings |
| dungeon_atmosphere | 14 | `dark_fantasy_studio.*dungeon_atmosphere` | dungeon_atmosphere |
| dungeon_noises | 60 | `dark_fantasy_studio.*dungeon_noises` | dungeons_noises |
| evil_laugh | 54 | `dark_fantasy_studio.*evil_laugh` | evil_laugh |
| flesh_and_blood | 50 | `dark_fantasy_studio.*flesh_and_blood` | flesh_and_blood |
| ghostly | 51 | `dark_fantasy_studio.*ghostly` | ghostly |
| glitch | 70 | `dark_fantasy_studio.*glitch` | glitch |
| gun_reload_and_shot | 46 | `dark_fantasy_studio.*gun_reload_and_shot` | dark_fantasy_studio_reload, dark_fantasy_s... |
| horror_rising | 20 | `dark_fantasy_studio.*horror_rising` | horror_rising |
| insects | 31 | `dark_fantasy_studio.*insects` | insects |
| interface | 66 | `dark_fantasy_studio.*interface` | interface, interface_combined |
| jingles | 44 | `dark_fantasy_studio.*jingles` | jingle |
| jumpscare | 62 | `dark_fantasy_studio.*jumpscare` | jump_scare |
| lamentations | 35 | `dark_fantasy_studio.*lamentations` | lamentations |
| metallic_philosophy | 46 | `dark_fantasy_studio.*metallic_philosophy` | metallic |
| monk | 38 | `dark_fantasy_studio.*monk` | monk |
| music_box | 51 | `dark_fantasy_studio.*music_box` | music_box |
| power_up | 34 | `dark_fantasy_studio.*power_up` | power_up |
| reality_glitch | 43 | `dark_fantasy_studio.*reality_glitch` | noise_alchemy_reality_glitch |
| rip | 15 | `dark_fantasy_studio.*rip` | rip |
| riser_impact | 49 | `dark_fantasy_studio.*riser_impact` | riser_impact |
| risers | 50 | `dark_fantasy_studio.*risers` | risers |
| rocks_and_boulders | 49 | `dark_fantasy_studio.*rocks_and_boulders` | rocks_and_boulders |
| sci_fi_voices | 286 | `dark_fantasy_studio.*sci_fi_voices` | sci_fi_voices_1, sci_fi_voices_1_activated... |
| shipwreck | 44 | `dark_fantasy_studio.*shipwreck` | dark_fantasy_studio_shipwreck |
| sirens | 30 | `dark_fantasy_studio.*sirens` | sirens |
| smashed | 52 | `dark_fantasy_studio.*smashed` | smashed |
| spaceship_door | 41 | `dark_fantasy_studio.*spaceship_door` | spaceship_door |
| steam | 30 | `dark_fantasy_studio.*steam` | steam |
| stingers | 50 | `dark_fantasy_studio.*stingers` | stingers |
| sub_boom | 52 | `dark_fantasy_studio.*sub_boom` | sub_boom |
| swords | 43 | `dark_fantasy_studio.*swords` | swords |
| thunder | 48 | `dark_fantasy_studio.*thunder` | dark_fantasy_studio_thunder |
| video_game_menu | 47 | `dark_fantasy_studio.*video_game_menu` | video_game_menu |
| waterphone | 50 | `dark_fantasy_studio.*waterphone` | dark_fantasy_studio_waterphone |
| whispers | 50 | `dark_fantasy_studio.*whispers` | whispers |
| whooshes | 50 | `dark_fantasy_studio.*whooshes` | whooshes |
| whooshes_vol2 | 50 | `dark_fantasy_studio.*whooshes_vol2` | whooshes_vol_2 |
| wind | 10 | `dark_fantasy_studio.*wind` | wind |
| witch | 41 | `dark_fantasy_studio.*witch` | witch |
| woman_terror_breath | 20 | `dark_fantasy_studio.*woman_terror_breath` | woman_terror_breath |
| woman_terror_scream | 49 | `dark_fantasy_studio.*woman_terror_scream` | woman_terror_scream |
| zombie_voices | 35 | `dark_fantasy_studio.*zombie_voices` | zombies |

## dice

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| dice_handling | 5 | `dice.*dice_handling` |  |
| dice_in_pouch | 5 | `dice.*dice_in_pouch` |  |
| dice_roll_velvet | 4 | `dice.*dice_roll_velvet` |  |
| few_dice_roll | 5 | `dice.*few_dice_roll` |  |
| many_dice_roll_wood | 5 | `dice.*many_dice_roll_wood` |  |
| single_die_roll | 5 | `dice.*single_die_roll` |  |

## fantasy

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| ambience | 20 | `fantasy.*ambience` | beach, castle, cave, dungeon, forest, loop... |
| armor | 26 | `fantasy.*armor` | armor_movement, armor_salute, armor_step, ... |
| dark_sword_attack | 3 | `fantasy.*dark_sword_attack` |  |
| dark_sword_attack_withblood | 3 | `fantasy.*dark_sword_attack_withblood` |  |
| dark_sword_crash | 1 | `fantasy.*dark_sword_crash` |  |
| dark_sword_enchant | 1 | `fantasy.*dark_sword_enchant` |  |
| dark_sword_recharge | 1 | `fantasy.*dark_sword_recharge` |  |
| dark_sword_steallife | 1 | `fantasy.*dark_sword_steallife` |  |
| dark_sword_unfold | 1 | `fantasy.*dark_sword_unfold` |  |
| dark_sword_whoosh | 3 | `fantasy.*dark_sword_whoosh` |  |
| earth_arrow_whoosh | 3 | `fantasy.*earth_arrow_whoosh` |  |
| earth_bow_buff | 1 | `fantasy.*earth_bow_buff` |  |
| earth_shooting_noreverb | 3 | `fantasy.*earth_shooting_noreverb` |  |
| earth_shooting_withreverb | 2 | `fantasy.*earth_shooting_withreverb` |  |
| elementa_lbow_waterattack_extended | 1 | `fantasy.*elementa_lbow_waterattack_extended` |  |
| elemental_bow_earthattack | 3 | `fantasy.*elemental_bow_earthattack` |  |
| elemental_bow_earthattack_extended | 3 | `fantasy.*elemental_bow_earthattack_extended` |  |
| elemental_bow_fireattack | 3 | `fantasy.*elemental_bow_fireattack` |  |
| elemental_bow_fireattack_extended | 3 | `fantasy.*elemental_bow_fireattack_extended` |  |
| elemental_bow_iceattack | 3 | `fantasy.*elemental_bow_iceattack` |  |
| elemental_bow_iceattack_extended | 3 | `fantasy.*elemental_bow_iceattack_extended` |  |
| elemental_bow_poisonattack | 3 | `fantasy.*elemental_bow_poisonattack` |  |
| elemental_bow_poisonattack_extended | 3 | `fantasy.*elemental_bow_poisonattack_extended` |  |
| elemental_bow_thunderattack | 3 | `fantasy.*elemental_bow_thunderattack` |  |
| elemental_bow_thunderattack_exte... | 3 | `fantasy.*elemental_bow_thunderattack_extended` |  |
| elemental_bow_waterattack | 3 | `fantasy.*elemental_bow_waterattack` |  |
| elemental_bow_waterattack_extended | 2 | `fantasy.*elemental_bow_waterattack_extended` |  |
| elemental_bow_windattack | 3 | `fantasy.*elemental_bow_windattack` |  |
| elemental_bow_windattack_extended | 3 | `fantasy.*elemental_bow_windattack_extended` |  |
| elemental_sword_earthattack | 3 | `fantasy.*elemental_sword_earthattack` |  |
| elemental_sword_fireattack | 3 | `fantasy.*elemental_sword_fireattack` |  |
| elemental_sword_fireattack_extended | 3 | `fantasy.*elemental_sword_fireattack_extended` |  |
| elemental_sword_iceattack | 3 | `fantasy.*elemental_sword_iceattack` |  |
| elemental_sword_poisonattack | 3 | `fantasy.*elemental_sword_poisonattack` |  |
| elemental_sword_poisonattack_ext... | 3 | `fantasy.*elemental_sword_poisonattack_extended` |  |
| elemental_sword_thunderattack | 3 | `fantasy.*elemental_sword_thunderattack` |  |
| elemental_sword_thunderattack_ex... | 3 | `fantasy.*elemental_sword_thunderattack_extended` |  |
| elemental_sword_waterattack | 3 | `fantasy.*elemental_sword_waterattack` |  |
| elemental_sword_waterattack_exte... | 3 | `fantasy.*elemental_sword_waterattack_extended` |  |
| elemental_sword_windattack | 3 | `fantasy.*elemental_sword_windattack` |  |
| elemental_sword_windattackextended | 3 | `fantasy.*elemental_sword_windattackextended` |  |
| fire_bow_buff | 1 | `fantasy.*fire_bow_buff` |  |
| fire_bow_whoosh | 2 | `fantasy.*fire_bow_whoosh` |  |
| fire_sword_buff | 3 | `fantasy.*fire_sword_buff` |  |
| gothic_fantasy_sound_fx_pack_vol | 182 | `fantasy.*gothic_fantasy_sound_fx_pack_vol` | angel_dust, banish, beast_footstep, bell_o... |
| ice_arrow_whoosh | 2 | `fantasy.*ice_arrow_whoosh` |  |
| ice_bow_buff | 3 | `fantasy.*ice_bow_buff` |  |
| items_misc | 53 | `fantasy.*items_misc` | black_smith_hammer, black_smith_tool, bush... |
| magic_sword_attack | 3 | `fantasy.*magic_sword_attack` |  |
| magic_sword_attack_withblood | 3 | `fantasy.*magic_sword_attack_withblood` |  |
| magic_sword_break | 1 | `fantasy.*magic_sword_break` |  |
| magic_sword_crash | 1 | `fantasy.*magic_sword_crash` |  |
| magic_sword_enchant | 1 | `fantasy.*magic_sword_enchant` |  |
| magic_sword_recharge | 2 | `fantasy.*magic_sword_recharge` |  |
| magic_sword_steallife | 2 | `fantasy.*magic_sword_steallife` |  |
| magic_sword_unfold | 1 | `fantasy.*magic_sword_unfold` |  |
| magic_sword_whoosh | 3 | `fantasy.*magic_sword_whoosh` |  |
| magical_bow_charge | 1 | `fantasy.*magical_bow_charge` |  |
| magical_bow_pullback | 2 | `fantasy.*magical_bow_pullback` |  |
| magical_bow_shootmiss | 3 | `fantasy.*magical_bow_shootmiss` |  |
| poison_arrow_whoosh | 3 | `fantasy.*poison_arrow_whoosh` |  |
| poison_bow_buff | 1 | `fantasy.*poison_bow_buff` |  |
| poison_sword_whoosh | 3 | `fantasy.*poison_sword_whoosh` |  |
| shooting_arrow_ice_reverb | 3 | `fantasy.*shooting_arrow_ice_reverb` |  |
| shooting_fire_arrow_reverb | 2 | `fantasy.*shooting_fire_arrow_reverb` |  |
| shooting_poison_arrow_noreverb | 1 | `fantasy.*shooting_poison_arrow_noreverb` |  |
| shooting_thunder_arrow_noreverb | 1 | `fantasy.*shooting_thunder_arrow_noreverb` |  |
| shooting_water_arrow_noreverb | 3 | `fantasy.*shooting_water_arrow_noreverb` |  |
| shooting_wind_arrow_noreverb | 3 | `fantasy.*shooting_wind_arrow_noreverb` |  |
| thunder_bow_buff | 2 | `fantasy.*thunder_bow_buff` |  |
| thunder_sword_whoosh | 2 | `fantasy.*thunder_sword_whoosh` |  |
| water_arrow_whoosh | 3 | `fantasy.*water_arrow_whoosh` |  |
| water_bow_buff | 1 | `fantasy.*water_bow_buff` |  |
| water_sword_buff | 2 | `fantasy.*water_sword_buff` |  |
| water_sword_whoosh | 3 | `fantasy.*water_sword_whoosh` |  |
| weapons | 45 | `fantasy.*weapons` | ballista_shoot, crossbow_load, crossbow_sh... |
| whooshes | 31 | `fantasy.*whooshes` | blunt_whoosh, flail_whoosh, general_throw,... |
| wind_arrow_whoosh | 1 | `fantasy.*wind_arrow_whoosh` |  |
| wind_bow_buff | 1 | `fantasy.*wind_bow_buff` |  |
| wind_sword_whoosh | 3 | `fantasy.*wind_sword_whoosh` |  |

## magic

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| air | 23 | `magic.*air` | aero_blade_cast, aero_blade_impact, aero_b... |
| aqua_slice_whoosh | 6 | `magic.*aqua_slice_whoosh` | aqua_slice_whoosh |
| arc_pulse | 5 | `magic.*arc_pulse` | magelem_arc_pulse |
| arcane_blast | 11 | `magic.*arcane_blast` | arcane_blast |
| arcane_mini_whoosh | 10 | `magic.*arcane_mini_whoosh` | arcane_mini_whoosh |
| arcane_snap | 4 | `magic.*arcane_snap` | arcane_snap |
| arcane_spells | 40 | `magic.*arcane_spells` | arcane_spells_aetherial_pulse, arcane_spel... |
| aura_of_vitality | 6 | `magic.*aura_of_vitality` | aura_of_vitality |
| aura_twirl | 6 | `magic.*aura_twirl` | aura_twirl |
| aurora_mend | 6 | `magic.*aurora_mend` | aurora_mend |
| beastly_chomp | 9 | `magic.*beastly_chomp` | creamnstr_beastly_chomp |
| blackveil_curse | 9 | `magic.*blackveil_curse` | magevil_blackveil_curse |
| blasting_dune | 13 | `magic.*blasting_dune` | magelem_blasting_dune |
| blazing_impact | 10 | `magic.*blazing_impact` | magelem_blazing_impact |
| blessing_bell | 5 | `magic.*blessing_bell` | magshim_blessing_bell |
| blessing_chime | 3 | `magic.*blessing_chime` | magshim_blessing_chime |
| bloodlight_pierce | 16 | `magic.*bloodlight_pierce` | bloodlight_pierce |
| bow_of_power | 16 | `magic.*bow_of_power` | magevil_bow_of_power |
| breeze_of_the_ancients | 10 | `magic.*breeze_of_the_ancients` | magelem_breeze_of_the_ancients |
| bubble_aura_explosion | 6 | `magic.*bubble_aura_explosion` | bubble_aura_explosion |
| bubble_kiss | 6 | `magic.*bubble_kiss` | bubble_kiss |
| bubble_rush | 15 | `magic.*bubble_rush` | magelem_bubble_rush |
| catalyst_strike | 17 | `magic.*catalyst_strike` | catalyst_strike |
| celestial_bolt | 15 | `magic.*celestial_bolt` | celestial_bolt |
| celestial_mend | 4 | `magic.*celestial_mend` | celestial_mend |
| chime_of_darkened_echo | 5 | `magic.*chime_of_darkened_echo` | chime_of_darkened_echo |
| chime_of_empowerment | 5 | `magic.*chime_of_empowerment` | chime_of_empowerment |
| chime_of_enchanted_speed | 9 | `magic.*chime_of_enchanted_speed` | chime_of_enchanted_speed |
| chime_of_mystic_pulse | 9 | `magic.*chime_of_mystic_pulse` | chime_of_mystic_pulse |
| chrono_rift | 10 | `magic.*chrono_rift` | chrono_rift |
| close_temporal_rift_summoning | 8 | `magic.*close_temporal_rift_summoning` | close_temporal_rift_summoning |
| colossal_shield_scrape | 10 | `magic.*colossal_shield_scrape` | colossal_shield_scrape |
| comet_crash | 9 | `magic.*comet_crash` | magelem_comet_crash |
| corrupted_bile | 15 | `magic.*corrupted_bile` | magevil_corrupted_bile |
| curse_of_frailty | 12 | `magic.*curse_of_frailty` | curse_of_frailty |
| cursebrand | 10 | `magic.*cursebrand` | magevil_cursebrand |
| cursed_blast | 1 | `magic.*cursed_blast` | cursed_blast |
| cutting_spiral | 9 | `magic.*cutting_spiral` | cutting_spiral |
| cyclone_wrath | 15 | `magic.*cyclone_wrath` | magelem_cyclone_wrath |
| dark | 28 | `magic.*dark` | abyssal_pulse, dark_aura, dark_hit, dark_m... |
| dark_magic | 32 | `magic.*dark_magic` | dark_magic_blight_curse, dark_magic_dread_... |
| darting_arcana | 6 | `magic.*darting_arcana` | darting_arcana |
| demonlash | 2 | `magic.*demonlash` | magevil_demonlash |
| dimensional_bind | 6 | `magic.*dimensional_bind` | dimensional_bind |
| divine_dissonance | 7 | `magic.*divine_dissonance` | magshim_divine_dissonance |
| divine_magic | 28 | `magic.*divine_magic` | divine_magic_celestial_choir, divine_magic... |
| doomed_impact | 12 | `magic.*doomed_impact` | magevil_doomed_impact |
| doomed_whisper | 5 | `magic.*doomed_whisper` | doomed_whisper |
| doomlash | 7 | `magic.*doomlash` | doomlash |
| dreadbound_ritual | 10 | `magic.*dreadbound_ritual` | dreadbound_ritual |
| earth | 28 | `magic.*earth` | boulder_throw_cast, boulder_throw_impact, ... |
| echoes_of_invocation | 4 | `magic.*echoes_of_invocation` | echoes_of_invocation |
| electrified_aura | 13 | `magic.*electrified_aura` | electrified_aura |
| electrified_impact | 7 | `magic.*electrified_impact` | electrified_impact |
| electrified_whoosh | 6 | `magic.*electrified_whoosh` | electrified_whoosh |
| energy_rush | 4 | `magic.*energy_rush` | whsh_energy_rush |
| ethereal_blade_strike | 5 | `magic.*ethereal_blade_strike` | ethereal_blade_strike |
| ethereal_bubble_swish | 7 | `magic.*ethereal_bubble_swish` | ethereal_bubble_swish |
| ethereal_chime | 2 | `magic.*ethereal_chime` | magshim_ethereal_chime |
| ethereal_essence_swish | 20 | `magic.*ethereal_essence_swish` | ethereal_essence_swish |
| ethereal_rejuvenation | 4 | `magic.*ethereal_rejuvenation` | ethereal_rejuvenation |
| ethereal_swish | 18 | `magic.*ethereal_swish` | ethereal_swish |
| fateful_whoosh | 8 | `magic.*fateful_whoosh` | fateful_whoosh |
| fire | 47 | `magic.*fire` | blazing_comet, burning_hands, combustion, ... |
| flashburst_rebound | 4 | `magic.*flashburst_rebound` | flashburst_rebound |
| flowing_incantation | 8 | `magic.*flowing_incantation` | flowing_incantation |
| frostveil_aura | 10 | `magic.*frostveil_aura` | magelem_frostveil_aura |
| futuristic_impact_type | 1 | `magic.*futuristic_impact_type` | futuristic_impact_type |
| gale_strike | 10 | `magic.*gale_strike` | magelem_gale_strike |
| gemstone_ripple | 8 | `magic.*gemstone_ripple` | gemstone_ripple |
| generic_whoosh_type | 19 | `magic.*generic_whoosh_type` | generic_whoosh_type_a, generic_whoosh_type... |
| gilded_breeze | 14 | `magic.*gilded_breeze` | gilded_breeze |
| glimmering_flux | 4 | `magic.*glimmering_flux` | glimmering_flux |
| glinting_bubbles | 18 | `magic.*glinting_bubbles` | magelem_glinting_bubbles |
| godstrike_impact | 4 | `magic.*godstrike_impact` | godstrike_impact |
| harmonia_grace | 12 | `magic.*harmonia_grace` | harmonia_grace |
| harmonic_power_cast | 4 | `magic.*harmonic_power_cast` | harmonic_power_cast |
| harmonic_resurgence | 6 | `magic.*harmonic_resurgence` | harmonic_resurgence |
| haunted_wrath | 8 | `magic.*haunted_wrath` | magevil_haunted_wrath |
| hellbound_bloodflow | 13 | `magic.*hellbound_bloodflow` | magevil_hellbound_bloodflow |
| hellfireball | 10 | `magic.*hellfireball` | magelem_hellfireball |
| hellgate_curse | 24 | `magic.*hellgate_curse` | magevil_hellgate_curse |
| hellvoice_descent | 8 | `magic.*hellvoice_descent` | magevil_hellvoice_descent |
| howling_hex | 5 | `magic.*howling_hex` | howling_hex |
| ice | 34 | `magic.*ice` | arctic_gale, crystal_column, crystal_lance... |
| icy_fractals | 10 | `magic.*icy_fractals` | magelem_icy_fractals |
| infernal_invocation | 3 | `magic.*infernal_invocation` | magevil_infernal_invocation |
| light | 15 | `magic.*light` | consecrate, heavenly_flame, heavenly_wrath... |
| lightning | 12 | `magic.*lightning` | lighting_aura, lighting_hit, lighting_magi... |
| lightning_arc_hit | 18 | `magic.*lightning_arc_hit` | magelem_lightning_arc_hit |
| little_arcane_blast | 11 | `magic.*little_arcane_blast` | little_arcane_blast |
| little_chime_of_enchanted_speed | 12 | `magic.*little_chime_of_enchanted_speed` | little_chime_of_enchanted_speed |
| loop_temporal_rift_summoning | 1 | `magic.*loop_temporal_rift_summoning` | loop_temporal_rift_summoning |
| lumen_chimes | 8 | `magic.*lumen_chimes` | lumen_chimes |
| luminous_blessing_strike | 2 | `magic.*luminous_blessing_strike` | luminous_blessing_strike |
| luminous_projectile | 12 | `magic.*luminous_projectile` | whsh_luminous_projectile |
| magic_potion_unbound | 5 | `magic.*magic_potion_unbound` | magic_potion_unbound |
| magic_potion_unbound_two | 3 | `magic.*magic_potion_unbound_two` | magic_potion_unbound_two |
| medium_arcane_blast | 9 | `magic.*medium_arcane_blast` | medium_arcane_blast |
| mistwhisper | 18 | `magic.*mistwhisper` | magelem_mistwhisper |
| monolith_crush | 16 | `magic.*monolith_crush` | magelem_monolith_crush |
| mudslide_call | 13 | `magic.*mudslide_call` | magelem_mudslide_call |
| mystic_trigger | 18 | `magic.*mystic_trigger` | mystic_trigger |
| nature | 21 | `magic.*nature` | animorphic_bond, barkskin, bramble_burst, ... |
| nebula_wave | 5 | `magic.*nebula_wave` | nebula_wave |
| neon_impact | 2 | `magic.*neon_impact` | neon_impact |
| noctis_rite | 12 | `magic.*noctis_rite` | noctis_rite |
| oblivion_slam | 10 | `magic.*oblivion_slam` | magevil_oblivion_slam |
| offensive_spells | 39 | `magic.*offensive_spells` | offensive_spells_arcane_missiles, offensiv... |
| open_temporal_rift_summoning | 6 | `magic.*open_temporal_rift_summoning` | open_temporal_rift_summoning |
| phantom_whoosh | 10 | `magic.*phantom_whoosh` | phantom_whoosh |
| phase_spiral | 12 | `magic.*phase_spiral` | phase_spiral |
| poison | 13 | `magic.*poison` | poison_aura, poison_hit, poison_magic_buff... |
| quakebound_spell | 10 | `magic.*quakebound_spell` | magelem_quakebound_spell |
| quick_wand_whiz_whoosh | 4 | `magic.*quick_wand_whiz_whoosh` | quick_wand_whiz_whoosh |
| quick_wand_whiz_whoosh_type | 10 | `magic.*quick_wand_whiz_whoosh_type` | quick_wand_whiz_whoosh_type_b |
| radiant_charge | 2 | `magic.*radiant_charge` | radiant_charge |
| rapid_air_slash | 10 | `magic.*rapid_air_slash` | rapid_air_slash |
| resonant_veil | 3 | `magic.*resonant_veil` | resonant_veil |
| rift_of_dread | 6 | `magic.*rift_of_dread` | magevil_rift_of_dread |
| riftstorm_discharge | 16 | `magic.*riftstorm_discharge` | magelem_riftstorm_discharge |
| rock | 12 | `magic.*rock` | earth_aura, earth_hit, earth_magic_whoosh,... |
| rune_blastwave | 10 | `magic.*rune_blastwave` | rune_blastwave |
| sacred_ritual | 9 | `magic.*sacred_ritual` | sacred_ritual |
| sanctum_implosion | 21 | `magic.*sanctum_implosion` | magangl_sanctum_implosion |
| shadowblade_scrape | 8 | `magic.*shadowblade_scrape` | shadowblade_scrape |
| shadowed_aura_trail | 7 | `magic.*shadowed_aura_trail` | shadowed_aura_trail |
| shadowsteel_flurry | 12 | `magic.*shadowsteel_flurry` | shadowsteel_flurry |
| shadowstrike_beam | 17 | `magic.*shadowstrike_beam` | shadowstrike_beam |
| shattered_terrain | 8 | `magic.*shattered_terrain` | magelem_shattered_terrain |
| shield_blessing | 4 | `magic.*shield_blessing` | shield_blessing |
| shock | 17 | `magic.*shock` | lightning_bolt_cast, lightning_bolt_impact... |
| spellblade_rush | 11 | `magic.*spellblade_rush` | spellblade_rush |
| steel_zapline | 5 | `magic.*steel_zapline` | steel_zapline |
| stonebind | 6 | `magic.*stonebind` | magelem_stonebind |
| stonebound_summon | 8 | `magic.*stonebound_summon` | stonebound_summon |
| stonecrash_impact | 13 | `magic.*stonecrash_impact` | magelem_stonecrash_impact |
| subtle_torrent | 19 | `magic.*subtle_torrent` | subtle_torrent |
| summoner_tempest | 13 | `magic.*summoner_tempest` | summoner_tempest |
| sweetbind | 7 | `magic.*sweetbind` | sweetbind |
| temporal_rift_summoning | 1 | `magic.*temporal_rift_summoning` | temporal_rift_summoning |
| temporal_rift_whoosh | 12 | `magic.*temporal_rift_whoosh` | temporal_rift_whoosh |
| twilight_fang | 10 | `magic.*twilight_fang` | twilight_fang |
| twinkle_tweak | 12 | `magic.*twinkle_tweak` | twinkle_tweak |
| twirl_whoosh | 13 | `magic.*twirl_whoosh` | twirl_whoosh |
| undead_wail_impact | 2 | `magic.*undead_wail_impact` | magevil_undead_wail_impact |
| unholy_echo | 10 | `magic.*unholy_echo` | magevil_unholy_echo |
| veiled_incantation | 8 | `magic.*veiled_incantation` | veiled_incantation |
| venomous_melt | 9 | `magic.*venomous_melt` | magelem_venomous_melt |
| vital_grace | 4 | `magic.*vital_grace` | magshim_vital_grace |
| vitalis_current | 13 | `magic.*vitalis_current` | vitalis_current |
| wailing_rite | 11 | `magic.*wailing_rite` | magevil_wailing_rite |
| wand_whiz_whoosh | 7 | `magic.*wand_whiz_whoosh` | wand_whiz_whoosh |
| warped_energy_flow_whoosh | 9 | `magic.*warped_energy_flow_whoosh` | warped_energy_flow_whoosh |
| warped_flow_whoosh | 7 | `magic.*warped_flow_whoosh` | warped_flow_whoosh |
| water | 30 | `magic.*water` | aqua_bolt_cast, aqua_bolt_impact, aqua_bol... |
| water_magic | 38 | `magic.*water_magic` | water_magic_current_pulse, water_magic_gey... |
| whimsy_morph | 7 | `magic.*whimsy_morph` | whimsy_morph |
| wind | 12 | `magic.*wind` | wind_aura, wind_hit, wind_magic_buff, wind... |

## misc

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| tictactoe | 3 | `misc.*tictactoe` | draw_line, move, win |

## monster

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| aberration | 20 | `monster.*aberration` | aberration_attack, aberration_death, aberr... |
| angry | 4 | `monster.*angry` |  |
| angry_with_caw | 4 | `monster.*angry_with_caw` |  |
| attack | 15 | `monster.*attack` | attack_highinstensity_01_withecho, attack_... |
| attack_high_intensity | 3 | `monster.*attack_high_intensity` |  |
| attack_high_intensity_with_caw | 3 | `monster.*attack_high_intensity_with_caw` |  |
| attack_normal | 3 | `monster.*attack_normal` |  |
| attack_normal_with_caw | 3 | `monster.*attack_normal_with_caw` |  |
| attack_quick | 3 | `monster.*attack_quick` |  |
| attack_quick_with_caw | 3 | `monster.*attack_quick_with_caw` |  |
| behemoth | 22 | `monster.*behemoth` | behemoth_attack, behemoth_death, behemoth_... |
| bite | 3 | `monster.*bite` |  |
| bite_with_blood | 3 | `monster.*bite_with_blood` |  |
| breath | 6 | `monster.*breath` | fastbreathing_01_withecho, fastbreathing_0... |
| complete_bite | 3 | `monster.*complete_bite` |  |
| creature_bite | 27 | `monster.*creature_bite` | creamisc_creature_bite_only_blood_type_a, ... |
| danger | 4 | `monster.*danger` |  |
| danger_with_caw | 3 | `monster.*danger_with_caw` |  |
| death | 7 | `monster.*death` | death_01_withecho, death_02_withecho, deat... |
| death_with_caw | 1 | `monster.*death_with_caw` |  |
| dragon | 29 | `monster.*dragon` | creadrgn_dragon_attack, creadrgn_dragon_de... |
| eating | 1 | `monster.*eating` |  |
| eating_loop_with_grunts | 1 | `monster.*eating_loop_with_grunts` |  |
| egg | 15 | `monster.*egg` | alien_egg_hatching_viscous_type, alien_egg... |
| fast_breathing | 2 | `monster.*fast_breathing` |  |
| flying | 1 | `monster.*flying` |  |
| footstep | 16 | `monster.*footstep` | footstep_01_withecho, footstep_02_withecho... |
| footstep_gravel | 1 | `monster.*footstep_gravel` |  |
| footstep_leaves | 1 | `monster.*footstep_leaves` |  |
| footstep_metal | 1 | `monster.*footstep_metal` |  |
| footstep_sand | 1 | `monster.*footstep_sand` |  |
| footstep_water | 1 | `monster.*footstep_water` |  |
| friendship_call | 4 | `monster.*friendship_call` |  |
| friendship_call_with_caw | 4 | `monster.*friendship_call_with_caw` |  |
| goblin | 31 | `monster.*goblin` | creahmn_goblin_attack, creahmn_goblin_deat... |
| growl | 12 | `monster.*growl` | deeplowgrowl_01_withecho, deeplowgrowl_02_... |
| growl_with_caw | 2 | `monster.*growl_with_caw` |  |
| growl_with_slobber | 3 | `monster.*growl_with_slobber` |  |
| grunt | 4 | `monster.*grunt` |  |
| grunt_with_caw | 4 | `monster.*grunt_with_caw` |  |
| impact | 15 | `monster.*impact` | monsters, recieveattack_highintensity_01_w... |
| insect | 26 | `monster.*insect` | creainsc_insect_attack, creainsc_insect_de... |
| kraughor | 75 | `monster.*kraughor` | creamnstr_kraughor_death_type_a, creamnstr... |
| long_roar | 4 | `monster.*long_roar` |  |
| long_roar_with_caw | 4 | `monster.*long_roar_with_caw` |  |
| monsters | 3 | `monster.*monsters` | eating_loop_withecho, throatsound_01_withe... |
| movement | 4 | `monster.*movement` | monsters, movement_flying_loop_01_withecho... |
| mutation | 3 | `monster.*mutation` |  |
| orc | 54 | `monster.*orc` | creahmn_orc_attack, creahmn_orc_death, cre... |
| recieve_attack_long | 4 | `monster.*recieve_attack_long` |  |
| recieve_attack_long_with_caw | 4 | `monster.*recieve_attack_long_with_caw` |  |
| recieve_attack_medium | 4 | `monster.*recieve_attack_medium` |  |
| recieve_attack_medium_with_caw | 4 | `monster.*recieve_attack_medium_with_caw` |  |
| recieve_attack_quick | 2 | `monster.*recieve_attack_quick` |  |
| recieve_attack_quick_with_caw | 4 | `monster.*recieve_attack_quick_with_caw` |  |
| scream | 4 | `monster.*scream` |  |
| scream_with_caw | 4 | `monster.*scream_with_caw` |  |
| short_roar | 4 | `monster.*short_roar` |  |
| short_roar_with_caw | 4 | `monster.*short_roar_with_caw` |  |
| shout | 37 | `monster.*shout` | agressiveshout_01_withecho, agressiveshout... |
| skarnil | 122 | `monster.*skarnil` | creamnstr_skarnil_death_type_a, creamnstr_... |
| skeleton | 32 | `monster.*skeleton` | creahmn_skeleton_attack, creahmn_skeleton_... |
| slobber | 3 | `monster.*slobber` |  |
| slow_breathing | 2 | `monster.*slow_breathing` |  |
| spectre | 20 | `monster.*spectre` | creaethr_spectre_attack, creaethr_spectre_... |
| spider | 24 | `monster.*spider` | creainsc_spider_attack, creainsc_spider_at... |
| step | 5 | `monster.*step` |  |
| troll | 30 | `monster.*troll` | creamnstr_troll_attack, creamnstr_troll_de... |
| varnok | 121 | `monster.*varnok` | creamnstr_varnok_death_type_a, creamnstr_v... |

## puzzle

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| bomb_appear | 1 | `puzzle.*bomb_appear` |  |
| bomb_explosion | 2 | `puzzle.*bomb_explosion` |  |
| bonus | 4 | `puzzle.*bonus` |  |
| bonus_with_crowns | 1 | `puzzle.*bonus_with_crowns` |  |
| break_wood | 2 | `puzzle.*break_wood` |  |
| collective_coins | 4 | `puzzle.*collective_coins` |  |
| complete_level | 6 | `puzzle.*complete_level` |  |
| get_crystal | 3 | `puzzle.*get_crystal` |  |
| get_orb | 4 | `puzzle.*get_orb` |  |
| heavy_whoosh | 5 | `puzzle.*heavy_whoosh` |  |
| lose_game | 3 | `puzzle.*lose_game` |  |
| match3 | 15 | `puzzle.*match3` |  |
| medium_whoosh | 6 | `puzzle.*medium_whoosh` |  |
| negative_pop | 6 | `puzzle.*negative_pop` |  |
| neutral_select_butom | 17 | `puzzle.*neutral_select_butom` |  |
| normal_power_up | 9 | `puzzle.*normal_power_up` |  |
| open_new_level | 3 | `puzzle.*open_new_level` |  |
| play_button | 6 | `puzzle.*play_button` |  |
| positive_pop | 6 | `puzzle.*positive_pop` |  |
| power_up_bar | 5 | `puzzle.*power_up_bar` |  |
| power_up_bar_lool | 1 | `puzzle.*power_up_bar_lool` |  |
| select_item | 6 | `puzzle.*select_item` |  |
| stars_complete_level | 5 | `puzzle.*stars_complete_level` |  |
| task_complete | 5 | `puzzle.*task_complete` |  |
| tiny_pop | 13 | `puzzle.*tiny_pop` |  |
| tiny_whoosh | 3 | `puzzle.*tiny_whoosh` |  |
| treasure_chest | 7 | `puzzle.*treasure_chest` |  |

## status

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| abstract_change | 4 | `status.*abstract_change` |  |
| abstract_dash | 4 | `status.*abstract_dash` |  |
| abstract_decision | 4 | `status.*abstract_decision` |  |
| abstract_move | 4 | `status.*abstract_move` |  |
| abstract_reward | 4 | `status.*abstract_reward` |  |
| action_and_interaction | 20 | `status.*action_and_interaction` | found, holy_charging, music_ready, ready, ... |
| ailments | 45 | `status.*ailments` | ailment_hunger, ailments_bleed, ailments_c... |
| fantasy | 16 | `status.*fantasy` | fantasy_dark_castle, fantasy_dispel, fanta... |
| low_hp_heartbeat_fast | 1 | `status.*low_hp_heartbeat_fast` |  |
| low_hp_heartbeat_mid | 1 | `status.*low_hp_heartbeat_mid` |  |
| low_hp_heartbeat_slow | 1 | `status.*low_hp_heartbeat_slow` |  |
| mental_and_magical_debuffs | 29 | `status.*mental_and_magical_debuffs` | charmed, confused, crazy, cursed, feared, ... |
| mobile | 32 | `status.*mobile` | mobile_buff, mobile_coin, mobile_compound,... |
| musical | 32 | `status.*musical` | musical_bless, musical_combat_ready, music... |
| physical_debuffs | 26 | `status.*physical_debuffs` | bound, broken, cute_hold, cute_rlease, hol... |
| positive_buffs_and_cures | 31 | `status.*positive_buffs_and_cures` | charged, growth, healed, purged, sharpened... |
| sci_fi | 20 | `status.*sci_fi` | sci_fi_device_use, sci_fi_meters_refill, s... |
| stimpack | 4 | `status.*stimpack` |  |
| system_and_tech_status | 21 | `status.*system_and_tech_status` | analyzing, digital_fear, hacked, targeted,... |
| transformations_and_special_moves | 16 | `status.*transformations_and_special_moves` | beast_formed, beast_formed_small, goblin_m... |
| vitals_and_needs | 37 | `status.*vitals_and_needs` | diarrhea, energy_low, frozen, hungry, low_... |

## steampunk

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| gas_steam | 50 | `steampunk.*gas_steam` | gas_click, gas_dink, gas_pressure, gas_rel... |
| handling | 53 | `steampunk.*handling` | handlight_thingy, kettle_lid_close, kettle... |
| impacts | 10 | `steampunk.*impacts` | toaster_boom |
| levers_and_pumps | 29 | `steampunk.*levers_and_pumps` | lever_winding, pump_squeak, squeaky_lever,... |
| loops | 26 | `steampunk.*loops` | bike_chain, boiler_room, clicking_mechanis... |
| mechanisms | 26 | `steampunk.*mechanisms` | bike_chain, clicking_mechanism_big, clicki... |

## stinger

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| musc_action | 1 | `stinger.*musc_action` |  |
| musc_cute_horror_action | 2 | `stinger.*musc_cute_horror_action` |  |
| musc_cute_theme | 1 | `stinger.*musc_cute_theme` |  |
| musc_puzzle_theme | 1 | `stinger.*musc_puzzle_theme` |  |
| musc_reaction_theme | 1 | `stinger.*musc_reaction_theme` |  |
| musc_retro_theme | 1 | `stinger.*musc_retro_theme` |  |
| musc_sports_theme | 1 | `stinger.*musc_sports_theme` |  |
| stinger | 14 | `stinger.*stinger` | action_lose, action_win, lose_cute, lose_c... |

## system

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| alerts | 32 | `system.*alerts` | achievement, aggressive_twinkle, big_loss,... |
| ambiences | 6 | `system.*ambiences` | lava_level, spooky_ambience, water_level |
| buttons | 26 | `system.*buttons` | activations, bouncy_select, clicks, cowbel... |
| celebrate | 20 | `system.*celebrate` | applause, bomb, firework, magical_confetti... |
| interactions | 43 | `system.*interactions` | bow, casual_enemy_damage, casual_glass, ca... |
| misc | 23 | `system.*misc` | futuristic_siren, gatcha_even_speed, gatch... |
| text | 4 | `system.*text` | text_sprawl_high_and_simple, text_sprawl_l... |
| vocalizations | 20 | `system.*vocalizations` | ah_ha, ahhh, chuckle, curiosities, evil_la... |

## token

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| move_piece_harsh | 5 | `token.*move_piece_harsh` |  |
| move_piece_soft | 4 | `token.*move_piece_soft` |  |
| token_box_handling | 3 | `token.*token_box_handling` |  |
| token_box_shake | 5 | `token.*token_box_shake` |  |
| token_drop | 5 | `token.*token_drop` |  |
| token_place_hard | 5 | `token.*token_place_hard` |  |
| token_place_soft | 5 | `token.*token_place_soft` |  |
| tokens_handling | 3 | `token.*tokens_handling` |  |

## ui

| 语义 | # | grep | 子关键词 |
|------|---|------|----------|
| buttons | 15 | `ui.*buttons` | overwrite_saved_save_game_button, tab_swit... |
| click | 14 | `ui.*click` | sfx_interact_pop, sfx_ui_click_buy, sfx_ui... |
| countdown | 9 | `ui.*countdown` | sfx_ui_countdown_cute, sfx_ui_countdown_cu... |
| dialog | 16 | `ui.*dialog` | dialog_choice, dialog_screen_appears, mous... |
| enter_or_discover_new_territory_... | 10 | `ui.*enter_or_discover_new_territory_pop_up` | enter_or_discover_new_territory_pop_up |
| experience_popup | 6 | `ui.*experience_popup` | experience_popup |
| fantasy_ui_sound_fx_pack_vol | 180 | `ui.*fantasy_ui_sound_fx_pack_vol` | back_a, back_b, back_c, backwards_navigati... |
| fillup | 12 | `ui.*fillup` | sfx_ui_fillup_futuristic, sfx_ui_fillup_ge... |
| insufficient_resources_popup | 8 | `ui.*insufficient_resources_popup` | insufficient_resources_popup |
| inventory | 102 | `ui.*inventory` | click_object_or_item, close_and_open_inven... |
| item_received_popup | 18 | `ui.*item_received_popup` | item_received_popup |
| journal_menu | 19 | `ui.*journal_menu` | close_journal_menu, open_journal_menu, upd... |
| journal_updated_pop_up | 22 | `ui.*journal_updated_pop_up` | journal_updated_pop_up |
| map_menu | 39 | `ui.*map_menu` | fast_travel_on_the_map, map_marker, mouseo... |
| misc | 42 | `ui.*misc` | interaction, interaction_abacus, interacti... |
| mision_or_quest_complete_pop_up | 15 | `ui.*mision_or_quest_complete_pop_up` | mision_or_quest_complete_pop_up |
| mouse | 56 | `ui.*mouse` | drag, mouse_drag_blood, mouse_drag_chemist... |
| neutral_pop_up | 18 | `ui.*neutral_pop_up` | neutral_pop_up |
| open_close_pause_menu | 11 | `ui.*open_close_pause_menu` | open_close_pause_menu |
| open_close_quest_menu | 10 | `ui.*open_close_quest_menu` | open_close_quest_menu |
| open_close_skill_tree | 12 | `ui.*open_close_skill_tree` | open_close_skill_tree |
| open_or_close_menu | 5 | `ui.*open_or_close_menu` | open_or_close_menu |
| overwrite_saved_and_save_game_po... | 16 | `ui.*overwrite_saved_and_save_game_pop_up` | overwrite_saved_and_save_game_pop_up |
| principal_menu | 49 | `ui.*principal_menu` | accept_button, enable_tutorial, menu_butto... |
| signals | 75 | `ui.*signals` | negative, positive, signal_negative_bells,... |
| special_event_complete_pop_up | 22 | `ui.*special_event_complete_pop_up` | special_event_complete_pop_up |
| success | 3 | `ui.*success` | sfx_success_point_big, sfx_success_point_m... |
| swipe | 3 | `ui.*swipe` | sfx_ui_swipe_screen |
