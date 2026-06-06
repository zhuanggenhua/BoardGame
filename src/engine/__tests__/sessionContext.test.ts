import { describe, expect, it } from 'vitest';
import type { MatchState } from '../types';
import {
    resolveCurrentDecisionPlayerId,
    resolveCurrentTurnPlayerId,
    resolveSessionActorContext,
} from '../sessionContext';

describe('sessionContext', () => {
    it('应优先解析当前回合玩家，而不是要求各调用方自己猜字段', () => {
        expect(resolveCurrentTurnPlayerId({
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 2,
        })).toBe('2');

        expect(resolveCurrentTurnPlayerId({
            currentPlayerId: '1',
        })).toBe('1');
    });

    it('防御阶段应允许把当前决策者解析为 defender，而不覆盖当前回合玩家', () => {
        const state = {
            core: {
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                },
            },
            sys: {
                phase: 'defensiveRoll',
            },
        } as MatchState<unknown>;

        expect(resolveCurrentDecisionPlayerId({
            state,
            preferPendingAttackDefenderAsDecisionOwner: true,
        })).toBe('1');

        expect(resolveSessionActorContext({
            state,
            preferPendingAttackDefenderAsDecisionOwner: true,
        })).toEqual({
            currentTurnPlayerId: '0',
            currentDecisionPlayerId: '1',
        });
    });
});
