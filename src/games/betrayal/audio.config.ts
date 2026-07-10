import type { AudioEvent, AudioRuntimeContext, GameAudioConfig } from '../../lib/audio/types';
import type { BetrayalCore } from './game';

export const BETRAYAL_MOVE_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.handling.wooden_component_handle_d';
export const BETRAYAL_EXPLORE_KEY =
    'foley.analogue_gear_sound_fx_pack_vol.handling.wooden_component_handle_b';
export const BETRAYAL_HAUNT_KEY =
    'system.computers_machinery_sound_fx_pack_vol.foley_and_impacts.rattling.wood_rattling_003';
export const BETRAYAL_ATTACK_KEY =
    'system.computers_machinery_sound_fx_pack_vol.foley_and_impacts.impact.high_metal_impact_004';

export const BETRAYAL_BGM_PRE_HAUNT_KEY =
    'bgm.horror_music_pack_vol.tip_toe_rt_5.horror_vol9_tip_toe_main';
export const BETRAYAL_BGM_HAUNT_KEY =
    'bgm.horror_music_pack_vol.hostile_hotel_rt_7.horror_vol9_hostile_hotel_main';

type HauntTriggerPayload = {
    hauntTriggered?: boolean;
};

const didTriggerHaunt = (event: AudioEvent): boolean => {
    const payload = event.payload as HauntTriggerPayload | undefined;
    return payload?.hauntTriggered === true;
};

export const BETRAYAL_AUDIO_CONFIG: GameAudioConfig = {
    criticalSounds: [
        BETRAYAL_MOVE_KEY,
        BETRAYAL_EXPLORE_KEY,
        BETRAYAL_HAUNT_KEY,
        BETRAYAL_ATTACK_KEY,
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
            case 'EXPLORER_MOVED':
                return BETRAYAL_MOVE_KEY;
            case 'ROOM_EXPLORED':
                return didTriggerHaunt(event) ? BETRAYAL_HAUNT_KEY : BETRAYAL_EXPLORE_KEY;
            case 'EVENT_CHOICE_RESOLVED':
                return didTriggerHaunt(event) ? BETRAYAL_HAUNT_KEY : null;
            case 'HAUNT_TRIGGERED':
                return BETRAYAL_HAUNT_KEY;
            case 'HAUNT_ATTACK_RESOLVED':
                return BETRAYAL_ATTACK_KEY;
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
