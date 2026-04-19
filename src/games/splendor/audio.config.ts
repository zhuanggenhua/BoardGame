import type { AudioEvent, AudioRuntimeContext, GameAudioConfig } from '../../lib/audio/types';
import type { SplendorCore, SplendorPendingResolution, TokenColor } from './domain';

type SplendorAudioCtx = {
    selfPlayerId: string;
    currentPlayer: string;
    pendingType: SplendorPendingResolution['type'] | null;
    endgameTriggered: boolean;
    isGameOver: boolean;
};

const HOST_STARTED_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
const GEM_GAIN_KEY = 'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a';
const GOLD_GAIN_KEY = 'coins.decks_and_cards_sound_fx_pack.big_coin_drop_001';
const CARD_RESERVE_OPEN_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const CARD_RESERVE_DECK_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001';
const CARD_BUY_KEY = 'ui.general.mini_games_sound_effects_and_music_pack.click.sfx_ui_click_buy';
const DISCARD_TOKEN_KEY = 'coins.decks_and_cards_sound_fx_pack.small_coin_drop_001';
const NOBLE_GAINED_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const PENDING_PROMPT_KEY = 'ui.fantasy_ui_sound_fx_pack_vol.notifications_pop_ups.notification_a_001';
const TURN_ADVANCED_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_c';
const ENDGAME_TRIGGERED_KEY = 'ui.general.mini_games_sound_effects_and_music_pack.success.sfx_success_point_medium';
const GAME_WIN_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win';
const GAME_LOSE_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';
const GAME_DRAW_KEY = 'system.general.casual_mobile_sound_fx_pack_vol.alerts.misc_alerts.intruiging_alert';

const BGM_NORMAL_KEY = 'bgm.general.casual_music_pack_vol.shopping_rt_2.casual_shopping_main';
const BGM_NORMAL_ALT_KEY = 'bgm.general.casual_music_pack_vol.workshop_rt_2.casual_workshop_main';
const BGM_ENDGAME_KEY = 'bgm.ethereal.ethereal_music_pack.golden_clouds_rt_3.ethereal_golden_clouds_main';

function sumTokenDelta(tokens: Partial<Record<TokenColor, number>> | undefined): number {
    if (!tokens) return 0;
    return Object.values(tokens).reduce((sum, count) => sum + Number(count ?? 0), 0);
}

function isGoldOnlyGain(tokens: Partial<Record<TokenColor, number>> | undefined): boolean {
    if (!tokens) return false;
    const total = sumTokenDelta(tokens);
    return total > 0 && Number(tokens.gold ?? 0) === total;
}

export const SPLENDOR_AUDIO_CONFIG: GameAudioConfig = {
    criticalSounds: [
        GEM_GAIN_KEY,
        GOLD_GAIN_KEY,
        CARD_RESERVE_OPEN_KEY,
        CARD_RESERVE_DECK_KEY,
        CARD_BUY_KEY,
        DISCARD_TOKEN_KEY,
        NOBLE_GAINED_KEY,
        PENDING_PROMPT_KEY,
        TURN_ADVANCED_KEY,
        ENDGAME_TRIGGERED_KEY,
    ],
    bgm: [
        {
            key: BGM_NORMAL_KEY,
            name: 'Shopping',
            src: '',
            volume: 0.42,
        },
        {
            key: BGM_NORMAL_ALT_KEY,
            name: 'Workshop',
            src: '',
            volume: 0.42,
        },
        {
            key: BGM_ENDGAME_KEY,
            name: 'Golden Clouds',
            src: '',
            volume: 0.46,
        },
    ],
    bgmGroups: {
        normal: [
            BGM_NORMAL_KEY,
            BGM_NORMAL_ALT_KEY,
        ],
        battle: [
            BGM_ENDGAME_KEY,
        ],
    },
    feedbackResolver: (
        event: AudioEvent,
        context: AudioRuntimeContext,
    ) => {
        const runtime = context as AudioRuntimeContext<SplendorCore, SplendorAudioCtx>;
        switch (event.type) {
            case 'HOST_STARTED':
                return HOST_STARTED_KEY;
            case 'TOKENS_GAINED': {
                const payload = event.payload as { tokens?: Partial<Record<TokenColor, number>> } | undefined;
                return isGoldOnlyGain(payload?.tokens) ? GOLD_GAIN_KEY : GEM_GAIN_KEY;
            }
            case 'CARD_RESERVED': {
                const payload = event.payload as { source?: 'open' | 'deck' } | undefined;
                return payload?.source === 'deck' ? CARD_RESERVE_DECK_KEY : CARD_RESERVE_OPEN_KEY;
            }
            case 'CARD_PURCHASED':
                return CARD_BUY_KEY;
            case 'TOKENS_DISCARDED':
                return DISCARD_TOKEN_KEY;
            case 'NOBLE_GAINED':
                return NOBLE_GAINED_KEY;
            case 'PENDING_RESOLUTION_SET':
                return PENDING_PROMPT_KEY;
            case 'TURN_ADVANCED':
                return TURN_ADVANCED_KEY;
            case 'ENDGAME_TRIGGERED':
                return ENDGAME_TRIGGERED_KEY;
            case 'GAME_ENDED': {
                const payload = event.payload as { winners?: string[]; draw?: boolean } | undefined;
                if (payload?.draw) return GAME_DRAW_KEY;
                return payload?.winners?.includes(runtime.ctx.selfPlayerId) ? GAME_WIN_KEY : GAME_LOSE_KEY;
            }
            default:
                return null;
        }
    },
    bgmRules: [
        {
            when: (context) => {
                const runtime = context as AudioRuntimeContext<SplendorCore, SplendorAudioCtx>;
                return runtime.ctx.endgameTriggered;
            },
            key: BGM_ENDGAME_KEY,
            group: 'battle',
        },
        {
            when: () => true,
            key: BGM_NORMAL_KEY,
            group: 'normal',
        },
    ],
};

export default SPLENDOR_AUDIO_CONFIG;
