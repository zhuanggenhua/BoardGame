import { describe, expect, it } from 'vitest';
import { buildAiDecisionContext } from '../../../engine/ai';
import { diceThroneAiRuntime } from '../ai';
import { evaluateDiceThroneBoardState } from '../ai/evaluation';
import { BARBARIAN_DICE_FACE_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import type { DiceThroneCore } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { createHeroMatchup, fixedRandom, getCardById } from './test-utils';
import '../game';

const barbarianFaceForValue = (value: number): string => {
    if (value <= 3) return BARBARIAN_DICE_FACE_IDS.SWORD;
    if (value <= 5) return BARBARIAN_DICE_FACE_IDS.HEART;
    return BARBARIAN_DICE_FACE_IDS.STRENGTH;
};

const createAfterRollConfirmedResponseState = (
    values: number[],
    responderCardId: string,
): MatchState<DiceThroneCore> => {
    const state = createHeroMatchup('barbarian', 'paladin')(['0', '1'], fixedRandom);
    state.sys.phase = 'offensiveRoll';
    state.core.activePlayerId = '0';
    state.core.rollCount = 1;
    state.core.rollLimit = 3;
    state.core.rollDiceCount = 5;
    state.core.rollConfirmed = true;
    state.core.players['1'].resources[RESOURCE_IDS.CP] = 10;
    state.core.players['1'].hand = [getCardById(responderCardId)];
    state.core.players['0'].hand = [];
    state.core.dice = state.core.dice.slice(0, 5).map((die, index) => {
        const value = values[index] ?? die.value;
        const symbol = barbarianFaceForValue(value);
        return {
            ...die,
            id: index,
            value,
            symbol,
            symbols: [symbol],
            isKept: true,
        };
    });
    state.sys.responseWindow = {
        current: {
            id: `rw-ai-response-gate-${values.join('-')}`,
            windowType: 'afterRollConfirmed',
            responderQueue: ['1'],
            currentResponderIndex: 0,
            passedPlayers: [],
        },
    };
    return state;
};

const decideForResponder = async (state: MatchState<DiceThroneCore>) => {
    const context = buildAiDecisionContext({
        gameId: 'dicethrone',
        matchId: 'dicethrone-ai-response-value-gate',
        playerId: '1',
        visibleState: state,
        rulesVersion: null,
        decisionBudgetMs: 250,
        source: 'local',
        seatController: { type: 'local-ai', difficulty: 'expert' },
    });

    return diceThroneAiRuntime.localPolicies.baseline.decide(context);
};

describe('DiceThrone AI 响应收益门槛', () => {
    it('真人只投出普攻/低价值攻击时，不应稳定花改骰牌', async () => {
        const state = createAfterRollConfirmedResponseState([1, 1, 1, 4, 5], 'card-surprise');

        const decision = await decideForResponder(state);

        expect(decision?.actionId).toBe('response:pass');
    });

    it('真人投出大招时，应优先考虑有效改骰响应', async () => {
        const state = createAfterRollConfirmedResponseState([6, 6, 6, 6, 6], 'card-surprise');

        const decision = await decideForResponder(state);

        expect(decision?.actionId).toBe('response:play-card:card-surprise');
    });

    it('统一局面价值应显著反映致命伤害压力', () => {
        const safeState = createAfterRollConfirmedResponseState([1, 2, 3, 4, 5], 'card-surprise');
        const pressuredState = createAfterRollConfirmedResponseState([1, 2, 3, 4, 5], 'card-surprise');
        pressuredState.core.players['1'].resources[RESOURCE_IDS.HP] = 4;
        pressuredState.core.pendingDamage = {
            id: 'ai-evaluation-lethal-damage',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 5,
            currentDamage: 5,
            responseType: 'beforeDamageReceived',
            responderId: '1',
            isFullyEvaded: false,
        };

        const safe = evaluateDiceThroneBoardState(safeState, '1');
        const pressured = evaluateDiceThroneBoardState(pressuredState, '1');

        expect(pressured.breakdown.lifeSafety).toBeLessThan(safe.breakdown.lifeSafety);
        expect(pressured.total).toBeLessThan(safe.total);
    });
});
