/**
 * 大杀四方 (Smash Up) 音频配置
 * 仅保留事件解析/规则，音效资源统一来自 registry
 */
import type { GameAudioConfig } from '../../lib/audio/types';
import { createFeedbackResolver, collectPreloadKeys } from '../../lib/audio/defineEvents';
import { pickRandomSoundKey } from '../../lib/audio/audioUtils';
import type { GamePhase, SmashUpCore } from './domain/types';
import { SU_EVENTS, SU_EVENT_TYPES } from './domain/events';
import { normalizeFactionSelectionId, SMASHUP_FACTION_IDS } from './domain/ids';
import { getCardDef } from './data/cards';

type SmashUpAudioCtx = {
    currentPhase: GamePhase;
    isGameOver: boolean;
    isWinner?: boolean;
};

const BGM_NORMAL_KEY = 'bgm.general.casual_music_pack_vol.tiki_party_rt_2.casual_tiki_party_main';
const BGM_BATTLE_KEY = 'bgm.funk.funk_music_pack.move_your_feet_rt_2.funk_move_your_feet_main';
const BGM_BUBBLEGUM_KEY = 'bgm.general.casual_music_pack_vol.bubblegum_rt_2.casual_bubblegum_main';
const BGM_FIELD_DAY_KEY = 'bgm.general.casual_music_pack_vol.field_day_rt_2.casual_field_day_main';
const BGM_LIZARDS_KEY = 'bgm.general.casual_music_pack_vol.lizards_rt_1.casual_lizards_main';
const BGM_BUBBLEGUM_INTENSE_KEY = 'bgm.general.casual_music_pack_vol.bubblegum_rt_2.casual_bubblegum_intensity_2';
const BGM_FIELD_DAY_INTENSE_KEY = 'bgm.general.casual_music_pack_vol.field_day_rt_2.casual_field_day_intensity_2';
const BGM_SUNSET_KEY = 'bgm.general.casual_music_pack_vol.sunset_rt_1.casual_sunset_main';
const BGM_SUNSET_INTENSE_KEY = 'bgm.general.casual_music_pack_vol.sunset_rt_1.casual_sunset_intensity_2';
const BGM_SUNNY_DAYS_KEY = 'bgm.funk.funk_music_pack.sunny_days_rt_2.funk_sunny_days_main';
const BGM_SUNNY_DAYS_INTENSE_KEY = 'bgm.funk.funk_music_pack.sunny_days_rt_2.funk_sunny_days_intensity_2';
const BGM_BIG_SHOT_KEY = 'bgm.funk.funk_music_pack.big_shot_rt_4.funk_big_shot_main';
const BGM_BIG_SHOT_INTENSE_KEY = 'bgm.funk.funk_music_pack.big_shot_rt_4.funk_big_shot_intensity_2';
const BGM_MOVE_YOUR_FEET_INTENSE_KEY = 'bgm.funk.funk_music_pack.move_your_feet_rt_2.funk_move_your_feet_intensity_2';
const BGM_TIKI_INTENSE_KEY = 'bgm.general.casual_music_pack_vol.tiki_party_rt_2.casual_tiki_party_intensity_2';
const BGM_NOBODY_KNOWS_KEY = 'bgm.funk.funk_music_pack.nobody_knows_rt_4.funk_nobody_knows_intensity_1';
const BGM_NOBODY_KNOWS_INTENSE_KEY = 'bgm.funk.funk_music_pack.nobody_knows_rt_4.funk_nobody_knows_intensity_2';
const STINGER_WIN_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win';
const STINGER_LOSE_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';

const SELECTION_KEY = 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';
const POSITIVE_SIGNAL_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const UPDATE_CHIME_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';

const MINION_PLAY_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
const ACTION_PLAY_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001';
const CARD_DRAW_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const CARD_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';

const MOVE_KEY = 'card.handling.mini_games_sound_effects_and_music_pack.card.sfx_card_play_1';
const POWER_GAIN_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const MADNESS_KEY = 'magic.dark.32.dark_spell_01';

