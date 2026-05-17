import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../../abilities';
import type { BaseAbilityContext } from '../../domain/baseAbilities';
import { triggerBaseAbilityWithMS } from '../helpers';
import {
    getInteractionsFromResult,
    getPromptSourceId,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    withOnlyCurrentPrompt,
} from '../helpers';
import { defaultTestRandom } from '../testRunner';
import { SU_EVENTS } from '../../domain/types';

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

describe('Pretty Pretty bases', () => {
    it('base_cat_fanciers_alley: 有己方随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_cat_fanciers_alley', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [makeBase('base_cat_fanciers_alley', [makeMinion('m1', 'test_minion', '0', 2)])],
                players: {
                    '0': makePlayer('0', {
                        deck: [makeCard('draw1', 'test_draw', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_cat_fanciers_alley',
            baseIndex: 0,
            playerId: '0',
        }));

        expect(result.events).toHaveLength(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_cat_fanciers_alley');
    });

    it('base_cat_fanciers_alley: 无己方随从时不触发', () => {
        const { events } = triggerBaseAbilityWithMS('base_cat_fanciers_alley', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [makeBase('base_cat_fanciers_alley', [makeMinion('m1', 'test_minion', '1', 2)])],
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_cat_fanciers_alley',
            baseIndex: 0,
            playerId: '0',
        }));

        expect(events).toHaveLength(0);
    });

    it('base_cat_fanciers_alley: 若所选随从已离开基地则不再消灭也不抽牌', () => {
        const result = triggerBaseAbilityWithMS('base_cat_fanciers_alley', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [makeBase('base_cat_fanciers_alley', [makeMinion('m1', 'test_minion', '0', 2)])],
                players: {
                    '0': makePlayer('0', {
                        deck: [makeCard('draw1', 'test_draw', 'minion', '0')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_cat_fanciers_alley',
            baseIndex: 0,
            playerId: '0',
        }));
        const interaction = getInteractionsFromResult(result)[0];
        const staleCore = makeState({
            bases: [makeBase('base_cat_fanciers_alley')],
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw1', 'test_draw', 'minion', '0')],
                    discard: [makeCard('m1', 'd1', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const staleState = withOnlyCurrentPrompt(makeMatchState(staleCore), interaction);
        const resolved = respondToPromptOption(
            staleState,
            (entry: any) => entry.value?.minionUid === 'm1',
            'Cat Fancier stale option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);
    });

    it('base_enchanted_glade: 附着行动卡到此基地随从时抽 1 卡', () => {
        const { events } = triggerBaseAbilityWithMS('base_enchanted_glade', 'onActionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_enchanted_glade')],
                players: {
                    '0': makePlayer('0', { deck: [makeCard('dk1', 'test', 'minion')] }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_enchanted_glade',
            baseIndex: 0,
            playerId: '0',
            actionTargetMinionUid: 'm1',
        }));

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
    });

    it('base_enchanted_glade: 非附着行动卡（无目标随从）时不触发', () => {
        const { events } = triggerBaseAbilityWithMS('base_enchanted_glade', 'onActionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_enchanted_glade')],
                players: {
                    '0': makePlayer('0', { deck: [makeCard('dk1', 'test', 'minion')] }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_enchanted_glade',
            baseIndex: 0,
            playerId: '0',
        }));

        expect(events).toHaveLength(0);
    });

    it('base_enchanted_glade: 牌库为空时不抽牌', () => {
        const { events } = triggerBaseAbilityWithMS('base_enchanted_glade', 'onActionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_enchanted_glade')],
                players: {
                    '0': makePlayer('0', { deck: [] }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_enchanted_glade',
            baseIndex: 0,
            playerId: '0',
            actionTargetMinionUid: 'm1',
        }));

        expect(events).toHaveLength(0);
    });
});
