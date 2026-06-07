import { beforeAll, describe, expect, it } from 'vitest';
import {
    expectNoPrompt,
    initAllAbilities,
    makeMatchState,
    makeMinion,
    makeState,
    reduce,
    triggerBaseAbilityWithMS,
    getInteractionsFromResult,
    getPromptOptions,
    getPromptSourceId,
    SU_EVENTS,
    SMASHUP_FACTION_IDS,
    type BaseAbilityContext,
} from './base-contract-helpers';
import { respondToPromptOption } from '../helpers';

beforeAll(() => {
    initAllAbilities();
});

function makePlayer(id: string, overrides: Record<string, any> = {}) {
    return {
        id,
        vp: 0,
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
        ...overrides,
    };
}

function makeBase(defId: string, overrides: Record<string, any> = {}) {
    return {
        defId,
        minions: [],
        ongoingActions: [],
        ...overrides,
    };
}

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

describe('10th Anniversary bases', () => {
    it('base_mermaid_pool 在你于此有仆从时，会提供把对手仆从移动到这里的交互', () => {
        const result = triggerBaseAbilityWithMS('base_mermaid_pool', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_mermaid_pool', {
                        minions: [makeMinion('ally-1', '0', 3)],
                    }),
                    makeBase('other_base', {
                        minions: [makeMinion('enemy-1', '1', 4)],
                    }),
                ],
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_mermaid_pool',
            baseIndex: 0,
        }));

        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_mermaid_pool');
        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.minionUid === 'enemy-1',
            'Mermaid Pool enemy minion option',
            '0',
            { random: () => 0.5, shuffle: <T>(arr: T[]) => arr, d: () => 1, range: (min: number) => min },
        );
        expect(resolved.success).toBe(true);

        const moveEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_MOVED) as any;
        expect(moveEvent).toBeTruthy();
        expect(moveEvent.payload.fromBaseIndex).toBe(1);
        expect(moveEvent.payload.toBaseIndex).toBe(0);
    });

    it('base_ossuary 在回合开始时可从弃牌堆埋葬力量 3 或以下仆从到这里', () => {
        const core = makeState({
            bases: [makeBase('base_ossuary')],
                players: {
                    '0': makePlayer('0', {
                        discard: [{ uid: 'minion-1', defId: 'skeletons_returned_one', type: 'minion', owner: '0' }],
                    }),
                    '1': makePlayer('1'),
                },
        });
        const result = triggerBaseAbilityWithMS('base_ossuary', 'onTurnStart', makeCtx({
            state: core,
            baseDefId: 'base_ossuary',
            baseIndex: 0,
        }));

        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_ossuary');
        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.cardUid === 'minion-1',
            'Ossuary bury option',
            '0',
            { random: () => 0.5, shuffle: <T>(arr: T[]) => arr, d: () => 1, range: (min: number) => min },
        );
        expect(resolved.success).toBe(true);

        expect(resolved.events.some(event => event.type === SU_EVENTS.CARD_BURIED)).toBe(true);
    });

    it('base_ossuary 埋葬 borrowed 弃牌堆随从时应保留真实 owner', () => {
        const core = makeState({
            bases: [makeBase('base_ossuary')],
            players: {
                '0': makePlayer('0', {
                    discard: [{ uid: 'borrowed-ossuary-card', defId: 'skeletons_returned_one', type: 'minion', owner: '1' }],
                }),
                '1': makePlayer('1'),
            },
        });
        const result = triggerBaseAbilityWithMS('base_ossuary', 'onTurnStart', makeCtx({
            state: core,
            baseDefId: 'base_ossuary',
            baseIndex: 0,
        }));

        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_ossuary');
        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.cardUid === 'borrowed-ossuary-card',
            'Ossuary borrowed bury option',
            '0',
            { random: () => 0.5, shuffle: <T>(arr: T[]) => arr, d: () => 1, range: (min: number) => min },
        );
        expect(resolved.success).toBe(true);

        const buriedEvent = resolved.events.find(event => event.type === SU_EVENTS.CARD_BURIED) as any;
        expect(buriedEvent).toBeDefined();
        expect(buriedEvent.payload).toEqual(expect.objectContaining({
            cardUid: 'borrowed-ossuary-card',
            trueOwnerId: '1',
            playerId: '0',
            buriedFrom: 'discard',
        }));
        expect(resolved.finalState.core.bases[0].buriedCards).toEqual(expect.arrayContaining([
            expect.objectContaining({
                uid: 'borrowed-ossuary-card',
                defId: 'skeletons_returned_one',
                trueOwnerId: '1',
            }),
        ]));
    });

    it('base_ossuary 埋葬仆从时不应误触发滑稽巨人的“打出随从后弃牌”效果', () => {
        const core = makeState({
            bases: [makeBase('base_ossuary')],
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'hand-1', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' }],
                    discard: [{ uid: 'minion-1', defId: 'fairies_puck', type: 'minion', owner: '0' }],
                }),
                '1': makePlayer('1'),
            },
            titans: [{
                uid: 'giant-1',
                defId: 'tricksters_big_funny_giant',
                faction: SMASHUP_FACTION_IDS.TRICKSTERS,
                ownerId: '1',
                controllerId: '1',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
        } as any);

        const result = triggerBaseAbilityWithMS('base_ossuary', 'onTurnStart', makeCtx({
            state: core,
            baseDefId: 'base_ossuary',
            baseIndex: 0,
        }));

        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_ossuary');

        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.cardUid === 'minion-1',
            'Ossuary bury option under Big Funny Giant',
            '0',
            { random: () => 0.5, shuffle: <T>(arr: T[]) => arr, d: () => 1, range: (min: number) => min },
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARD_BURIED)).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DISCARDED)).toBe(false);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['hand-1']);
        expect(resolved.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'minion-1')).toBe(true);
        expectNoPrompt(resolved.finalState);
    });

    it('base_arena 在此基地首次打出随从后，应提供额外行动或抽牌交互', () => {
        const core = makeState({
            bases: [makeBase('base_arena')],
            players: {
                '0': makePlayer('0', {
                    deck: [{ uid: 'draw-1', defId: 'pirate_dinghy', type: 'action', owner: '0' }],
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
        });

        const result = triggerBaseAbilityWithMS('base_arena', 'onMinionPlayed', makeCtx({
            state: core,
            baseDefId: 'base_arena',
            baseIndex: 0,
            minionUid: 'm1',
            minionDefId: 'pirate_first_mate',
        }));

        const interactions = getInteractionsFromResult(result);
        expect(interactions).toHaveLength(1);
        expect(getPromptSourceId(interactions[0])).toBe('base_arena');
        expect(getPromptOptions(interactions[0]).map((option: any) => option.value?.choice ?? option.value?.skip)).toEqual(
            expect.arrayContaining(['extra_action', 'draw_card', true]),
        );
        const resolved = respondToPromptOption(
            result.matchState!,
            (option: any) => option.value?.choice === 'draw_card',
            'Arena draw-card option',
            '0',
            { random: () => 0.5, shuffle: <T>(arr: T[]) => arr, d: () => 1, range: (min: number) => min },
        );
        expect(resolved.success).toBe(true);

        const drawEvent = resolved.events.find((event) => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload).toMatchObject({
            playerId: '0',
            count: 1,
        });
    });

    it('base_hall_of_fame 在此基地首次打出随从后，应给予该随从本回合 +2 力量', () => {
        const core = makeState({
            bases: [makeBase('base_hall_of_fame', {
                minions: [makeMinion('m1', '0', 2, 'pirate_first_mate')],
            })],
            players: {
                '0': makePlayer('0', {
                    minionsPlayedPerBase: { 0: 1 },
                }),
                '1': makePlayer('1'),
            },
        });

        const result = triggerBaseAbilityWithMS('base_hall_of_fame', 'onMinionPlayed', makeCtx({
            state: core,
            baseDefId: 'base_hall_of_fame',
            baseIndex: 0,
            minionUid: 'm1',
            minionDefId: 'pirate_first_mate',
        }));

        expect(result.events).toHaveLength(1);
        expect(result.events[0].type).toBe(SU_EVENTS.TEMP_POWER_ADDED);
        expect((result.events[0] as any).payload).toMatchObject({
            minionUid: 'm1',
            baseIndex: 0,
            amount: 2,
            reason: 'base_hall_of_fame',
        });

        const reduced = reduce(core, result.events[0] as any);
        expect(reduced.bases[0].minions[0].tempPowerModifier).toBe(2);
    });

    it('base_hall_of_fame 的 queued context 若不是该玩家本回合在此基地首次随从，不应误加临时力量', () => {
        const core = makeState({
            bases: [makeBase('base_hall_of_fame', {
                minions: [makeMinion('m2', '0', 2, 'pirate_first_mate')],
            })],
            players: {
                '0': makePlayer('0', {
                    minionsPlayedPerBase: { 0: 2 },
                }),
                '1': makePlayer('1'),
            },
        });

        const result = triggerBaseAbilityWithMS('base_hall_of_fame', 'onMinionPlayed', {
            ...makeCtx({
                state: core,
                baseDefId: 'base_hall_of_fame',
                baseIndex: 0,
                minionUid: 'm2',
                minionDefId: 'pirate_first_mate',
            }),
            frameId: 'minion-played-frame:m2:0:legacy',
            sourceEventId: 'minion-played:m2:0:legacy',
        } as BaseAbilityContext);

        expect(result.events).toHaveLength(0);
    });
});