// 僵尸随从：DFS zombie_voices（语义高度匹配）
const ZOMBIE_MINION_KEYS = [
    'dark_fantasy_studio.zombie_voices.zombies_1',
];
// 僵尸行动：保留原有暗影哀嚎/墓穴低语
const ZOMBIE_ACTION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_001',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_002',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_003',
];
const WIZARD_MINION_KEYS = [
    'magic.general.spells_variations_vol_1.arcane_blast.magspel_arcane_blast_01_krst',
    'magic.general.spells_variations_vol_1.arcane_blast.magspel_arcane_blast_02_krst',
    'magic.general.spells_variations_vol_1.arcane_blast.magspel_arcane_blast_03_krst',
];
const WIZARD_ACTION_KEYS = [
    'magic.general.spells_variations_vol_1.little_arcane_blast.magspel_little_arcane_blast_01_krst',
    'magic.general.spells_variations_vol_1.little_arcane_blast.magspel_little_arcane_blast_02_krst',
    'magic.general.spells_variations_vol_1.little_arcane_blast.magspel_little_arcane_blast_03_krst',
];
const DINO_MINION_KEYS = [
    'monster.general.files.14.short_roar_01',
    'monster.general.files.14.short_roar_02',
    'monster.general.files.15.long_roar_01',
];
const DINO_ACTION_KEYS = [
    'magic.general.spells_variations_vol_2.beastly_chomp.creamnstr_beastly_chomp_01_krst_none',
    'magic.general.spells_variations_vol_2.beastly_chomp.creamnstr_beastly_chomp_02_krst_none',
    'magic.fire.3.fire_earthquake',
];
const ALIEN_MINION_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_scifi_charge_generic_1',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_scifi_charge_generic_2',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_scifi_charge_generic_3',
];
const ALIEN_ACTION_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_scifi_shoot_1',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_scifi_shoot_2',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_scifi_shoot_3',
];
const PIRATE_MINION_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_retro_shoot_1',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_retro_shoot_2',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_retro_shoot_3',
];
const PIRATE_ACTION_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_generic_b_shoot_1',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_generic_b_shoot_2',
    'combat.general.mini_games_sound_effects_and_music_pack.gun.shoot.sfx_gun_generic_b_shoot_3',
];
const COWBOY_MINION_KEYS = [
    'combat.guns_sound_fx_pack.misc_ammo_boxes_holsters_etc.leather_unholster_001',
    'combat.guns_sound_fx_pack.misc_ammo_boxes_holsters_etc.leather_unholster_002',
    'combat.guns_sound_fx_pack.misc_ammo_boxes_holsters_etc.leather_unholster_003',
];
const COWBOY_ACTION_KEYS = [
    'combat.guns_sound_fx_pack.misc_ammo_boxes_holsters_etc.leather_unholster_001',
    'combat.guns_sound_fx_pack.30_30_lever_action_rifle.foley.30_30_lever_action_rifle_lever_001',
    'combat.guns_sound_fx_pack.30_30_lever_action_rifle.foley.30_30_lever_action_rifle_lever_002',
    'combat.guns_sound_fx_pack.38_spl_revolver.gunshots.38_spl_revolver_gunshot_a_001',
    'combat.explosives_sound_fx_pack.fuse.dynamite_fuse_start_001',
    'coins.decks_and_cards_sound_fx_pack.gold_pouch_handle_001',
    'coins.decks_and_cards_sound_fx_pack.small_reward_001',
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.movement.hoof_move_step_001',
];
const COWBOY_ACTION_FALLBACK_KEYS = [
    'combat.guns_sound_fx_pack.misc_ammo_boxes_holsters_etc.leather_unholster_001',
    'combat.guns_sound_fx_pack.30_30_lever_action_rifle.foley.30_30_lever_action_rifle_lever_001',
    'combat.guns_sound_fx_pack.30_30_lever_action_rifle.foley.30_30_lever_action_rifle_lever_002',
];
const MERMAID_MINION_KEYS = [
    'ambient.water_sound_fx_pack_vol.splashes_and_movement.fast_short_swirl_a',
    'ambient.water_sound_fx_pack_vol.bubbles.bubbles_short_a',
];
const MERMAID_ACTION_KEYS = [
    'ambient.water_sound_fx_pack_vol.designed.water_ball_spell_small',
    'ambient.water_sound_fx_pack_vol.designed.water_ball_spell_big',
    'ambient.water_sound_fx_pack_vol.splashes_and_movement.big_splash_a',
];
const NINJA_MINION_KEYS = [
    'combat.general.forged_in_fury_vol_1.katana.double_katana_whoosh.dsgnwhsh_double_katana_whoosh_01_krst',
    'combat.general.forged_in_fury_vol_1.katana.double_katana_whoosh.dsgnwhsh_double_katana_whoosh_02_krst',
    'combat.general.forged_in_fury_vol_1.katana.double_katana_whoosh.dsgnwhsh_double_katana_whoosh_03_krst',
];
const NINJA_ACTION_KEYS = [
    'combat.general.forged_in_fury_vol_1.katana.katana_only_hit_layer.fghtimpt_katana_only_hit_layer_01_krst',
    'combat.general.forged_in_fury_vol_1.katana.katana_only_hit_layer.fghtimpt_katana_only_hit_layer_02_krst',
    'combat.general.forged_in_fury_vol_1.katana.katana_only_hit_layer.fghtimpt_katana_only_hit_layer_03_krst',
];
const ROBOT_MINION_KEYS = [
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robotic_limb_single_a3',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robotic_limb_single_a4',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robotic_limb_single_b2',
];
const ROBOT_ACTION_KEYS = [
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robotic_limb_single_a1',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robotic_limb_single_a2',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robotic_limb_single_b1',
];
// 幽灵随从：DFS ghostly 系列（语义匹配，最短音效）
const GHOST_MINION_KEYS = [
    'dark_fantasy_studio.ghostly.ghostly_33',
    'dark_fantasy_studio.ghostly.ghostly_34',
    'dark_fantasy_studio.ghostly.ghostly_35',
];
const GHOST_ACTION_KEYS = [
    'magic.general.spells_variations_vol_3.wailing_rite.magevil_wailing_rite_04_krst_none',
    'magic.general.spells_variations_vol_3.wailing_rite.magevil_wailing_rite_05_krst_none',
    'magic.general.spells_variations_vol_3.wailing_rite.magevil_wailing_rite_06_krst_none',
];
const TRICKSTER_MINION_KEYS = [
    'monster.general.khron_studio_monster_library_vol_3_assets.goblin.goblin_attack.creahmn_goblin_attack_01',
    'monster.general.khron_studio_monster_library_vol_3_assets.goblin.goblin_attack.creahmn_goblin_attack_02',
    'monster.general.khron_studio_monster_library_vol_3_assets.goblin.goblin_attack.creahmn_goblin_attack_03',
];
const TRICKSTER_ACTION_KEYS = [
    'magic.general.spells_variations_vol_2.twinkle_tweak.magspel_twinkle_tweak_01_krst_none',
    'magic.general.spells_variations_vol_2.twinkle_tweak.magspel_twinkle_tweak_02_krst_none',
    'magic.general.spells_variations_vol_2.twinkle_tweak.magspel_twinkle_tweak_03_krst_none',
];
// 蒸汽朋克：DFS steam 系列（最短音效，随从/行动各一个）
const STEAMPUNK_MINION_KEYS = [
    'dark_fantasy_studio.steam.steam_26',
];
const STEAMPUNK_ACTION_KEYS = [
    'dark_fantasy_studio.steam.steam_28',
];
const KILLER_PLANT_MINION_KEYS = [
    'ambient.khron_studio_sound_of_survival_vol_1_assets.items.item_or_weapon_hit_plants.weapmisc_item_or_weapon_hit_plants_01_krst',
    'ambient.khron_studio_sound_of_survival_vol_1_assets.items.item_or_weapon_hit_plants.weapmisc_item_or_weapon_hit_plants_02_krst',
    'ambient.khron_studio_sound_of_survival_vol_1_assets.items.item_or_weapon_hit_plants.weapmisc_item_or_weapon_hit_plants_03_krst',
];
const KILLER_PLANT_ACTION_KEYS = [
    'fantasy.poison_sword_whoosh_01',
    'fantasy.poison_sword_whoosh_02',
    'fantasy.poison_sword_whoosh_03',
];
const BEAR_CAVALRY_MINION_KEYS = [
    'monster.general.files.10.growl_with_slobber_01',
    'monster.general.files.10.growl_with_slobber_02',
    'monster.general.files.10.growl_with_slobber_03',
];
const BEAR_CAVALRY_ACTION_KEYS = [
    'monster.general.files.9.growl_01',
    'monster.general.files.9.growl_02',
    'monster.general.files.9.growl_03',
];
const CTHULHU_MINION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_maelstrom_roar_001',
    'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_maelstrom_roar_002',
    'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_maelstrom_roar_003',
];
const CTHULHU_ACTION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_tidal_rush_001',
    'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_tidal_rush_002',
    'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_tidal_rush_003',
];
const ELDER_THING_MINION_KEYS = [
    'magic.general.spells_variations_vol_1.shadowstrike_beam.magspel_shadowstrike_beam_01_krst',
    'magic.general.spells_variations_vol_1.shadowstrike_beam.magspel_shadowstrike_beam_02_krst',
    'magic.general.spells_variations_vol_1.shadowstrike_beam.magspel_shadowstrike_beam_03_krst',
];
const ELDER_THING_ACTION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_astral_flare_001',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_astral_flare_002',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_astral_flare_003',
];
const INNSMOUTH_MINION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_maelstrom_roar_004',
    'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_maelstrom_roar_005',
    'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_maelstrom_roar_006',
];
const INNSMOUTH_ACTION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_tidal_rush_004',
    'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_tidal_rush_005',
    'magic.general.modern_magic_sound_fx_pack_vol.water_magic.water_magic_tidal_rush_006',
];
const MISKATONIC_MINION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_glyphic_resonance_001',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_glyphic_resonance_002',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_glyphic_resonance_003',
];
const MISKATONIC_ACTION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_001',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_002',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_003',
];

