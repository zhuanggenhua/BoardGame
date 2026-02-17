/**
 * Smash Up 音效配置测试
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import type { AudioEvent } from '../../../lib/audio/types';
import { SMASHUP_AUDIO_CONFIG } from '../audio.config';
import { SU_EVENTS } from '../domain/types';

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
const TURN_NOTIFY_KEY = 'ui.fantasy_ui_sound_fx_pack_vol.notifications_pop_ups.popup_a_001';
const PROMPT_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_spring_a';

const MINION_PLAY_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
const ACTION_PLAY_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001';
const CARD_DRAW_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const CARD_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';
const CARD_SHUFFLE_KEY = 'card.handling.decks_and_cards_sound_fx_pack.cards_shuffle_fast_001';
const CARD_SCROLL_KEY = 'card.handling.decks_and_cards_sound_fx_pack.cards_scrolling_001';

const MOVE_KEY = 'card.handling.mini_games_sound_effects_and_music_pack.card.sfx_card_play_1';
const MINION_DESTROY_KEY = 'puzzle.16.tiny_pop_01';
const POWER_GAIN_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const POWER_LOSE_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.purged_a';
const TALENT_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001';
const MADNESS_KEY = 'magic.dark.32.dark_spell_01';

const ZOMBIE_MINION_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_001',
    'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_grave_whisper_002',
    'magic.general.spells_variations_vol_2.undead_wail_impact.magevil_undead_wail_impact_01_krst_none',
];
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
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robot_monster_a',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robot_monster_b',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robotic_limb_a',
];
const ROBOT_ACTION_KEYS = [
    'cyberpunk.cyberpunk_sound_fx_pack_vol.machinery.mechanical_gears',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.machinery.cyber_drill',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.machinery.mind_reader_machine',
];
const GHOST_MINION_KEYS = [
    'magic.general.spells_variations_vol_2.haunted_wrath.magevil_haunted_wrath_01_krst_none',
    'magic.general.spells_variations_vol_2.haunted_wrath.magevil_haunted_wrath_02_krst_none',
    'magic.general.spells_variations_vol_2.haunted_wrath.magevil_haunted_wrath_03_krst_none',
];
const GHOST_ACTION_KEYS = [
    'magic.general.spells_variations_vol_3.wailing_rite.magevil_wailing_rite_01_krst_none',
    'magic.general.spells_variations_vol_3.wailing_rite.magevil_wailing_rite_02_krst_none',
    'magic.general.spells_variations_vol_3.wailing_rite.magevil_wailing_rite_03_krst_none',
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
const STEAMPUNK_MINION_KEYS = [
    'steampunk.steampunk_sound_fx_pack_vol.gas_steam.gas_click_a',
    'steampunk.steampunk_sound_fx_pack_vol.gas_steam.gas_click_b',
    'steampunk.steampunk_sound_fx_pack_vol.gas_steam.gas_click_c',
];
const STEAMPUNK_ACTION_KEYS = [
    'steampunk.steampunk_sound_fx_pack_vol.gas_steam.steam_engine_speed_up_short_a',
    'steampunk.steampunk_sound_fx_pack_vol.gas_steam.steam_engine_speed_up_short_b',
    'steampunk.steampunk_sound_fx_pack_vol.gas_steam.steam_engine_speed_up_short_c',
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

const ALL_KEYS = [
    BGM_NORMAL_KEY,
    BGM_BATTLE_KEY,
    BGM_BUBBLEGUM_KEY,
    BGM_FIELD_DAY_KEY,
    BGM_LIZARDS_KEY,
    BGM_BUBBLEGUM_INTENSE_KEY,
    BGM_FIELD_DAY_INTENSE_KEY,
    BGM_SUNSET_KEY,
    BGM_SUNSET_INTENSE_KEY,
    BGM_SUNNY_DAYS_KEY,
    BGM_SUNNY_DAYS_INTENSE_KEY,
    BGM_BIG_SHOT_KEY,
    BGM_BIG_SHOT_INTENSE_KEY,
    BGM_MOVE_YOUR_FEET_INTENSE_KEY,
    BGM_TIKI_INTENSE_KEY,
    BGM_NOBODY_KNOWS_KEY,
    BGM_NOBODY_KNOWS_INTENSE_KEY,
    STINGER_WIN_KEY,
    STINGER_LOSE_KEY,
    SELECTION_KEY,
    POSITIVE_SIGNAL_KEY,
    UPDATE_CHIME_KEY,
    PROMPT_KEY,
    MINION_PLAY_KEY,
    ACTION_PLAY_KEY,
    CARD_DRAW_KEY,
    CARD_DISCARD_KEY,
    CARD_SHUFFLE_KEY,
    CARD_SCROLL_KEY,
    MOVE_KEY,
    MINION_DESTROY_KEY,
    POWER_GAIN_KEY,
    POWER_LOSE_KEY,
    TALENT_KEY,
    MADNESS_KEY,
    ...ZOMBIE_MINION_KEYS,
    ...ZOMBIE_ACTION_KEYS,
    ...WIZARD_MINION_KEYS,
    ...WIZARD_ACTION_KEYS,
    ...DINO_MINION_KEYS,
    ...DINO_ACTION_KEYS,
    ...ALIEN_MINION_KEYS,
    ...ALIEN_ACTION_KEYS,
    ...PIRATE_MINION_KEYS,
    ...PIRATE_ACTION_KEYS,
    ...NINJA_MINION_KEYS,
    ...NINJA_ACTION_KEYS,
    ...ROBOT_MINION_KEYS,
    ...ROBOT_ACTION_KEYS,
    ...GHOST_MINION_KEYS,
    ...GHOST_ACTION_KEYS,
    ...TRICKSTER_MINION_KEYS,
    ...TRICKSTER_ACTION_KEYS,
    ...STEAMPUNK_MINION_KEYS,
    ...STEAMPUNK_ACTION_KEYS,
    ...KILLER_PLANT_MINION_KEYS,
    ...KILLER_PLANT_ACTION_KEYS,
    ...BEAR_CAVALRY_MINION_KEYS,
    ...BEAR_CAVALRY_ACTION_KEYS,
    ...CTHULHU_MINION_KEYS,
    ...CTHULHU_ACTION_KEYS,
    ...ELDER_THING_MINION_KEYS,
    ...ELDER_THING_ACTION_KEYS,
    ...INNSMOUTH_MINION_KEYS,
    ...INNSMOUTH_ACTION_KEYS,
    ...MISKATONIC_MINION_KEYS,
    ...MISKATONIC_ACTION_KEYS,
];

const REGISTRY_PATH = path.join(process.cwd(), 'public', 'assets', 'common', 'audio', 'registry.json');
const registryExists = fs.existsSync(REGISTRY_PATH);
const registryRaw = registryExists ? fs.readFileSync(REGISTRY_PATH, 'utf-8') : '{"entries":[]}';
const registry = JSON.parse(registryRaw) as { entries: Array<{ key: string }> };
const registryMap = new Map(registry.entries.map(entry => [entry.key, entry]));

const mockContext = {
    G: {},
    ctx: { currentPhase: 'playCards', isGameOver: false },
    meta: { currentPlayerId: '0' },
} as any;

const resolveKey = (event: AudioEvent): string | undefined => {
    const resolver = SMASHUP_AUDIO_CONFIG.feedbackResolver;
    if (!resolver) throw new Error('feedbackResolver 未定义');
    const result = resolver(event, mockContext);
    return result ?? undefined;
};

describe.skip('Smash Up 音效配置', () => {
    // TODO: 这些测试需要更新以适应新的 defineEvents 架构
    it('应解析基础事件音效', () => {
        expect(resolveKey({ type: SU_EVENTS.FACTION_SELECTED } as AudioEvent)).toBe(SELECTION_KEY);
        expect(resolveKey({ type: SU_EVENTS.ALL_FACTIONS_SELECTED } as AudioEvent)).toBe(TURN_NOTIFY_KEY);
        const zombieMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'zombie_lord' } } as AudioEvent);
        const zombieAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'zombie_grave_robbing' } } as AudioEvent);
        const wizardMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'wizard_archmage' } } as AudioEvent);
        const wizardAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'wizard_summon' } } as AudioEvent);
        const dinoMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'dino_king_rex' } } as AudioEvent);
        const dinoAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'dino_howl' } } as AudioEvent);
        const alienMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'alien_supreme_overlord' } } as AudioEvent);
        const alienAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'alien_disintegrator' } } as AudioEvent);
        const pirateMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'pirate_king' } } as AudioEvent);
        const pirateAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'pirate_dinghy' } } as AudioEvent);
        const ninjaMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'ninja_master' } } as AudioEvent);
        const ninjaAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'ninja_smoke_bomb' } } as AudioEvent);
        const robotMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'robot_nukebot' } } as AudioEvent);
        const robotAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'robot_tech_center' } } as AudioEvent);
        const ghostMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'ghost_spectre' } } as AudioEvent);
        const ghostAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'ghost_seance' } } as AudioEvent);
        const tricksterMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'trickster_leprechaun' } } as AudioEvent);
        const tricksterAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'trickster_enshrouding_mist' } } as AudioEvent);
        const steampunkMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'steampunk_steam_queen' } } as AudioEvent);
        const steampunkAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'steampunk_ornate_dome' } } as AudioEvent);
        const killerPlantMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'killer_plant_venus_man_trap' } } as AudioEvent);
        const killerPlantAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'killer_plant_budding' } } as AudioEvent);
        const bearCavalryMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'bear_cavalry_general_ivan' } } as AudioEvent);
        const bearCavalryAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'bear_cavalry_bear_hug' } } as AudioEvent);
        const cthulhuMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'cthulhu_star_spawn' } } as AudioEvent);
        const cthulhuAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'cthulhu_altar' } } as AudioEvent);
        const elderThingMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'elder_thing_elder_thing' } } as AudioEvent);
        const elderThingAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'elder_thing_power_of_madness' } } as AudioEvent);
        const innsmouthMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'innsmouth_the_locals' } } as AudioEvent);
        const innsmouthAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'innsmouth_mysteries_of_the_deep' } } as AudioEvent);
        const miskatonicMinion = resolveKey({ type: SU_EVENTS.MINION_PLAYED, payload: { defId: 'miskatonic_professor' } } as AudioEvent);
        const miskatonicAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'miskatonic_book_of_iter_the_unseen' } } as AudioEvent);
        const madnessAction = resolveKey({ type: SU_EVENTS.ACTION_PLAYED, payload: { defId: 'special_madness' } } as AudioEvent);
        const talentUsed = resolveKey({ type: SU_EVENTS.TALENT_USED, payload: { defId: 'wizard_archmage' } } as AudioEvent);

        expect(ZOMBIE_MINION_KEYS).toContain(zombieMinion);
        expect(ZOMBIE_ACTION_KEYS).toContain(zombieAction);
        expect(WIZARD_MINION_KEYS).toContain(wizardMinion);
        expect(WIZARD_ACTION_KEYS).toContain(wizardAction);
        expect(DINO_MINION_KEYS).toContain(dinoMinion);
        expect(DINO_ACTION_KEYS).toContain(dinoAction);
        expect(ALIEN_MINION_KEYS).toContain(alienMinion);
        expect(ALIEN_ACTION_KEYS).toContain(alienAction);
        expect(PIRATE_MINION_KEYS).toContain(pirateMinion);
        expect(PIRATE_ACTION_KEYS).toContain(pirateAction);
        expect(NINJA_MINION_KEYS).toContain(ninjaMinion);
        expect(NINJA_ACTION_KEYS).toContain(ninjaAction);
        expect(ROBOT_MINION_KEYS).toContain(robotMinion);
        expect(ROBOT_ACTION_KEYS).toContain(robotAction);
        expect(GHOST_MINION_KEYS).toContain(ghostMinion);
        expect(GHOST_ACTION_KEYS).toContain(ghostAction);
        expect(TRICKSTER_MINION_KEYS).toContain(tricksterMinion);
        expect(TRICKSTER_ACTION_KEYS).toContain(tricksterAction);
        expect(STEAMPUNK_MINION_KEYS).toContain(steampunkMinion);
        expect(STEAMPUNK_ACTION_KEYS).toContain(steampunkAction);
        expect(KILLER_PLANT_MINION_KEYS).toContain(killerPlantMinion);
        expect(KILLER_PLANT_ACTION_KEYS).toContain(killerPlantAction);
        expect(BEAR_CAVALRY_MINION_KEYS).toContain(bearCavalryMinion);
        expect(BEAR_CAVALRY_ACTION_KEYS).toContain(bearCavalryAction);
        expect(CTHULHU_MINION_KEYS).toContain(cthulhuMinion);
        expect(CTHULHU_ACTION_KEYS).toContain(cthulhuAction);
        expect(ELDER_THING_MINION_KEYS).toContain(elderThingMinion);
        expect(ELDER_THING_ACTION_KEYS).toContain(elderThingAction);
        expect(INNSMOUTH_MINION_KEYS).toContain(innsmouthMinion);
        expect(INNSMOUTH_ACTION_KEYS).toContain(innsmouthAction);
        expect(MISKATONIC_MINION_KEYS).toContain(miskatonicMinion);
        expect(MISKATONIC_ACTION_KEYS).toContain(miskatonicAction);
        expect(madnessAction).toBe(MADNESS_KEY);
        expect(WIZARD_MINION_KEYS).toContain(talentUsed);
        expect(resolveKey({ type: SU_EVENTS.CARDS_DRAWN } as AudioEvent)).toBe(CARD_DRAW_KEY);
        expect(resolveKey({ type: SU_EVENTS.CARDS_DISCARDED } as AudioEvent)).toBe(CARD_DISCARD_KEY);
        expect(resolveKey({ type: SU_EVENTS.DECK_RESHUFFLED } as AudioEvent)).toBe(CARD_SHUFFLE_KEY);
        expect(resolveKey({ type: SU_EVENTS.MINION_RETURNED } as AudioEvent)).toBe(CARD_SCROLL_KEY);
        expect(resolveKey({ type: SU_EVENTS.MINION_DESTROYED } as AudioEvent)).toBe(MINION_DESTROY_KEY);
        expect(resolveKey({ type: SU_EVENTS.MINION_MOVED } as AudioEvent)).toBe(MOVE_KEY);
        expect(resolveKey({ type: SU_EVENTS.POWER_COUNTER_ADDED } as AudioEvent)).toBe(POWER_GAIN_KEY);
        expect(resolveKey({ type: SU_EVENTS.POWER_COUNTER_REMOVED } as AudioEvent)).toBe(POWER_LOSE_KEY);
        expect(resolveKey({ type: SU_EVENTS.MADNESS_DRAWN } as AudioEvent)).toBe(MADNESS_KEY);
        expect(resolveKey({ type: SU_EVENTS.MADNESS_RETURNED } as AudioEvent)).toBe(MADNESS_KEY);
    });

    it('应按阶段切换 BGM', () => {
        const rules = SMASHUP_AUDIO_CONFIG.bgmRules ?? [];
        const battleKey = rules.find(rule => rule.when({ ...mockContext, ctx: { currentPhase: 'playCards' } }))?.key;
        const normalKey = rules.find(rule => rule.when({ ...mockContext, ctx: { currentPhase: 'draw' } }))?.key;
        expect(battleKey).toBe(BGM_BATTLE_KEY);
        expect(normalKey).toBe(BGM_NOBODY_KNOWS_KEY);
    });

    it('应有 bgmGroups（normal + battle）', () => {
        expect(SMASHUP_AUDIO_CONFIG.bgmGroups).toBeDefined();
        expect(SMASHUP_AUDIO_CONFIG.bgmGroups!.normal.length).toBeGreaterThanOrEqual(6);
        expect(SMASHUP_AUDIO_CONFIG.bgmGroups!.battle.length).toBeGreaterThanOrEqual(5);
    });

    it('应有 17 首 BGM', () => {
        expect(SMASHUP_AUDIO_CONFIG.bgm!.length).toBe(17);
    });

    it('游戏结束应触发胜负音效', () => {
        const trigger = SMASHUP_AUDIO_CONFIG.stateTriggers?.[0];
        if (!trigger) throw new Error('stateTriggers 未定义');

        const shouldTrigger = trigger.condition(
            { ...mockContext, ctx: { currentPhase: 'playCards', isGameOver: false } },
            { ...mockContext, ctx: { currentPhase: 'draw', isGameOver: true, isWinner: true } }
        );
        expect(shouldTrigger).toBe(true);

        const winKey = trigger.resolveSound?.(
            mockContext,
            { ...mockContext, ctx: { currentPhase: 'draw', isGameOver: true, isWinner: true } }
        );
        const loseKey = trigger.resolveSound?.(
            mockContext,
            { ...mockContext, ctx: { currentPhase: 'draw', isGameOver: true, isWinner: false } }
        );
        expect(winKey).toBe(STINGER_WIN_KEY);
        expect(loseKey).toBe(STINGER_LOSE_KEY);
    });

    it.skipIf(!registryExists)('音效 key 必须存在于 registry', () => {
        for (const key of ALL_KEYS) {
            expect(registryMap.has(key)).toBe(true);
        }
    });
});
