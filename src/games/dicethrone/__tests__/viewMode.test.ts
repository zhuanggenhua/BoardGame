import { describe, expect, it } from 'vitest';
import type { PendingAttack, PendingDamage, TurnPhase } from '../domain/types';
import {
    computeViewModeState,
    getResponseViewSuggestionKey,
    resolveManualResponseEnabledForWindow,
    resolveResponseAutoViewTransition,
    shouldAutoPassResponseWindow,
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
    it('响应窗口自动切到对方视角后，窗口关闭时应恢复原视角', () => {
        const enter = resolveResponseAutoViewTransition({
            currentSuggestionKey: 'window:1:0',
            autoResponseEnabled: true,
            manualViewMode: 'self',
            session: null,
        });

        expect(enter.nextSession).toEqual({
            suggestionKey: 'window:1:0',
            restoreMode: 'self',
        });
        expect(enter.nextViewMode).toBe('opponent');

        const exit = resolveResponseAutoViewTransition({
            currentSuggestionKey: null,
            autoResponseEnabled: true,
            manualViewMode: 'opponent',
            session: enter.nextSession,
        });

        expect(exit.nextSession).toBeNull();
        expect(exit.nextViewMode).toBe('self');
    });

    it('如果原本就在对方视角，被动切换结束后应恢复到原本视角', () => {
        const enter = resolveResponseAutoViewTransition({
            currentSuggestionKey: 'token:pending-damage-1',
            autoResponseEnabled: true,
            manualViewMode: 'opponent',
            session: null,
        });

        expect(enter.nextSession).toEqual({
            suggestionKey: 'token:pending-damage-1',
            restoreMode: 'opponent',
        });
        expect(enter.nextViewMode).toBe('opponent');

        const exit = resolveResponseAutoViewTransition({
            currentSuggestionKey: null,
            autoResponseEnabled: true,
            manualViewMode: 'opponent',
            session: enter.nextSession,
        });

        expect(exit.nextSession).toBeNull();
        expect(exit.nextViewMode).toBe('opponent');
    });

    it('响应窗口 key 变化但被动切换原因仍存在时，不应提前恢复视角', () => {
        const transition = resolveResponseAutoViewTransition({
            currentSuggestionKey: 'window:1:1',
            autoResponseEnabled: true,
            manualViewMode: 'opponent',
            session: {
                suggestionKey: 'window:1:0',
                restoreMode: 'self',
            },
        });

        expect(transition.nextSession).toEqual({
            suggestionKey: 'window:1:1',
            restoreMode: 'self',
        });
        expect(transition.nextViewMode).toBeUndefined();
    });

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

    it('普通响应只受总响应开关控制，不受奖励骰响应开关影响', () => {
        const params = {
            autoResponseEnabled: true,
            bonusDiceResponseEnabled: false,
            isBonusDiceResponseWindow: false,
        };

        expect(resolveManualResponseEnabledForWindow(params)).toBe(true);
        expect(shouldAutoPassResponseWindow(params)).toBe(false);
    });

    it('奖励骰响应需要总响应和奖励骰响应同时开启', () => {
        expect(resolveManualResponseEnabledForWindow({
            autoResponseEnabled: true,
            bonusDiceResponseEnabled: false,
            isBonusDiceResponseWindow: true,
        })).toBe(false);
        expect(shouldAutoPassResponseWindow({
            autoResponseEnabled: true,
            bonusDiceResponseEnabled: false,
            isBonusDiceResponseWindow: true,
        })).toBe(true);

        expect(resolveManualResponseEnabledForWindow({
            autoResponseEnabled: true,
            bonusDiceResponseEnabled: true,
            isBonusDiceResponseWindow: true,
        })).toBe(true);
        expect(shouldAutoPassResponseWindow({
            autoResponseEnabled: true,
            bonusDiceResponseEnabled: true,
            isBonusDiceResponseWindow: true,
        })).toBe(false);
    });

    it('总响应关闭时，即使奖励骰响应存储为开启也会自动让过', () => {
        const params = {
            autoResponseEnabled: false,
            bonusDiceResponseEnabled: true,
            isBonusDiceResponseWindow: true,
        };

        expect(resolveManualResponseEnabledForWindow(params)).toBe(false);
        expect(shouldAutoPassResponseWindow(params)).toBe(true);
    });
});
