import { describe, expect, it } from 'vitest';
import { buildAiDecisionContext } from '../../../engine/ai';
import { diceThroneAiRuntime } from '../ai';
import type { DiceThroneCore, SelectableCharacterId } from '../domain/types';
import type { MatchState } from '../../../engine/types';
import { RESOURCE_IDS } from '../domain/resources';
import { createHeroMatchup, fixedRandom } from './test-utils';
import '../game';

const setBarbarianOffensiveRoll = (
    values: number[],
    kept: boolean[] = values.map(() => false),
    profileCharacterId: SelectableCharacterId = 'barbarian',
): MatchState<DiceThroneCore> => {
    const state = createHeroMatchup('barbarian', 'monk')(['0', '1'], fixedRandom);
    state.sys.phase = 'offensiveRoll';
    state.core.activePlayerId = '0';
    state.core.rollCount = 1;
    state.core.rollLimit = 3;
    state.core.rollDiceCount = 5;
    state.core.rollConfirmed = false;
    state.core.players['0'].characterId = profileCharacterId;
    state.core.selectedCharacters['0'] = profileCharacterId;
    state.core.players['0'].resources[RESOURCE_IDS.CP] = 2;
    state.core.players['0'].hand = [];
    state.core.dice = state.core.dice.map((die, index) => ({
        ...die,
        id: index,
        value: values[index] ?? die.value,
        symbol: (values[index] ?? die.value) <= 3
            ? 'sword'
            : (values[index] ?? die.value) <= 5
                ? 'heart'
                : 'strength',
        symbols: [((values[index] ?? die.value) <= 3
            ? 'sword'
            : (values[index] ?? die.value) <= 5
                ? 'heart'
                : 'strength')],
        isKept: kept[index] ?? false,
    }));
    return state;
};

const decide = async (state: MatchState<DiceThroneCore>) => {
    const context = buildAiDecisionContext({
        gameId: 'dicethrone',
        matchId: 'dicethrone-ai-roll-strategy',
        playerId: '0',
        visibleState: state,
        rulesVersion: null,
        decisionBudgetMs: 250,
        source: 'local',
        seatController: { type: 'local-ai', difficulty: 'expert' },
    });

    return diceThroneAiRuntime.localPolicies.baseline.decide(context);
};

describe('DiceThrone 本地 AI 掷骰策略', () => {
    it('已有三个 6 时应继续保护大招骰，不应把自己的 6 改掉', async () => {
        const state = setBarbarianOffensiveRoll([6, 6, 6, 1, 2]);

        const decision = await decide(state);

        expect(decision?.actionId).toMatch(/^toggle-die-lock:/);
        const dieId = Number(`${decision?.actionId ?? ''}`.split(':')[1]);
        expect([0, 1, 2]).toContain(dieId);
    });

    it('已有小顺子且还可重投时，应追大顺子而不是直接确认小顺子', async () => {
        const state = setBarbarianOffensiveRoll([1, 2, 3, 4, 6], [true, true, true, true, false]);

        const decision = await decide(state);

        expect(decision?.actionId).not.toBe('ability:powerful-strike');
        expect(decision?.actionId).not.toBe('roll:confirm');
        expect(['roll:dice', 'toggle-die-lock:4:lock']).toContain(decision?.actionId);
    });

    it('只有三剑普攻成型但还可追更高目标时，不应立刻选择普攻', async () => {
        const state = setBarbarianOffensiveRoll([1, 2, 3, 5, 6], [true, true, true, true, false]);

        const decision = await decide(state);

        expect(decision?.actionId).not.toBe('ability:slap-3');
        expect(decision?.actionId).not.toBe('roll:confirm');
        expect(['roll:dice', 'toggle-die-lock:4:lock']).toContain(decision?.actionId);
    });

    it('没有改骰牌且只剩最后一投时，不应为了远距离目标继续拆掉已成顺子', async () => {
        const state = setBarbarianOffensiveRoll([1, 2, 3, 4, 6], [true, true, true, true, false]);
        state.core.rollCount = 2;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 0;

        const decision = await decide(state);

        expect(decision?.actionId).toBe('roll:dice');
    });

    it('同一骰面下应让爆发型英雄更敢直接重投，稳健型英雄先补锁保底骰', async () => {
        const burstState = setBarbarianOffensiveRoll([1, 1, 1, 5, 6], [true, true, true, false, false], 'barbarian');
        const steadyState = setBarbarianOffensiveRoll([1, 1, 1, 5, 6], [true, true, true, false, false], 'paladin');
        burstState.core.players['0'].resources[RESOURCE_IDS.CP] = 0;
        steadyState.core.players['0'].resources[RESOURCE_IDS.CP] = 0;

        const burstDecision = await decide(burstState);
        const steadyDecision = await decide(steadyState);

        expect(burstDecision?.actionId).toBe('roll:dice');
        expect(steadyDecision?.actionId).toBe('toggle-die-lock:3:lock');
    });
});
