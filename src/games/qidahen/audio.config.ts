import type { AudioEvent, GameAudioConfig } from '../../lib/audio/types';

const DRAW_CARD_KEY = 'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
const DISCARD_CARD_KEY = 'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';
const SELECT_KEY = 'ui.general.khron_studio_rpg_interface_essentials_inventory_dialog_ucs_system_192khz.dialog.dialog_choice.uiclick_dialog_choice_01_krst_none';
const CONFIRM_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a';
const BATTLE_KEY = 'combat.general.fight_fury_vol_2.versatile_punch_hit.fghtimpt_versatile_punch_hit_01_krst';
const WHEEL_KEY = 'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
const WIN_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win';
const LOSE_KEY = 'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';

const BGM_NORMAL_KEY = 'bgm.ethereal.ethereal_music_pack.luminesce_rt_4.ethereal_luminesce_main';
const BGM_BATTLE_KEY = 'bgm.ethereal.ethereal_music_pack.luminesce_rt_4.ethereal_luminesce_intensity_2';

const BATTLE_EVENT_TYPES = new Set([
    'PENDING_ACTION_RESOLVED',
    'POST_BATTLE_DECISION_RESOLVED',
]);

const SELECTION_EVENT_TYPES = new Set([
    'REGION_SELECTED',
    'PREVIEW_ACTION_CONFIRMED',
    'WHEEL_MOVE_SELECTED',
    'WHEEL_MOVE_EXECUTED',
    'GAO_DI_DISPATCH_CARD_SELECTED',
    'SUN_YUANHUA_TECH_CARD_SELECTED',
]);

const CONFIRM_EVENT_TYPES = new Set([
    'INTERNAL_DISPATCH_RESOLVED',
    'RECRUIT_CHOICE_RESOLVED',
    'MA_SHI_TRADE_CHOICE_RESOLVED',
    'KHAN_EDICT_CHOICE_RESOLVED',
    'DIPLOMACY_CHOICE_RESOLVED',
    'DRIVE_TIGER_CONSENT_RESOLVED',
    'FORTIFICATION_MAINTENANCE_RESOLVED',
    'SCENARIO_CHARACTER_CHOICE_RESOLVED',
    'SCENARIO_ARMAMENT_CHOICE_RESOLVED',
    'SCENARIO_VOTE_CAST',
]);

type QidahenAudioCtx = {
    turnPhase?: string;
    isGameOver: boolean;
    isWinner?: boolean;
};

export const QIDAHEN_AUDIO_CONFIG: GameAudioConfig = {
    criticalSounds: [
        DRAW_CARD_KEY,
        DISCARD_CARD_KEY,
        SELECT_KEY,
        CONFIRM_KEY,
        BATTLE_KEY,
        WHEEL_KEY,
        WIN_KEY,
        LOSE_KEY,
    ],
    bgm: [
        {
            key: BGM_NORMAL_KEY,
            name: 'Luminesce',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle' },
        },
        {
            key: BGM_BATTLE_KEY,
            name: 'Luminesce (Intense)',
            src: '',
            volume: 0.5,
            category: { group: 'bgm', sub: 'battle_intense' },
        },
    ],
    bgmGroups: {
        normal: [BGM_NORMAL_KEY],
        battle: [BGM_BATTLE_KEY],
    },
    feedbackResolver: (event) => {
        const typedEvent = event as AudioEvent & {
            payload?: {
                actionId?: string;
                moveId?: string;
            };
        };

        if (typedEvent.type === 'SELECT_PAYMENT_CARD' || typedEvent.type === 'PAYMENT_CARD_SELECTED') {
            return DISCARD_CARD_KEY;
        }
        if (typedEvent.type === 'SELECT_HAND_LIMIT_DISCARD_CARD' || typedEvent.type === 'HAND_LIMIT_DISCARD_CARD_SELECTED') {
            return DISCARD_CARD_KEY;
        }
        if (typedEvent.type === 'HAND_LIMIT_DISCARD_RESOLVED') {
            return CONFIRM_KEY;
        }
        if (typedEvent.type === 'SELECTED_ACTION_EXECUTED') {
            return typedEvent.payload?.actionId === 'upgrade-armament' ? CONFIRM_KEY : DRAW_CARD_KEY;
        }
        if (typedEvent.type === 'WHEEL_MOVE_EXECUTED' || typedEvent.type === 'WHEEL_MOVE_SELECTED') {
            return WHEEL_KEY;
        }
        if (BATTLE_EVENT_TYPES.has(typedEvent.type)) {
            return BATTLE_KEY;
        }
        if (SELECTION_EVENT_TYPES.has(typedEvent.type)) {
            return SELECT_KEY;
        }
        if (CONFIRM_EVENT_TYPES.has(typedEvent.type)) {
            return CONFIRM_KEY;
        }
        return null;
    },
    bgmRules: [
        {
            when: (context) => {
                const { turnPhase } = context.ctx as QidahenAudioCtx;
                return turnPhase === 'resolve-pending' || turnPhase === 'post-battle-decision';
            },
            key: BGM_BATTLE_KEY,
            group: 'battle',
        },
        {
            when: () => true,
            key: BGM_NORMAL_KEY,
            group: 'normal',
        },
    ],
    stateTriggers: [
        {
            condition: (prev, next) => {
                const prevOver = (prev.ctx as QidahenAudioCtx).isGameOver;
                const nextOver = (next.ctx as QidahenAudioCtx).isGameOver;
                return !prevOver && !!nextOver;
            },
            resolveSound: (_prev, next) => {
                const { isWinner } = next.ctx as QidahenAudioCtx;
                if (isWinner === undefined) {
                    return null;
                }
                return isWinner ? WIN_KEY : LOSE_KEY;
            },
        },
    ],
};

export default QIDAHEN_AUDIO_CONFIG;