// 狼人：统一用攻击音效（风格一致）
const WEREWOLF_MINION_KEYS = [
    'fantasy.gothic_fantasy_sound_fx_pack_vol.creatures.werewolf_attack_001',
    'fantasy.gothic_fantasy_sound_fx_pack_vol.creatures.werewolf_attack_002',
    'fantasy.gothic_fantasy_sound_fx_pack_vol.creatures.werewolf_attack_003',
];
const WEREWOLF_ACTION_KEYS = [
    'fantasy.gothic_fantasy_sound_fx_pack_vol.creatures.werewolf_attack_001',
    'fantasy.gothic_fantasy_sound_fx_pack_vol.creatures.werewolf_attack_002',
    'fantasy.gothic_fantasy_sound_fx_pack_vol.creatures.werewolf_attack_003',
];

// 科学怪人：统一用电流音效（风格一致）
const FRANKENSTEIN_MINION_KEYS = [
    'magic.general.spells_variations_vol_1.electrified_whoosh.magspel_electrified_whoosh_01_krst',
    'magic.general.spells_variations_vol_1.electrified_whoosh.magspel_electrified_whoosh_02_krst',
];
const FRANKENSTEIN_ACTION_KEYS = [
    'magic.general.spells_variations_vol_1.electrified_whoosh.magspel_electrified_whoosh_01_krst',
    'magic.general.spells_variations_vol_1.electrified_whoosh.magspel_electrified_whoosh_02_krst',
];

// 吸血鬼：统一用暗影魔法音效（风格一致）
const VAMPIRE_MINION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_001',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_002',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_003',
];
const VAMPIRE_ACTION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_001',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_shadow_wail_002',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_003',
];

