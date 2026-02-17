/**
 * 召唤师战争音频配置
 * 仅保留事件解析/规则，音效资源统一来自 registry
 */
import type { AudioEvent, AudioRuntimeContext, GameAudioConfig, SoundKey } from '../../lib/audio/types';
import { pickDiceRollSoundKey, pickRandomSoundKey } from '../../lib/audio/audioUtils';
import { createFeedbackResolver } from '../../lib/audio/defineEvents';
import type { GamePhase, PlayerId, SummonerWarsCore, FactionId } from './domain/types';
import { SW_EVENTS } from './domain/events';
import { resolveFactionId } from './config/factions';
import { abilityRegistry, NECROMANCER_ABILITIES } from './domain/abilities';
import { TRICKSTER_ABILITIES } from './domain/abilities-trickster';
import { GOBLIN_ABILITIES } from './domain/abilities-goblin';
import { PALADIN_ABILITIES } from './domain/abilities-paladin';
import { FROST_ABILITIES } from './domain/abilities-frost';
import { BARBARIC_ABILITIES } from './domain/abilities-barbaric';

const BGM_TO_THE_WALL_KEY = 'bgm.fantasy.fantasy_music_pack_vol.to_the_wall_rt_2.to_the_wall_main';
const BGM_TO_THE_WALL_INTENSE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.to_the_wall_rt_2.to_the_wall_intensity_2';
const BGM_CORSAIR_KEY = 'bgm.fantasy.fantasy_music_pack_vol.corsair_rt_3.fantasy_vol5_corsair_main';
const BGM_LONELY_BARD_KEY = 'bgm.fantasy.fantasy_music_pack_vol.lonely_bard_rt_3.fantasy_vol5_lonely_bard_main';
const BGM_CORSAIR_INTENSE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.corsair_rt_3.fantasy_vol5_corsair_intensity_2';
const BGM_LONELY_BARD_INTENSE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.lonely_bard_rt_3.fantasy_vol5_lonely_bard_intensity_2';
const BGM_LUMINESCE_KEY = 'bgm.ethereal.ethereal_music_pack.luminesce_rt_4.ethereal_luminesce_main';
const BGM_LUMINESCE_INTENSE_KEY = 'bgm.ethereal.ethereal_music_pack.luminesce_rt_4.ethereal_luminesce_intensity_2';
const BGM_WIND_CHIME_KEY = 'bgm.ethereal.ethereal_music_pack.wind_chime_rt_5.ethereal_wind_chime_main';
const BGM_WIND_CHIME_INTENSE_KEY = 'bgm.ethereal.ethereal_music_pack.wind_chime_rt_5.ethereal_wind_chime_intensity_2';
// 新增 Fantasy Vol 7/8 曲目
const BGM_ELDER_AWAKENING_KEY = 'bgm.fantasy.fantasy_music_pack_vol.elder_awakening_rt_2.fantasy_vol7_elder_awakening_main';
const BGM_ELDER_AWAKENING_INTENSE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.elder_awakening_rt_2.fantasy_vol7_elder_awakening_intensity_2';
const BGM_FEYSONG_KEY = 'bgm.fantasy.fantasy_music_pack_vol.feysong_fields_rt_3.fantasy_vol7_feysong_fields_main';
const BGM_FEYSONG_INTENSE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.feysong_fields_rt_3.fantasy_vol7_feysong_fields_intensity_2';
const BGM_STONE_CHANT_KEY = 'bgm.fantasy.fantasy_music_pack_vol.stone_chant_rt_3.fantasy_vol8_stone_chant_main';
const BGM_STONE_CHANT_INTENSE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.stone_chant_rt_3.fantasy_vol8_stone_chant_intensity_2';
const STINGER_WIN_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win';
const STINGER_LOSE_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';

