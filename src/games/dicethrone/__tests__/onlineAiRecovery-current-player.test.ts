import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import { resolveOnlineAiCurrentPlayerId } from '../../../engine/transport/onlineAiRecovery';
import diceThroneEngineConfig from '../game';

function buildDiceThroneRecoveryState(args: {
    activePlayerId?: string;
    phase?: string;
}): MatchState<unknown> {
    const activePlayerId = args.activePlayerId ?? '1';
    return {
        core: {
            activePlayerId,
            currentPlayerIndex: activePlayerId === '0' ? 0 : 1,
            turnOrder: ['0', '1'],
        },
        sys: {
            phase: args.phase ?? 'main2',
            turnNumber: 4,
            eventStream: { nextId: 1 },
            interaction: {
                current: undefined,
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: undefined,
            },
        },
    } as MatchState<unknown>;
}

describe('DiceThrone online AI recovery current player', () => {
    it('defensiveRoll 存在当前攻击防御者时，由防御者持有恢复操作者身份', () => {
        const state = buildDiceThroneRecoveryState({
            activePlayerId: '1',
            phase: 'defensiveRoll',
        }) as MatchState<{
            pendingAttack?: {
                attackerId?: string;
                defenderId?: string;
                isDefendable?: boolean;
            };
        }>;

        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            isDefendable: true,
        };

        expect(resolveOnlineAiCurrentPlayerId(state, {
            engineConfig: diceThroneEngineConfig,
            gameId: 'dicethrone',
        })).toBe('0');
    });

    it('defensiveRoll 已进入伤害响应时，由当前伤害响应者持有恢复操作者身份', () => {
        const state = buildDiceThroneRecoveryState({
            activePlayerId: '1',
            phase: 'defensiveRoll',
        }) as MatchState<{
            pendingAttack?: {
                attackerId?: string;
                defenderId?: string;
                settlementStage?: string;
                isDefendable?: boolean;
                defenseResolved?: boolean;
            };
            pendingDamage?: {
                id: string;
                sourcePlayerId: string;
                targetPlayerId: string;
                originalDamage: number;
                currentDamage: number;
                sourceAbilityId: string;
                damageScope: string;
                responseType: string;
                responderId: string;
                isFullyEvaded: boolean;
            };
        }>;

        state.core.pendingAttack = {
            attackerId: '1',
            defenderId: '0',
            settlementStage: 'afterDefense',
            isDefendable: true,
            defenseResolved: true,
        };
        state.core.pendingDamage = {
            id: 'damage-after-defense',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 5,
            currentDamage: 5,
            sourceAbilityId: 'holy-blade-3',
            damageScope: 'attack',
            responseType: 'beforeDamageDealt',
            responderId: '1',
            isFullyEvaded: false,
        };

        expect(resolveOnlineAiCurrentPlayerId(state, {
            engineConfig: diceThroneEngineConfig,
            gameId: 'dicethrone',
        })).toBe('1');
    });
});