// 巨蚁：统一用嗡鸣音效（风格一致）
const GIANT_ANT_MINION_KEYS = [
    'cyberpunk.cyberpunk_sound_fx_pack_vol.buzz_and_hum.buzzing',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.buzz_and_hum.buzz_and_hum_a',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.buzz_and_hum.buzz_and_hum_b',
];
const GIANT_ANT_ACTION_KEYS = [
    'cyberpunk.cyberpunk_sound_fx_pack_vol.buzz_and_hum.buzzing',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.buzz_and_hum.buzz_and_hum_a',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.buzz_and_hum.buzz_and_hum_b',
];
const ANCIENT_EGYPTIAN_MINION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_001',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_002',
    'dark_fantasy_studio.dimensional_portal.dimensional_portal_1',
];
const ANCIENT_EGYPTIAN_ACTION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_003',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_002',
];
const CYBORG_APE_MINION_KEYS = [
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.fight.melee.steel_fist_punch_001',
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.fight.melee.pixel_punch_001',
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.fight.melee.pixel_punch_002',
];
const CYBORG_APE_ACTION_KEYS = [
    'foley.analogue_gear_sound_fx_pack_vol.audio_devices.handheld_radio_buttons_a',
    'foley.analogue_gear_sound_fx_pack_vol.audio_devices.handheld_radio_buttons_b',
    'system.computers_machinery_sound_fx_pack_vol.misc.machinery.mech_transform_001',
];
const DRAGON_MINION_KEYS = [
    'monster.general.khron_studio_monster_library_vol_3_assets.dragon.dragon_roar.creadrgn_dragon_roar_01',
    'monster.general.khron_studio_monster_library_vol_3_assets.dragon.dragon_roar.creadrgn_dragon_roar_02',
    'monster.general.khron_studio_monster_library_vol_3_assets.dragon.dragon_attack.creadrgn_dragon_attack_01',
];
const DRAGON_ACTION_KEYS = [
    'monster.general.khron_studio_monster_library_vol_3_assets.dragon.dragon_attack.creadrgn_dragon_attack_02',
    'monster.general.khron_studio_monster_library_vol_3_assets.dragon.dragon_wings.wingcrea_dragon_wings_01',
    'magic.fire.3.fire_earthquake',
];
const FAIRY_MINION_KEYS = [
    'status.general.player_status_sound_fx_pack.fantasy.fantasy_fairy_dust_001',
    'status.general.player_status_sound_fx_pack.fantasy.fantasy_fairy_dust_002',
    'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_sparkle_a',
];
const FAIRY_ACTION_KEYS = [
    'magic.general.spells_variations_vol_2.twinkle_tweak.magspel_twinkle_tweak_04_krst_none',
    'magic.general.spells_variations_vol_2.twinkle_tweak.magspel_twinkle_tweak_05_krst_none',
    'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_b',
];
const GEEK_MINION_KEYS = [
    'ui.general.ui_menu_sound_fx_pack_vol.misc.interaction.interaction_mechanic_a',
    'ui.general.ui_menu_sound_fx_pack_vol.misc.interaction.interaction_mechanic_b',
    'ui.general.ui_menu_sound_fx_pack_vol.misc.interaction.interaction_mechanic_c',
];
const GEEK_ACTION_KEYS = [
    'ui.general.ui_menu_sound_fx_pack_vol.misc.interaction.interaction_mechanic_d',
    'ui.general.ui_menu_sound_fx_pack_vol.misc.interaction.interaction_mechanic_e',
    'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_c',
];
const HULUWAWA_MINION_KEYS = [
    'magic.water.12.water_spell_01',
    'status.general.player_status_sound_fx_pack_vol.action_and_interaction.water_ready_a',
    'magic.general.spells_variations_vol_2.glinting_bubbles.magelem_glinting_bubbles_01_krst_none',
];
const HULUWAWA_ACTION_KEYS = [
    'magic.general.simple_magic_sound_fx_pack_vol.water.aqua_jet_cast_a',
    'magic.general.simple_magic_sound_fx_pack_vol.water.aqua_jet_impact_a',
    'ambient.water_sound_fx_pack_vol.designed.water_ball_spell_small',
];
const ITTY_CRITTER_MINION_KEYS = [
    'status.general.player_status_sound_fx_pack.fantasy.fantasy_fairy_dust_003',
    'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_sparkle_c',
    'magic.general.spells_variations_vol_2.twinkle_tweak.magspel_twinkle_tweak_06_krst_none',
];
const ITTY_CRITTER_ACTION_KEYS = [
    'magic.general.spells_variations_vol_2.twinkle_tweak.magspel_twinkle_tweak_07_krst_none',
    'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a',
    'status.general.player_status_sound_fx_pack.fantasy.fantasy_fairy_dust_004',
];
const KAIJU_MINION_KEYS = [
    'monster.general.khron_studio_monster_library_vol_3_assets.dragon.dragon_roar.creadrgn_dragon_roar_03',
    'monster.general.khron_studio_monster_library_vol_3_assets.dragon.dragon_attack.creadrgn_dragon_attack_03',
    'magic.fire.3.fire_earthquake',
];
const KAIJU_ACTION_KEYS = [
    'system.computers_machinery_sound_fx_pack_vol.misc.energy.laser_emitter_002',
    'monster.general.khron_studio_monster_library_vol_3_assets.dragon.dragon_attack.creadrgn_dragon_attack_04',
    'magic.fire.2.fire_earthquake_with_lava',
];
const MEGA_TROOPER_MINION_KEYS = [
    'system.computers_machinery_sound_fx_pack_vol.misc.machinery.mech_transform_002',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robotic_limb_single_b4',
    'system.computers_machinery_sound_fx_pack_vol.misc.energy.laser_emitter_003',
];
const MEGA_TROOPER_ACTION_KEYS = [
    'system.computers_machinery_sound_fx_pack_vol.misc.energy.laser_emitter_004',
    'system.computers_machinery_sound_fx_pack_vol.misc.machinery.mech_transform_003',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_004',
];
const MYTHIC_GREEK_MINION_KEYS = [
    'magic.general.spells_variations_vol_2.colossal_shield_scrape.magmisc_colossal_shield_scrape_01_krst_none',
    'magic.general.spells_variations_vol_2.colossal_shield_scrape.magmisc_colossal_shield_scrape_02_krst_none',
    'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a',
];
const MYTHIC_GREEK_ACTION_KEYS = [
    'magic.general.spells_variations_vol_2.colossal_shield_scrape.magmisc_colossal_shield_scrape_03_krst_none',
    'combat.general.khron_studio_fight_fury_vol_1_assets.strong_generic_punch.fghtimpt_strong_generic_punch_04',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_005',
];
const SHAPESHIFTER_MINION_KEYS = [
    'dark_fantasy_studio.dimensional_portal.dimensional_portal_2',
    'dark_fantasy_studio.dimensional_portal.dimensional_portal_3',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_006',
];
const SHAPESHIFTER_ACTION_KEYS = [
    'dark_fantasy_studio.dimensional_portal.dimensional_portal_4',
    'dark_fantasy_studio.dimensional_portal.dimensional_portal_5',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_007',
];
const SHARK_MINION_KEYS = [
    'magic.general.spells_variations_vol_2.beastly_chomp.creamnstr_beastly_chomp_01_krst_none',
    'magic.general.spells_variations_vol_2.beastly_chomp.creamnstr_beastly_chomp_02_krst_none',
    'magic.general.spells_variations_vol_2.beastly_chomp.creamnstr_beastly_chomp_03_krst_none',
];
const SHARK_ACTION_KEYS = [
    'ambient.water_sound_fx_pack_vol.designed.water_ball_spell_big',
    'ambient.water_sound_fx_pack_vol.splashes_and_movement.big_splash_a',
    'magic.general.spells_variations_vol_2.beastly_chomp.creamnstr_beastly_chomp_04_krst_none',
];
const SKELETON_MINION_KEYS = [
    'monster.general.khron_studio_monster_library_vol_4_assets.skeleton.skeleton_attack.creahmn_skeleton_attack_01',
    'monster.general.khron_studio_monster_library_vol_4_assets.skeleton.skeleton_attack.creahmn_skeleton_attack_02',
    'monster.general.khron_studio_monster_library_vol_4_assets.skeleton.skeleton_attack.creahmn_skeleton_attack_03',
];
const SKELETON_ACTION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_004',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_005',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_006',
];
const SUPERHERO_MINION_KEYS = [
    'combat.general.khron_studio_fight_fury_vol_1_assets.strong_generic_punch.fghtimpt_strong_generic_punch_05',
    'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a',
    'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a',
];
const SUPERHERO_ACTION_KEYS = [
    'combat.general.khron_studio_fight_fury_vol_1_assets.strong_generic_punch.fghtimpt_strong_generic_punch_06',
    'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_sparkle_a',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001',
];
const SUPER_SPY_MINION_KEYS = [
    'ui.general.ui_menu_sound_fx_pack_vol.misc.interaction.interaction_mechanic_f',
    'ui.general.ui_menu_sound_fx_pack_vol.misc.interaction.interaction_mechanic_g',
    'ui.general.ui_menu_sound_fx_pack_vol.misc.interaction.interaction_mechanic_h',
];
const SUPER_SPY_ACTION_KEYS = [
    'ui.general.ui_menu_sound_fx_pack_vol.misc.interaction.interaction_mechanic_i',
    'ui.general.ui_menu_sound_fx_pack_vol.misc.interaction.interaction_mechanic_j',
    'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a',
];
const TIME_TRAVELER_MINION_KEYS = [
    'ambient.khron_studio_sound_of_survival_vol_1_assets.home.metalic_safe.turn_safe_security_system.clocktick_turn_safe_security_system_01_krst',
    'ambient.khron_studio_sound_of_survival_vol_1_assets.home.metalic_safe.turn_safe_security_system.clocktick_turn_safe_security_system_02_krst',
    'dark_fantasy_studio.dimensional_portal.dimensional_portal_6',
];
const TIME_TRAVELER_ACTION_KEYS = [
    'dark_fantasy_studio.dimensional_portal.dimensional_portal_7',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_006',
    'system.computers_machinery_sound_fx_pack_vol.misc.energy.laser_emitter_001',
];
const TORNADO_MINION_KEYS = [
    'magic.wind.43.wind_spell_03',
    'magic.wind.41.wind_whoosh_01',
    'magic.wind.41.wind_whoosh_02',
];
const TORNADO_ACTION_KEYS = [
    'magic.wind.40.wind_hit_01',
    'magic.wind.40.wind_hit_02',
    'magic.wind.44.wind_magic_buff_01',
];
const VIKING_MINION_KEYS = [
    'combat.general.forged_in_fury_vol_1.heavy_axe.heavy_axe_hard_whoosh.weapaxe_heavy_axe_hard_whoosh_01_krst',
    'combat.general.forged_in_fury_vol_1.heavy_axe.heavy_axe_hard_whoosh.weapaxe_heavy_axe_hard_whoosh_02_krst',
    'combat.general.forged_in_fury_vol_1.heavy_axe.heavy_axe_hard_whoosh.weapaxe_heavy_axe_hard_whoosh_03_krst',
];
const VIKING_ACTION_KEYS = [
    'combat.general.forged_in_fury_vol_1.heavy_axe.heavy_axe_strike.weapaxe_heavy_axe_strike_01_krst',
    'combat.general.forged_in_fury_vol_1.heavy_axe.heavy_axe_strike.weapaxe_heavy_axe_strike_02_krst',
    'combat.general.forged_in_fury_vol_1.heavy_axe.heavy_axe_strike.weapaxe_heavy_axe_strike_03_krst',
];
const WORLD_CHAMP_MINION_KEYS = [
    'combat.general.khron_studio_fight_fury_vol_1_assets.strong_generic_punch.fghtimpt_strong_generic_punch_07',
    'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst',
    'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_b',
];
const WORLD_CHAMP_ACTION_KEYS = [
    'combat.general.khron_studio_fight_fury_vol_1_assets.strong_generic_punch.fghtimpt_strong_generic_punch_08',
    'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_02_krst',
    'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_sparkle_b',
];
const KUNG_FU_FIGHTER_MINION_KEYS = [
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.fight.melee.kung_fu_shout_001',
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.fight.melee.kung_fu_shout_002',
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.fight.melee.kung_fu_shout_003',
];
const KUNG_FU_FIGHTER_ACTION_KEYS = [
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.fight.melee.kick_001',
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.fight.melee.pixel_punch_001',
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.fight.melee.steel_fist_punch_001',
];
const VIGILANTE_MINION_KEYS = [
    'combat.guns_sound_fx_pack.30_30_lever_action_rifle.foley.30_30_lever_action_rifle_lever_001',
    'combat.guns_sound_fx_pack.30_30_lever_action_rifle.foley.30_30_lever_action_rifle_lever_002',
    'combat.guns_sound_fx_pack.38_spl_revolver.gunshots.38_spl_revolver_gunshot_a_001',
];
const VIGILANTE_ACTION_KEYS = [
    'combat.guns_sound_fx_pack.38_spl_revolver.gunshots.38_spl_revolver_gunshot_a_002',
    'combat.guns_sound_fx_pack.12ga_pump_shotgun.foley.12ga_pump_shotgun_pump_001',
    'combat.guns_sound_fx_pack.30_30_lever_action_rifle.gunshots.30_30_lever_action_rifle_gunshot_a_001',
];
const TRUCKER_MINION_KEYS = [
    'system.computers_machinery_sound_fx_pack_vol.misc.machinery.mech_transform_001',
    'system.computers_machinery_sound_fx_pack_vol.misc.machinery.mech_transform_002',
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.machinery.lever_001',
];
const TRUCKER_ACTION_KEYS = [
    'system.computers_machinery_sound_fx_pack_vol.foley_and_impacts.foley.tools_metal_foley_001',
    'system.computers_machinery_sound_fx_pack_vol.foley_and_impacts.foley.tools_metal_foley_002',
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.machinery.lever_002',
];
const DISCO_DANCER_MINION_KEYS = [
    'system.success_and_failure_sound_fx_pack_vol.successes.party_horn_short_a',
    'system.success_and_failure_sound_fx_pack_vol.successes.party_horn_short_b',
    'system.success_and_failure_sound_fx_pack_vol.successes.party_horn_short_c',
];
const DISCO_DANCER_ACTION_KEYS = [
    'foley.analogue_gear_sound_fx_pack_vol.home_media.vinyl_player_a',
    'foley.analogue_gear_sound_fx_pack_vol.home_media.vinyl_record_handling_a',
    'foley.analogue_gear_sound_fx_pack_vol.home_media.casette_tape_handling_a',
];

