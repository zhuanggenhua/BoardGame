import type { AudioEvent, AudioRuntimeContext, GameAudioConfig, SoundKey } from '../../lib/audio/types';
import type { BetrayalCore } from './game';

export const BETRAYAL_MOVE_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.handling.wooden_component_handle_d';
export const BETRAYAL_EXPLORE_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.handling.wooden_component_handle_b';
export const BETRAYAL_EXPLORE_EVENT_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.misc_items.rattle_fiddle_a';
export const BETRAYAL_EXPLORE_OMEN_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.misc_items.rattle_latch_c';
export const BETRAYAL_HAUNT_KEY =
    'system.computers_machinery_sound_fx_pack_vol.foley_and_impacts.rattling.wood_rattling_003';
export const BETRAYAL_ATTACK_KEY =
    'system.computers_machinery_sound_fx_pack_vol.foley_and_impacts.impact.high_metal_impact_004';
export const BETRAYAL_SCENARIO_PAGE_TURN_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.handling.wooden_component_handle_e';
export const BETRAYAL_SELECT_EXPLORER_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.audio_devices.handheld_radio_buttons_a';
export const BETRAYAL_CONFIRM_EXPLORER_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.triggers.spring_button_a';
export const BETRAYAL_START_SCENARIO_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.misc_items.rattle_latch_a';
export const BETRAYAL_USE_POSSESSION_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.handling.rubber_component_handle_c';
export const BETRAYAL_USE_HOLY_WATER_POSSESSION_KEY =
    'ambient.water_sound_fx_pack_vol.designed.water_ball_spell_small';
export const BETRAYAL_REROLL_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.handling.watch_handling_b';
export const BETRAYAL_EVENT_CHOICE_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.triggers.spring_button_d';
export const BETRAYAL_ROOM_EFFECT_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.misc_items.rattle_twist';
export const BETRAYAL_TRADE_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.handling.wooden_component_handle_a';
export const BETRAYAL_LOOT_CORPSE_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.handling.handling_metal_equipment_b';
export const BETRAYAL_END_TURN_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.triggers.spring_button_f';
export const BETRAYAL_JACK_LEARNED_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.home_media.vhs_player_buttons_pressing_c';
export const BETRAYAL_EXORCISM_STUDIED_KEY =
    'ambient.water_sound_fx_pack_vol.designed.water_ball_spell_small';
export const BETRAYAL_EXORCISE_SUCCESS_KEY =
    'ambient.water_sound_fx_pack_vol.designed.water_ball_spell_big';
export const BETRAYAL_EXORCISE_FAILURE_KEY =
    'ambient.water_sound_fx_pack_vol.designed.impact_b';
export const BETRAYAL_SCENARIO_COMPLETED_KEY =
    'retro.retro_gaming_sound_fx_pack_vol.16_bit.ui.jingle_win_001';

export const BETRAYAL_BGM_PRE_HAUNT_KEY =
    'bgm.horror_music_pack_vol.tip_toe_rt_5.horror_vol9_tip_toe_main';
export const BETRAYAL_BGM_HAUNT_KEY =
    'bgm.horror_music_pack_vol.hostile_hotel_rt_7.horror_vol9_hostile_hotel_main';

type HauntTriggerPayload = {
    hauntTriggered?: boolean;
};

type RoomExploredPayload = HauntTriggerPayload & {
    deckKind?: 'event' | 'item' | 'omen';
};

type SuccessPayload = {
    success?: boolean;
};

type PossessionUsedPayload = {
    cardId?: string;
};

type AttackRewardPayload = {
    choice?: 'damage' | 'steal';
};

const POSSESSION_SOUND_BY_CARD_ID: Record<string, SoundKey> = {
    'holy-water': BETRAYAL_USE_HOLY_WATER_POSSESSION_KEY,
};

const resolvePossessionBaseCardId = (cardId: string): string => cardId
    .replace(/-preview-\d+$/, '')
    .replace(/-armory-\d+-\d+$/, '')
    .replace(/-\d+$/, '');

