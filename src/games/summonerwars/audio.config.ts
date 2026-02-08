/**
 * 召唤师战争音频配置
 * 仅保留事件解析/规则，音效资源统一来自 registry
 */
import type { AudioEvent, AudioRuntimeContext, GameAudioConfig } from '../../lib/audio/types';
import { pickRandomSoundKey } from '../../lib/audio/audioUtils';
import type { GamePhase, PlayerId, SummonerWarsCore } from './domain/types';
import { SW_EVENTS } from './domain/types';
import { abilityRegistry } from './domain/abilities';

const BGM_NORMAL_KEY = 'bgm.fantasy.fantasy_music_pack_vol.dragon_dance_rt_2.fantasy_vol5_dragon_dance_main';
const BGM_BATTLE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.shields_and_spears_rt_2.fantasy_vol5_shields_and_spears_main';
const STINGER_WIN_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win';
const STINGER_LOSE_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';

const MAGIC_GAIN_KEY = 'fantasy.magic_sword_recharge_01';
const MAGIC_SPEND_KEY = 'fantasy.dark_sword_recharge';
const SUMMON_KEY = 'status.general.player_status_sound_fx_pack_vol.action_and_interaction.ready_a';
const MOVE_KEY = 'card.handling.decks_and_cards_sound_fx_pack.cards_scrolling_001';
const BUILD_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
const CARD_DRAW_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const CARD_DISCARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';
const EVENT_PLAY_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001';
const UNIT_CHARGE_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const DAMAGE_LIGHT_KEY = 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst';
const DAMAGE_HEAVY_KEY = 'combat.general.fight_fury_vol_2.special_hit.fghtimpt_special_hit_01_krst';
const UNIT_DESTROY_KEY = 'combat.general.fight_fury_vol_2.body_hitting_the_ground_with_blood.fghtbf_body_hitting_the_ground_with_blood_01_krst';
const STRUCTURE_DAMAGE_KEY = 'fantasy.medieval_fantasy_sound_fx_pack_vol.armor.shield_impact_a';
const MAGIC_SHOCK_KEY = 'magic.general.simple_magic_sound_fx_pack_vol.light.holy_shock';
const HEAL_KEY = 'magic.general.simple_magic_sound_fx_pack_vol.light.holy_light';
const HEAL_MODE_KEY = 'magic.general.simple_magic_sound_fx_pack_vol.light.holy_ward';
const POSITIVE_SIGNAL_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const UPDATE_CHIME_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
const SELECTION_KEY = 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';
const PROMPT_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_spring_a';

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
    healing: HEAL_KEY,
    divine_shield: HEAL_MODE_KEY,
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

