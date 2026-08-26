import { beforeEach, describe, expect, it } from 'vitest';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import { clearOngoingEffectRegistry, isMinionProtected } from '../../domain/ongoingEffects';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    applyEvents,
    getPromptOption,
    getPromptOptions,
    getPromptSliderMax,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
    respondToPromptOptions,
    respondToPromptWithMergedValue,
    scoreBaseViaFlow,
    triggerBaseAbilityWithMS,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeEach(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('功夫斗士首批能力实现', () => {
    it('蟋蟀打出后可转移 1 枚 +1 战力标记', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('cricket-1', 'kung_fu_fighters_cricket', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('src', 'test_src', '0', 3, { powerCounters: 1 }),
                        makeMinion('dst', 'test_dst', '1', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '0',
                payload: { cardUid: 'cricket-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);

        const sourcePrompt = getSimpleChoicePrompt(played.finalState, 'kung_fu_counter_transfer_source');
        const chooseSource = respondToPrompt(
            played.finalState,
            getPromptOption(sourcePrompt, option => option.value?.minionUid === 'src', '蟋蟀来源随从').id,
            '0',
            defaultTestRandom,
        );

        const targetPrompt = getSimpleChoicePrompt(chooseSource.finalState, 'kung_fu_counter_transfer_target');
        const resolved = respondToPrompt(
            chooseSource.finalState,
            getPromptOption(targetPrompt, option => option.value?.minionUid === 'dst', '蟋蟀目标随从').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        const base = resolved.finalState.core.bases[0];
        expect(base.minions.find(minion => minion.uid === 'src')?.powerCounters).toBe(0);
        expect(base.minions.find(minion => minion.uid === 'dst')?.powerCounters).toBe(1);
    });

    it('神龙武者持续防消灭，且天赋可转移任意数量标记', () => {
        const state = makeMatchState(makeState({
            bases: [
                makeBase('base_a', [
                    makeMinion('dragon-1', 'kung_fu_fighters_dragon_warrior', '0', 5),
                    makeMinion('src', 'test_src', '0', 2, { powerCounters: 2 }),
                    makeMinion('dst', 'test_dst', '1', 2),
                ]),
            ],
        }));

        const dragon = state.core.bases[0].minions.find(minion => minion.uid === 'dragon-1');
        expect(dragon).toBeDefined();
        expect(isMinionProtected(state.core, dragon!, 0, '1', 'destroy')).toBe(true);
        expect(isMinionProtected(state.core, dragon!, 0, '0', 'destroy')).toBe(true);

        const used = runCommand(
            state,
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'dragon-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);

        const sourcePrompt = getSimpleChoicePrompt(used.finalState, 'kung_fu_counter_transfer_source');
        const chooseSource = respondToPrompt(
            used.finalState,
            getPromptOption(sourcePrompt, option => option.value?.minionUid === 'src', '神龙武者来源随从').id,
            '0',
            defaultTestRandom,
        );

        const targetPrompt = getSimpleChoicePrompt(chooseSource.finalState, 'kung_fu_counter_transfer_target');
        const chooseTarget = respondToPrompt(
            chooseSource.finalState,
            getPromptOption(targetPrompt, option => option.value?.minionUid === 'dst', '神龙武者目标随从').id,
            '0',
            defaultTestRandom,
        );

        const amountPrompt = getSimpleChoicePrompt(chooseTarget.finalState, 'kung_fu_counter_transfer_amount');
        expect(getPromptSliderMax(amountPrompt)).toBe(2);

        const resolved = respondToPromptWithMergedValue(
            chooseTarget.finalState,
            'confirm-transfer',
            { amount: 2, value: 2 },
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        const base = resolved.finalState.core.bases[0];
        expect(base.minions.find(minion => minion.uid === 'src')?.powerCounters).toBe(0);
        expect(base.minions.find(minion => minion.uid === 'dst')?.powerCounters).toBe(2);
    });

    it('醉酒宗师在没有标记时发动天赋会给自己放置 1 枚标记', () => {
        const used = runCommand(
            makeMatchState(makeState({
                bases: [
                    makeBase('base_a', [
                        makeMinion('drunken-1', 'kung_fu_fighters_drunken_master', '0', 3),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'drunken-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);
        expect(used.events.some(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
        expect(used.finalState.core.bases[0].minions.find(minion => minion.uid === 'drunken-1')?.powerCounters).toBe(1);
    });

    it('旋风女侠在没有标记时会消灭更低战力随从并给自己加 1 标记', () => {
        const used = runCommand(
            makeMatchState(makeState({
                bases: [
                    makeBase('base_a', [
                        makeMinion('lady-1', 'kung_fu_fighters_lady_whirlwind', '0', 4),
                        makeMinion('enemy-low', 'test_low', '1', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { minionUid: 'lady-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);
        expect(used.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
        const prompt = getSimpleChoicePrompt(used.finalState, 'kung_fu_fighters_lady_whirlwind');
        const target = getPromptOption(prompt, option => option.value?.minionUid === 'enemy-low', 'Lady Whirlwind destroy target');
        const resolved = respondToPrompt(used.finalState, target.id, '0', defaultTestRandom);
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);

        const base = resolved.finalState.core.bases[0];
        expect(base.minions.some(minion => minion.uid === 'enemy-low')).toBe(false);
        expect(base.minions.find(minion => minion.uid === 'lady-1')?.powerCounters).toBe(1);
    });

    it('古老的中国艺术可在所在基地选择目标放置 1 枚标记', () => {
        const used = runCommand(
            makeMatchState(makeState({
                bases: [
                    makeBase({
                        defId: 'base_a',
                        minions: [
                            makeMinion('ally-a', 'test_a', '0', 2),
                            makeMinion('ally-b', 'test_b', '0', 3),
                        ],
                        ongoingActions: [
                            { uid: 'art-1', defId: 'kung_fu_fighters_ancient_chinese_art', ownerId: '0' },
                        ],
                    }),
                ],
            })),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'art-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);
        const prompt = getSimpleChoicePrompt(used.finalState, 'kung_fu_fighters_ancient_chinese_art_add_counter');
        const resolved = respondToPrompt(
            used.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'ally-b', '古老的中国艺术加标记目标').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-b')?.powerCounters).toBe(1);
    });

    it('古老的中国艺术在本基地没有随从时可改为转移任意数量标记', () => {
        const used = runCommand(
            makeMatchState(makeState({
                bases: [
                    makeBase({
                        defId: 'base_a',
                        minions: [],
                        ongoingActions: [
                            { uid: 'art-1', defId: 'kung_fu_fighters_ancient_chinese_art', ownerId: '0' },
                        ],
                    }),
                    makeBase('base_b', [
                        makeMinion('src', 'test_src', '0', 3, { powerCounters: 2 }),
                        makeMinion('dst', 'test_dst', '1', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.USE_TALENT,
                playerId: '0',
                payload: { ongoingCardUid: 'art-1', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(used.success).toBe(true);

        const sourcePrompt = getSimpleChoicePrompt(used.finalState, 'kung_fu_counter_transfer_source');
        const chooseSource = respondToPrompt(
            used.finalState,
            getPromptOption(sourcePrompt, option => option.value?.minionUid === 'src', '古老的中国艺术来源随从').id,
            '0',
            defaultTestRandom,
        );

        const targetPrompt = getSimpleChoicePrompt(chooseSource.finalState, 'kung_fu_counter_transfer_target');
        const chooseTarget = respondToPrompt(
            chooseSource.finalState,
            getPromptOption(targetPrompt, option => option.value?.minionUid === 'dst', '古老的中国艺术目标随从').id,
            '0',
            defaultTestRandom,
        );

        const amountPrompt = getSimpleChoicePrompt(chooseTarget.finalState, 'kung_fu_counter_transfer_amount');
        const resolved = respondToPromptWithMergedValue(
            chooseTarget.finalState,
            'confirm-transfer',
            { amount: 2, value: 2 },
            '0',
            defaultTestRandom,
        );

        expect(getPromptSliderMax(amountPrompt)).toBe(2);
        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'src')?.powerCounters).toBe(0);
        expect(resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'dst')?.powerCounters).toBe(2);
    });

    it('各尽其责会按所选随从战力给同基地额外打出低战力随从的额度', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('ek-1', 'kung_fu_fighters_everybody_knew_their_part', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('strong', 'test_strong', '0', 4),
                        makeMinion('weak', 'test_weak', '0', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'ek-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'kung_fu_fighters_everybody_knew_their_part');
        const resolved = respondToPrompt(
            played.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'strong', '各尽其责选择的己方随从').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({
                    playerId: '0',
                    limitType: 'minion',
                    restrictToBase: 0,
                    powerMax: 3,
                    reason: 'kung_fu_fighters_everybody_knew_their_part',
                }),
            }),
        ]));
    });

    it('有些胆寒会先消灭更低战力随从，再给该处你的一个随从放置 2 枚标记', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('fright-1', 'kung_fu_fighters_a_little_bit_frightening', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('reference', 'test_reference', '0', 4),
                        makeMinion('enemy-low', 'test_enemy_low', '1', 2),
                        makeMinion('enemy-high', 'test_enemy_high', '1', 5),
                        makeMinion('ally-a', 'test_ally_a', '0', 2),
                        makeMinion('ally-b', 'test_ally_b', '0', 3),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'fright-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);

        const referencePrompt = getSimpleChoicePrompt(played.finalState, 'kung_fu_fighters_a_little_bit_frightening_reference');
        const chooseReference = respondToPrompt(
            played.finalState,
            getPromptOption(referencePrompt, option => option.value?.minionUid === 'reference', '有些胆寒参照随从').id,
            '0',
            defaultTestRandom,
        );

        const destroyPrompt = getSimpleChoicePrompt(chooseReference.finalState, 'kung_fu_fighters_a_little_bit_frightening_destroy');
        const chooseDestroy = respondToPrompt(
            chooseReference.finalState,
            getPromptOption(destroyPrompt, option => option.value?.minionUid === 'enemy-low', '有些胆寒消灭目标').id,
            '0',
            defaultTestRandom,
        );

        const rewardPrompt = getSimpleChoicePrompt(chooseDestroy.finalState, 'kung_fu_fighters_a_little_bit_frightening_reward');
        const resolved = respondToPrompt(
            chooseDestroy.finalState,
            getPromptOption(rewardPrompt, option => option.value?.minionUid === 'ally-b', '有些胆寒放标记目标').id,
            '0',
            defaultTestRandom,
        );

        expect(chooseDestroy.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-low')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-b')?.powerCounters).toBe(2);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-a')?.powerCounters ?? 0).toBe(0);
    });

    it('有些胆寒的更低战力判断走有效战力', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('fright-1', 'kung_fu_fighters_a_little_bit_frightening', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('reference', 'test_reference', '0', 3, { powerCounters: 1 }),
                        makeMinion('enemy-low', 'test_enemy_low', '1', 3),
                        makeMinion('enemy-high', 'test_enemy_high', '1', 5),
                        makeMinion('ally-a', 'test_ally_a', '0', 2),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'fright-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);

        const referencePrompt = getSimpleChoicePrompt(played.finalState, 'kung_fu_fighters_a_little_bit_frightening_reference');
        const chooseReference = respondToPrompt(
            played.finalState,
            getPromptOption(referencePrompt, option => option.value?.minionUid === 'reference', '有些胆寒有效战力参照随从').id,
            '0',
            defaultTestRandom,
        );

        const destroyPrompt = getSimpleChoicePrompt(chooseReference.finalState, 'kung_fu_fighters_a_little_bit_frightening_destroy');
        expect(getPromptOptions(destroyPrompt).some(option => option.value?.minionUid === 'enemy-low')).toBe(true);
        expect(getPromptOptions(destroyPrompt).some(option => option.value?.minionUid === 'enemy-high')).toBe(false);
    });

    it('让我们躁起来会消灭所选己方随从所在基地中任意数量的不高于其战力的随从', () => {
        const played = runCommand(
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('lets-1', 'kung_fu_fighters_lets_get_it_on', 'action', '0')],
                    }),
                    '1': makePlayer('1'),
                },
                bases: [
                    makeBase('base_a', [
                        makeMinion('source', 'test_source', '0', 4),
                        makeMinion('enemy-a', 'test_enemy_a', '1', 4),
                        makeMinion('enemy-b', 'test_enemy_b', '1', 2),
                        makeMinion('enemy-c', 'test_enemy_c', '1', 5),
                    ]),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'lets-1' },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const sourcePrompt = getSimpleChoicePrompt(played.finalState, 'kung_fu_fighters_lets_get_it_on_source');
        const chooseSource = respondToPrompt(
            played.finalState,
            getPromptOption(sourcePrompt, option => option.value?.minionUid === 'source', '让我们躁起来来源随从').id,
            '0',
            defaultTestRandom,
        );

        const targetPrompt = getSimpleChoicePrompt(chooseSource.finalState, 'kung_fu_fighters_lets_get_it_on_targets');
        const destroyA = getPromptOption(targetPrompt, option => option.value?.minionUid === 'enemy-a', '让我们躁起来目标 A');
        const destroyB = getPromptOption(targetPrompt, option => option.value?.minionUid === 'enemy-b', '让我们躁起来目标 B');
        const resolved = respondToPromptOptions(
            chooseSource.finalState,
            [destroyA.id, destroyB.id],
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED)).toHaveLength(2);

        const base = resolved.finalState.core.bases[0];
        expect(base.minions.some(minion => minion.uid === 'enemy-a')).toBe(false);
        expect(base.minions.some(minion => minion.uid === 'enemy-b')).toBe(false);
        expect(base.minions.some(minion => minion.uid === 'enemy-c')).toBe(true);
    });

    it('哦-厚-厚-厚-厚会在其他玩家打出随从到该基地后给己方随从放置标记', () => {
        const played = runCommand(
            makeMatchState(makeState({
                currentPlayerIndex: 1,
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1', {
                        hand: [makeCard('enemy-play', 'pirate_first_mate', '1')],
                    }),
                },
                bases: [
                    makeBase({
                        defId: 'base_a',
                        minions: [
                            makeMinion('ally-a', 'test_a', '0', 2),
                            makeMinion('ally-b', 'test_b', '0', 3),
                        ],
                        ongoingActions: [
                            { uid: 'hoah-1', defId: 'kung_fu_fighters_oh_hoh_hoh_hoah', ownerId: '0' },
                        ],
                    }),
                ],
            })),
            {
                type: SU_COMMANDS.PLAY_MINION,
                playerId: '1',
                payload: { cardUid: 'enemy-play', baseIndex: 0 },
            },
            defaultTestRandom,
        );

        expect(played.success).toBe(true);
        const prompt = getSimpleChoicePrompt(played.finalState, 'kung_fu_fighters_oh_hoh_hoh_hoah');
        expect(prompt.playerId).toBe('0');

        const resolved = respondToPrompt(
            played.finalState,
            getPromptOption(prompt, option => option.value?.minionUid === 'ally-b', '哦-厚-厚-厚-厚选择的己方随从').id,
            '0',
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'ally-b')?.powerCounters).toBe(1);
    });

    it('古道场会在你打出随从后给同基地更低战力的己方随从各加 1 标记', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_ancient_dojo', [
                    makeMinion('played', 'test_played', '0', 4),
                    makeMinion('ally-low', 'test_low', '0', 2),
                    makeMinion('ally-equal', 'test_equal', '0', 4),
                    makeMinion('enemy-low', 'test_enemy', '1', 1),
                ]),
            ],
        });

        const triggered = triggerBaseAbilityWithMS('base_ancient_dojo', 'onMinionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_ancient_dojo',
            playerId: '0',
            minionUid: 'played',
            minionDefId: 'test_played',
            minionPower: 4,
            now: 1000,
        });
        const finalCore = applyEvents(core, triggered.events as any);

        expect(finalCore.bases[0].minions.find(minion => minion.uid === 'ally-low')?.powerCounters).toBe(1);
        expect(finalCore.bases[0].minions.find(minion => minion.uid === 'ally-equal')?.powerCounters ?? 0).toBe(0);
        expect(finalCore.bases[0].minions.find(minion => minion.uid === 'enemy-low')?.powerCounters ?? 0).toBe(0);
    });

    it('比武擂台在唯一第一名与并列第一时都会按零战力玩家数给额外 VP', () => {
        const uniqueFirstResult = scoreBaseViaFlow(
            makeState({
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                    '2': makePlayer('2'),
                },
                turnOrder: ['0', '1', '2'],
                bases: [
                    makeBase('base_tournament_site', [
                        makeMinion('winner', 'test_winner', '0', 20),
                    ]),
                ],
                baseDeck: ['base_a'],
            }),
            0,
            ['base_a'],
            '0',
            1000,
            defaultTestRandom,
            makeMatchState(makeState({
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                    '2': makePlayer('2'),
                },
                turnOrder: ['0', '1', '2'],
                bases: [
                    makeBase('base_tournament_site', [
                        makeMinion('winner', 'test_winner', '0', 20),
                    ]),
                ],
                baseDeck: ['base_a'],
            })),
        );

        const uniqueFirstBaseScored = uniqueFirstResult.events.find(event => event.type === SU_EVENTS.BASE_SCORED) as any;
        expect(uniqueFirstBaseScored.payload.rankings.find((ranking: any) => ranking.playerId === '0')?.vp).toBe(4);

        const tiedFirstCore = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            bases: [
                makeBase('base_tournament_site', [
                    makeMinion('p0', 'test_p0', '0', 10),
                    makeMinion('p1', 'test_p1', '1', 10),
                ]),
            ],
            baseDeck: ['base_a'],
        });
        const tiedResult = scoreBaseViaFlow(
            tiedFirstCore,
            0,
            tiedFirstCore.baseDeck,
            '0',
            1001,
            defaultTestRandom,
            makeMatchState(tiedFirstCore),
        );
        const tiedBaseScored = tiedResult.events.find(event => event.type === SU_EVENTS.BASE_SCORED) as any;
        expect(tiedBaseScored.payload.rankings.find((ranking: any) => ranking.playerId === '0')?.vp).toBe(2);
        expect(tiedBaseScored.payload.rankings.find((ranking: any) => ranking.playerId === '1')?.vp).toBe(2);
    });

    it('让我们躁起来与古道场的力量判断都走有效战力', () => {
        const core = makeState({
            bases: [
                makeBase('base_ancient_dojo', [
                    makeMinion('played', 'test_played', '0', 4, { powerCounters: 1 }),
                    makeMinion('ally-low', 'test_low', '0', 4),
                ]),
            ],
        });

        const played = core.bases[0].minions.find(minion => minion.uid === 'played');
        const allyLow = core.bases[0].minions.find(minion => minion.uid === 'ally-low');
        expect(played && getEffectivePower(core, played, 0)).toBe(5);
        expect(allyLow && getEffectivePower(core, allyLow, 0)).toBe(4);

        const triggered = triggerBaseAbilityWithMS('base_ancient_dojo', 'onMinionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_ancient_dojo',
            playerId: '0',
            minionUid: 'played',
            minionDefId: 'test_played',
            minionPower: 4,
            now: 1002,
        });
        const finalCore = applyEvents(core, triggered.events as any);

        expect(finalCore.bases[0].minions.find(minion => minion.uid === 'ally-low')?.powerCounters).toBe(1);
    });
});