const didTriggerHaunt = (event: AudioEvent): boolean => {
    const payload = event.payload as HauntTriggerPayload | undefined;
    return payload?.hauntTriggered === true;
};

const resolveExploreSound = (event: AudioEvent) => {
    if (didTriggerHaunt(event)) return BETRAYAL_HAUNT_KEY;
    const payload = event.payload as RoomExploredPayload | undefined;
    if (payload?.deckKind === 'event') return BETRAYAL_EXPLORE_EVENT_KEY;
    if (payload?.deckKind === 'omen') return BETRAYAL_EXPLORE_OMEN_KEY;
    return BETRAYAL_EXPLORE_KEY;
};

const resolvePossessionSound = (event: AudioEvent) => {
    const payload = event.payload as PossessionUsedPayload | undefined;
    const cardId = payload?.cardId;
    if (!cardId) return BETRAYAL_USE_POSSESSION_KEY;
    return POSSESSION_SOUND_BY_CARD_ID[resolvePossessionBaseCardId(cardId)] ?? BETRAYAL_USE_POSSESSION_KEY;
};

const resolveAttackRewardSound = (event: AudioEvent) => {
    const payload = event.payload as AttackRewardPayload | undefined;
    return payload?.choice === 'steal' ? BETRAYAL_LOOT_CORPSE_KEY : BETRAYAL_ATTACK_KEY;
};

