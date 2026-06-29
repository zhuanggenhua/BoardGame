import { describe, expect, it } from 'vitest';
import type { AudioEvent } from '../../../lib/audio/types';
import { FANTASY_REALMS_AUDIO_CONFIG } from '../audio.config';
import type { FantasyRealmsCore } from '../domain';

const baseContext = {
    G: {} as FantasyRealmsCore,
    ctx: {
        currentStage: 'draw' as const,
        isGameOver: false,
        selfPlayerId: '0',
        winnerIds: [] as string[],
        isDraw: false,
    },
};

const resolveAudioKey = (event: AudioEvent, ctx = baseContext) => (
    FANTASY_REALMS_AUDIO_CONFIG.feedbackResolver(event, ctx as never)
);

describe('fantasyrealms audio config', () => {
    it('为核心回合事件返回预期音效', () => {
        expect(resolveAudioKey({
            type: 'CARDS_DRAWN',
            payload: { playerId: '0', cards: [], nextStage: 'discard' },
        } as AudioEvent)).toBe('card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_003');

        expect(resolveAudioKey({
            type: 'DISCARD_CARD_TAKEN',
            payload: {
                playerId: '0',
                card: { id: 'card-a' },
                nextPlayerId: '1',
                nextTurn: 2,
                nextStage: 'discard',
                requiresDiscard: true,
            },
        } as AudioEvent)).toBe('card.fx.decks_and_cards_sound_fx_pack.fx_flying_cards_001');

        expect(resolveAudioKey({
            type: 'CARD_DISCARDED',
            payload: {
                playerId: '0',
                card: { id: 'card-b' },
                nextPlayerId: '1',
                nextTurn: 2,
                nextStage: 'draw',
            },
        } as AudioEvent)).toBe('card.fx.decks_and_cards_sound_fx_pack.fx_discard_003');
    });

    it('私有手牌相关流程音只对当前操作者自己播放，其他玩家和观战保持静默', () => {
        const otherViewerContext = {
            ...baseContext,
            ctx: {
                ...baseContext.ctx,
                selfPlayerId: '1',
            },
        };

        expect(resolveAudioKey({
            type: 'CARDS_DRAWN',
            payload: { playerId: '0', cards: [], nextStage: 'discard' },
        } as AudioEvent, otherViewerContext)).toBeNull();

        expect(resolveAudioKey({
            type: 'DISCARD_CARD_TAKEN',
            payload: {
                playerId: '0',
                card: { id: 'card-a' },
                nextPlayerId: '1',
                nextTurn: 2,
                nextStage: 'discard',
                requiresDiscard: true,
            },
        } as AudioEvent, otherViewerContext)).toBeNull();

        expect(resolveAudioKey({
            type: 'CARD_DISCARDED',
            payload: {
                playerId: '0',
                card: { id: 'card-b' },
                nextPlayerId: '1',
                nextTurn: 2,
                nextStage: 'draw',
            },
        } as AudioEvent, {
            ...baseContext,
            ctx: {
                ...baseContext.ctx,
                selfPlayerId: null,
            },
        })).toBeNull();
    });

    it('查看焦点牌保持静默，避免把本地查看音广播给其他玩家', () => {
        expect(resolveAudioKey({
            type: 'FOCUS_CARD_SET',
            payload: { cardId: 'card-a' },
        } as AudioEvent)).toBeNull();
    });

    it('终局时切到结算 BGM 组', () => {
        const rules = FANTASY_REALMS_AUDIO_CONFIG.bgmRules ?? [];
        const gameoverRule = rules.find((rule) => rule.group === 'endgame');

        expect(gameoverRule?.when({
            G: {} as FantasyRealmsCore,
            ctx: {
                currentStage: 'discard',
                isGameOver: true,
                selfPlayerId: '0',
                winnerIds: ['0'],
                isDraw: false,
            },
        } as never)).toBe(true);
        expect(gameoverRule?.key).toBe('bgm.ethereal.ethereal_music_pack.cloud_cathedral_rt_5.ethereal_cloud_cathedral_main');
    });

    it('状态触发器按胜负返回新的终局提示音，平局或观战不播放', () => {
        const trigger = FANTASY_REALMS_AUDIO_CONFIG.stateTriggers?.[0];
        expect(trigger).toBeDefined();

        expect(trigger?.resolveSound?.(
            baseContext as never,
            {
                G: {} as FantasyRealmsCore,
                ctx: {
                    currentStage: 'discard',
                    isGameOver: true,
                    selfPlayerId: '0',
                    winnerIds: ['0'],
                    isDraw: false,
                },
            } as never,
        )).toBe('system.success_and_failure_sound_fx_pack_vol.successes.traditional_success_f');

        expect(trigger?.resolveSound?.(
            baseContext as never,
            {
                G: {} as FantasyRealmsCore,
                ctx: {
                    currentStage: 'discard',
                    isGameOver: true,
                    selfPlayerId: '0',
                    winnerIds: ['1'],
                    isDraw: false,
                },
            } as never,
        )).toBe('system.success_and_failure_sound_fx_pack_vol.failures.traditional_failure_f');

        expect(trigger?.resolveSound?.(
            baseContext as never,
            {
                G: {} as FantasyRealmsCore,
                ctx: {
                    currentStage: 'discard',
                    isGameOver: true,
                    selfPlayerId: null,
                    winnerIds: ['1'],
                    isDraw: false,
                },
            } as never,
        )).toBeNull();

        expect(trigger?.resolveSound?.(
            baseContext as never,
            {
                G: {} as FantasyRealmsCore,
                ctx: {
                    currentStage: 'discard',
                    isGameOver: true,
                    selfPlayerId: '0',
                    winnerIds: ['0', '1'],
                    isDraw: true,
                },
            } as never,
        )).toBeNull();
    });
});
