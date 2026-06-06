import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities } from '../../abilities';
import { triggerExtendedBaseAbility } from '../../domain/baseAbilities';
import type { BaseAbilityContext } from '../../domain/baseAbilities';
import {
    getInteractionsFromResult,
    getPromptOption,
    getPromptOptions,
    getPromptPlayerId,
    getPromptSourceId,
    getPromptTitle,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    triggerBaseAbilityWithMS,
    withOnlyCurrentPrompt,
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

describe('Move Minion bases', () => {
    it('base_land_of_balance: 其他基地有己方随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_land_of_balance', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_land_of_balance'),
                    makeBase({
                        defId: 'other_base',
                        minions: [makeMinion('m_other', 'test_minion', '0', 4)],
                    }),
                ],
            }),
            baseDefId: 'base_land_of_balance',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(result.events).toHaveLength(0);
        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_land_of_balance');
        expect(getPromptOptions(interactions[0]).length).toBe(2);
    });

    it('base_land_of_balance: 其他基地无己方随从时不触发', () => {
        const { events } = triggerBaseAbilityWithMS('base_land_of_balance', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_land_of_balance'),
                    makeBase({
                        defId: 'other_base',
                        minions: [makeMinion('m_other', 'test_minion', '1', 4)],
                    }),
                ],
            }),
            baseDefId: 'base_land_of_balance',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(events).toHaveLength(0);
    });

    it('base_land_of_balance: 只有平衡之地一个基地时不触发', () => {
        const { events } = triggerBaseAbilityWithMS('base_land_of_balance', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_land_of_balance')],
            }),
            baseDefId: 'base_land_of_balance',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(events).toHaveLength(0);
    });

    it('base_land_of_balance: 若所选随从已离开原基地则不再移动', () => {
        const result = triggerBaseAbilityWithMS('base_land_of_balance', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_land_of_balance'),
                    makeBase({
                        defId: 'other_base',
                        minions: [makeMinion('m1', 'test_minion', '0', 3)],
                    }),
                ],
            }),
            baseDefId: 'base_land_of_balance',
            baseIndex: 0,
            minionUid: 'm1',
        }));
        const interaction = getInteractionsFromResult(result)[0];
        const option = getPromptOption(interaction, (entry: any) => entry.value?.minionUid === 'm1');
        expect(getPromptSourceId(interaction)).toBe('base_land_of_balance');
        expect(option).toBeDefined();

        const staleCore = makeState({
            bases: [makeBase('base_land_of_balance')],
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('m1', 'd1', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const staleState = withOnlyCurrentPrompt(makeMatchState(staleCore), interaction);
        const resolved = respondToPromptOption(
            staleState,
            (entry: any) => entry.value?.minionUid === 'm1',
            'Land of Balance stale option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === 'su:minion_moved')).toBe(false);
    });

    it('base_sheep_shrine: 若所选随从已离开原基地则不再移动', () => {
        const result = triggerExtendedBaseAbility('base_sheep_shrine', 'onBaseRevealed', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_sheep_shrine'),
                    makeBase({
                        defId: 'other_base',
                        minions: [makeMinion('m1', 'test_minion', '0', 3)],
                    }),
                ],
            }),
            baseDefId: 'base_sheep_shrine',
            baseIndex: 0,
            playerId: '0',
        }));
        const interaction = getInteractionsFromResult(result)[0];
        const option = getPromptOption(interaction, (entry: any) => !entry.value?.skip && entry.value?.minionUid === 'm1');
        expect(getPromptSourceId(interaction)).toBe('base_sheep_shrine');
        expect(option).toBeDefined();

        const staleCore = makeState({
            bases: [
                makeBase('base_sheep_shrine'),
                makeBase({
                    defId: 'other_base',
                    minions: [],
                }),
            ],
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('m1', 'd1', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const staleState = withOnlyCurrentPrompt(makeMatchState(staleCore), interaction);
        const resolved = respondToPromptOption(
            staleState,
            (entry: any) => !entry.value?.skip && entry.value?.minionUid === 'm1',
            'Sheep Shrine stale option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === 'su:minion_moved')).toBe(false);
    });

    it('base_the_pasture: 若所选随从已离开原基地则不再移动', () => {
        const result = triggerExtendedBaseAbility('base_the_pasture', 'onMinionMoved', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_the_pasture'),
                    makeBase({
                        defId: 'other_base',
                        minions: [makeMinion('m1', 'test_minion', '1', 4)],
                    }),
                ],
                minionsMovedToBaseThisTurn: {
                    '0': {
                        0: 0,
                    },
                },
            }),
            baseDefId: 'base_the_pasture',
            baseIndex: 0,
            playerId: '0',
            minionUid: 'just-moved',
        }));
        const interaction = getInteractionsFromResult(result)[0];
        const option = getPromptOption(interaction, (entry: any) => entry.value?.minionUid === 'm1');
        expect(getPromptSourceId(interaction)).toBe('base_the_pasture');
        expect(option).toBeDefined();

        const staleCore = makeState({
                bases: [
                    makeBase('base_the_pasture'),
                    makeBase({
                        defId: 'other_base',
                        minions: [],
                    }),
            ],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    discard: [makeCard('m1', 'd1', 'minion', '1')],
                }),
            },
        });

        const staleState = withOnlyCurrentPrompt(makeMatchState(staleCore), interaction);
        const resolved = respondToPromptOption(
            staleState,
            (entry: any) => entry.value?.minionUid === 'm1',
            'The Pasture stale option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === 'su:minion_moved')).toBe(false);
    });

    it('base_pirate_cove: 非冠军有随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_pirate_cove', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_pirate_cove',
                    minions: [
                        makeMinion('m1', 'test_minion', '0', 5),
                        makeMinion('m2', 'test_minion', '1', 3),
                    ],
                })],
            }),
            baseDefId: 'base_pirate_cove',
            rankings: [
                { playerId: '0', power: 5, vp: 4 },
                { playerId: '1', power: 3, vp: 2 },
            ],
        }));

        const interactions = getInteractionsFromResult(result);
        expect(result.events).toHaveLength(0);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_pirate_cove');
        expect(getPromptPlayerId(interactions[0])).toBe('1');
        expect(getPromptOptions(interactions[0]).length).toBe(2);
    });

    it('base_pirate_cove: 冠军不生成 Prompt', () => {
        const { events } = triggerBaseAbilityWithMS('base_pirate_cove', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_pirate_cove',
                    minions: [makeMinion('m1', 'test_minion', '0', 5)],
                })],
            }),
            baseDefId: 'base_pirate_cove',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));

        expect(events).toHaveLength(0);
    });

    it('base_pirate_cove: 非冠军无随从时不生成 Prompt', () => {
        const { events } = triggerBaseAbilityWithMS('base_pirate_cove', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_pirate_cove',
                    minions: [makeMinion('m1', 'test_minion', '0', 5)],
                })],
            }),
            baseDefId: 'base_pirate_cove',
            rankings: [
                { playerId: '0', power: 5, vp: 4 },
                { playerId: '1', power: 0, vp: 2 },
            ],
        }));

        expect(events).toHaveLength(0);
    });

    it('base_pirate_cove: 第二步若目标已离开来源基地则不再移动', () => {
        const result = triggerBaseAbilityWithMS('base_pirate_cove', 'afterScoring', makeCtx({
            state: makeState({
                bases: [
                    makeBase({
                        defId: 'base_pirate_cove',
                        minions: [
                            makeMinion('m1', 'test_minion', '0', 5),
                            makeMinion('m2', 'test_minion', '1', 3),
                        ],
                    }),
                    makeBase('base_other_1'),
                    makeBase('base_other_2'),
                ],
            }),
            baseDefId: 'base_pirate_cove',
            baseIndex: 0,
            rankings: [
                { playerId: '0', power: 5, vp: 4 },
                { playerId: '1', power: 3, vp: 2 },
            ],
        }));
        const prompt = getInteractionsFromResult(result)[0];
        expect(getPromptSourceId(prompt)).toBe('base_pirate_cove');

        const step1 = respondToPromptOption(
            result.matchState!,
            (entry: any) => entry.value?.minionUid === 'm2',
            'Pirate Cove choose minion m2',
            '1',
            defaultTestRandom,
        );
        const chooseBasePrompt = getSimpleChoicePrompt(step1.finalState, 'base_pirate_cove_choose_base');

        const staleCore = makeState({
            bases: [
                makeBase({
                    defId: 'base_pirate_cove',
                    minions: [makeMinion('m1', 'test_minion', '0', 5)],
                }),
                makeBase('base_other_1'),
                makeBase('base_other_2'),
            ],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    discard: [makeCard('m2', 'd1', 'minion', '1')],
                }),
            },
        });

        const resolved = respondToPromptOption(
            withOnlyCurrentPrompt(makeMatchState(staleCore), chooseBasePrompt),
            (entry: any) => entry.value?.baseIndex === 1,
            'Pirate Cove choose base 1',
            '1',
            defaultTestRandom,
        );
        expect(resolved.events.some(event => event.type === 'su:minion_moved')).toBe(false);
    });

    it('base_tortuga: 亚军有随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', makeCtx({
            state: makeState({
                bases: [
                    makeBase({
                        defId: 'base_tortuga',
                        minions: [
                            makeMinion('m1', 'test_minion', '0', 5),
                            makeMinion('m2', 'test_minion', '1', 3),
                        ],
                    }),
                    makeBase({
                        defId: 'base_other',
                        minions: [makeMinion('m3', 'test_minion', '1', 2)],
                    }),
                ],
            }),
            baseDefId: 'base_tortuga',
            baseIndex: 0,
            rankings: [
                { playerId: '0', power: 5, vp: 4 },
                { playerId: '1', power: 3, vp: 2 },
            ],
        }));

        const interactions = getInteractionsFromResult(result);
        expect(result.events).toHaveLength(0);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_tortuga');
        expect(getPromptTitle(interactions[0])).toBe('托尔图加：选择移动一个其他基地上的随从到替换基地');
        expect(getPromptPlayerId(interactions[0])).toBe('1');
    });

    it('base_tortuga: 排名不足 2 人时不触发', () => {
        const { events } = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_tortuga')],
            }),
            baseDefId: 'base_tortuga',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));

        expect(events).toHaveLength(0);
    });

    it('base_tortuga: 亚军在此无随从时不触发', () => {
        const { events } = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase({
                    defId: 'base_tortuga',
                    minions: [makeMinion('m1', 'test_minion', '0', 5)],
                })],
            }),
            baseDefId: 'base_tortuga',
            rankings: [
                { playerId: '0', power: 5, vp: 4 },
                { playerId: '1', power: 0, vp: 2 },
            ],
        }));

        expect(events).toHaveLength(0);
    });

    it('base_tortuga: 若所选随从已离开原基地则不再移动', () => {
        const result = triggerBaseAbilityWithMS('base_tortuga', 'afterScoring', makeCtx({
            state: makeState({
                bases: [
                    makeBase({
                        defId: 'base_tortuga',
                        minions: [
                            makeMinion('m1', 'test_minion', '0', 5),
                            makeMinion('m2', 'test_minion', '1', 3),
                        ],
                    }),
                    makeBase({
                        defId: 'base_other',
                        minions: [makeMinion('m3', 'test_minion', '1', 2)],
                    }),
                ],
            }),
            baseDefId: 'base_tortuga',
            baseIndex: 0,
            rankings: [
                { playerId: '0', power: 5, vp: 4 },
                { playerId: '1', power: 3, vp: 2 },
            ],
        }));
        const prompt = getInteractionsFromResult(result)[0];
        expect(getPromptSourceId(prompt)).toBe('base_tortuga');

        const staleCore = makeState({
            bases: [
                makeBase({
                    defId: 'base_tortuga',
                    minions: [
                        makeMinion('m1', 'test_minion', '0', 5),
                        makeMinion('m2', 'test_minion', '1', 3),
                    ],
                }),
                makeBase({
                    defId: 'base_other',
                    minions: [],
                }),
            ],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    discard: [makeCard('m3', 'd1', 'minion', '1')],
                }),
            },
        });

        const resolved = respondToPromptOption(
            withOnlyCurrentPrompt(makeMatchState(staleCore), prompt),
            (entry: any) => entry.value?.minionUid === 'm3',
            'Tortuga choose minion m3',
            '1',
            defaultTestRandom,
        );
        expect(resolved.events.some(event => event.type === 'su:minion_moved')).toBe(false);
    });

    it('base_mushroom_kingdom: 其他基地有对手随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_mushroom_kingdom', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_mushroom_kingdom'),
                    makeBase({
                        defId: 'other_base',
                        minions: [makeMinion('m1', 'test_minion', '1', 3)],
                    }),
                ],
            }),
            baseIndex: 0,
            baseDefId: 'base_mushroom_kingdom',
        }));

        const interactions = getInteractionsFromResult(result);
        expect(result.events).toHaveLength(0);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_mushroom_kingdom');
        expect(getPromptPlayerId(interactions[0])).toBe('0');
        expect(getPromptOptions(interactions[0]).length).toBe(2);
    });

    it('base_mushroom_kingdom: 只有己方随从时不生成 Prompt', () => {
        const { events } = triggerBaseAbilityWithMS('base_mushroom_kingdom', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_mushroom_kingdom'),
                    makeBase({
                        defId: 'other_base',
                        minions: [makeMinion('m1', 'test_minion', '0', 3)],
                    }),
                ],
            }),
            baseIndex: 0,
            baseDefId: 'base_mushroom_kingdom',
        }));

        expect(events).toHaveLength(0);
    });

    it('base_mushroom_kingdom: 本基地的对手随从不计入可移动选项', () => {
        const { events } = triggerBaseAbilityWithMS('base_mushroom_kingdom', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [
                    makeBase({
                        defId: 'base_mushroom_kingdom',
                        minions: [makeMinion('m1', 'test_minion', '1', 3)],
                    }),
                ],
            }),
            baseIndex: 0,
            baseDefId: 'base_mushroom_kingdom',
        }));

        expect(events).toHaveLength(0);
    });

    it('base_mushroom_kingdom: 若所选对手随从已离开原基地则不再移动', () => {
        const result = triggerBaseAbilityWithMS('base_mushroom_kingdom', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_mushroom_kingdom'),
                    makeBase({
                        defId: 'other_base',
                        minions: [makeMinion('m1', 'test_minion', '1', 3)],
                    }),
                ],
            }),
            baseIndex: 0,
            baseDefId: 'base_mushroom_kingdom',
        }));
        const prompt = getInteractionsFromResult(result)[0];
        expect(getPromptSourceId(prompt)).toBe('base_mushroom_kingdom');

        const staleCore = makeState({
            bases: [
                makeBase('base_mushroom_kingdom'),
                makeBase({
                    defId: 'other_base',
                    minions: [],
                }),
            ],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    discard: [makeCard('m1', 'd1', 'minion', '1')],
                }),
            },
        });

        const resolved = respondToPromptOption(
            withOnlyCurrentPrompt(makeMatchState(staleCore), prompt),
            (entry: any) => entry.value?.minionUid === 'm1',
            'Mushroom Kingdom choose minion m1',
            '0',
            defaultTestRandom,
        );
        expect(resolved.events.some(event => event.type === 'su:minion_moved')).toBe(false);
    });

    it('base_the_hill: 若所选随从已离开原基地则不再移动', () => {
        const result = triggerBaseAbilityWithMS('base_the_hill', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_the_hill'),
                    makeBase({
                        defId: 'other_base',
                        minions: [makeMinion('m1', 'test_minion', '0', 3)],
                    }),
                ],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_hill',
        }));
        const prompt = getInteractionsFromResult(result)[0];
        expect(getPromptSourceId(prompt)).toBe('base_the_hill');

        const staleCore = makeState({
            bases: [
                makeBase('base_the_hill'),
                makeBase({
                    defId: 'other_base',
                    minions: [],
                }),
            ],
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('m1', 'd1', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const resolved = respondToPromptOption(
            withOnlyCurrentPrompt(makeMatchState(staleCore), prompt),
            (entry: any) => entry.value?.minionUid === 'm1',
            'The Hill choose minion m1',
            '0',
            defaultTestRandom,
        );
        expect(resolved.events.some(event => event.type === 'su:minion_moved')).toBe(false);
    });

    it('borrowed Infiltrate 由控制者控制时，应阻止 The Hill 给控制者生成移动 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_the_hill', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [
                    makeBase({
                        defId: 'base_the_hill',
                        ongoingActions: [{
                            uid: 'inf-hill-1',
                            defId: 'ninja_infiltrate',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any],
                    }),
                    makeBase({
                        defId: 'other_base',
                        minions: [makeMinion('m1', 'test_minion', '0', 3)],
                    }),
                ],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_hill',
            playerId: '0',
        }));

        expect(result.events).toHaveLength(0);
        expect(getInteractionsFromResult(result)).toHaveLength(0);
    });
});