export const SUMMONER_WARS_AUDIO_CONFIG: GameAudioConfig = {
    bgm: [
        {
            key: BGM_NORMAL_KEY,
            name: 'Dragon Dance',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: BGM_BATTLE_KEY,
            name: 'Shields and Spears',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle_intense' },
        },
    ],
    eventSoundMap: {},
    eventSoundResolver: (event, context) => {
        const type = event.type;
        const runtime = context as AudioRuntimeContext<
            SummonerWarsCore,
            { currentPhase: GamePhase; isGameOver: boolean; isWinner?: boolean },
            { currentPlayerId: PlayerId }
        >;
        const abilitySound = resolveAbilitySound(event);
        if (abilitySound) return abilitySound;

        if (type === SW_EVENTS.FACTION_SELECTED) return SELECTION_KEY;
        if (type === SW_EVENTS.PLAYER_READY) return POSITIVE_SIGNAL_KEY;
        if (type === SW_EVENTS.HOST_STARTED || type === SW_EVENTS.GAME_INITIALIZED) return UPDATE_CHIME_KEY;
        if (type === SW_EVENTS.PHASE_CHANGED || type === SW_EVENTS.TURN_CHANGED) return UPDATE_CHIME_KEY;

        if (type === SW_EVENTS.UNIT_SUMMONED) return SUMMON_KEY;
        if (type === SW_EVENTS.UNIT_MOVED) return MOVE_KEY;
        if (type === SW_EVENTS.STRUCTURE_BUILT) return BUILD_KEY;

        if (type === SW_EVENTS.UNIT_ATTACKED) {
            const payload = (event as AudioEvent & { payload?: { attackType?: 'melee' | 'ranged'; attacker?: { row: number; col: number } } }).payload;
            const attackType = payload?.attackType ?? 'melee';
            if (attackType === 'ranged') {
                return pickRandomSoundKey('summonerwars.ranged_attack', RANGED_ATTACK_KEYS, { minGap: 1 });
            }
            const attacker = payload?.attacker;
            const attackerUnit = attacker ? runtime.G?.board?.[attacker.row]?.[attacker.col]?.unit : undefined;
            const unitClass = attackerUnit?.card.unitClass;
            const meleeKeys = unitClass === 'summoner' || unitClass === 'champion'
                ? MELEE_HEAVY_KEYS
                : MELEE_LIGHT_KEYS;
            return pickRandomSoundKey('summonerwars.melee_attack', meleeKeys, { minGap: 1 });
        }

        if (type === SW_EVENTS.UNIT_DAMAGED) {
            const damage = (event as AudioEvent & { payload?: { damage?: number } }).payload?.damage ?? 0;
            if (damage >= 3) return DAMAGE_HEAVY_KEY;
            if (damage > 0) return DAMAGE_LIGHT_KEY;
            return null;
        }

        if (type === SW_EVENTS.STRUCTURE_DAMAGED) return STRUCTURE_DAMAGE_KEY;
        if (type === SW_EVENTS.UNIT_DESTROYED) return UNIT_DESTROY_KEY;
        if (type === SW_EVENTS.STRUCTURE_DESTROYED) return DAMAGE_HEAVY_KEY;

        if (type === SW_EVENTS.UNIT_HEALED || type === SW_EVENTS.STRUCTURE_HEALED) return HEAL_KEY;

        if (type === SW_EVENTS.MAGIC_CHANGED) {
            const delta = (event as AudioEvent & { payload?: { delta?: number } }).payload?.delta ?? 0;
            return delta >= 0 ? MAGIC_GAIN_KEY : MAGIC_SPEND_KEY;
        }

        if (type === SW_EVENTS.CARD_DRAWN) return CARD_DRAW_KEY;
        if (type === SW_EVENTS.CARD_DISCARDED || type === SW_EVENTS.ACTIVE_EVENT_DISCARDED) return CARD_DISCARD_KEY;
        if (type === SW_EVENTS.EVENT_PLAYED || type === SW_EVENTS.EVENT_ATTACHED) return EVENT_PLAY_KEY;
        if (type === SW_EVENTS.CARD_RETRIEVED) return CARD_DRAW_KEY;

        if (type === SW_EVENTS.UNIT_CHARGED || type === SW_EVENTS.FUNERAL_PYRE_CHARGED) return UNIT_CHARGE_KEY;
        if (type === SW_EVENTS.HEALING_MODE_SET) return HEAL_MODE_KEY;

        if (type === SW_EVENTS.DAMAGE_REDUCED) return STRUCTURE_DAMAGE_KEY;
        if (type === SW_EVENTS.EXTRA_ATTACK_GRANTED) return POSITIVE_SIGNAL_KEY;

        if (type === SW_EVENTS.UNIT_PUSHED || type === SW_EVENTS.UNIT_PULLED || type === SW_EVENTS.UNITS_SWAPPED) {
            return pickRandomSoundKey('summonerwars.move_swing', MOVE_SWING_KEYS, { minGap: 1 });
        }

        if (type === SW_EVENTS.CONTROL_TRANSFERRED || type === SW_EVENTS.ABILITY_TRIGGERED || type === SW_EVENTS.HYPNOTIC_LURE_MARKED) {
            return MAGIC_SHOCK_KEY;
        }

        if (
            type === SW_EVENTS.SUMMON_FROM_DISCARD_REQUESTED
            || type === SW_EVENTS.SOUL_TRANSFER_REQUESTED
            || type === SW_EVENTS.MIND_CAPTURE_REQUESTED
            || type === SW_EVENTS.GRAB_FOLLOW_REQUESTED
        ) {
            return PROMPT_KEY;
        }

        return undefined;
    },
    bgmRules: [
        {
            when: (context) => {
                const { currentPhase } = context.ctx as { currentPhase?: GamePhase };
                return currentPhase === 'attack';
            },
            key: BGM_BATTLE_KEY,
        },
        {
            when: () => true,
            key: BGM_NORMAL_KEY,
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
};
