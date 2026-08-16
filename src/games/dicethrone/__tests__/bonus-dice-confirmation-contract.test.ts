import { describe, expect, it } from 'vitest';
import { executePipeline } from '../../../engine/pipeline';
import type { MatchState } from '../../../engine/types';
import { DiceThroneDomain } from '../domain';
import { createDiceThroneEventSystem } from '../domain/systems';
import { reduce } from '../domain/reducer';
import type { DiceThroneCore, DiceThroneEvent, PendingBonusDiceSettlement } from '../domain/types';
import { createHeroMatchup, createQueuedRandom, testSystems } from './test-utils';
import { COMMON_CARDS } from '../domain/commonCards';

const bonusSettlement = (): PendingBonusDiceSettlement => ({
    id: 'ordinary-confirm-required',
    sourceAbilityId: 'ordinary-confirm-required',
    attackerId: '0',
    targetId: '1',
    dice: [{ index: 0, value: 4, face: 'sabre', effectParams: { value: 4 } }],
    rerollCostTokenId: 'tactical_advantage',
    rerollCostAmount: 1,
    rerollCount: 0,
    maxRerollCount: 1,
    readyToSettle: false,
    allowDiceModification: true,
});

const runBonusDiceSystem = (
    state: MatchState<DiceThroneCore>,
    events: DiceThroneEvent[],
) => {
    const system = createDiceThroneEventSystem();
    return system.afterEvents?.({
        state,
        events,
        random: createQueuedRandom([6]),
    } as any) as { state?: MatchState<DiceThroneCore>; events?: DiceThroneEvent[] } | undefined;
};

const openBonusDiceState = (
    settlement: PendingBonusDiceSettlement,
    mutate?: (core: DiceThroneCore) => void,
): MatchState<DiceThroneCore> => {
    const state = createHeroMatchup('monk', 'treant')(['0', '1'], createQueuedRandom([1]));
    mutate?.(state.core);
    const requested = {
        type: 'BONUS_DICE_REROLL_REQUESTED',
        payload: { settlement },
        sourceCommandType: 'TEST_BONUS_DICE',
        timestamp: 100,
    } as DiceThroneEvent;
    const coreWithBonus = reduce(state.core, requested);
    const result = runBonusDiceSystem({ ...state, core: coreWithBonus }, [requested]);
    if (!result?.state) {
        throw new Error('奖励骰交互未成功打开');
    }
    return result.state;
};

describe('DiceThrone 奖励骰普通确认合同', () => {
    it('即使对手有改骰牌，奖励骰也不再打开响应窗口，而是直接停在右侧骰盘等待普通确认', () => {
        const settlement = bonusSettlement();
        const nextState = openBonusDiceState(settlement, (core) => {
            const giveHand = COMMON_CARDS.find((card) => card.id === 'card-give-hand');
            if (!giveHand) throw new Error('测试缺少“弹一手”通用牌定义');
            core.players['1'].hand = [giveHand];
            core.players['1'].resources.CP = 3;
        });

        expect(nextState.sys.responseWindow?.current).toBeUndefined();
        expect(nextState.sys.interaction.current).toMatchObject({
            kind: 'dt:bonus-dice',
            playerId: '0',
        });
    });

    it('无可用内置重投且没有响应时，奖励骰仍停在右侧骰盘等待普通确认', () => {
        const settlement = bonusSettlement();
        const nextState = openBonusDiceState(settlement, (core) => {
            core.players['0'].tokens.tactical_advantage = 0;
        });

        expect(nextState.core.pendingBonusDiceSettlement).toMatchObject({
            id: settlement.id,
            dice: [{ value: 4 }],
        });
        expect(nextState.sys.interaction.current).toMatchObject({
            kind: 'dt:bonus-dice',
            playerId: '0',
        });
    });

    it('达到奖励骰重投上限后仍等待骰主点击右侧骰盘普通确认', () => {
        const settlement = {
            ...bonusSettlement(),
            rerollCostTokenId: '',
            rerollCostAmount: 0,
            rerollCount: 0,
            maxRerollCount: 1,
        };
        const opened = openBonusDiceState(settlement);

        const rerolled = executePipeline(
            { domain: DiceThroneDomain, systems: testSystems },
            opened,
            {
                type: 'REROLL_BONUS_DIE',
                playerId: '0',
                payload: { dieIndex: 0 },
                timestamp: 101,
            } as any,
            createQueuedRandom([6]),
            ['0', '1'],
        );

        expect(rerolled.success).toBe(true);
        expect(rerolled.events).toContainEqual(expect.objectContaining({
            type: 'BONUS_DIE_REROLLED',
        }));
        expect(rerolled.events).not.toContainEqual(expect.objectContaining({
            type: 'BONUS_DICE_SETTLED',
        }));
        expect(rerolled.state.core.pendingBonusDiceSettlement).toMatchObject({
            id: settlement.id,
            rerollCount: 1,
            maxRerollCount: 1,
            dice: [{ value: 6 }],
        });
        expect(rerolled.state.sys.interaction.current).toMatchObject({
            kind: 'dt:bonus-dice',
            playerId: '0',
        });
    });
});
