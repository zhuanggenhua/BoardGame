import type { AudioRuntimeContext, GameAudioConfig } from '../../lib/audio/types';
import { collectPreloadKeys, createFeedbackResolver } from '../../lib/audio/defineEvents';
import type { FantasyRealmsCore } from './domain';
import { FANTASY_REALMS_AUDIO_EVENTS } from './domain/events';

type FantasyRealmsAudioCtx = {
    currentStage: FantasyRealmsCore['stage'];
    isGameOver: boolean;
    selfPlayerId: string | null;
    winnerIds: string[];
    isDraw: boolean;
};

const BGM_ROYALTY_KEY = 'bgm.fantasy.fantasy_music_pack_vol.royalty_rt_1.royalty_main';
const BGM_MYSTWOOD_REVERIE_KEY = 'bgm.fantasy.fantasy_music_pack_vol.mystwood_reverie_rt_4.fantasy_vol7_mystwood_reverie_main';
const BGM_MOONVEIL_KEY = 'bgm.fantasy.fantasy_music_pack_vol.moonveil_rt_5.fantasy_vol8_moonveil_main';
const BGM_SORCERER_KEY = 'bgm.fantasy.fantasy_music_pack_vol.sorcerer_rt_3.sorcerer_main';
const BGM_CLOUD_CATHEDRAL_KEY = 'bgm.ethereal.ethereal_music_pack.cloud_cathedral_rt_5.ethereal_cloud_cathedral_main';
const STINGER_WIN_KEY = 'system.success_and_failure_sound_fx_pack_vol.successes.traditional_success_f';
const STINGER_LOSE_KEY = 'system.success_and_failure_sound_fx_pack_vol.failures.traditional_failure_f';
export const ENDGAME_SCORE_STEP_KEY = 'puzzle.17.positive_pop_05';

const baseFeedbackResolver = createFeedbackResolver(FANTASY_REALMS_AUDIO_EVENTS);

const resolveLocalGameplaySound = (
    event: { type: string; payload?: { playerId?: string } },
    selfPlayerId: string | null | undefined,
): string | null => {
    const actorPlayerId = event.payload?.playerId;
    if (!actorPlayerId || !selfPlayerId || actorPlayerId !== selfPlayerId) {
        return null;
    }
    return baseFeedbackResolver(event);
};

export const FANTASY_REALMS_AUDIO_CONFIG: GameAudioConfig = {
    blockingSounds: [
        STINGER_WIN_KEY,
        STINGER_LOSE_KEY,
        ENDGAME_SCORE_STEP_KEY,
    ],
    criticalSounds: Array.from(new Set([
        ...collectPreloadKeys(FANTASY_REALMS_AUDIO_EVENTS),
        STINGER_WIN_KEY,
        STINGER_LOSE_KEY,
        ENDGAME_SCORE_STEP_KEY,
    ])),
    bgm: [
        {
            key: BGM_ROYALTY_KEY,
            name: 'Royalty',
            src: 'bgm/fantasy/Fantasy Music Pack Vol. 3/Royalty (RT 1.636)/Royalty Main.ogg',
            volume: 0.44,
            category: { group: 'bgm', sub: 'fantasy' },
        },
        {
            key: BGM_MYSTWOOD_REVERIE_KEY,
            name: 'Mystwood Reverie',
            src: 'bgm/fantasy/Fantasy Music Pack Vol. 7/Mystwood Reverie (RT 4.186)/Fantasy Vol7 Mystwood Reverie Main.ogg',
            volume: 0.44,
            category: { group: 'bgm', sub: 'fantasy' },
        },
        {
            key: BGM_MOONVEIL_KEY,
            name: 'Moonveil',
            src: 'bgm/fantasy/Fantasy Music Pack Vol. 8/Moonveil (RT 5.625)/Fantasy Vol8 Moonveil Main.ogg',
            volume: 0.42,
            category: { group: 'bgm', sub: 'fantasy' },
        },
        {
            key: BGM_SORCERER_KEY,
            name: 'Sorcerer',
            src: 'bgm/fantasy/Fantasy Music Pack Vol. 3/Sorcerer (RT 3.75)/Sorcerer Main.ogg',
            volume: 0.42,
            category: { group: 'bgm', sub: 'fantasy' },
        },
        {
            key: BGM_CLOUD_CATHEDRAL_KEY,
            name: 'Cloud Cathedral',
            src: 'bgm/ethereal/Ethereal Music Pack/Cloud Cathedral (RT 5.625)/Ethereal Cloud Cathedral Main.ogg',
            volume: 0.4,
            category: { group: 'bgm', sub: 'ethereal' },
        },
    ],
    bgmGroups: {
        normal: [
            BGM_ROYALTY_KEY,
            BGM_MYSTWOOD_REVERIE_KEY,
            BGM_MOONVEIL_KEY,
            BGM_SORCERER_KEY,
        ],
        battle: [
            BGM_ROYALTY_KEY,
            BGM_MYSTWOOD_REVERIE_KEY,
            BGM_MOONVEIL_KEY,
            BGM_SORCERER_KEY,
        ],
        endgame: [BGM_CLOUD_CATHEDRAL_KEY],
    },
    feedbackResolver: (event, context) => {
        switch (event.type) {
            case 'CARDS_DRAWN':
            case 'DISCARD_CARD_TAKEN':
            case 'CARD_DISCARDED':
                return resolveLocalGameplaySound(event as { type: string; payload?: { playerId?: string } }, (
                    context?.ctx as FantasyRealmsAudioCtx | undefined
                )?.selfPlayerId);
            default:
                return baseFeedbackResolver(event);
        }
    },
    bgmRules: [
        {
            when: (context) => {
                const runtime = context as AudioRuntimeContext<FantasyRealmsCore, FantasyRealmsAudioCtx>;
                return runtime.ctx.isGameOver;
            },
            key: BGM_CLOUD_CATHEDRAL_KEY,
            group: 'endgame',
        },
        {
            when: () => true,
            key: BGM_ROYALTY_KEY,
            group: 'normal',
        },
    ],
    stateTriggers: [
        {
            condition: (prev, next) => {
                const prevOver = (prev.ctx as FantasyRealmsAudioCtx).isGameOver;
                const nextOver = (next.ctx as FantasyRealmsAudioCtx).isGameOver;
                return !prevOver && nextOver;
            },
            resolveSound: (_prev, next) => {
                const runtime = next.ctx as FantasyRealmsAudioCtx;
                if (runtime.isDraw || !runtime.selfPlayerId) {
                    return null;
                }
                return runtime.winnerIds.includes(runtime.selfPlayerId)
                    ? STINGER_WIN_KEY
                    : STINGER_LOSE_KEY;
            },
        },
    ],
};

export default FANTASY_REALMS_AUDIO_CONFIG;
