import type { AudioEvent, AudioRuntimeContext, GameAudioConfig } from '../../lib/audio/types';
import type { MageWarsCore, MageWarsPhase } from './domain';
import { MAGE_WARS_EVENTS } from './domain/events';

export const MAGE_WARS_BGM_NORMAL_KEY =
    'bgm.fantasy.fantasy_music_pack_vol.sorcerer_rt_3.sorcerer_main';
export const MAGE_WARS_BGM_BATTLE_KEY =
    'bgm.ethereal.ethereal_music_pack.cloud_cathedral_rt_5.ethereal_cloud_cathedral_main';
export const MAGE_WARS_CARD_PLACE_KEY =
    'card.handling.decks_and_cards_sound_fx_pack.card_placing_001';
export const MAGE_WARS_CARD_TAKE_KEY =
    'card.handling.decks_and_cards_sound_fx_pack.card_take_001';
export const MAGE_WARS_DISCARD_KEY =
    'card.fx.decks_and_cards_sound_fx_pack.fx_discard_001';
export const MAGE_WARS_UPDATE_KEY =
    'ui.general.ui_menu_sound_fx_pack_vol.signals.update.update_chime_a';
export const MAGE_WARS_HEAL_KEY =
    'status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.healed_a';
export const MAGE_WARS_WIN_KEY =
    'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win';
export const MAGE_WARS_LOSE_KEY =
    'stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose';

const SILENT_FX_EVENT_TYPES = new Set<string>([
    MAGE_WARS_EVENTS.ARENA_OBJECT_SUMMONED,
    MAGE_WARS_EVENTS.ATTACK_DECLARED,
    MAGE_WARS_EVENTS.ARENA_OBJECT_ATTACK_DECLARED,
    MAGE_WARS_EVENTS.SPELL_ATTACK_ROLLED,
    MAGE_WARS_EVENTS.SPELL_DIRECT_DAMAGE_ROLLED,
    MAGE_WARS_EVENTS.SPELL_PUSH_RESOLVED,
    MAGE_WARS_EVENTS.SPELL_HEALING_ROLLED,
    MAGE_WARS_EVENTS.SPELL_TELEPORT_RESOLVED,
    MAGE_WARS_EVENTS.DAMAGE_BARRIER_TRIGGERED,
    'DAMAGE_DEALT',
]);

const UPDATE_EVENT_TYPES = new Set<string>([
    MAGE_WARS_EVENTS.OBJECT_MANA_CHANNELED,
    MAGE_WARS_EVENTS.MANA_CHANNELED,
    MAGE_WARS_EVENTS.GUARD_GAINED,
    MAGE_WARS_EVENTS.GUARD_REMOVED,
    MAGE_WARS_EVENTS.PHASE_WINDOW_COMPLETED,
    MAGE_WARS_EVENTS.TURN_ADVANCED,
    MAGE_WARS_EVENTS.ACTION_READINESS_RESET,
]);

const resolveMageWarsFeedbackSound = (event: AudioEvent) => {
    if (SILENT_FX_EVENT_TYPES.has(event.type)) {
        return null;
    }

    switch (event.type) {
        case MAGE_WARS_EVENTS.SPELLS_PLANNED:
            return MAGE_WARS_CARD_PLACE_KEY;
        case MAGE_WARS_EVENTS.OBJECT_SPELL_PLANNED:
            return MAGE_WARS_CARD_TAKE_KEY;
        case MAGE_WARS_EVENTS.MANA_SPENT:
        case MAGE_WARS_EVENTS.MANA_DRAINED:
        case MAGE_WARS_EVENTS.SPELL_DISCARDED:
        case MAGE_WARS_EVENTS.OBJECT_SPELL_RETURNED:
            return MAGE_WARS_DISCARD_KEY;
        case MAGE_WARS_EVENTS.MAGE_MOVED:
        case MAGE_WARS_EVENTS.ARENA_OBJECT_MOVED:
            return MAGE_WARS_CARD_TAKE_KEY;
        case MAGE_WARS_EVENTS.ARENA_OBJECT_REGENERATED:
        case MAGE_WARS_EVENTS.STATUS_TOKEN_REMOVED:
            return MAGE_WARS_HEAL_KEY;
        case MAGE_WARS_EVENTS.MAGE_DEFEATED:
            return MAGE_WARS_WIN_KEY;
        default:
            return UPDATE_EVENT_TYPES.has(event.type) ? MAGE_WARS_UPDATE_KEY : null;
    }
};

const BATTLE_PHASES = new Set<MageWarsPhase>(['creatureAction', 'finalQuickcast']);

const isBattleAudioContext = (context: AudioRuntimeContext<MageWarsCore>) => {
    const matchState = context.G as unknown as {
        core?: MageWarsCore;
        sys?: { phase?: unknown; gameover?: unknown };
    };
    const runtimeCtx = context.ctx as { phase?: unknown; isGameOver?: unknown } | undefined;
    const directCore = context.G as MageWarsCore | undefined;
    const currentPhase = (matchState.sys?.phase ?? runtimeCtx?.phase) as MageWarsPhase | undefined;

    return BATTLE_PHASES.has(currentPhase as MageWarsPhase)
        || Boolean(matchState.sys?.gameover)
        || Boolean(matchState.core?.gameResult)
        || Boolean(directCore?.gameResult)
        || runtimeCtx?.isGameOver === true;
};

export const MAGE_WARS_AUDIO_CONFIG: GameAudioConfig = {
    criticalSounds: [
        MAGE_WARS_CARD_PLACE_KEY,
        MAGE_WARS_CARD_TAKE_KEY,
        MAGE_WARS_DISCARD_KEY,
        MAGE_WARS_UPDATE_KEY,
        MAGE_WARS_HEAL_KEY,
        MAGE_WARS_WIN_KEY,
    ],
    warmSounds: [
        MAGE_WARS_BGM_NORMAL_KEY,
        MAGE_WARS_BGM_BATTLE_KEY,
        MAGE_WARS_LOSE_KEY,
    ],
    bgm: [
        {
            key: MAGE_WARS_BGM_NORMAL_KEY,
            name: 'Sorcerer',
            src: '',
            volume: 0.38,
            category: { group: 'bgm', sub: 'fantasy' },
        },
        {
            key: MAGE_WARS_BGM_BATTLE_KEY,
            name: 'Cloud Cathedral',
            src: '',
            volume: 0.42,
            category: { group: 'bgm', sub: 'ethereal' },
        },
    ],
    bgmGroups: {
        normal: [MAGE_WARS_BGM_NORMAL_KEY],
        battle: [MAGE_WARS_BGM_BATTLE_KEY],
    },
    feedbackResolver: resolveMageWarsFeedbackSound,
    bgmRules: [
        {
            when: (context) => isBattleAudioContext(context as AudioRuntimeContext<MageWarsCore>),
            key: MAGE_WARS_BGM_BATTLE_KEY,
            group: 'battle',
        },
        {
            when: () => true,
            key: MAGE_WARS_BGM_NORMAL_KEY,
            group: 'normal',
        },
    ],
};

export default MAGE_WARS_AUDIO_CONFIG;
