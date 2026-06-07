import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../../abilities';
import type { BaseAbilityContext } from '../../domain/baseAbilities';
import { MADNESS_CARD_DEF_ID, SU_EVENTS } from '../../domain/types';
import {
    getInteractionsFromResult,
    getPromptOptions,
    getPromptPlayerId,
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

describe('base_miskatonic_university_base: 密大基地 - 首次打出随从后效果', () => {
    it('第一次打出随从到这里时生成分支选择 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_miskatonic_university_base', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_miskatonic_university_base',
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
            baseDefId: 'base_miskatonic_university_base',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(result.events).toHaveLength(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_miskatonic_university_base');
        expect(getPromptTargetType(interactions[0])).toBe('button');
        expect(getPromptPlayerId(interactions[0])).toBe('0');
        expect(getPromptOptions(interactions[0]).some((entry: any) => entry.value?.choice === 'draw')).toBe(true);
        expect(getPromptOptions(interactions[0]).some((entry: any) => entry.value?.choice === 'discard_for_action')).toBe(true);
    });

    it('不是本回合第一次打出到这里时不触发', () => {
        const result = triggerBaseAbilityWithMS('base_miskatonic_university_base', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_miskatonic_university_base',
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
            baseDefId: 'base_miskatonic_university_base',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(result.events).toHaveLength(0);
        expect(getInteractionsFromResult(result)).toHaveLength(0);
    });

    it('选择抓疯狂时产生 MADNESS_DRAWN 事件', () => {
        const result = triggerBaseAbilityWithMS('base_miskatonic_university_base', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_miskatonic_university_base',
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
            baseDefId: 'base_miskatonic_university_base',
            baseIndex: 0,
            minionUid: 'm1',
        }));
        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.choice === 'draw',
            'Miskatonic University draw madness option',
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
        const result = triggerBaseAbilityWithMS('base_miskatonic_university_base', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_miskatonic_university_base',
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
            baseDefId: 'base_miskatonic_university_base',
            baseIndex: 0,
            minionUid: 'm1',
        }));
        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.choice === 'discard_for_action',
            'Miskatonic University discard-for-action option',
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