const MAGIC_GAIN_KEY = 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_mana_surge_001';
const MAGIC_SPEND_KEY = 'status.general.player_status_sound_fx_pack.fantasy.fantasy_dispel_001';
const SUMMON_KEY = 'magic.general.spells_variations_vol_1.open_temporal_rift_summoning.magspel_open_temporal_rift_summoning_06_krst';
const MOVE_FALLBACK_KEY = 'fantasy.medieval_fantasy_sound_fx_pack_vol.armor.armor_movement_h';
const FACTION_MOVE_KEYS: Partial<Record<FactionId, string[]>> = {
    necromancer: [
        'monster.general.khron_studio_monster_library_vol_4_assets.skeleton.skeletons_footstep.feetcrea_skeletons_footstep_01',
        'monster.general.khron_studio_monster_library_vol_4_assets.skeleton.skeletons_footstep.feetcrea_skeletons_footstep_02',
        'monster.general.khron_studio_monster_library_vol_4_assets.skeleton.skeletons_footstep.feetcrea_skeletons_footstep_03',
        'monster.general.khron_studio_monster_library_vol_4_assets.skeleton.skeletons_footstep.feetcrea_skeletons_footstep_04',
    ],
    goblin: [
        'monster.general.khron_studio_monster_library_vol_3_assets.goblin.goblin_footstep.feetcrea_goblin_footstep_01',
        'monster.general.khron_studio_monster_library_vol_3_assets.goblin.goblin_footstep.feetcrea_goblin_footstep_02',
        'monster.general.khron_studio_monster_library_vol_3_assets.goblin.goblin_footstep.feetcrea_goblin_footstep_03',
        'monster.general.khron_studio_monster_library_vol_3_assets.goblin.goblin_footstep.feetcrea_goblin_footstep_04',
    ],
    paladin: [
        'monster.general.khron_studio_monster_library_vol_3_assets.orc.orc_footstep_with_armour.creahmn_orc_footstep_with_armour_01',
        'monster.general.khron_studio_monster_library_vol_3_assets.orc.orc_footstep_with_armour.creahmn_orc_footstep_with_armour_02',
        'monster.general.khron_studio_monster_library_vol_3_assets.orc.orc_footstep_with_armour.creahmn_orc_footstep_with_armour_03',
        'monster.general.khron_studio_monster_library_vol_3_assets.orc.orc_footstep_with_armour.creahmn_orc_footstep_with_armour_04',
    ],
    barbaric: [
        'monster.general.khron_studio_monster_library_vol_3_assets.troll.troll_footstep.feetcrea_troll_footstep_01',
        'monster.general.khron_studio_monster_library_vol_3_assets.troll.troll_footstep.feetcrea_troll_footstep_02',
        'monster.general.khron_studio_monster_library_vol_3_assets.troll.troll_footstep.feetcrea_troll_footstep_03',
        'monster.general.khron_studio_monster_library_vol_3_assets.troll.troll_footstep.feetcrea_troll_footstep_04',
    ],
};
const BUILD_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
const WALL_BUILD_KEYS = [
    'magic.general.spells_variations_vol_3.stonebound_summon.magspel_stonebound_summon_01_krst_none',
    'magic.general.spells_variations_vol_3.stonebound_summon.magspel_stonebound_summon_02_krst_none',
    'magic.general.spells_variations_vol_3.stonebound_summon.magspel_stonebound_summon_03_krst_none',
];
const GATE_BUILD_KEYS = [
    'magic.general.spells_variations_vol_1.open_temporal_rift_summoning.magspel_open_temporal_rift_summoning_01_krst',
    'magic.general.spells_variations_vol_1.open_temporal_rift_summoning.magspel_open_temporal_rift_summoning_02_krst',
    'magic.general.spells_variations_vol_1.open_temporal_rift_summoning.magspel_open_temporal_rift_summoning_03_krst',
];
const GATE_DESTROY_KEYS = [
    'magic.general.spells_variations_vol_1.close_temporal_rift_summoning.magspel_close_temporal_rift_summoning_01_krst',
    'magic.general.spells_variations_vol_1.close_temporal_rift_summoning.magspel_close_temporal_rift_summoning_02_krst',
    'magic.general.spells_variations_vol_1.close_temporal_rift_summoning.magspel_close_temporal_rift_summoning_03_krst',
];
const CARD_DRAW_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const CARD_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';
const EVENT_PLAY_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001';
const UNIT_CHARGE_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const DAMAGE_LIGHT_KEY = 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst';
const DAMAGE_HEAVY_KEY = 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_01_krst';
const UNIT_DESTROY_KEY = 'combat.general.fight_fury_vol_2.body_hitting_the_ground_with_blood.fghtbf_body_hitting_the_ground_with_blood_01_krst';
const STRUCTURE_DAMAGE_KEY = 'fantasy.medieval_fantasy_sound_fx_pack_vol.armor.shield_impact_a';
const STRUCTURE_DESTROY_KEY = 'magic.general.spells_variations_vol_2.stonecrash_impact.magelem_stonecrash_impact_01_krst_none';
const MAGIC_SHOCK_KEY = 'magic.general.simple_magic_sound_fx_pack_vol.light.holy_shock';
const HEAL_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.healed_a';
const HEAL_MODE_KEY = 'magic.general.simple_magic_sound_fx_pack_vol.light.holy_ward';
const POSITIVE_SIGNAL_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const UPDATE_CHIME_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
const SELECTION_KEY = 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';
const PROMPT_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_spring_a';
const TURN_CHANGED_KEY = 'fantasy.medieval_fantasy_sound_fx_pack_vol.items_misc.warhorn_d';

