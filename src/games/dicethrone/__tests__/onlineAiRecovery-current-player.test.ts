import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import {
    resolveForceEndTurnForStalledAi,
    resolveOnlineAiCurrentPlayerId,
} from '../../../engine/transport/onlineAiRecovery';
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

function attachMainPhaseHumanBonusSettlement(state: MatchState<unknown>): void {
    const core = state.core as {
        pendingBonusDiceSettlement?: {
            id: string;
            sourceAbilityId: string;
            attackerId: string;
            targetId: string;
            dice: Array<{ index: number; value: number; face: string }>;
            rerollCostTokenId: string;
            rerollCostAmount: number;
            rerollCount: number;
            maxRerollCount: number;
            readyToSettle: boolean;
            displayOnly: boolean;
            continuation: { kind: 'complete' };
            allowDiceModification: boolean;
        };
        currentRollContext?: {
            id: string;
            kind: 'bonus';
            ownerPlayerId: string;
            targetPlayerId: string;
            sourceAbilityId: string;
            status: 'open';
            dice: Array<{ id: number; value: number; symbol: string; symbols: string[]; ownerId: string }>;
            policy: {
                modifiableBy: 'any';
                rerollableBy: 'any';
                allowPassiveReroll: true;
                allowDiceCardTargeting: true;
                ultimateLocked: false;
                blocksPhaseFlow: true;
            };
            display: { surface: 'diceTray'; replayOnly: false };
        };
    };
    core.pendingBonusDiceSettlement = {
        id: 'card-cursed-pirate-sip-display-test',
        sourceAbilityId: 'card-cursed-pirate-sip',
        attackerId: '0',
        targetId: '0',
        dice: [{ index: 0, value: 1, face: 'fire' }],
        rerollCostTokenId: '',
        rerollCostAmount: 0,
        rerollCount: 0,
        maxRerollCount: 0,
        readyToSettle: false,
        displayOnly: true,
        continuation: { kind: 'complete' },
        allowDiceModification: true,
    };
    core.currentRollContext = {
        id: 'bonus:card-cursed-pirate-sip-display-test',
        kind: 'bonus',
        ownerPlayerId: '0',
        targetPlayerId: '0',
        sourceAbilityId: 'card-cursed-pirate-sip',
        status: 'open',
        dice: [{ id: 0, value: 1, symbol: 'fire', symbols: ['fire'], ownerId: '0' }],
        policy: {
            modifiableBy: 'any',
            rerollableBy: 'any',
            allowPassiveReroll: true,
            allowDiceCardTargeting: true,
            ultimateLocked: false,
            blocksPhaseFlow: true,
        },
        display: { surface: 'diceTray', replayOnly: false },
    };
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

    it('main1 存在未收口奖励骰时，由奖励骰主人持有恢复操作者身份', () => {
        const state = buildDiceThroneRecoveryState({
            activePlayerId: '1',
            phase: 'main1',
        });
        attachMainPhaseHumanBonusSettlement(state);

        expect(resolveOnlineAiCurrentPlayerId(state, {
            engineConfig: diceThroneEngineConfig,
            gameId: 'dicethrone',
        })).toBe('0');
    });

    it('main1 真人奖励骰未收口时，watchdog 不应替 AI 座位裸推进阶段', () => {
        const state = buildDiceThroneRecoveryState({
            activePlayerId: '1',
            phase: 'main1',
        });
        attachMainPhaseHumanBonusSettlement(state);

        expect(resolveForceEndTurnForStalledAi({
            sharedState: state,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', policyId: 'baseline' },
            },
            seatStates: {
                '0': state,
                '1': state,
            },
            engineConfig: diceThroneEngineConfig,
            gameId: 'dicethrone',
        })).toBeNull();
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
