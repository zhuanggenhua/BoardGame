import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../../abilities';
import { triggerBaseAbility } from '../../domain/baseAbilities';
import type { BaseAbilityContext } from '../../domain/baseAbilities';
import { SU_EVENTS } from '../../domain/types';
import {
    getInteractionsFromResult,
    getPromptOptions,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    triggerBaseAbilityWithMS,
} from '../helpers';
import { defaultTestRandom } from '../testRunner';

beforeAll(() => {
    initAllAbilities();
});

function makeCtx(overrides: Partial<BaseAbilityContext>): BaseAbilityContext {
    const state = overrides.state ?? makeState();
    return {
        state,
        matchState: makeMatchState(state),
        baseIndex: 0,
        baseDefId: 'test_base',
        playerId: '0',
        now: 1000,
        ...overrides,
    };
}

describe('base_the_asylum: 疯人院 - 放入盒子并加指示物', () => {
    it('有手牌时生成手牌选择 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_the_asylum', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_the_asylum',
                    minions: [makeMinion('m1', 'test_minion', '0', 3)],
                })],
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'normal_action', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_the_asylum',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(result.events).toHaveLength(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_the_asylum');
        expect(getPromptTargetType(interactions[0])).toBe('hand');
        expect(getPromptOptions(interactions[0]).some((entry: any) => entry.value?.cardUid === 'h1')).toBe(true);
    });

    it('选择手牌后会进入选择随从的第二步，并产生 boxed 与加指示物事件', () => {
        const result = triggerBaseAbilityWithMS('base_the_asylum', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [
                    makeBase({
                        defId: 'base_the_asylum',
                        minions: [makeMinion('m1', 'test_minion', '0', 3)],
                    }),
                    makeBase({
                        defId: 'other_base',
                        minions: [makeMinion('m2', 'test_minion', '0', 4)],
                    }),
                ],
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'normal_action', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_the_asylum',
            baseIndex: 0,
            minionUid: 'm1',
        }));
        const step1 = respondToPromptOption(
            result.matchState!,
            (entry: any) => entry.value?.cardUid === 'h1',
            'Asylum hand option',
            '0',
            defaultTestRandom,
        );
        expect(step1.success).toBe(true);
        const secondInteraction = getSimpleChoicePrompt(step1.finalState, 'base_the_asylum_choose_minion');

        expect(secondInteraction).toBeDefined();
        expect(getPromptSourceId(secondInteraction)).toBe('base_the_asylum_choose_minion');
        expect(getPromptTargetType(secondInteraction)).toBe('minion');
        const step2 = respondToPromptOption(
            step1.finalState,
            (entry: any) => entry.value?.minionUid === 'm2',
            'Asylum minion option',
            '0',
            defaultTestRandom,
        );
        expect(step2.success).toBe(true);

        const boxedEvent = step2.events.find((event) => event.type === SU_EVENTS.CARD_BOXED) as any;
        expect(boxedEvent).toBeDefined();
        expect(boxedEvent.payload).toMatchObject({
            playerId: '0',
            cardUid: 'h1',
            defId: 'normal_action',
            from: 'hand',
        });
        const counterEvent = step2.events.find((event) => event.type === SU_EVENTS.POWER_COUNTER_ADDED) as any;
        expect(counterEvent).toBeDefined();
        expect(counterEvent.payload).toMatchObject({
            minionUid: 'm2',
            baseIndex: 1,
            amount: 1,
        });

        const finalCore = step2.finalState.core;
        expect(finalCore.players['0'].hand.some(card => card.uid === 'h1')).toBe(false);
        expect((finalCore.players['0'].removedFromGame ?? []).some(card => card.uid === 'h1')).toBe(true);
    });

    it('无手牌时不触发', () => {
        const { events } = triggerBaseAbility('base_the_asylum', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_the_asylum',
                    minions: [makeMinion('m1', 'test_minion', '0', 3)],
                })],
            }),
            baseDefId: 'base_the_asylum',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(events).toHaveLength(0);
    });
});