const MELEE_LIGHT_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_small_1',
    'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1',
];

const MELEE_HEAVY_KEYS = [
    'fantasy.dark_sword_whoosh_01',
    'fantasy.dark_sword_whoosh_02',
    'fantasy.dark_sword_whoosh_03',
];

const RANGED_ATTACK_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.bow.sfx_weapon_bow_shoot_1',
    'combat.general.mini_games_sound_effects_and_music_pack.bow.sfx_weapon_bow_shoot_2',
    'combat.general.mini_games_sound_effects_and_music_pack.bow.sfx_weapon_bow_shoot_3',
];

const DICE_ROLL_SINGLE_KEY = 'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_001';
const DICE_ROLL_MULTI_KEYS = [
    'dice.decks_and_cards_sound_fx_pack.few_dice_roll_001',
    'dice.decks_and_cards_sound_fx_pack.dice_roll_velvet_003',
    'dice.decks_and_cards_sound_fx_pack.few_dice_roll_005',
];
const DICE_ROLL_KEYS = [DICE_ROLL_SINGLE_KEY, ...DICE_ROLL_MULTI_KEYS];

const MOVE_SWING_KEYS = [
    'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_sword_1',
    'combat.general.mini_games_sound_effects_and_music_pack.weapon_swoosh.sfx_weapon_melee_swoosh_small_1',
];

const ARCANE_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_001',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_002',
    'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_003',
];

const DARK_KEYS = [
    'magic.dark.32.dark_spell_01',
    'magic.dark.32.dark_spell_02',
    'magic.dark.32.dark_spell_03',
];

const DIVINE_KEYS = [
    'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_smite_001',
    'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_smite_002',
    'magic.general.modern_magic_sound_fx_pack_vol.divine_magic.divine_magic_smite_003',
];

const ICE_KEYS = [
    'fantasy.elemental_sword_iceattack_v1',
    'fantasy.elemental_sword_iceattack_v2',
    'fantasy.elemental_sword_iceattack_v3',
];

const EARTH_KEYS = [
    'magic.rock.35.earth_magic_whoosh_01',
    'magic.rock.35.earth_magic_whoosh_02',
    'fantasy.elemental_sword_earthattack_01',
];

const FIRE_KEYS = [
    'fantasy.elemental_sword_fireattack_01',
    'fantasy.elemental_sword_fireattack_02',
    'fantasy.elemental_sword_fireattack_03',
];

const BLOOD_KEYS = [
    'fantasy.dark_sword_attack_withblood_01',
    'fantasy.dark_sword_attack_withblood_02',
    'fantasy.dark_sword_attack_withblood_03',
];

