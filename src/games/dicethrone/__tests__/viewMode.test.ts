import { describe, expect, it } from 'vitest';
import type { PendingAttack, TurnPhase } from '../domain/types';
import { computeViewModeState } from '../ui/viewMode';

const makePendingAttack = (defenderId: string): PendingAttack => ({
    attackerId: defenderId === '0' ? '1' : '0',
    defenderId,
    isDefendable: true,
    sourceAbilityId: 'test-ability',
});

const runCase = (params: {
    currentPhase: TurnPhase;
    pendingAttack: PendingAttack | null;
    activePlayerId: string;
    rootPlayerId: string;
    manualViewMode: 'self' | 'opponent';
}) => computeViewModeState({
    currentPhase: params.currentPhase,
    pendingAttack: params.pendingAttack,
    activePlayerId: params.activePlayerId,
    rootPlayerId: params.rootPlayerId,
    manualViewMode: params.manualViewMode,
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
        expect(result.isResponseAutoSwitch).toBe(false);
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
});

describe('响应窗口视角自动切换', () => {
    const makeResponseWindow = (responderQueue: string[], currentResponderIndex = 0) => ({
        id: 'test-window',
        windowType: 'afterRollConfirmed' as const,
        responderQueue,
        currentResponderIndex,
        passedPlayers: [],
    });

    it('响应窗口打开且本地玩家是响应者时 isResponseAutoSwitch 为 true', () => {
        const result = computeViewModeState({
            currentPhase: 'offensiveRoll',
            pendingAttack: null,
            activePlayerId: '0',
            rootPlayerId: '0',
            manualViewMode: 'self',
            responseWindow: makeResponseWindow(['1']),
            isLocalPlayerResponder: true,
        });

        expect(result.isResponseAutoSwitch).toBe(true);
    });

    it('响应窗口打开且当前响应者是自己时 isResponseAutoSwitch 为 false', () => {
        const result = computeViewModeState({
            currentPhase: 'offensiveRoll',
            pendingAttack: null,
            activePlayerId: '0',
            rootPlayerId: '0',
            manualViewMode: 'self',
            responseWindow: makeResponseWindow(['0']),
        });

        expect(result.isResponseAutoSwitch).toBe(false);
    });

    it('无响应窗口时 isResponseAutoSwitch 为 false', () => {
        const result = computeViewModeState({
            currentPhase: 'offensiveRoll',
            pendingAttack: null,
            activePlayerId: '0',
            rootPlayerId: '0',
            manualViewMode: 'self',
        });

        expect(result.isResponseAutoSwitch).toBe(false);
    });

    it('响应窗口不影响防御阶段的强制观战', () => {
        const result = computeViewModeState({
            currentPhase: 'defensiveRoll',
            pendingAttack: makePendingAttack('1'),
            activePlayerId: '0',
            rootPlayerId: '0',
            manualViewMode: 'self',
            responseWindow: makeResponseWindow(['0']),
        });

        // 防御阶段 shouldAutoObserve 仍然生效
        expect(result.shouldAutoObserve).toBe(true);
        expect(result.viewMode).toBe('opponent');
        // 响应者是自己，所以 isResponseAutoSwitch 为 false
        expect(result.isResponseAutoSwitch).toBe(false);
    });

    it('多响应者队列中本地玩家是当前响应者时正确识别', () => {
        const result = computeViewModeState({
            currentPhase: 'offensiveRoll',
            pendingAttack: null,
            activePlayerId: '0',
            rootPlayerId: '0',
            manualViewMode: 'self',
            responseWindow: makeResponseWindow(['0', '1'], 1),
            isLocalPlayerResponder: true,
        });

        expect(result.isResponseAutoSwitch).toBe(true);
    });
});
