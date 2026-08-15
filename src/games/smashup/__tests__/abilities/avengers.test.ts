import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import {
    isAbilityRuntimeContinuationEvent,
    resumeAbilityRuntimeContinuationEvent,
} from '../../domain/abilityRuntime';
import { getEffectivePower } from '../../domain/ongoingModifiers';
import { SU_EVENTS } from '../../domain/types';
import { AVENGERS_CARDS } from '../../data/factions/avengers';
import {
    applyEvents,
    expectRegisteredAbilityContract,
    getPromptOptions,
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    respondToPromptOptions,
} from '../helpers';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

describe('复仇者代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('18 个唯一卡面生成 20 张牌，并注册全部可执行能力入口', () => {
        expect(AVENGERS_CARDS).toHaveLength(18);
        expect(AVENGERS_CARDS.reduce((total, card) => total + card.count, 0)).toBe(20);
        expect(AVENGERS_CARDS.map(card => card.previewRef?.index)).toEqual(
            Array.from({ length: 18 }, (_, index) => index),
        );

        const registrations = [
            ['avengers_black_widow', 'onPlay'],
            ['avengers_captain_america', 'talent'],
            ['avengers_hawkeye', 'onPlay'],
            ['avengers_hulk', 'talent'],
            ['avengers_iron_man', 'talent'],
            ['avengers_thor', 'onPlay'],
            ['avengers_thor', 'talent'],
            ['avengers_assemble', 'onPlay'],
            ['avengers_hawkeyes_arrows', 'onPlay'],
            ['avengers_hulk_smash', 'onPlay'],
            ['avengers_jarvis', 'talent'],
            ['avengers_modular_tech', 'onPlay'],
            ['avengers_repulsor_boots', 'onPlay'],
            ['avengers_repulsor_boots', 'special'],
            ['avengers_strategize', 'onPlay'],
            ['avengers_tactical_advantage', 'onPlay'],
            ['avengers_thunder_and_lightning', 'onPlay'],
            ['avengers_widows_bite', 'special'],
        ] as const;

        for (const [defId, tag] of registrations) {
            expect(expectRegisteredAbilityContract(defId, tag), `${defId}::${tag}`).toBeTypeOf('function');
        }
    });

    it('美队的盾牌与雷神锤按当前宿主持续计算力量', () => {
        const state = makeState({
            bases: [makeBase('base_juice_bar', [
                makeMinion('cap', 'avengers_captain_america', '0', 5, {
                    attachedActions: [{ uid: 'shield', defId: 'avengers_caps_shield', ownerId: '0' }],
                }),
                makeMinion('ally', 'avengers_hawkeye', '0', 5),
                makeMinion('thor', 'avengers_thor', '0', 5, {
                    attachedActions: [{ uid: 'mjolnir-thor', defId: 'avengers_mjolnir', ownerId: '0' }],
                }),
                makeMinion('other', 'avengers_hulk', '0', 5, {
                    attachedActions: [{ uid: 'mjolnir-other', defId: 'avengers_mjolnir', ownerId: '0' }],
                }),
                makeMinion('enemy', 'avengers_hawkeye', '1', 5),
            ])],
        });

        expect(getEffectivePower(state, state.bases[0].minions[0], 0)).toBe(6);
        expect(getEffectivePower(state, state.bases[0].minions[1], 0)).toBe(6);
        expect(getEffectivePower(state, state.bases[0].minions[2], 0)).toBe(8);
        expect(getEffectivePower(state, state.bases[0].minions[3], 0)).toBe(4);
        expect(getEffectivePower(state, state.bases[0].minions[4], 0)).toBe(5);
    });

    it('美队的盾牌阻止敌方行动影响己方角色，但不阻止己方行动或敌方角色能力', () => {
        const core = makeState({
            bases: [makeBase('base_juice_bar', [
                makeMinion('cap', 'avengers_captain_america', '0', 5, {
                    attachedActions: [{ uid: 'shield', defId: 'avengers_caps_shield', ownerId: '0' }],
                }),
                makeMinion('ally', 'mega_troopers_beta_6', '0', 2),
                makeMinion('widow', 'avengers_black_widow', '1', 5),
            ])],
        });

        const blocked = invokeRegisteredAbilityContract('avengers_tactical_advantage', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            cardUid: 'enemy-action',
            defId: 'avengers_tactical_advantage',
            baseIndex: 0,
            targetMinionUid: 'ally',
            random: FIXED_RANDOM,
            now: 10,
        });
        const afterBlocked = applyEvents(core, blocked.events);
        expect(getEffectivePower(afterBlocked, afterBlocked.bases[0].minions[1], 0)).toBe(3);
        expect(blocked.events.some(event => event.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(false);

        const allowed = invokeRegisteredAbilityContract('avengers_tactical_advantage', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'own-action',
            defId: 'avengers_tactical_advantage',
            baseIndex: 0,
            targetMinionUid: 'ally',
            random: FIXED_RANDOM,
            now: 11,
        });
        const afterAllowed = applyEvents(core, allowed.events);
        expect(getEffectivePower(afterAllowed, afterAllowed.bases[0].minions[1], 0)).toBe(6);

        const widow = invokeRegisteredAbilityContract('avengers_black_widow', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            cardUid: 'widow',
            defId: 'avengers_black_widow',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 12,
        });
        const destroyed = respondToPromptOption(
            widow.matchState!,
            option => option.value?.minionUid === 'ally',
            'protected ally remains targetable by non-action ability',
            '1',
            FIXED_RANDOM,
        );
        expect(destroyed.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('ally');
    });

    it('黑寡妇与复仇者集结允许主动跳过，不改变权威状态', () => {
        const widowCore = makeState({
            bases: [makeBase('base_juice_bar', [
                makeMinion('widow', 'avengers_black_widow', '0', 5),
                makeMinion('target', 'avengers_hawkeye', '1', 5),
            ])],
        });
        const widow = invokeRegisteredAbilityContract('avengers_black_widow', 'onPlay', {
            state: widowCore,
            matchState: makeMatchState(widowCore),
            playerId: '0',
            cardUid: 'widow',
            defId: 'avengers_black_widow',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 20,
        });
        const skippedWidow = respondToPromptOption(
            widow.matchState!,
            option => option.value?.skip === true,
            'skip Black Widow',
            '0',
            FIXED_RANDOM,
        );
        expect(skippedWidow.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([
            'widow',
            'target',
        ]);

        const assembleCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-card', 'avengers_hulk', 'minion', '0')],
                    discard: [makeCard('discard-card', 'avengers_hawkeye', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });
        const assemble = invokeRegisteredAbilityContract('avengers_assemble', 'onPlay', {
            state: assembleCore,
            matchState: makeMatchState(assembleCore),
            playerId: '0',
            cardUid: 'assemble',
            defId: 'avengers_assemble',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 21,
        });
        const skippedAssemble = respondToPromptOptions(assemble.matchState!, [], '0', FIXED_RANDOM);
        expect(skippedAssemble.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-card']);
        expect(skippedAssemble.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([
            'discard-card',
        ]);
    });

    it('钢铁侠可跳过同伴并只移动自己', () => {
        const core = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('iron-man', 'avengers_iron_man', '0', 5),
                    makeMinion('ally', 'avengers_hawkeye', '0', 5),
                ]),
                makeBase('base_moon_dumpster'),
            ],
        });
        const talent = invokeRegisteredAbilityContract('avengers_iron_man', 'talent', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'iron-man',
            defId: 'avengers_iron_man',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 30,
        });
        const skippedCompanion = respondToPromptOption(
            talent.matchState!,
            option => option.value?.skip === true,
            'skip Iron Man companion',
            '0',
            FIXED_RANDOM,
        );
        const moved = respondToPromptOption(
            skippedCompanion.finalState,
            option => option.value?.baseIndex === 1,
            'move Iron Man to second base',
            '0',
            FIXED_RANDOM,
        );

        expect(moved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['ally']);
        expect(moved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['iron-man']);
    });

    it('索尔从牌库检索雷神锤，并以同一 UID 在角色间转移', () => {
        const searchCore = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('before', 'avengers_hulk', 'minion', '0'),
                        makeCard('mjolnir', 'avengers_mjolnir', 'action', '0'),
                        makeCard('after', 'avengers_strategize', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const searched = invokeRegisteredAbilityContract('avengers_thor', 'onPlay', {
            state: searchCore,
            matchState: makeMatchState(searchCore),
            playerId: '0',
            cardUid: 'thor',
            defId: 'avengers_thor',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 40,
        });
        const afterSearch = applyEvents(searchCore, searched.events);
        expect(afterSearch.players['0'].hand.map(card => card.uid)).toEqual(['mjolnir']);
        expect(afterSearch.players['0'].deck.map(card => card.uid)).toEqual(['before', 'after']);

        const transferCore = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('thor', 'avengers_thor', '0', 5, {
                        attachedActions: [{ uid: 'mjolnir', defId: 'avengers_mjolnir', ownerId: '0' }],
                    }),
                ]),
                makeBase('base_moon_dumpster', [
                    makeMinion('target', 'avengers_hawkeye', '0', 5),
                ]),
            ],
        });
        const talent = invokeRegisteredAbilityContract('avengers_thor', 'talent', {
            state: transferCore,
            matchState: makeMatchState(transferCore),
            playerId: '0',
            cardUid: 'thor',
            defId: 'avengers_thor',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 41,
        });
        const transferred = respondToPromptOption(
            talent.matchState!,
            option => option.value?.minionUid === 'target',
            'move Mjolnir',
            '0',
            FIXED_RANDOM,
        );
        expect(transferred.finalState.core.bases[0].minions[0].attachedActions).toEqual([]);
        expect(transferred.finalState.core.bases[1].minions[0].attachedActions).toEqual([
            expect.objectContaining({ uid: 'mjolnir', defId: 'avengers_mjolnir' }),
        ]);
    });

    it('鹰眼箭抽取所选法术，将其余展示牌洗回，并只给该牌额外行动额度', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('action-a', 'avengers_strategize', 'action', '0'),
                        makeCard('miss', 'avengers_hulk', 'minion', '0'),
                        makeCard('action-b', 'avengers_tactical_advantage', 'action', '0'),
                        makeCard('tail', 'avengers_hawkeye', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_juice_bar', [
                makeMinion('hawkeye', 'avengers_hawkeye', '0', 5),
            ])],
        });
        const arrows = invokeRegisteredAbilityContract('avengers_hawkeyes_arrows', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'arrows',
            defId: 'avengers_hawkeyes_arrows',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 50,
        });
        const revealEvents = arrows.events.filter(event => !isAbilityRuntimeContinuationEvent(event as any));
        const arrowsContinuation = arrows.events.find(event => isAbilityRuntimeContinuationEvent(event as any));
        expect(arrowsContinuation).toBeTruthy();
        const arrowsPromptState = resumeAbilityRuntimeContinuationEvent(
            makeMatchState(applyEvents(core, revealEvents as any)),
            arrowsContinuation as any,
            FIXED_RANDOM,
        )?.state;
        const prompt = getSimpleChoicePrompt(arrowsPromptState!, 'avengers_hawkeyes_arrows_pick');
        expect(getPromptOptions(prompt).map(option => option.value?.cardUid)).toEqual([
            'action-a',
            'action-b',
        ]);

        const picked = respondToPromptOption(
            arrowsPromptState!,
            option => option.value?.cardUid === 'action-a',
            'pick first revealed action',
            '0',
            FIXED_RANDOM,
        );
        expect(picked.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['action-a']);
        expect(picked.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'tail',
            'action-b',
            'miss',
        ]);
        expect(picked.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: expect.objectContaining({ restrictToCardUid: 'action-a' }),
            }),
        ]));
    });

    it('浩克冲击替换基地时保留角色，并将所有基地神器和角色装备送入各自弃牌堆', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_juice_bar',
                instanceId: 'base-old',
                ongoingActions: [
                    { uid: 'artifact-own', defId: 'avengers_jarvis', ownerId: '0' },
                    { uid: 'artifact-enemy', defId: 'kaiju_the_kaiju_base', ownerId: '1' },
                ],
                minions: [
                    makeMinion('hulk', 'avengers_hulk', '0', 5, {
                        attachedActions: [
                            { uid: 'hulk-gear', defId: 'avengers_mjolnir', ownerId: '0' },
                        ],
                    }),
                    makeMinion('enemy', 'avengers_hawkeye', '1', 5, {
                        attachedActions: [
                            { uid: 'enemy-gear', defId: 'avengers_caps_shield', ownerId: '1' },
                        ],
                    }),
                ],
            })],
            baseDeck: ['base_moon_dumpster'],
        });
        const smash = invokeRegisteredAbilityContract('avengers_hulk_smash', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'smash',
            defId: 'avengers_hulk_smash',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 60,
        });
        const artifactPrompt = getSimpleChoicePrompt(smash.matchState!, 'avengers_hulk_smash_artifacts');
        const ownArtifact = getPromptOptions(artifactPrompt).find(
            option => option.value?.cardUid === 'artifact-own',
        );
        expect(ownArtifact).toBeDefined();
        const selected = respondToPromptOptions(
            smash.matchState!,
            [ownArtifact!.id],
            '0',
            FIXED_RANDOM,
        );
        const replaced = respondToPromptOption(
            selected.finalState,
            option => option.value?.replace === true,
            'replace base',
            '0',
            FIXED_RANDOM,
        );

        expect(replaced.finalState.core.bases[0].defId).toBe('base_moon_dumpster');
        expect(replaced.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([
            'hulk',
            'enemy',
        ]);
        expect(replaced.finalState.core.bases[0].ongoingActions).toEqual([]);
        expect(replaced.finalState.core.bases[0].minions.every(
            minion => minion.attachedActions.length === 0,
        )).toBe(true);
        expect(replaced.finalState.core.players['0'].discard.map(card => card.uid).sort()).toEqual([
            'artifact-own',
            'hulk-gear',
        ]);
        expect(replaced.finalState.core.players['1'].discard.map(card => card.uid).sort()).toEqual([
            'artifact-enemy',
            'enemy-gear',
        ]);

        const skipCore = makeState({
            bases: [makeBase('base_juice_bar', [
                makeMinion('hulk', 'avengers_hulk', '0', 5),
            ])],
            baseDeck: ['base_moon_dumpster'],
        });
        const skipSmash = invokeRegisteredAbilityContract('avengers_hulk_smash', 'onPlay', {
            state: skipCore,
            matchState: makeMatchState(skipCore),
            playerId: '0',
            cardUid: 'smash',
            defId: 'avengers_hulk_smash',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: FIXED_RANDOM,
            now: 61,
        });
        const skipped = respondToPromptOption(
            skipSmash.matchState!,
            option => option.value?.skip === true,
            'skip base replacement',
            '0',
            FIXED_RANDOM,
        );
        expect(skipped.finalState.core.bases[0].defId).toBe('base_juice_bar');
        expect(skipped.finalState.core.baseDeck).toEqual(['base_moon_dumpster']);
    });

    it('模块化技术转移原 UID 并获得额外行动；全部目的地受保护时仍独立获得额度', () => {
        const transferCore = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('source', 'avengers_hulk', '0', 5, {
                        attachedActions: [
                            { uid: 'gear', defId: 'avengers_mjolnir', ownerId: '0' },
                        ],
                    }),
                ]),
                makeBase('base_moon_dumpster', [
                    makeMinion('target', 'avengers_hawkeye', '0', 5),
                ]),
            ],
        });
        const transfer = invokeRegisteredAbilityContract('avengers_modular_tech', 'onPlay', {
            state: transferCore,
            matchState: makeMatchState(transferCore),
            playerId: '0',
            cardUid: 'modular',
            defId: 'avengers_modular_tech',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 70,
        });
        const moved = respondToPromptOption(
            transfer.matchState!,
            option => option.value?.minionUid === 'target',
            'move equipment',
            '0',
            FIXED_RANDOM,
        );
        expect(moved.finalState.core.bases[0].minions[0].attachedActions).toEqual([]);
        expect(moved.finalState.core.bases[1].minions[0].attachedActions).toEqual([
            expect.objectContaining({ uid: 'gear', defId: 'avengers_mjolnir' }),
        ]);
        expect(moved.events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(true);

        const protectedCore = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('source', 'avengers_hulk', '0', 5, {
                        attachedActions: [
                            { uid: 'gear', defId: 'avengers_mjolnir', ownerId: '0' },
                        ],
                    }),
                ]),
                makeBase('base_moon_dumpster', [
                    makeMinion('protected-cap', 'avengers_captain_america', '1', 5, {
                        attachedActions: [
                            { uid: 'shield', defId: 'avengers_caps_shield', ownerId: '1' },
                        ],
                    }),
                ]),
            ],
        });
        const blocked = invokeRegisteredAbilityContract('avengers_modular_tech', 'onPlay', {
            state: protectedCore,
            matchState: makeMatchState(protectedCore),
            playerId: '0',
            cardUid: 'modular',
            defId: 'avengers_modular_tech',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 71,
        });
        expect(blocked.matchState).toBeUndefined();
        expect(blocked.events).toEqual([
            expect.objectContaining({ type: SU_EVENTS.LIMIT_MODIFIED }),
        ]);
    });

    it('战略部署按玩家选择顺序放两张到牌库顶，其余查看牌落到牌库底', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('a', 'avengers_hulk', 'minion', '0'),
                        makeCard('b', 'avengers_hawkeye', 'minion', '0'),
                        makeCard('c', 'avengers_strategize', 'action', '0'),
                        makeCard('d', 'avengers_tactical_advantage', 'action', '0'),
                        makeCard('tail', 'avengers_thor', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });
        const strategize = invokeRegisteredAbilityContract('avengers_strategize', 'onPlay', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'strategize',
            defId: 'avengers_strategize',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 80,
        });
        const first = respondToPromptOption(
            strategize.matchState!,
            option => option.value?.cardUid === 'c',
            'choose first top card',
            '0',
            FIXED_RANDOM,
        );
        const second = respondToPromptOption(
            first.finalState,
            option => option.value?.cardUid === 'a',
            'choose second top card',
            '0',
            FIXED_RANDOM,
        );
        expect(second.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'c',
            'a',
            'tail',
            'b',
            'd',
        ]);
    });

    it('斥力靴普通模式在能力内选择己方角色，计分前模式只移动计分基地的钢铁侠', () => {
        const normalCore = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('iron-man', 'avengers_iron_man', '0', 5),
                    makeMinion('ally', 'avengers_hawkeye', '0', 5),
                ]),
                makeBase('base_moon_dumpster'),
            ],
        });
        const normal = invokeRegisteredAbilityContract('avengers_repulsor_boots', 'onPlay', {
            state: normalCore,
            matchState: makeMatchState(normalCore),
            playerId: '0',
            cardUid: 'boots',
            defId: 'avengers_repulsor_boots',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 90,
        });
        const selectedAlly = respondToPromptOption(
            normal.matchState!,
            option => option.value?.minionUid === 'ally',
            'choose normal source',
            '0',
            FIXED_RANDOM,
        );
        const normalMoved = respondToPromptOption(
            selectedAlly.finalState,
            option => option.value?.baseIndex === 1,
            'choose normal destination',
            '0',
            FIXED_RANDOM,
        );
        expect(normalMoved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([
            'iron-man',
        ]);
        expect(normalMoved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual([
            'ally',
        ]);

        const specialCore = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('iron-man', 'avengers_iron_man', '0', 5),
                    makeMinion('ally', 'avengers_hawkeye', '0', 5),
                ]),
                makeBase('base_moon_dumpster'),
            ],
        });
        const special = invokeRegisteredAbilityContract('avengers_repulsor_boots', 'special', {
            state: specialCore,
            matchState: makeMatchState(specialCore),
            playerId: '0',
            cardUid: 'boots',
            defId: 'avengers_repulsor_boots',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 91,
        });
        expect(getSimpleChoicePrompt(
            special.matchState!,
            'avengers_repulsor_boots_move',
        ).sourceId).toBe('avengers_repulsor_boots_move');
        const specialMoved = respondToPromptOption(
            special.matchState!,
            option => option.value?.baseIndex === 1,
            'move Iron Man before scoring',
            '0',
            FIXED_RANDOM,
        );
        expect(specialMoved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([
            'ally',
        ]);
        expect(specialMoved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual([
            'iron-man',
        ]);
    });

    it('雷霆闪电只消灭力量3或更少角色，蜘蛛之吻按计分基地给敌方减力并强化黑寡妇', () => {
        const thunderCore = makeState({
            bases: [makeBase('base_juice_bar', [
                makeMinion('small-target', 'shield_agent', '1', 2),
                makeMinion('large-target', 'avengers_hulk', '1', 5),
            ])],
        });

        const invalidThunder = invokeRegisteredAbilityContract('avengers_thunder_and_lightning', 'onPlay', {
            state: thunderCore,
            matchState: makeMatchState(thunderCore),
            playerId: '0',
            cardUid: 'thunder-invalid',
            defId: 'avengers_thunder_and_lightning',
            baseIndex: 0,
            targetMinionUid: 'large-target',
            random: FIXED_RANDOM,
            now: 100,
        });
        expect(invalidThunder.events).toEqual([]);

        const thunder = invokeRegisteredAbilityContract('avengers_thunder_and_lightning', 'onPlay', {
            state: thunderCore,
            matchState: makeMatchState(thunderCore),
            playerId: '0',
            cardUid: 'thunder',
            defId: 'avengers_thunder_and_lightning',
            baseIndex: 0,
            targetMinionUid: 'small-target',
            random: FIXED_RANDOM,
            now: 101,
        });
        expect(thunder.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.MINION_DESTROYED,
                payload: expect.objectContaining({
                    minionUid: 'small-target',
                    reason: 'avengers_thunder_and_lightning',
                }),
            }),
        ]));
        const afterThunder = applyEvents(thunderCore, thunder.events);
        expect(afterThunder.bases[0].minions.map(minion => minion.uid)).toEqual(['large-target']);

        const biteCore = makeState({
            bases: [
                makeBase('base_juice_bar', [
                    makeMinion('widow', 'avengers_black_widow', '0', 5),
                    makeMinion('ally', 'avengers_hawkeye', '0', 5),
                    makeMinion('enemy-a', 'spider_verse_spider_man_2099', '1', 2),
                    makeMinion('enemy-b', 'shield_phil_coulson', '1', 3),
                ]),
                makeBase('base_moon_dumpster', [
                    makeMinion('off-base-enemy', 'shield_agent', '1', 2),
                ]),
            ],
        });
        const bite = invokeRegisteredAbilityContract('avengers_widows_bite', 'special', {
            state: biteCore,
            matchState: makeMatchState(biteCore),
            playerId: '0',
            cardUid: 'bite',
            defId: 'avengers_widows_bite',
            baseIndex: 0,
            random: FIXED_RANDOM,
            now: 102,
        });
        const afterBite = applyEvents(biteCore, bite.events);
        expect(getEffectivePower(afterBite, afterBite.bases[0].minions[0], 0)).toBe(7);
        expect(getEffectivePower(afterBite, afterBite.bases[0].minions[1], 0)).toBe(5);
        expect(getEffectivePower(afterBite, afterBite.bases[0].minions[2], 0)).toBe(1);
        expect(getEffectivePower(afterBite, afterBite.bases[0].minions[3], 0)).toBe(2);
        expect(getEffectivePower(afterBite, afterBite.bases[1].minions[0], 1)).toBe(2);
    });
});
