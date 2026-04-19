import { describe, expect, it } from 'vitest';
import type { PendingAttack, PendingDamage, TurnPhase } from '../domain/types';
import {
    computeViewModeState,
    getResponseViewSuggestionKey,
    shouldSuggestOpponentViewOnResponseChange,
} from '../ui/viewMode';

const makePendingAttack = (defenderId: string): PendingAttack => ({
    attackerId: defenderId === '0' ? '1' : '0',
    defenderId,
    isDefendable: true,
    sourceAbilityId: 'test-ability',
});

const makePendingDamage = (responderId: string): PendingDamage => ({
    id: 'pending-damage-1',
    sourcePlayerId: responderId === '0' ? '1' : '0',
    targetPlayerId: responderId,
    originalDamage: 5,
    currentDamage: 5,
    responseType: 'beforeDamageReceived',
    responderId,
    modifiers: [],
});

const runCase = (params: {
    currentPhase: TurnPhase;
    pendingAttack: PendingAttack | null;
    activePlayerId: string;
    rootPlayerId: string;
    manualViewMode: 'self' | 'opponent';
    isResponseWindowOpen?: boolean;
    currentResponderId?: string;
    pendingDamage?: PendingDamage;
}) => computeViewModeState({
    currentPhase: params.currentPhase,
    pendingAttack: params.pendingAttack,
    activePlayerId: params.activePlayerId,
    rootPlayerId: params.rootPlayerId,
    manualViewMode: params.manualViewMode,
    isResponseWindowOpen: params.isResponseWindowOpen,
    currentResponderId: params.currentResponderId,
    pendingDamage: params.pendingDamage,
});

describe('DiceThrone 视角逻辑', () => {
    it('防御阶段 pendingAttack 为空时不强制观战', () => {
        const result = runCase({
            currentPhase: 'defensiveRoll',
            pendingAttack: null,
            activePlayerId: '1',
            rootPlayerId: '1',
            manualViewMode: 'self',
        });

        expect(result.shouldAutoObserve).toBe(false);
        expect(result.viewMode).toBe('self');
        expect(result.isSelfView).toBe(true);
        expect(result.rollerId).toBe('1');
    });

    it('防御阶段存在 pendingAttack 且自己不是 defender 时强制观战', () => {
        const result = runCase({
            currentPhase: 'defensiveRoll',
            pendingAttack: makePendingAttack('0'),
            activePlayerId: '1',
            rootPlayerId: '1',
            manualViewMode: 'self',
        });

        expect(result.rollerId).toBe('0');
        expect(result.shouldAutoObserve).toBe(true);
        expect(result.viewMode).toBe('opponent');
        expect(result.isSelfView).toBe(false);
    });

    it('防御阶段存在 pendingAttack 且自己是 defender 时保持自身视角', () => {
        const result = runCase({
            currentPhase: 'defensiveRoll',
            pendingAttack: makePendingAttack('1'),
            activePlayerId: '0',
            rootPlayerId: '1',
            manualViewMode: 'self',
        });

        expect(result.rollerId).toBe('1');
        expect(result.shouldAutoObserve).toBe(false);
        expect(result.viewMode).toBe('self');
        expect(result.isSelfView).toBe(true);
    });

    it('非防御阶段不强制观战', () => {
        const result = runCase({
            currentPhase: 'offensiveRoll',
            pendingAttack: makePendingAttack('1'),
            activePlayerId: '1',
            rootPlayerId: '1',
            manualViewMode: 'opponent',
        });

        expect(result.rollerId).toBe('1');
        expect(result.shouldAutoObserve).toBe(false);
        expect(result.viewMode).toBe('opponent');
        expect(result.isSelfView).toBe(false);
    });

    it('响应窗口保持打开但轮到下一位自己响应时，生成新的视角引导 key', () => {
        const previousKey = getResponseViewSuggestionKey({
            rootPlayerId: '1',
            isResponseWindowOpen: true,
            currentResponderId: '0',
            currentResponderIndex: 0,
        });
        const currentKey = getResponseViewSuggestionKey({
            rootPlayerId: '1',
            isResponseWindowOpen: true,
            currentResponderId: '1',
            currentResponderIndex: 1,
        });

        expect(currentKey).toBe('window:1:1');
        expect(shouldSuggestOpponentViewOnResponseChange({
            previousSuggestionKey: previousKey,
            currentSuggestionKey: currentKey,
            autoResponseEnabled: true,
        })).toBe(true);
    });

    it('Token 响应由自己处理时，即使没有响应窗口也生成独立视角引导 key', () => {
        const currentKey = getResponseViewSuggestionKey({
            rootPlayerId: '1',
            pendingDamage: makePendingDamage('1'),
        });

        expect(currentKey).toBe('token:pending-damage-1');
        expect(shouldSuggestOpponentViewOnResponseChange({
            previousSuggestionKey: null,
            currentSuggestionKey: currentKey,
            autoResponseEnabled: true,
        })).toBe(true);
    });

    it('自动跳过模式下不触发视角引导', () => {
        const currentKey = getResponseViewSuggestionKey({
            rootPlayerId: '1',
            pendingDamage: makePendingDamage('1'),
        });

        expect(shouldSuggestOpponentViewOnResponseChange({
            previousSuggestionKey: null,
            currentSuggestionKey: currentKey,
            autoResponseEnabled: false,
        })).toBe(false);
    });
});