const FACTION_SFX_KEYS: Record<string, string[]> = {
    [SMASHUP_FACTION_IDS.ZOMBIES]: [...ZOMBIE_MINION_KEYS, ...ZOMBIE_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.WIZARDS]: [...WIZARD_MINION_KEYS, ...WIZARD_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.DINOSAURS]: [...DINO_MINION_KEYS, ...DINO_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.ALIENS]: [...ALIEN_MINION_KEYS, ...ALIEN_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.PIRATES]: [...PIRATE_MINION_KEYS, ...PIRATE_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.COWBOYS]: [...COWBOY_MINION_KEYS, ...COWBOY_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.COWBOYS_POD]: [...COWBOY_MINION_KEYS, ...COWBOY_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.MERMAIDS]: [...MERMAID_MINION_KEYS, ...MERMAID_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.NINJAS]: [...NINJA_MINION_KEYS, ...NINJA_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.ROBOTS]: [...ROBOT_MINION_KEYS, ...ROBOT_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.GHOSTS]: [...GHOST_MINION_KEYS, ...GHOST_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.TRICKSTERS]: [...TRICKSTER_MINION_KEYS, ...TRICKSTER_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.STEAMPUNKS]: [...STEAMPUNK_MINION_KEYS, ...STEAMPUNK_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.KILLER_PLANTS]: [...KILLER_PLANT_MINION_KEYS, ...KILLER_PLANT_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.BEAR_CAVALRY]: [...BEAR_CAVALRY_MINION_KEYS, ...BEAR_CAVALRY_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU]: [...CTHULHU_MINION_KEYS, ...CTHULHU_ACTION_KEYS, MADNESS_KEY],
    [SMASHUP_FACTION_IDS.ELDER_THINGS]: [...ELDER_THING_MINION_KEYS, ...ELDER_THING_ACTION_KEYS, MADNESS_KEY],
    [SMASHUP_FACTION_IDS.INNSMOUTH]: [...INNSMOUTH_MINION_KEYS, ...INNSMOUTH_ACTION_KEYS, MADNESS_KEY],
    [SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY]: [...MISKATONIC_MINION_KEYS, ...MISKATONIC_ACTION_KEYS, MADNESS_KEY],
    [SMASHUP_FACTION_IDS.WEREWOLVES]: [...WEREWOLF_MINION_KEYS, ...WEREWOLF_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.FRANKENSTEIN]: [...FRANKENSTEIN_MINION_KEYS, ...FRANKENSTEIN_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.VAMPIRES]: [...VAMPIRE_MINION_KEYS, ...VAMPIRE_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.GIANT_ANTS]: [...GIANT_ANT_MINION_KEYS, ...GIANT_ANT_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.ANCIENT_EGYPTIANS]: [...ANCIENT_EGYPTIAN_MINION_KEYS, ...ANCIENT_EGYPTIAN_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.CYBORG_APES]: [...CYBORG_APE_MINION_KEYS, ...CYBORG_APE_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.DRAGONS]: [...DRAGON_MINION_KEYS, ...DRAGON_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.FAIRIES]: [...FAIRY_MINION_KEYS, ...FAIRY_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.GEEKS]: [...GEEK_MINION_KEYS, ...GEEK_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.HULUWAWA]: [...HULUWAWA_MINION_KEYS, ...HULUWAWA_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.ITTY_CRITTERS]: [...ITTY_CRITTER_MINION_KEYS, ...ITTY_CRITTER_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.KAIJU]: [...KAIJU_MINION_KEYS, ...KAIJU_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.MAGICAL_GIRLS]: [...FAIRY_MINION_KEYS, ...FAIRY_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.MEGA_TROOPERS]: [...MEGA_TROOPER_MINION_KEYS, ...MEGA_TROOPER_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.MYTHIC_GREEKS]: [...MYTHIC_GREEK_MINION_KEYS, ...MYTHIC_GREEK_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.PRINCESSES]: [...FAIRY_MINION_KEYS, ...FAIRY_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.SAMURAI]: [...NINJA_MINION_KEYS, ...NINJA_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.SHAPESHIFTERS]: [...SHAPESHIFTER_MINION_KEYS, ...SHAPESHIFTER_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.SHARKS]: [...SHARK_MINION_KEYS, ...SHARK_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.SKELETONS]: [...SKELETON_MINION_KEYS, ...SKELETON_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.SUPERHEROES]: [...SUPERHERO_MINION_KEYS, ...SUPERHERO_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.SUPER_SPIES]: [...SUPER_SPY_MINION_KEYS, ...SUPER_SPY_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.TIME_TRAVELERS]: [...TIME_TRAVELER_MINION_KEYS, ...TIME_TRAVELER_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.TORNADOS]: [...TORNADO_MINION_KEYS, ...TORNADO_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.VIKINGS]: [...VIKING_MINION_KEYS, ...VIKING_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.WORLD_CHAMPS]: [...WORLD_CHAMP_MINION_KEYS, ...WORLD_CHAMP_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.KUNG_FU_FIGHTERS]: [...KUNG_FU_FIGHTER_MINION_KEYS, ...KUNG_FU_FIGHTER_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.VIGILANTES]: [...VIGILANTE_MINION_KEYS, ...VIGILANTE_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.TRUCKERS]: [...TRUCKER_MINION_KEYS, ...TRUCKER_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.DISCO_DANCERS]: [...DISCO_DANCER_MINION_KEYS, ...DISCO_DANCER_ACTION_KEYS],
};

