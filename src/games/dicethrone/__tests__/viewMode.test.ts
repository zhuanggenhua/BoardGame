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