export const BETRAYAL_AUDIO_CONFIG: GameAudioConfig = {
    criticalSounds: [
        BETRAYAL_MOVE_KEY,
        BETRAYAL_EXPLORE_KEY,
        BETRAYAL_EXPLORE_EVENT_KEY,
        BETRAYAL_EXPLORE_OMEN_KEY,
        BETRAYAL_HAUNT_KEY,
        BETRAYAL_ATTACK_KEY,
        BETRAYAL_SCENARIO_PAGE_TURN_KEY,
        BETRAYAL_SELECT_EXPLORER_KEY,
        BETRAYAL_CONFIRM_EXPLORER_KEY,
        BETRAYAL_START_SCENARIO_KEY,
        BETRAYAL_USE_POSSESSION_KEY,
        BETRAYAL_REROLL_KEY,
        BETRAYAL_EVENT_CHOICE_KEY,
        BETRAYAL_ROOM_EFFECT_KEY,
        BETRAYAL_TRADE_KEY,
        BETRAYAL_LOOT_CORPSE_KEY,
        BETRAYAL_END_TURN_KEY,
        BETRAYAL_JACK_LEARNED_KEY,
        BETRAYAL_EXORCISM_STUDIED_KEY,
        BETRAYAL_EXORCISE_SUCCESS_KEY,
        BETRAYAL_EXORCISE_FAILURE_KEY,
        BETRAYAL_SCENARIO_COMPLETED_KEY,
    ],
    warmSounds: [
        BETRAYAL_USE_HOLY_WATER_POSSESSION_KEY,
    ],
    bgm: [
        {
            key: BETRAYAL_BGM_PRE_HAUNT_KEY,
            name: 'Tip Toe',
            src: '',
            volume: 0.34,
        },
        {
            key: BETRAYAL_BGM_HAUNT_KEY,
            name: 'Hostile Hotel',
            src: '',
            volume: 0.4,
        },
    ],
    bgmGroups: {
        normal: [BETRAYAL_BGM_PRE_HAUNT_KEY],
        battle: [BETRAYAL_BGM_HAUNT_KEY],
    },
    feedbackResolver: (event) => {
        switch (event.type) {
            case 'EXPLORER_SELECTED':
                return BETRAYAL_SELECT_EXPLORER_KEY;
            case 'EXPLORER_CONFIRMED':
                return BETRAYAL_CONFIRM_EXPLORER_KEY;
            case 'SCENARIO_STARTED':
                return BETRAYAL_START_SCENARIO_KEY;
            case 'EXPLORER_MOVED':
                return BETRAYAL_MOVE_KEY;
            case 'ROOM_EXPLORED':
                return resolveExploreSound(event);
            case 'EVENT_CHOICE_RESOLVED':
                return didTriggerHaunt(event) ? BETRAYAL_HAUNT_KEY : BETRAYAL_EVENT_CHOICE_KEY;
            case 'POSSESSION_USED':
                return resolvePossessionSound(event);
            case 'RABBIT_FOOT_USED':
                return BETRAYAL_REROLL_KEY;
            case 'ROOM_EFFECT_USED':
                return BETRAYAL_ROOM_EFFECT_KEY;
            case 'POSSESSION_TRADED':
                return BETRAYAL_TRADE_KEY;
            case 'CORPSE_LOOTED':
                return BETRAYAL_LOOT_CORPSE_KEY;
            case 'TURN_ENDED':
                return BETRAYAL_END_TURN_KEY;
            case 'HAUNT_TRIGGERED':
                return BETRAYAL_HAUNT_KEY;
            case 'HAUNT_ATTACK_RESOLVED':
            case 'DYNAMITE_ATTACK_RESOLVED':
            case 'MONSTER_DAMAGE_RESOLVED':
            case 'MONSTER_ATTACK_HERO_RESOLVED':
            case 'HELPING_HANDS_TROLL_HAND_ATTACK_RESOLVED':
                return BETRAYAL_ATTACK_KEY;
            case 'MONSTER_TURN_START_RESOLVED':
            case 'BLOOD_FROM_STONE_EXTRA_STONE_CHERUBS_PLACED':
            case 'HELPING_HANDS_MONSTER_TURN_STARTED':
                return BETRAYAL_HAUNT_KEY;
            case 'MONSTER_MOVEMENT_GROUP_ROLLED':
                return BETRAYAL_REROLL_KEY;
            case 'MONSTER_MOVED':
            case 'HELPING_HANDS_TROLL_HAND_MOVED':
                return BETRAYAL_MOVE_KEY;
            case 'BLOOD_FROM_STONE_MONSTER_TURN_ENDED':
            case 'HELPING_HANDS_MONSTER_TURN_ENDED':
                return BETRAYAL_END_TURN_KEY;
            case 'HELPING_HANDS_ATTACK_REWARD_RESOLVED':
                return resolveAttackRewardSound(event);
            case 'JACK_LEARNED':
            case 'MUMMY_NAME_STUDIED':
                return BETRAYAL_JACK_LEARNED_KEY;
            case 'EXORCISM_STUDIED':
            case 'MUMMY_BANISHMENT_LEARNED':
                return BETRAYAL_EXORCISM_STUDIED_KEY;
            case 'JACK_EXORCISED': {
                const payload = event.payload as SuccessPayload | undefined;
                return payload?.success ? BETRAYAL_EXORCISE_SUCCESS_KEY : BETRAYAL_EXORCISE_FAILURE_KEY;
            }
            case 'MUMMY_BANISHED': {
                const payload = event.payload as SuccessPayload | undefined;
                return payload?.success ? BETRAYAL_EXORCISE_SUCCESS_KEY : BETRAYAL_EXORCISE_FAILURE_KEY;
            }
            case 'MUMMY_GIRL_PICKED_UP':
                return BETRAYAL_USE_POSSESSION_KEY;
            case 'MUMMY_GIRL_GIVEN':
            case 'MUMMY_OMEN_GIVEN':
                return BETRAYAL_TRADE_KEY;
            case 'MUMMY_ATTACK_REWARD_RESOLVED':
                return resolveAttackRewardSound(event);
            case 'SCENARIO_COMPLETED':
                return BETRAYAL_SCENARIO_COMPLETED_KEY;
            default:
                return null;
        }
    },
    bgmRules: [
        {
            when: (context) => {
                const runtime = context as AudioRuntimeContext<BetrayalCore>;
                return runtime.G.phase === 'haunt' || runtime.G.phase === 'endgame';
            },
            key: BETRAYAL_BGM_HAUNT_KEY,
            group: 'battle',
        },
        {
            when: () => true,
            key: BETRAYAL_BGM_PRE_HAUNT_KEY,
            group: 'normal',
        },
    ],
};

export default BETRAYAL_AUDIO_CONFIG;
