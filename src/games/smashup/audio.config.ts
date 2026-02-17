/**
 * 大杀四方 (Smash Up) 音频配置
 * 仅保留事件解析/规则，音效资源统一来自 registry
 */
import type { GameAudioConfig } from '../../lib/audio/types';
import { createFeedbackResolver } from '../../lib/audio/defineEvents';
import { pickRandomSoundKey } from '../../lib/audio/audioUtils';
import type { GamePhase, SmashUpCore } from './domain/types';
import { SU_EVENTS, SU_EVENT_TYPES } from './domain/events';
import { SMASHUP_FACTION_IDS } from './domain/ids';

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
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robotic_limb_single_a1',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robotic_limb_single_a2',
    'cyberpunk.cyberpunk_sound_fx_pack_vol.android_esque.robotic_limb_single_b1',
];
const GHOST_MINION_KEYS = [
    'magic.general.spells_variations_vol_2.haunted_wrath.magevil_haunted_wrath_01_krst_none',
    'magic.general.spells_variations_vol_2.haunted_wrath.magevil_haunted_wrath_02_krst_none',
    'magic.general.spells_variations_vol_2.haunted_wrath.magevil_haunted_wrath_03_krst_none',
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
const STEAMPUNK_MINION_KEYS = [
    'steampunk.steampunk_sound_fx_pack_vol.gas_steam.gas_click_a',
    'steampunk.steampunk_sound_fx_pack_vol.gas_steam.gas_click_b',
    'steampunk.steampunk_sound_fx_pack_vol.gas_steam.gas_click_c',
];
const STEAMPUNK_ACTION_KEYS = [
    'steampunk.steampunk_sound_fx_pack_vol.gas_steam.gas_release_a',
    'steampunk.steampunk_sound_fx_pack_vol.gas_steam.gas_release_i',
    'steampunk.steampunk_sound_fx_pack_vol.gas_steam.gas_pressure_a',
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

const FACTION_SFX_KEYS: Record<string, string[]> = {
    [SMASHUP_FACTION_IDS.ZOMBIES]: [...ZOMBIE_MINION_KEYS, ...ZOMBIE_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.WIZARDS]: [...WIZARD_MINION_KEYS, ...WIZARD_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.DINOSAURS]: [...DINO_MINION_KEYS, ...DINO_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.ALIENS]: [...ALIEN_MINION_KEYS, ...ALIEN_ACTION_KEYS],
    [SMASHUP_FACTION_IDS.PIRATES]: [...PIRATE_MINION_KEYS, ...PIRATE_ACTION_KEYS],
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
};

const collectFactionPreloadKeys = (factionIds: string[]): string[] => {
    const keys = new Set<string>();
    for (const factionId of factionIds) {
        const list = FACTION_SFX_KEYS[factionId];
        if (list) list.forEach(key => keys.add(key));
    }
    return Array.from(keys);
};

const resolveFactionSound = (defId: string | undefined, cardType: 'minion' | 'action' | 'talent'): string | null => {
    if (!defId) return null;
    if (defId === 'special_madness') {
        return MADNESS_KEY;
    }
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
    return null;
};

// 创建基础 feedbackResolver（框架自动处理 events.ts 中的 sound 配置）
const baseFeedbackResolver = createFeedbackResolver(SU_EVENTS);

export const SMASHUP_AUDIO_CONFIG: GameAudioConfig = {
    criticalSounds: [
        SELECTION_KEY,
        POSITIVE_SIGNAL_KEY,
        UPDATE_CHIME_KEY,
        MINION_PLAY_KEY,
        ACTION_PLAY_KEY,
        CARD_DRAW_KEY,
        CARD_DISCARD_KEY,
        MOVE_KEY,
        POWER_GAIN_KEY,
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