const ABILITY_SFX_MAP: Record<string, string> = {
    revive_undead: 'magic.dark.29.dark_resurrection',
    life_drain: 'fantasy.dark_sword_steallife',
    soul_transfer: 'magic.general.spells_variations_vol_2.unholy_echo.magevil_unholy_echo_01_krst_none',
    infection: 'magic.general.modern_magic_sound_fx_pack_vol.dark_magic.dark_magic_blight_curse_001',
    healing: 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.healed_a',
    divine_shield: 'magic.general.simple_magic_sound_fx_pack_vol.light.holy_ward',
    holy_arrow: 'magic.general.simple_magic_sound_fx_pack_vol.light.holy_shock',
    frost_bolt: 'fantasy.elemental_sword_iceattack_v1',
    greater_frost_bolt: 'fantasy.elemental_sword_iceattack_v2',
    ice_shards: 'fantasy.elemental_sword_iceattack_v3',
    telekinesis: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_001',
    high_telekinesis: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_002',
    mind_capture: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_aetherial_pulse_003',
    mind_transmission: 'magic.general.modern_magic_sound_fx_pack_vol.arcane_spells.arcane_spells_arcane_ripple_004',
    blood_rune: 'fantasy.dark_sword_attack_withblood_01',
    fire_sacrifice_summon: 'fantasy.elemental_sword_fireattack_01',
    gather_power: 'magic.rock.35.earth_magic_whoosh_01',
    rapid_fire: 'fantasy.elemental_bow_fireattack_01',
};

const ABILITY_GROUP_MAP: Record<string, keyof typeof ABILITY_GROUPS> = {
    // necromancer
    revive_undead: 'dark',
    fire_sacrifice_summon: 'fire',
    life_drain: 'dark',
    rage: 'dark',
    blood_rage: 'blood',
    power_boost: 'dark',
    blood_rage_decay: 'blood',
    sacrifice: 'fire',
    soulless: 'dark',
    infection: 'dark',
    soul_transfer: 'dark',

    // trickster
    mind_capture: 'arcane',
    flying: 'arcane',
    aerial_strike: 'arcane',
    high_telekinesis: 'arcane',
    stable: 'arcane',
    mind_transmission: 'arcane',
    swift: 'arcane',
    ranged: 'arcane',
    telekinesis: 'arcane',
    illusion: 'arcane',
    evasion: 'arcane',
    rebound: 'arcane',

    // goblin
    vanish: 'earth',
    blood_rune: 'blood',
    magic_addiction: 'earth',
    ferocity: 'blood',
    feed_beast: 'blood',
    climb: 'earth',
    charge: 'earth',
    immobile: 'earth',
    grab: 'earth',

    // paladin
    fortress_power: 'divine',
    guidance: 'divine',
    fortress_elite: 'divine',
    radiant_shot: 'divine',
    divine_shield: 'divine',
    healing: 'divine',
    judgment: 'divine',
    entangle: 'divine',
    guardian: 'divine',
    holy_arrow: 'divine',

    // frost
    structure_shift: 'ice',
    cold_snap: 'ice',
    imposing: 'ice',
    ice_shards: 'ice',
    greater_frost_bolt: 'ice',
    frost_bolt: 'ice',
    trample: 'ice',
    frost_axe: 'ice',
    living_gate: 'ice',
    mobile_structure: 'ice',
    slow: 'ice',

    // barbaric
    ancestral_bond: 'earth',
    power_up: 'earth',
    prepare: 'earth',
    rapid_fire: 'fire',
    inspire: 'earth',
    withdraw: 'earth',
    intimidate: 'earth',
    life_up: 'earth',
    speed_up: 'earth',
    gather_power: 'earth',
    spirit_bond: 'earth',
};

const ABILITY_GROUPS = {
    arcane: ARCANE_KEYS,
    dark: DARK_KEYS,
    divine: DIVINE_KEYS,
    ice: ICE_KEYS,
    earth: EARTH_KEYS,
    fire: FIRE_KEYS,
    blood: BLOOD_KEYS,
} as const;

type AbilityLike = { id: string; sfxKey?: string };

const collectAbilityKeys = (abilities: AbilityLike[]): string[] => {
    const keys = new Set<string>();
    for (const ability of abilities) {
        const explicit = ability.sfxKey ?? ABILITY_SFX_MAP[ability.id];
        if (explicit) keys.add(explicit);
        const group = ABILITY_GROUP_MAP[ability.id];
        if (group) {
            ABILITY_GROUPS[group].forEach(key => keys.add(key));
        }
    }
    return Array.from(keys);
};

