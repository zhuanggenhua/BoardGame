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

    it('默认不从游戏私有字段推导当前决策者', () => {
        const state = {
            core: {
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                privateGameState: {
                    decisionOwnerId: '1',
                },
            },
            sys: {
                phase: 'testDecisionPhase',
            },
        } as MatchState<unknown>;

        expect(resolveCurrentDecisionPlayerId({
            state,
        })).toBe('0');

        expect(resolveSessionActorContext({
            state,
        })).toEqual({
            currentTurnPlayerId: '0',
            currentDecisionPlayerId: '0',
        });
    });

    it('调用方可通过通用解析器声明当前决策者，而不改写当前回合玩家', () => {
        const state = {
            core: {
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                decisionOwnerId: '1',
            },
            sys: {
                phase: 'testDecisionPhase',
            },
        } as MatchState<unknown>;

        const resolveDecisionOwner = ({ state: inputState }: {
            state: MatchState<unknown>;
            fallbackPlayerId: string | null;
        }) => {
            const ownerId = (inputState.core as { decisionOwnerId?: unknown } | undefined)?.decisionOwnerId;
            return typeof ownerId === 'string' ? ownerId : undefined;
        };

        expect(resolveCurrentDecisionPlayerId({
            state,
            resolveCurrentDecisionPlayerId: resolveDecisionOwner,
        })).toBe('1');

        expect(resolveSessionActorContext({
            state,
            resolveCurrentDecisionPlayerId: resolveDecisionOwner,
        })).toEqual({
            currentTurnPlayerId: '0',
            currentDecisionPlayerId: '1',
        });
    });
});