const collectFactionPreloadKeys = (factionIds: string[]): string[] => {
    const keys = new Set<string>();
    for (const factionId of factionIds) {
        const normalizedFactionId = normalizeFactionSelectionId(factionId);
        const list = FACTION_SFX_KEYS[factionId] ?? FACTION_SFX_KEYS[normalizedFactionId];
        if (list) list.forEach(key => keys.add(key));
    }
    return Array.from(keys);
};

/**
 * 解析卡牌音效 key
 * 优先级：卡牌配置的 soundKey > 派系默认音效池
 */
const resolveFactionSound = (defId: string | undefined, cardType: 'minion' | 'action' | 'talent'): string | null => {
    if (!defId) return null;

    // 特殊卡牌：疯狂卡
    if (defId === 'special_madness') {
        return MADNESS_KEY;
    }

    // 优先使用卡牌配置的 soundKey
    const cardDef = getCardDef(defId);
    if (cardDef && 'soundKey' in cardDef && cardDef.soundKey) {
        return cardDef.soundKey;
    }

    // Fallback 到派系默认音效池
    if (defId.startsWith('zombie_')) {
        const keys = cardType === 'action' ? ZOMBIE_ACTION_KEYS : ZOMBIE_MINION_KEYS;
        return pickRandomSoundKey(`smashup.zombie.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('wizard_')) {
        const keys = cardType === 'action' ? WIZARD_ACTION_KEYS : WIZARD_MINION_KEYS;
        return pickRandomSoundKey(`smashup.wizard.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('dino_')) {
        const keys = cardType === 'action' ? DINO_ACTION_KEYS : DINO_MINION_KEYS;
        return pickRandomSoundKey(`smashup.dino.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('alien_')) {
        const keys = cardType === 'action' ? ALIEN_ACTION_KEYS : ALIEN_MINION_KEYS;
        return pickRandomSoundKey(`smashup.alien.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('pirate_')) {
        const keys = cardType === 'action' ? PIRATE_ACTION_KEYS : PIRATE_MINION_KEYS;
        return pickRandomSoundKey(`smashup.pirate.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('cowboys_')) {
        const keys = cardType === 'action' ? COWBOY_ACTION_FALLBACK_KEYS : COWBOY_MINION_KEYS;
        return pickRandomSoundKey(`smashup.cowboys.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('mermaids_')) {
        const keys = cardType === 'action' ? MERMAID_ACTION_KEYS : MERMAID_MINION_KEYS;
        return pickRandomSoundKey(`smashup.mermaids.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('ninja_')) {
        const keys = cardType === 'action' ? NINJA_ACTION_KEYS : NINJA_MINION_KEYS;
        return pickRandomSoundKey(`smashup.ninja.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('robot_')) {
        const keys = cardType === 'action' ? ROBOT_ACTION_KEYS : ROBOT_MINION_KEYS;
        return pickRandomSoundKey(`smashup.robot.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('ghost_')) {
        const keys = cardType === 'action' ? GHOST_ACTION_KEYS : GHOST_MINION_KEYS;
        return pickRandomSoundKey(`smashup.ghost.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('trickster_')) {
        const keys = cardType === 'action' ? TRICKSTER_ACTION_KEYS : TRICKSTER_MINION_KEYS;
        return pickRandomSoundKey(`smashup.trickster.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('steampunk_')) {
        const keys = cardType === 'action' ? STEAMPUNK_ACTION_KEYS : STEAMPUNK_MINION_KEYS;
        return pickRandomSoundKey(`smashup.steampunk.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('killer_plant_')) {
        const keys = cardType === 'action' ? KILLER_PLANT_ACTION_KEYS : KILLER_PLANT_MINION_KEYS;
        return pickRandomSoundKey(`smashup.killer_plant.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('bear_cavalry_')) {
        const keys = cardType === 'action' ? BEAR_CAVALRY_ACTION_KEYS : BEAR_CAVALRY_MINION_KEYS;
        return pickRandomSoundKey(`smashup.bear_cavalry.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('cthulhu_')) {
        const keys = cardType === 'action' ? CTHULHU_ACTION_KEYS : CTHULHU_MINION_KEYS;
        return pickRandomSoundKey(`smashup.cthulhu.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('elder_thing_')) {
        const keys = cardType === 'action' ? ELDER_THING_ACTION_KEYS : ELDER_THING_MINION_KEYS;
        return pickRandomSoundKey(`smashup.elder_thing.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('innsmouth_')) {
        const keys = cardType === 'action' ? INNSMOUTH_ACTION_KEYS : INNSMOUTH_MINION_KEYS;
        return pickRandomSoundKey(`smashup.innsmouth.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('miskatonic_')) {
        const keys = cardType === 'action' ? MISKATONIC_ACTION_KEYS : MISKATONIC_MINION_KEYS;
        return pickRandomSoundKey(`smashup.miskatonic.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('werewolf_')) {
        const keys = cardType === 'action' ? WEREWOLF_ACTION_KEYS : WEREWOLF_MINION_KEYS;
        return pickRandomSoundKey(`smashup.werewolf.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('frankenstein_')) {
        const keys = cardType === 'action' ? FRANKENSTEIN_ACTION_KEYS : FRANKENSTEIN_MINION_KEYS;
        return pickRandomSoundKey(`smashup.frankenstein.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('vampire_')) {
        const keys = cardType === 'action' ? VAMPIRE_ACTION_KEYS : VAMPIRE_MINION_KEYS;
        return pickRandomSoundKey(`smashup.vampire.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('giant_ant_')) {
        const keys = cardType === 'action' ? GIANT_ANT_ACTION_KEYS : GIANT_ANT_MINION_KEYS;
        return pickRandomSoundKey(`smashup.giant_ant.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('ancient_egyptians_')) {
        const keys = cardType === 'action' ? ANCIENT_EGYPTIAN_ACTION_KEYS : ANCIENT_EGYPTIAN_MINION_KEYS;
        return pickRandomSoundKey(`smashup.ancient_egyptians.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('cyborg_apes_')) {
        const keys = cardType === 'action' ? CYBORG_APE_ACTION_KEYS : CYBORG_APE_MINION_KEYS;
        return pickRandomSoundKey(`smashup.cyborg_apes.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('dragons_')) {
        const keys = cardType === 'action' ? DRAGON_ACTION_KEYS : DRAGON_MINION_KEYS;
        return pickRandomSoundKey(`smashup.dragons.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('fairies_')) {
        const keys = cardType === 'action' ? FAIRY_ACTION_KEYS : FAIRY_MINION_KEYS;
        return pickRandomSoundKey(`smashup.fairies.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('geeks_')) {
        const keys = cardType === 'action' ? GEEK_ACTION_KEYS : GEEK_MINION_KEYS;
        return pickRandomSoundKey(`smashup.geeks.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('huluwawa_')) {
        const keys = cardType === 'action' ? HULUWAWA_ACTION_KEYS : HULUWAWA_MINION_KEYS;
        return pickRandomSoundKey(`smashup.huluwawa.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('itty_critters_')) {
        const keys = cardType === 'action' ? ITTY_CRITTER_ACTION_KEYS : ITTY_CRITTER_MINION_KEYS;
        return pickRandomSoundKey(`smashup.itty_critters.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('kaiju_')) {
        const keys = cardType === 'action' ? KAIJU_ACTION_KEYS : KAIJU_MINION_KEYS;
        return pickRandomSoundKey(`smashup.kaiju.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('magical_girls_')) {
        const keys = cardType === 'action' ? FAIRY_ACTION_KEYS : FAIRY_MINION_KEYS;
        return pickRandomSoundKey(`smashup.magical_girls.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('mega_troopers_')) {
        const keys = cardType === 'action' ? MEGA_TROOPER_ACTION_KEYS : MEGA_TROOPER_MINION_KEYS;
        return pickRandomSoundKey(`smashup.mega_troopers.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('mythic_greeks_')) {
        const keys = cardType === 'action' ? MYTHIC_GREEK_ACTION_KEYS : MYTHIC_GREEK_MINION_KEYS;
        return pickRandomSoundKey(`smashup.mythic_greeks.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('princesses_')) {
        const keys = cardType === 'action' ? FAIRY_ACTION_KEYS : FAIRY_MINION_KEYS;
        return pickRandomSoundKey(`smashup.princesses.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('samurai_')) {
        const keys = cardType === 'action' ? NINJA_ACTION_KEYS : NINJA_MINION_KEYS;
        return pickRandomSoundKey(`smashup.samurai.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('shapeshifters_')) {
        const keys = cardType === 'action' ? SHAPESHIFTER_ACTION_KEYS : SHAPESHIFTER_MINION_KEYS;
        return pickRandomSoundKey(`smashup.shapeshifters.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('sharks_')) {
        const keys = cardType === 'action' ? SHARK_ACTION_KEYS : SHARK_MINION_KEYS;
        return pickRandomSoundKey(`smashup.sharks.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('skeletons_')) {
        const keys = cardType === 'action' ? SKELETON_ACTION_KEYS : SKELETON_MINION_KEYS;
        return pickRandomSoundKey(`smashup.skeletons.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('superheroes_')) {
        const keys = cardType === 'action' ? SUPERHERO_ACTION_KEYS : SUPERHERO_MINION_KEYS;
        return pickRandomSoundKey(`smashup.superheroes.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('super_spies_')) {
        const keys = cardType === 'action' ? SUPER_SPY_ACTION_KEYS : SUPER_SPY_MINION_KEYS;
        return pickRandomSoundKey(`smashup.super_spies.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('time_travelers_')) {
        const keys = cardType === 'action' ? TIME_TRAVELER_ACTION_KEYS : TIME_TRAVELER_MINION_KEYS;
        return pickRandomSoundKey(`smashup.time_travelers.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('tornados_')) {
        const keys = cardType === 'action' ? TORNADO_ACTION_KEYS : TORNADO_MINION_KEYS;
        return pickRandomSoundKey(`smashup.tornados.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('vikings_')) {
        const keys = cardType === 'action' ? VIKING_ACTION_KEYS : VIKING_MINION_KEYS;
        return pickRandomSoundKey(`smashup.vikings.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('world_champs_')) {
        const keys = cardType === 'action' ? WORLD_CHAMP_ACTION_KEYS : WORLD_CHAMP_MINION_KEYS;
        return pickRandomSoundKey(`smashup.world_champs.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('kung_fu_fighters_')) {
        const keys = cardType === 'action' ? KUNG_FU_FIGHTER_ACTION_KEYS : KUNG_FU_FIGHTER_MINION_KEYS;
        return pickRandomSoundKey(`smashup.kung_fu_fighters.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('vigilantes_')) {
        const keys = cardType === 'action' ? VIGILANTE_ACTION_KEYS : VIGILANTE_MINION_KEYS;
        return pickRandomSoundKey(`smashup.vigilantes.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('truckers_')) {
        const keys = cardType === 'action' ? TRUCKER_ACTION_KEYS : TRUCKER_MINION_KEYS;
        return pickRandomSoundKey(`smashup.truckers.${cardType}`, keys, { minGap: 1 });
    }
    if (defId.startsWith('disco_dancers_')) {
        const keys = cardType === 'action' ? DISCO_DANCER_ACTION_KEYS : DISCO_DANCER_MINION_KEYS;
        return pickRandomSoundKey(`smashup.disco_dancers.${cardType}`, keys, { minGap: 1 });
    }

    // 未配置音效池的派系，返回 null（静默）
    return null;
};

// 创建基础 feedbackResolver（框架自动处理 events.ts 中的 sound 配置）
const baseFeedbackResolver = createFeedbackResolver(SU_EVENTS);

export const SMASHUP_AUDIO_CONFIG: GameAudioConfig = {
    // 自动收集 SU_EVENTS 中所有 immediate/ui 策略的音效 key（零维护）
    criticalSounds: [
        ...collectPreloadKeys(SU_EVENTS),
        // 基地得分（FX on-impact，需手动预加载）
        'ui.general.mini_games_sound_effects_and_music_pack.success.sfx_success_point_medium',
    ],
    bgm: [
        {
            key: BGM_NORMAL_KEY,
            name: 'Tiki Party',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: BGM_TIKI_INTENSE_KEY,
            name: 'Tiki Party (Intense)',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle_intense' },
        },
        {
            key: BGM_BUBBLEGUM_KEY,
            name: 'Bubblegum',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: BGM_FIELD_DAY_KEY,
            name: 'Field Day',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: BGM_LIZARDS_KEY,
            name: 'Lizards',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: BGM_BUBBLEGUM_INTENSE_KEY,
            name: 'Bubblegum (Intense)',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle_intense' },
        },
        {
            key: BGM_FIELD_DAY_INTENSE_KEY,
            name: 'Field Day (Intense)',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle_intense' },
        },
        {
            key: BGM_SUNSET_KEY,
            name: 'Sunset',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: BGM_SUNSET_INTENSE_KEY,
            name: 'Sunset (Intense)',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle_intense' },
        },
        {
            key: BGM_SUNNY_DAYS_KEY,
            name: 'Sunny Days',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: BGM_SUNNY_DAYS_INTENSE_KEY,
            name: 'Sunny Days (Intense)',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle_intense' },
        },
        {
            key: BGM_BIG_SHOT_KEY,
            name: 'Big Shot',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: BGM_BIG_SHOT_INTENSE_KEY,
            name: 'Big Shot (Intense)',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle_intense' },
        },
        {
            key: BGM_BATTLE_KEY,
            name: 'Move Your Feet',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: BGM_MOVE_YOUR_FEET_INTENSE_KEY,
            name: 'Move Your Feet (Intense)',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle_intense' },
        },
        {
            key: BGM_NOBODY_KNOWS_KEY,
            name: 'Nobody Knows',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: BGM_NOBODY_KNOWS_INTENSE_KEY,
            name: 'Nobody Knows (Intense)',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle_intense' },
        },
    ],
    bgmGroups: {
        normal: [
            BGM_NOBODY_KNOWS_KEY,
            BGM_NORMAL_KEY,
            BGM_BUBBLEGUM_KEY,
            BGM_FIELD_DAY_KEY,
            BGM_LIZARDS_KEY,
            BGM_SUNSET_KEY,
            BGM_SUNNY_DAYS_KEY,
        ],
        battle: [
            BGM_BATTLE_KEY,
            BGM_MOVE_YOUR_FEET_INTENSE_KEY,
            BGM_BIG_SHOT_KEY,
            BGM_BIG_SHOT_INTENSE_KEY,
            BGM_TIKI_INTENSE_KEY,
            BGM_BUBBLEGUM_INTENSE_KEY,
            BGM_FIELD_DAY_INTENSE_KEY,
        ],
    },
    feedbackResolver: (event) => {
        const type = event.type;

        // ========== 特殊处理逻辑（覆盖框架默认）==========

        // FACTION_SELECTED：UI 层已播放，EventStream 跳过
        if (type === SU_EVENT_TYPES.FACTION_SELECTED) {
            return null;
        }

        // MINION_MOVED：移动音效
        if (type === SU_EVENT_TYPES.MINION_MOVED) {
            return MOVE_KEY;
        }

        // MINION_PLAYED：根据阵营选择音效
        if (type === SU_EVENT_TYPES.MINION_PLAYED) {
            const defId = (event.payload as { defId?: string })?.defId;
            const factionSound = resolveFactionSound(defId, 'minion');
            if (factionSound) return factionSound;
            // 回退到框架默认
        }

        // ACTION_PLAYED / ONGOING_ATTACHED：根据阵营选择音效
        if (type === SU_EVENT_TYPES.ACTION_PLAYED || type === SU_EVENT_TYPES.ONGOING_ATTACHED) {
            const defId = (event.payload as { defId?: string })?.defId;
            const factionSound = resolveFactionSound(defId, 'action');
            if (factionSound) return factionSound;
            // 回退到框架默认
        }

        // TALENT_USED：根据阵营选择音效
        if (type === SU_EVENT_TYPES.TALENT_USED) {
            const defId = (event.payload as { defId?: string })?.defId;
            const factionSound = resolveFactionSound(defId, 'talent');
            if (factionSound) return factionSound;
            // 回退到框架默认
        }

        // ========== 使用框架自动生成的默认音效 ==========
        return baseFeedbackResolver(event);
    },
    bgmRules: [
        {
            when: (context) => {
                const { currentPhase } = context.ctx as SmashUpAudioCtx;
                return currentPhase === 'playCards' || currentPhase === 'scoreBases';
            },
            key: BGM_BATTLE_KEY,
            group: 'battle',
        },
        {
            when: () => true,
            key: BGM_NOBODY_KNOWS_KEY,
            group: 'normal',
        },
    ],
    stateTriggers: [
        {
            condition: (prev, next) => {
                const prevOver = (prev.ctx as SmashUpAudioCtx).isGameOver;
                const nextOver = (next.ctx as SmashUpAudioCtx).isGameOver;
                return !prevOver && !!nextOver;
            },
            resolveSound: (_prev, next) => {
                const { isWinner } = next.ctx as SmashUpAudioCtx;
                if (isWinner === undefined) return null;
                return isWinner ? STINGER_WIN_KEY : STINGER_LOSE_KEY;
            },
        },
    ],
    contextualPreloadKeys: (context) => {
        const core = context.G as SmashUpCore | undefined;
        if (!core) return [];
        const selected = new Set<string>();
        if (core.factionSelection) {
            for (const list of Object.values(core.factionSelection.playerSelections)) {
                list?.forEach((faction) => selected.add(faction));
            }
        } else {
            for (const player of Object.values(core.players ?? {})) {
                player.factions?.forEach((faction) => selected.add(faction));
            }
        }
        if (selected.size === 0) return [];
        return collectFactionPreloadKeys(Array.from(selected));
    },
};