const FACTION_ABILITY_KEYS: Record<FactionId, string[]> = {
    necromancer: collectAbilityKeys(NECROMANCER_ABILITIES),
    trickster: collectAbilityKeys(TRICKSTER_ABILITIES),
    goblin: collectAbilityKeys(GOBLIN_ABILITIES),
    paladin: collectAbilityKeys(PALADIN_ABILITIES),
    frost: collectAbilityKeys(FROST_ABILITIES),
    barbaric: collectAbilityKeys(BARBARIC_ABILITIES),
};

const resolveAbilitySound = (event: AudioEvent): string | null => {
    const payload = (event as AudioEvent & { payload?: { sourceAbilityId?: string; abilityId?: string } }).payload;
    const abilityId = payload?.sourceAbilityId ?? payload?.abilityId;
    if (!abilityId) return null;
    const explicit = abilityRegistry.get(abilityId)?.sfxKey ?? ABILITY_SFX_MAP[abilityId];
    if (explicit) return explicit;
    const group = ABILITY_GROUP_MAP[abilityId];
    if (!group) return null;
    const keys = ABILITY_GROUPS[group];
    return pickRandomSoundKey(`summonerwars.ability.${group}`, [...keys], { minGap: 1 });
};

// ============================================================================
// 音效 key 解析 helpers（供 FX/动画层调用，避免重复定义 key 映射）
// ============================================================================

/** 解析攻击音效 key（melee/ranged） */
export function resolveAttackSoundKey(
    attackType: 'melee' | 'ranged',
    core: SummonerWarsCore,
    attackerPos?: { row: number; col: number },
): string {
    if (attackType === 'ranged') {
        return pickRandomSoundKey('summonerwars.ranged_attack', RANGED_ATTACK_KEYS, { minGap: 1 });
    }
    const attackerUnit = attackerPos ? core.board?.[attackerPos.row]?.[attackerPos.col]?.unit : undefined;
    const meleeKeys = attackerUnit?.card?.unitClass === 'summoner' || attackerUnit?.card?.unitClass === 'champion'
        ? MELEE_HEAVY_KEYS : MELEE_LIGHT_KEYS;
    return pickRandomSoundKey('summonerwars.melee_attack', meleeKeys, { minGap: 1 });
}

/** 解析受伤音效 key */
export function resolveDamageSoundKey(damage: number): string | null {
    if (damage >= 3) return DAMAGE_HEAVY_KEY;
    if (damage > 0) return DAMAGE_LIGHT_KEY;
    return null;
}

/** 解析摧毁音效 key */
export function resolveDestroySoundKey(type: 'unit' | 'structure', isGate?: boolean): string {
    if (type === 'unit') return UNIT_DESTROY_KEY;
    return isGate
        ? pickRandomSoundKey('summonerwars.gate_destroy', GATE_DESTROY_KEYS, { minGap: 1 })
        : STRUCTURE_DESTROY_KEY;
}

