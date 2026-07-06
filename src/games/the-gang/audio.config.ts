import type { AudioEvent, AudioRuntimeContext, GameAudioConfig } from '../../lib/audio/types';
import { THE_GANG_EVENTS, type TheGangCore } from './domain/types';

export const THE_GANG_CHIP_TAKEN_KEY = 'coins.decks_and_cards_sound_fx_pack.small_coin_drop_001';
export const THE_GANG_ROUND_ENDED_KEY = 'card.handling.mini_games_sound_effects_and_music_pack.card.sfx_card_deal_1';
export const THE_GANG_NEXT_HEIST_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_c';
export const THE_GANG_SHOWDOWN_SUCCESS_KEY = 'ui.general.mini_games_sound_effects_and_music_pack.success.sfx_success_point_medium';
export const THE_GANG_SHOWDOWN_WIN_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win';
export const THE_GANG_SHOWDOWN_LOSE_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';

const THE_GANG_BGM_NORMAL_KEY = 'bgm.ethereal.ethereal_music_pack.enigmatic_badger_rt_7.ethereal_enigmatic_badger_main';
const THE_GANG_BGM_SHOWDOWN_KEY = 'bgm.ethereal.ethereal_music_pack.enigmatic_badger_rt_7.ethereal_enigmatic_badger_intensity_2';

type ShowdownPayload = {
    record?: {
        outcome?: 'success' | 'failure';
    };
};

type TheGangAudioCtx = {
    isGameOver?: boolean;
};

const resolveShowdownSound = (event: AudioEvent) => {
    const payload = event.payload as ShowdownPayload | undefined;
    return payload?.record?.outcome === 'success'
        ? THE_GANG_SHOWDOWN_WIN_KEY
        : THE_GANG_SHOWDOWN_LOSE_KEY;
};

export const THE_GANG_AUDIO_CONFIG: GameAudioConfig = {
    criticalSounds: [
        THE_GANG_CHIP_TAKEN_KEY,
        THE_GANG_ROUND_ENDED_KEY,
        THE_GANG_NEXT_HEIST_KEY,
        THE_GANG_SHOWDOWN_SUCCESS_KEY,
        THE_GANG_SHOWDOWN_WIN_KEY,
        THE_GANG_SHOWDOWN_LOSE_KEY,
    ],
    bgm: [
        {
            key: THE_GANG_BGM_NORMAL_KEY,
            name: 'Enigmatic Badger',
            src: '',
            volume: 0.38,
        },
        {
            key: THE_GANG_BGM_SHOWDOWN_KEY,
            name: 'Enigmatic Badger Intense',
            src: '',
            volume: 0.42,
        },
    ],
    bgmGroups: {
        normal: [THE_GANG_BGM_NORMAL_KEY],
        battle: [THE_GANG_BGM_SHOWDOWN_KEY],
    },
    feedbackResolver: (event) => {
        switch (event.type) {
            case THE_GANG_EVENTS.CHIP_TAKEN:
                return THE_GANG_CHIP_TAKEN_KEY;
            case THE_GANG_EVENTS.ROUND_ENDED:
                return THE_GANG_ROUND_ENDED_KEY;
            case THE_GANG_EVENTS.PROGRESS_APPROVED:
                return THE_GANG_SHOWDOWN_SUCCESS_KEY;
            case THE_GANG_EVENTS.SHOWDOWN_REVEALED:
                return resolveShowdownSound(event);
            case THE_GANG_EVENTS.NEXT_HEIST_STARTED:
                return THE_GANG_NEXT_HEIST_KEY;
            case THE_GANG_EVENTS.GAME_FINISHED:
                return THE_GANG_SHOWDOWN_WIN_KEY;
            default:
                return null;
        }
    },
    bgmRules: [
        {
            when: (context) => {
                const runtime = context as AudioRuntimeContext<TheGangCore, TheGangAudioCtx>;
                return runtime.G.phase === 'showdown' || !!runtime.ctx.isGameOver;
            },
            key: THE_GANG_BGM_SHOWDOWN_KEY,
            group: 'battle',
        },
        {
            when: () => true,
            key: THE_GANG_BGM_NORMAL_KEY,
            group: 'normal',
        },
    ],
};

export default THE_GANG_AUDIO_CONFIG;
