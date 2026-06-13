import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../../abilities';
import type { BaseAbilityContext } from '../../domain/baseAbilities';
import { MADNESS_CARD_DEF_ID, SU_EVENTS } from '../../domain/types';
import {
    getInteractionsFromResult,
    getPromptOptions,
    getPromptPlayerId,
    invokeRegisteredInteractionHandlerContract,
    getPromptSourceId,
    getPromptTargetType,
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

describe('base_miskatonic_university_base: 米斯卡塔尼克大学（经典版）', () => {
    it('计分后冠军手牌/弃牌堆中有疯狂卡时生成返回 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_miskatonic_university_base', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase({ defId: 'base_miskatonic_university_base' })],
                madnessDeck: Array(30).fill(MADNESS_CARD_DEF_ID),
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('hand-mad-1', MADNESS_CARD_DEF_ID, 'action', '0')],
                        discard: [makeCard('discard-mad-1', MADNESS_CARD_DEF_ID, 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_miskatonic_university_base',
            rankings: [{ playerId: '0', power: 10, rank: 1 }],
        }));

        expect(result.events).toHaveLength(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_miskatonic_university_base');
        expect(getPromptTargetType(interactions[0])).toBe('button');
        expect(getPromptPlayerId(interactions[0])).toBe('0');
        expect(getPromptOptions(interactions[0]).some((entry: any) => entry.value?.source === 'hand')).toBe(true);
        expect(getPromptOptions(interactions[0]).some((entry: any) => entry.value?.source === 'discard')).toBe(true);
    });

    it('冠军没有疯狂卡时不触发', () => {
        const result = triggerBaseAbilityWithMS('base_miskatonic_university_base', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase({ defId: 'base_miskatonic_university_base' })],
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_miskatonic_university_base',
            rankings: [{ playerId: '0', power: 10, rank: 1 }],
        }));

        expect(result.events).toHaveLength(0);
        expect(getInteractionsFromResult(result)).toHaveLength(0);
    });

    it('可连续把手牌和弃牌堆中的疯狂卡全部返回疯狂牌库', () => {
        const result = triggerBaseAbilityWithMS('base_miskatonic_university_base', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase({ defId: 'base_miskatonic_university_base' })],
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('hand-mad-1', MADNESS_CARD_DEF_ID, 'action', '0')],
                        discard: [makeCard('discard-mad-1', MADNESS_CARD_DEF_ID, 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_miskatonic_university_base',
            rankings: [{ playerId: '0', power: 10, rank: 1 }],
        }));

        const first = invokeRegisteredInteractionHandlerContract(
            'base_miskatonic_university_base',
            result.matchState!,
            '0',
            { source: 'hand' },
            undefined,
            1001,
            defaultTestRandom,
        );
        const firstReturnEvents = first.events.filter(event => event.type === SU_EVENTS.MADNESS_RETURNED);
        expect(firstReturnEvents).toHaveLength(1);
        expect((firstReturnEvents[0] as any)?.payload?.cardUid).toBe('hand-mad-1');

        const second = invokeRegisteredInteractionHandlerContract(
            'base_miskatonic_university_base',
            first.state,
            '0',
            { source: 'discard' },
            undefined,
            1002,
            defaultTestRandom,
        );
        const secondReturnEvents = second.events.filter(event => event.type === SU_EVENTS.MADNESS_RETURNED);
        expect(secondReturnEvents).toHaveLength(1);
        expect((secondReturnEvents[0] as any)?.payload?.cardUid).toBe('discard-mad-1');
    });
});

describe('base_miskatonic_university_base_pod: 米斯卡塔尼克大学（POD 版）', () => {
    it('第一次打出随从到这里时生成分支选择 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_miskatonic_university_base_pod', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_miskatonic_university_base_pod',
                    minions: [makeMinion('m1', 'test_minion', '0', 3)],
                })],
                madnessDeck: Array(10).fill(MADNESS_CARD_DEF_ID),
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', MADNESS_CARD_DEF_ID, 'action', '0')],
                        minionsPlayedPerBase: { 0: 1 },
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_miskatonic_university_base_pod',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(result.events).toHaveLength(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_miskatonic_university_base_pod');
        expect(getPromptTargetType(interactions[0])).toBe('button');
        expect(getPromptPlayerId(interactions[0])).toBe('0');
        expect(getPromptOptions(interactions[0]).some((entry: any) => entry.value?.choice === 'draw')).toBe(true);
        expect(getPromptOptions(interactions[0]).some((entry: any) => entry.value?.choice === 'discard_for_action')).toBe(true);
    });

    it('不是本回合第一次打出到这里时不触发', () => {
        const result = triggerBaseAbilityWithMS('base_miskatonic_university_base_pod', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_miskatonic_university_base_pod',
                    minions: [makeMinion('m1', 'test_minion', '0', 3)],
                })],
                madnessDeck: Array(10).fill(MADNESS_CARD_DEF_ID),
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', MADNESS_CARD_DEF_ID, 'action', '0')],
                        minionsPlayedPerBase: { 0: 2 },
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_miskatonic_university_base_pod',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(result.events).toHaveLength(0);
        expect(getInteractionsFromResult(result)).toHaveLength(0);
    });

    it('选择抓疯狂时产生 MADNESS_DRAWN 事件', () => {
        const result = triggerBaseAbilityWithMS('base_miskatonic_university_base_pod', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_miskatonic_university_base_pod',
                    minions: [makeMinion('m1', 'test_minion', '0', 3)],
                })],
                madnessDeck: Array(10).fill(MADNESS_CARD_DEF_ID),
                players: {
                    '0': makePlayer('0', {
                        minionsPlayedPerBase: { 0: 1 },
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_miskatonic_university_base_pod',
            baseIndex: 0,
            minionUid: 'm1',
        }));
        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.choice === 'draw',
            'Miskatonic University POD draw madness option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);

        const drawEvent = resolved.events.find((event) => event.type === SU_EVENTS.MADNESS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload).toMatchObject({
            playerId: '0',
            count: 2,
        });
    });

    it('选择弃疯狂换行动时产生弃牌和额外行动事件', () => {
        const result = triggerBaseAbilityWithMS('base_miskatonic_university_base_pod', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_miskatonic_university_base_pod',
                    minions: [makeMinion('m1', 'test_minion', '0', 3)],
                })],
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                        minionsPlayedPerBase: { 0: 1 },
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_miskatonic_university_base_pod',
            baseIndex: 0,
            minionUid: 'm1',
        }));
        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.choice === 'discard_for_action',
            'Miskatonic University POD discard-for-action option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);

        const discardEvent = resolved.events.find((event) => event.type === SU_EVENTS.CARDS_DISCARDED) as any;
        expect(discardEvent).toBeDefined();
        expect(discardEvent.payload).toMatchObject({
            playerId: '0',
            cardUids: ['mad1'],
        });
        const limitEvent = resolved.events.find((event) => event.type === SU_EVENTS.LIMIT_MODIFIED) as any;
        expect(limitEvent).toBeDefined();
        expect(limitEvent.payload).toMatchObject({
            playerId: '0',
            limitType: 'action',
            delta: 1,
        });
    });
});