export const SUMMONER_WARS_AUDIO_CONFIG: GameAudioConfig = {
    criticalSounds: [
        SELECTION_KEY,
        POSITIVE_SIGNAL_KEY,
        UPDATE_CHIME_KEY,
        SUMMON_KEY,
        MOVE_FALLBACK_KEY,
        BUILD_KEY,
        ...WALL_BUILD_KEYS,
        CARD_DRAW_KEY,
        CARD_DISCARD_KEY,
        DAMAGE_LIGHT_KEY,
        MAGIC_GAIN_KEY,
        MAGIC_SPEND_KEY,
        ...DICE_ROLL_KEYS,
    ],
    bgm: [
        // --- normal 组（7 首）---
        { key: BGM_TO_THE_WALL_KEY, name: 'To The Wall', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle' } },
        { key: BGM_CORSAIR_KEY, name: 'Corsair', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle' } },
        { key: BGM_LONELY_BARD_KEY, name: 'Lonely Bard', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle' } },
        { key: BGM_LUMINESCE_KEY, name: 'Luminesce', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle' } },
        { key: BGM_WIND_CHIME_KEY, name: 'Wind Chime', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle' } },
        { key: BGM_ELDER_AWAKENING_KEY, name: 'Elder Awakening', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle' } },
        { key: BGM_FEYSONG_KEY, name: 'Feysong Fields', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle' } },
        // --- battle 组（9 首）---
        { key: BGM_STONE_CHANT_KEY, name: 'Stone Chant', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
        { key: BGM_TO_THE_WALL_INTENSE_KEY, name: 'To The Wall (Intensity 2)', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
        { key: BGM_CORSAIR_INTENSE_KEY, name: 'Corsair (Intensity 2)', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
        { key: BGM_LONELY_BARD_INTENSE_KEY, name: 'Lonely Bard (Intensity 2)', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
        { key: BGM_LUMINESCE_INTENSE_KEY, name: 'Luminesce (Intensity 2)', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
        { key: BGM_WIND_CHIME_INTENSE_KEY, name: 'Wind Chime (Intensity 2)', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
        { key: BGM_ELDER_AWAKENING_INTENSE_KEY, name: 'Elder Awakening (Intensity 2)', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
        { key: BGM_FEYSONG_INTENSE_KEY, name: 'Feysong Fields (Intensity 2)', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
        { key: BGM_STONE_CHANT_INTENSE_KEY, name: 'Stone Chant (Intensity 2)', src: '', volume: 0.5, category: { group: 'bgm', sub: 'battle_intense' } },
    ],
    bgmGroups: {
        normal: [
            BGM_TO_THE_WALL_KEY,
            BGM_CORSAIR_KEY,
            BGM_LONELY_BARD_KEY,
            BGM_LUMINESCE_KEY,
            BGM_WIND_CHIME_KEY,
            BGM_ELDER_AWAKENING_KEY,
            BGM_FEYSONG_KEY,
        ],
        battle: [
            BGM_STONE_CHANT_KEY,
            BGM_TO_THE_WALL_INTENSE_KEY,
            BGM_CORSAIR_INTENSE_KEY,
            BGM_LONELY_BARD_INTENSE_KEY,
            BGM_LUMINESCE_INTENSE_KEY,
            BGM_WIND_CHIME_INTENSE_KEY,
            BGM_ELDER_AWAKENING_INTENSE_KEY,
            BGM_FEYSONG_INTENSE_KEY,
            BGM_STONE_CHANT_INTENSE_KEY,
        ],
    },
    feedbackResolver: (event, context): SoundKey | null => {
        const type = event.type;
        const runtime = context as AudioRuntimeContext<
            SummonerWarsCore,
            { currentPhase: GamePhase; isGameOver: boolean; isWinner?: boolean },
            { currentPlayerId: PlayerId }
        >;

        // ========== 特殊处理逻辑（覆盖框架默认）==========

        // 能力音效（战斗事件已排除，此处仅处理非战斗能力）
        const abilitySound = resolveAbilitySound(event);
        if (abilitySound) return abilitySound;

        // FACTION_SELECTED：UI 层已播放，跳过 EventStream
        if (type === SW_EVENTS.FACTION_SELECTED.type) return null;

        // UNIT_MOVED：根据阵营选择移动音效
        if (type === SW_EVENTS.UNIT_MOVED.type) {
            const movePayload = (event as AudioEvent & { payload?: { to?: { row: number; col: number } } }).payload;
            const to = movePayload?.to;
            const movedUnit = to ? runtime.G?.board?.[to.row]?.[to.col]?.unit : undefined;
            const factionRaw = movedUnit?.card?.faction;
            const faction = factionRaw ? resolveFactionId(factionRaw) : undefined;
            const factionKeys = faction ? FACTION_MOVE_KEYS[faction] : undefined;
            if (factionKeys) {
                return pickRandomSoundKey(`summonerwars.move.${faction}`, factionKeys, { minGap: 1 });
            }
            return MOVE_FALLBACK_KEY;
        }

        // STRUCTURE_BUILT：根据建筑类型选择音效
        if (type === SW_EVENTS.STRUCTURE_BUILT.type) {
            const buildPayload = (event as AudioEvent & { payload?: { card?: { isGate?: boolean } } }).payload;
            if (buildPayload?.card?.isGate) {
                return pickRandomSoundKey('summonerwars.gate_build', GATE_BUILD_KEYS, { minGap: 1 });
            }
            return pickRandomSoundKey('summonerwars.wall_build', WALL_BUILD_KEYS, { minGap: 1 });
        }

        // MAGIC_CHANGED：根据增减选择音效
        if (type === SW_EVENTS.MAGIC_CHANGED.type) {
            const delta = (event as AudioEvent & { payload?: { delta?: number } }).payload?.delta ?? 0;
            return delta >= 0 ? MAGIC_GAIN_KEY : MAGIC_SPEND_KEY;
        }

        // STRENGTH_MODIFIED：根据增减选择音效
        if (type === SW_EVENTS.STRENGTH_MODIFIED.type) {
            const delta = (event as AudioEvent & { payload?: { delta?: number } }).payload?.delta ?? 0;
            return delta >= 0 ? UNIT_CHARGE_KEY : MAGIC_SPEND_KEY;
        }

        // ========== 使用框架自动生成的默认音效 ==========
        const baseFeedbackResolver = createFeedbackResolver(SW_EVENTS);
        return baseFeedbackResolver(event);
    },
    bgmRules: [
        {
            when: (context) => {
                const { currentPhase } = context.ctx as { currentPhase?: GamePhase };
                return currentPhase === 'attack';
            },
            key: BGM_STONE_CHANT_KEY,
            group: 'battle',
        },
        {
            when: () => true,
            key: BGM_TO_THE_WALL_KEY,
            group: 'normal',
        },
    ],
    stateTriggers: [
        {
            condition: (prev, next) => {
                const prevOver = (prev.ctx as { isGameOver?: boolean }).isGameOver;
                const nextOver = (next.ctx as { isGameOver?: boolean }).isGameOver;
                return !prevOver && !!nextOver;
            },
            resolveSound: (_prev, next) => {
                const { isWinner } = next.ctx as { isWinner?: boolean };
                if (isWinner === undefined) return null;
                return isWinner ? STINGER_WIN_KEY : STINGER_LOSE_KEY;
            },
        },
    ],
    contextualPreloadKeys: (context) => {
        const core = context.G as SummonerWarsCore | undefined;
        if (!core) return [];
        const selectedValues = Object.values(core.selectedFactions ?? {}) as Array<FactionId | 'unselected'>;
        const selected = selectedValues
            .filter((faction): faction is FactionId => !!faction && faction !== 'unselected');
        if (selected.length === 0) return [];
        const keys = new Set<string>();

        // 通用战斗音效（不分阵营，选角后即预加载，消除首次攻击延迟）
        MELEE_LIGHT_KEYS.forEach(key => keys.add(key));
        MELEE_HEAVY_KEYS.forEach(key => keys.add(key));
        RANGED_ATTACK_KEYS.forEach(key => keys.add(key));
        MOVE_SWING_KEYS.forEach(key => keys.add(key));
        DICE_ROLL_KEYS.forEach(key => keys.add(key));
        keys.add(DAMAGE_HEAVY_KEY);
        keys.add(UNIT_DESTROY_KEY);
        keys.add(STRUCTURE_DAMAGE_KEY);
        keys.add(STRUCTURE_DESTROY_KEY);
        GATE_BUILD_KEYS.forEach(key => keys.add(key));
        WALL_BUILD_KEYS.forEach(key => keys.add(key));
        GATE_DESTROY_KEYS.forEach(key => keys.add(key));

        // 阵营专属音效（移动 + 技能）
        const uniqueFactions = new Set<FactionId>(selected);
        for (const faction of uniqueFactions) {
            const moveKeys = FACTION_MOVE_KEYS[faction];
            if (moveKeys) moveKeys.forEach(key => keys.add(key));
            const abilityKeys = FACTION_ABILITY_KEYS[faction];
            if (abilityKeys) abilityKeys.forEach(key => keys.add(key));
        }
        return Array.from(keys);
    },
};

// ============================================================================
// 掌骰音效 API（UI 层手动调用，与 feedbackResolver 无关）
// ============================================================================

/** 掷骰音（显示骰子结果时播放） */
export function resolveDiceRollSound(diceCount: number): string {
    return pickDiceRollSoundKey(
        'summonerwars.dice_roll',
        diceCount,
        { single: DICE_ROLL_SINGLE_KEY, multiple: DICE_ROLL_MULTI_KEYS },
        { minGap: 1 }
    );
}
