import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import {
    CELLULAR_BONDING_EXPLICIT_COPIED_PROTECTION_DEF_IDS,
    CELLULAR_BONDING_EXPLICIT_COPIED_TRIGGER_DEF_IDS,
    COPYCAT_EXPLICIT_COPIED_TRIGGER_DEF_IDS,
} from '../abilities/yuanhou';
import {
    CELLULAR_BONDING_EXPLICIT_COPIED_POWER_DEF_IDS,
    COPYCAT_EXPLICIT_COPIED_POWER_DEF_IDS,
} from '../abilities/ongoing_modifiers';
import {
    applyEvents,
    findInteractionOption,
    getPromptOptions,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    resolveInteractionChain,
    triggerBaseAbilityWithMS,
} from './helpers';
import { defaultTestRandom, runCommand } from './testRunner';
import { resolveSpecial } from '../domain/abilityRegistry';
import { scoreOneBase } from '../domain';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { triggerBaseAbility } from '../domain/baseAbilities';
import { collectBaseAbilityTriggers } from '../domain/baseAbilityQueue';
import { collectTriggers, fireTriggers, isBaseAbilitySuppressed, isMinionProtected, isOperationRestricted } from '../domain/ongoingEffects';
import { getEffectivePower, getScoringEligibleBaseIndices } from '../domain/ongoingModifiers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { startSmashUpReactionSession } from '../domain/reactionSession';
import { queueImmediateExtraPlayInteractions } from '../domain/extraPlay';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { validate } from '../domain/commands';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { reduce } from '../domain/reduce';
import {
    filterProtectedAffectEvents,
    filterProtectedDeckBottomEvents,
    filterProtectedDestroyEvents,
    filterProtectedMoveEvents,
    filterProtectedReturnEvents,
    processClydeDetachChoices,
    processReturnToHandTriggers,
} from '../domain/reducer';
import { refreshInteractionOptions } from '../../../engine/systems/InteractionSystem';

describe('yuanhou 四派系代表性玩法行为', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    const chooseCardOptionRejectingUnexpectedImmediateExtraMinion = (prompt: any, cardUid: string) => {
        if (prompt?.data?.sourceId === 'smashup_immediate_extra_minion') {
            throw new Error('搜索/选择链的放弃入口应在当前选择 prompt 内，不应额外生成第二个 immediate extra prompt');
        }
        const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === cardUid);
        expect(option).toBeTruthy();
        return { optionId: option.id };
    };

    const skipImmediateExtraMinionPrompt = (state: any) => {
        const prompt = state.sys.interaction.current;
        if (prompt?.data?.sourceId !== 'smashup_immediate_extra_minion') return state;
        const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
        expect(skip).toBeTruthy();
        const skipped = runCommand(state, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: prompt.playerId,
            payload: { optionId: skip.id },
        } as any);
        expect(skipped.success).toBe(true);
        return skipped.finalState;
    };

    const advancePostScoringDelay = (state: any, playerId: string) => {
        const delayUntil = (state.sys as any)._smashupPostScoringBaseRevealDelayUntil;
        if (typeof delayUntil !== 'number') {
            expect(state.sys.phase).not.toBe('scoreBases');
            return {
                success: true,
                finalState: state,
                events: [],
            };
        }
        const advanced = runCommand(state, {
            type: 'ADVANCE_PHASE',
            playerId,
            payload: undefined,
            timestamp: delayUntil,
        } as any);
        expect(advanced.success).toBe(true);
        return advanced;
    };

    it('变形者：基因突变通过真实行动入口给目标随从临时 +3 力量', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-shift', 'shapeshifters_genetic_shift', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [
                makeMinion('target', 'shapeshifters_mimic', '0', 0),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-shift', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'target')?.tempPowerModifier).toBe(3);
    });

    it('变形者：基因突变直接目标也不能给敌方随从 +3', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-shift', 'shapeshifters_genetic_shift', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [
                makeMinion('enemy', 'sharks_mako', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-shift', targetBaseIndex: 0, targetMinionUid: 'enemy' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'enemy')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('变形者：基因突变真实无目标入口弹出模式选择后只给自己的所有随从 +1', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-shift', 'shapeshifters_genetic_shift', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [
                makeMinion('mine-a', 'shapeshifters_mimic', '0', 0),
                makeMinion('mine-b', 'sharks_mako', '0', 2),
                makeMinion('theirs', 'sharks_mako', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-shift' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.sys.interaction.current?.data?.sourceId).toBe('shapeshifters_genetic_shift_choose');

        const resolved = resolveInteractionChain(result.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.mode === 'all');
            return { optionId: option.id };
        });

        const minions = resolved.finalState.core.bases[0].minions;
        expect(minions.find(minion => minion.uid === 'mine-a')?.tempPowerModifier).toBe(1);
        expect(minions.find(minion => minion.uid === 'mine-b')?.tempPowerModifier).toBe(1);
        expect(minions.find(minion => minion.uid === 'theirs')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('变形者：基因突变模式选择只允许自己的单个随从 +3', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-shift', 'shapeshifters_genetic_shift', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [
                makeMinion('mine-a', 'shapeshifters_mimic', '0', 0),
                makeMinion('theirs', 'sharks_mako', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-shift' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.sys.interaction.current?.data?.sourceId).toBe('shapeshifters_genetic_shift_choose');
        expect(findInteractionOption(result.finalState.sys.interaction.current, candidate => candidate.value?.minionUid === 'theirs')).toBeUndefined();

        const resolved = resolveInteractionChain(result.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'mine-a');
            return { optionId: option.id };
        });

        const minions = resolved.finalState.core.bases[0].minions;
        expect(minions.find(minion => minion.uid === 'mine-a')?.tempPowerModifier).toBe(3);
        expect(minions.find(minion => minion.uid === 'theirs')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('变形者：基因突变交互处理器拒绝伪造敌方单体目标', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-shift', 'shapeshifters_genetic_shift', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [
                makeMinion('mine-a', 'shapeshifters_mimic', '0', 0),
                makeMinion('theirs', 'sharks_mako', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-shift' },
        } as any);

        expect(result.success).toBe(true);
        const prompt = result.finalState.sys.interaction.current!;
        const forgedState = {
            ...result.finalState,
            sys: {
                ...result.finalState.sys,
                interaction: {
                    ...result.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                {
                                    id: 'forged-enemy-single',
                                    label: 'forged enemy',
                                    value: { mode: 'single', minionUid: 'theirs' },
                                },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-enemy-single' },
        } as any);

        expect(forged.success).toBe(true);
        const minions = forged.finalState.core.bases[0].minions;
        expect(minions.find(minion => minion.uid === 'mine-a')?.tempPowerModifier ?? 0).toBe(0);
        expect(minions.find(minion => minion.uid === 'theirs')?.tempPowerModifier ?? 0).toBe(0);
    });

    it('变形者：基因突变单体模式拒绝非本次候选的晚加入己方随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-shift', 'shapeshifters_genetic_shift', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [
                makeMinion('mine-a', 'shapeshifters_mimic', '0', 0),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-shift' },
        } as any);

        expect(result.success).toBe(true);
        const prompt = result.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('shapeshifters_genetic_shift_choose');

        const forgedState = {
            ...result.finalState,
            core: {
                ...result.finalState.core,
                bases: [{
                    ...result.finalState.core.bases[0],
                    minions: [
                        ...result.finalState.core.bases[0].minions,
                        makeMinion('late-own', 'sharks_mako', '0', 2),
                    ],
                }],
            },
            sys: {
                ...result.finalState.sys,
                interaction: {
                    ...result.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-own', label: 'forged late own', value: { mode: 'single', minionUid: 'late-own' } },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-own' },
        } as any);

        expect(forged.success).toBe(true);
        const late = forged.finalState.core.bases[0].minions.find(minion => minion.uid === 'late-own');
        expect(late?.tempPowerModifier ?? 0).toBe(0);
    });

    it('候选快照合同：多类交互 handler 缺少本次 allowed 快照时拒绝执行', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('same-a', 'sharks_mako', 'minion', '0')],
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                    discard: [
                        makeCard('discard-a', 'sharks_mako', 'minion', '0'),
                        makeCard('action-a', 'time_travelers_time_walk', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_nexus', [
                makeMinion('mine-a', 'sharks_mako', '0', 2),
                makeMinion('enemy-low', 'sharks_hammerhead', '1', 3),
            ])],
            baseDeck: ['base_monkey_lab'],
            baseDiscard: ['base_the_vats'],
            turnNumber: 1,
            nextUid: 100,
        };
        const state = makeMatchState(core);
        const random = {
            random: () => 0.5,
            d: () => 1,
            range: () => 1,
            shuffle: <T,>(items: T[]) => items,
        };

        const cases: Array<{
            sourceId: string;
            value: unknown;
            data?: Record<string, unknown>;
        }> = [
            { sourceId: 'shapeshifters_genetic_shift_choose', value: { mode: 'single', minionUid: 'mine-a' } },
            { sourceId: 'shapeshifters_mitosis_choose', value: { cardUid: 'same-a', baseIndex: 0, sameNameDefId: 'sharks_mako' } },
            { sourceId: 'shapeshifters_really_base', value: { cardUid: 'discard-a', baseIndex: 0, reason: 'shapeshifters_really' } },
            { sourceId: 'base_faceless_city_choose', value: { cardUid: 'deck-a' } },
            { sourceId: 'super_spies_live_and_let_chum_choose', value: { minionUid: 'enemy-low' }, data: { baseIndex: 0 } },
            { sourceId: 'super_spies_the_base_is_not_enough_choose', value: { minionUid: 'enemy-low' }, data: { baseIndex: 0 } },
            { sourceId: 'time_travelers_its_astounding_choose', value: { cardUid: 'action-a' } },
            { sourceId: 'base_the_nexus_choose', value: { baseDefId: 'base_the_vats' } },
            { sourceId: 'time_travelers_time_is_fleeting_choose', value: { baseDefId: 'base_the_vats' } },
            { sourceId: 'time_travelers_time_raider_choose', value: { cardUid: 'discard-a' } },
            { sourceId: 'time_travelers_repeater_perfect_choose', value: { cardUid: 'action-a' } },
            { sourceId: 'time_travelers_1_21_gigawatts_choose', value: { cardType: 'minion' } },
        ];

        for (const testCase of cases) {
            const handler = getInteractionHandler(testCase.sourceId);
            expect(handler, testCase.sourceId).toBeTruthy();
            const handled = handler!(
                state,
                '0',
                testCase.value,
                testCase.data,
                random,
                1001,
            );
            expect(handled.events, testCase.sourceId).toEqual([]);
        }
    });

    it('变形者：细胞结合记录所复制的同随从附着行动', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-bond', 'shapeshifters_cellular_bonding', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'shapeshifters_mimic', '0', 0, {
                    attachedActions: [{ uid: 'splice-a', defId: 'shapeshifters_splice_as_nice', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-bond', targetBaseIndex: 0, targetMinionUid: 'host' },
        } as any);

        expect(result.success).toBe(true);
        const host = result.finalState.core.bases[0].minions.find(minion => minion.uid === 'host');
        expect(host?.metadata?.cellularBondingCopiedActionDefId).toBe('shapeshifters_splice_as_nice');
        expect(host ? getEffectivePower(result.finalState.core, host, 0) : undefined).toBe(4);
    });

    it('变形者：细胞结合在多张附着行动中按玩家选择复制目标', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-bond', 'shapeshifters_cellular_bonding', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'shapeshifters_mimic', '0', 0, {
                    attachedActions: [
                        { uid: 'splice-a', defId: 'shapeshifters_splice_as_nice', ownerId: '0' },
                        { uid: 'evo-a', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-bond', targetBaseIndex: 0, targetMinionUid: 'host' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('shapeshifters_cellular_bonding_choose');
        expect(
            findInteractionOption(
                getSimpleChoicePrompt(played.finalState, 'shapeshifters_cellular_bonding_choose'),
                candidate => candidate.value?.actionUid === 'evo-a',
            )?.value?.cardUid,
        ).toBe('evo-a');

        const resolved = resolveInteractionChain(played.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.actionUid === 'evo-a');
            return { optionId: option.id };
        });

        const host = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'host');
        expect(host?.metadata?.cellularBondingCopiedActionDefId).toBe('cyborg_apes_cyberevolution');
    });

    it('变形者：细胞结合交互处理器拒绝伪造宿主基地或非本卡上下文', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-bond', 'shapeshifters_cellular_bonding', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_the_vats', [
                    makeMinion('host', 'shapeshifters_mimic', '0', 0, {
                        attachedActions: [
                            { uid: 'splice-a', defId: 'shapeshifters_splice_as_nice', ownerId: '0' },
                            { uid: 'evo-a', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                        ],
                    }),
                ]),
                makeBase('base_faceless_city', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-bond', targetBaseIndex: 0, targetMinionUid: 'host' },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('shapeshifters_cellular_bonding_choose');

        const forgedState = {
            ...played.finalState,
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            hostBaseIndex: 1,
                            bondingCardUid: 'splice-a',
                        },
                    },
                },
            },
        };

        const option = findInteractionOption(prompt, candidate => candidate.value?.actionUid === 'evo-a');
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
        } as any);

        expect(forged.success).toBe(true);
        const host = forged.finalState.core.bases[0].minions.find(minion => minion.uid === 'host');
        expect(host?.metadata?.cellularBondingCopiedActionDefId).toBeUndefined();
    });

    it('变形者：细胞结合 handler 拒绝 prompt 后晚加入的附着行动', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-bond', 'shapeshifters_cellular_bonding', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'shapeshifters_mimic', '0', 0, {
                    attachedActions: [
                        { uid: 'splice-a', defId: 'shapeshifters_splice_as_nice', ownerId: '0' },
                        { uid: 'evo-a', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-bond', targetBaseIndex: 0, targetMinionUid: 'host' },
        } as any);

        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.allowedActionUids).toEqual(['splice-a', 'evo-a']);
        const forgedState = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                bases: [makeBase('base_the_vats', [
                    {
                        ...played.finalState.core.bases[0].minions[0],
                        attachedActions: [
                            ...played.finalState.core.bases[0].minions[0].attachedActions,
                            { uid: 'late-action', defId: 'cyborg_apes_flying_monkey', ownerId: '0' },
                        ],
                    },
                ])],
            },
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-action', label: 'forged late action', value: { actionUid: 'late-action' } },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-action' },
        } as any);

        expect(forged.success).toBe(true);
        const host = forged.finalState.core.bases[0].minions.find(minion => minion.uid === 'host');
        expect(host?.metadata?.cellularBondingCopiedActionDefId).toBeUndefined();
    });

    it('变形者：细胞结合 handler 缺少本次行动候选快照时拒绝复制', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-bond', 'shapeshifters_cellular_bonding', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'shapeshifters_mimic', '0', 0, {
                    attachedActions: [
                        { uid: 'splice-a', defId: 'shapeshifters_splice_as_nice', ownerId: '0' },
                        { uid: 'evo-a', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-bond', targetBaseIndex: 0, targetMinionUid: 'host' },
        } as any);

        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('shapeshifters_cellular_bonding_choose');
        const option = findInteractionOption(prompt, candidate => candidate.value?.actionUid === 'evo-a');
        expect(option).toBeTruthy();

        const forgedState = {
            ...played.finalState,
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            allowedActionUids: undefined,
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
        } as any);

        expect(forged.success).toBe(true);
        const host = forged.finalState.core.bases[0].minions.find(minion => minion.uid === 'host');
        expect(host?.metadata?.cellularBondingCopiedActionDefId).toBeUndefined();
    });

    it('变形者：模仿者在多个敌方随从中按玩家选择复制对象', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('copy-a', 'shapeshifters_copycat', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('enemy-a', 'cyborg_apes_baboom', '1', 3),
                makeMinion('enemy-b', 'cyborg_apes_furious_george', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'copy-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('shapeshifters_copycat_choose');

        const resolved = resolveInteractionChain(played.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'enemy-b');
            return { optionId: option.id };
        });

        const copycat = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'copy-a');
        expect(copycat?.metadata?.copiedAbilityDefId).toBe('cyborg_apes_furious_george');
    });

    it('变形者：模仿者交互处理器拒绝把复制目标伪造到非 Copycat 本体上', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('copy-a', 'shapeshifters_copycat', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('copycat-host', 'sharks_mako', '0', 2),
                makeMinion('enemy-a', 'cyborg_apes_baboom', '1', 3),
                makeMinion('enemy-b', 'cyborg_apes_furious_george', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'copy-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('shapeshifters_copycat_choose');

        const forgedState = {
            ...played.finalState,
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            copycatUid: 'copycat-host',
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-enemy', label: 'forged enemy', value: { minionUid: 'enemy-a' } },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-enemy' },
        } as any);

        expect(forged.success).toBe(true);
        const host = forged.finalState.core.bases[0].minions.find(minion => minion.uid === 'copycat-host');
        const copycat = forged.finalState.core.bases[0].minions.find(minion => minion.uid === 'copy-a');
        expect(host?.metadata?.copiedAbilityDefId).toBeUndefined();
        expect(copycat?.metadata?.copiedAbilityDefId).toBeUndefined();
    });

    it('变形者：模仿者 handler 拒绝 prompt 后晚加入的敌方随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('copy-a', 'shapeshifters_copycat', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('enemy-a', 'cyborg_apes_baboom', '1', 3),
                makeMinion('enemy-b', 'cyborg_apes_furious_george', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'copy-a', baseIndex: 0 },
        } as any);

        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.allowedMinionUids).toEqual(['enemy-a', 'enemy-b']);
        const forgedState = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                bases: [makeBase('base_the_vats', [
                    ...played.finalState.core.bases[0].minions,
                    makeMinion('late-enemy', 'time_travelers_doctor_when', '1', 5),
                ])],
            },
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-enemy', label: 'forged late enemy', value: { minionUid: 'late-enemy' } },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-enemy' },
        } as any);

        expect(forged.success).toBe(true);
        const copycat = forged.finalState.core.bases[0].minions.find(minion => minion.uid === 'copy-a');
        expect(copycat?.metadata?.copiedAbilityDefId).toBeUndefined();
    });

    it('变形者：模仿者 handler 缺少本次候选快照时拒绝复制', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('copy-a', 'shapeshifters_copycat', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('enemy-a', 'cyborg_apes_baboom', '1', 2),
                makeMinion('enemy-b', 'cyborg_apes_furious_george', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'copy-a', baseIndex: 0 },
        } as any);

        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('shapeshifters_copycat_choose');
        const option = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'enemy-a');
        expect(option).toBeTruthy();

        const forgedState = {
            ...played.finalState,
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            allowedMinionUids: undefined,
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
        } as any);

        expect(forged.success).toBe(true);
        const copycat = forged.finalState.core.bases[0].minions.find(minion => minion.uid === 'copy-a');
        expect(copycat?.metadata?.copiedAbilityDefId).toBeUndefined();
    });

    it('变形者：模仿者复制持续力量能力时参与有效力量计算', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('copycat', 'shapeshifters_copycat', '0', 2, {
                    attachedActions: [
                        { uid: 'action-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                        { uid: 'action-b', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                    ],
                    metadata: {
                        copiedAbilityDefId: 'cyborg_apes_furious_george',
                        copiedAbilityUntilTurn: 1,
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const copycat = core.bases[0].minions[0];
        expect(getEffectivePower(core, copycat, 0)).toBe(4);
    });

    it('变形者：Copycat 复制 POD 版狂怒的乔治时仍应按附着行动数量获得持续力量', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('copycat', 'shapeshifters_copycat', '0', 2, {
                    attachedActions: [
                        { uid: 'action-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                        { uid: 'action-b', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                    ],
                    metadata: {
                        copiedAbilityDefId: 'cyborg_apes_furious_george_pod',
                        copiedAbilityUntilTurn: 1,
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(4);
    });

    it('变形者：Copycat 复制 Mimic 后应按最高印刷力量而非有效力量动态重算', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_the_vats', [
                    makeMinion('copycat', 'shapeshifters_copycat', '0', 2, {
                        metadata: {
                            copiedAbilityDefId: 'shapeshifters_mimic',
                            copiedAbilityUntilTurn: 1,
                        },
                    }),
                    makeMinion('boosted-two', 'sharks_mako', '1', 2, {
                        attachedActions: [{ uid: 'evo-a', defId: 'cyborg_apes_cyberevolution', ownerId: '1' }],
                    }),
                ]),
                makeBase('base_portal_room', [
                    makeMinion('printed-five', 'sharks_megalodon', '1', 5),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(5);

        const withoutPrintedFive = {
            ...core,
            bases: [
                core.bases[0],
                {
                    ...core.bases[1],
                    minions: [],
                },
            ],
        };

        expect(getEffectivePower(withoutPrintedFive, withoutPrintedFive.bases[0].minions[0], 0)).toBe(2);
    });

    it('变形者：Copycat 复制未显式适配的 Robot Microbot Alpha 持续力量时不应隐式代理 power surface', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('copycat', 'shapeshifters_copycat', '0', 2, {
                    metadata: {
                        copiedAbilityDefId: 'robot_microbot_alpha',
                        copiedAbilityUntilTurn: 1,
                    },
                }),
                makeMinion('ally-a', 'sharks_mako', '0', 2),
                makeMinion('ally-b', 'time_travelers_jumper', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(2);
    });

    it('变形者：Copycat 复制能力到下个回合后应失去 copied power 与 copied talent', () => {
        const currentTurnCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('copycat', 'shapeshifters_copycat', '0', 2, {
                    attachedActions: [{ uid: 'action-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                    metadata: {
                        copiedAbilityDefId: 'cyborg_apes_furious_george',
                        copiedAbilityUntilTurn: 1,
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(getEffectivePower(currentTurnCore, currentTurnCore.bases[0].minions[0], 0)).toBe(3);

        const nextTurnCore = {
            ...currentTurnCore,
            turnNumber: 2,
        };

        expect(getEffectivePower(nextTurnCore, nextTurnCore.bases[0].minions[0], 0)).toBe(2);

        const expiredTalentCore = {
            ...currentTurnCore,
            bases: [makeBase('base_the_vats', [
                makeMinion('copycat', 'shapeshifters_copycat', '0', 2, {
                    metadata: {
                        copiedAbilityDefId: 'cyborg_apes_baboom',
                        copiedAbilityUntilTurn: 1,
                    },
                }),
            ])],
            turnNumber: 2,
        };

        const result = runCommand(makeMatchState(expiredTalentCore), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'copycat', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(false);
    });

    it('shared-contract：copy/proxy-current-surface 的显式 adapter inventory 应保持可审计', () => {
        expect([...COPYCAT_EXPLICIT_COPIED_TRIGGER_DEF_IDS]).toEqual([
            'time_travelers_jumper',
        ]);
        expect([...COPYCAT_EXPLICIT_COPIED_POWER_DEF_IDS]).toEqual([
            'shapeshifters_mimic',
            'cyborg_apes_furious_george',
        ]);
        expect([...CELLULAR_BONDING_EXPLICIT_COPIED_TRIGGER_DEF_IDS]).toEqual([
            'cyborg_apes_missing_uplink',
            'cyborg_apes_flying_monkey',
        ]);
        expect([...CELLULAR_BONDING_EXPLICIT_COPIED_PROTECTION_DEF_IDS]).toEqual([
            'shapeshifters_shell_game',
            'cyborg_apes_shielding',
        ]);
        expect([...CELLULAR_BONDING_EXPLICIT_COPIED_POWER_DEF_IDS]).toEqual([
            'shapeshifters_splice_as_nice',
            'cyborg_apes_cyberevolution',
            'cyborg_apes_juiced_up',
        ]);
    });

    it('变形者：Copycat 复制未显式适配的 Secret Agent trigger 时不应代理 onActionPlayed 弃牌', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('hand-a', 'sharks_mako', 'minion', '1'),
                        makeCard('hand-b', 'time_travelers_time_walk', 'action', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_the_vats', [
                makeMinion('copycat-a', 'shapeshifters_copycat', '0', 2, {
                    metadata: {
                        copiedAbilityDefId: 'super_spies_secret_agent',
                        copiedAbilityUntilTurn: 1,
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '1',
            random: () => 0.5,
            now: 1000,
        });

        expect(triggered.events).toEqual([]);
        expect(triggered.matchState?.sys.interaction.current).toBeUndefined();
        expect(triggered.matchState?.core.players['1'].hand.map(card => card.uid)).toEqual(['hand-a', 'hand-b']);
    });

    it('变形者：Copycat 复制未显式适配的 Mole special 时不应在计分窗口生成额外特殊行动入口', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '0')],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_the_vats',
                    breakpoint: 18,
                    minions: [
                        makeMinion('anchor-a', 'bear_cavalry_general_ivan', '0', 6),
                        makeMinion('copycat-mole', 'shapeshifters_copycat', '0', 2, {
                            metadata: {
                                copiedAbilityDefId: 'super_spies_mole',
                                copiedAbilityUntilTurn: 1,
                            },
                        }),
                        makeMinion('real-mole', 'super_spies_mole', '0', 4),
                        makeMinion('enemy-a', 'sharks_hammerhead', '1', 5),
                    ],
                }),
                makeBase('base_portal_room', []),
            ],
            baseDeck: ['base_the_nexus'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        const reactionPrompt = advance.finalState.sys.interaction.current;
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const realMoleOption = findInteractionOption(reactionPrompt, candidate =>
            candidate.value?.kind === 'activate_special'
            && candidate.value?.minionUid === 'real-mole'
            && candidate.value?.baseIndex === 0,
        );
        expect(realMoleOption).toBeTruthy();
        expect(findInteractionOption(reactionPrompt, candidate =>
            candidate.value?.kind === 'activate_special'
            && candidate.value?.minionUid === 'copycat-mole'
            && candidate.value?.baseIndex === 0,
        )).toBeUndefined();
    });

    it('变形者与电子猿：持续力量修正可直接消费到有效力量', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('mimic-peer', 'sharks_megalodon', '1', 5),
                makeMinion('mimic', 'shapeshifters_mimic', '0', 0),
                makeMinion('splice', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'splice-a', defId: 'shapeshifters_splice_as_nice', ownerId: '0' }],
                }),
                makeMinion('evo', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'evo-a', defId: 'cyborg_apes_cyberevolution', ownerId: '0' }],
                }),
                makeMinion('juice', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'juice-a', defId: 'cyborg_apes_juiced_up', ownerId: '0' },
                        { uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                    ],
                }),
                makeMinion('furious', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [
                        { uid: 'furious-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                        { uid: 'furious-b', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const [mimicPeer, mimic, splice, evo, juice, furious] = core.bases[0].minions;

        expect(getEffectivePower(core, mimicPeer, 0)).toBe(5);
        expect(getEffectivePower(core, mimic, 0)).toBe(5);
        expect(getEffectivePower(core, splice, 0)).toBe(4);
        expect(getEffectivePower(core, evo, 0)).toBe(5);
        expect(getEffectivePower(core, juice, 0)).toBe(6);
        expect(getEffectivePower(core, furious, 0)).toBe(4);
    });

    it('变形者：Mimic 按场上最高印刷力量动态重算，不复制有效力量加成', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('mimic', 'shapeshifters_mimic', '0', 0),
                makeMinion('boosted', 'sharks_mako', '1', 2, {
                    attachedActions: [{ uid: 'evo-a', defId: 'cyborg_apes_cyberevolution', ownerId: '1' }],
                }),
                makeMinion('printed-five', 'sharks_megalodon', '1', 5),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const mimic = core.bases[0].minions[0];
        const boosted = core.bases[0].minions[1];

        expect(getEffectivePower(core, boosted, 0)).toBe(5);
        expect(getEffectivePower(core, mimic, 0)).toBe(5);

        const afterPrintedFiveLeaves = {
            ...core,
            bases: [{
                ...core.bases[0],
                minions: [mimic, boosted],
            }],
        };

        expect(getEffectivePower(afterPrintedFiveLeaves, afterPrintedFiveLeaves.bases[0].minions[0], 0)).toBe(2);
    });

    it('电子猿：狂怒的乔治只按自己身上的行动数量动态加力量', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_primate_park', [
                makeMinion('furious', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [
                        { uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                        { uid: 'uplink-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                    ],
                }),
                makeMinion('ordinary', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'shield-b', defId: 'cyborg_apes_shielding', ownerId: '0' },
                        { uid: 'uplink-b', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const [furious, ordinary] = core.bases[0].minions;

        expect(getEffectivePower(core, furious, 0)).toBe(4);
        expect(getEffectivePower(core, ordinary, 0)).toBe(2);

        const afterDetach = {
            ...core,
            bases: [{
                ...core.bases[0],
                minions: [{
                    ...furious,
                    attachedActions: furious.attachedActions.slice(0, 1),
                }, ordinary],
            }],
        };

        expect(getEffectivePower(afterDetach, afterDetach.bases[0].minions[0], 0)).toBe(3);
    });

    it('电子猿：电子进化每张附着行动给宿主 +3 且离开后不再生效', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_primate_park', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'evo-a', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                        { uid: 'evo-b', defId: 'cyborg_apes_cyberevolution', ownerId: '1' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const host = core.bases[0].minions[0];

        expect(getEffectivePower(core, host, 0)).toBe(8);

        const afterDetach = {
            ...core,
            bases: [{
                ...core.bases[0],
                minions: [{
                    ...host,
                    attachedActions: [],
                }],
            }],
        };

        expect(getEffectivePower(afterDetach, afterDetach.bases[0].minions[0], 0)).toBe(2);
    });

    it('电子猿：兴奋剂按宿主全部行动数量每张 +2，包含本卡和 POD 别名', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_primate_park', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'juice-a', defId: 'cyborg_apes_juiced_up', ownerId: '0' },
                        { uid: 'juice-pod', defId: 'cyborg_apes_juiced_up_pod', ownerId: '1' },
                        { uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const host = core.bases[0].minions[0];

        expect(getEffectivePower(core, host, 0)).toBe(14);

        const afterDetach = {
            ...core,
            bases: [{
                ...core.bases[0],
                minions: [{
                    ...host,
                    attachedActions: host.attachedActions.filter(action => action.uid !== 'shield-a'),
                }],
            }],
        };

        expect(getEffectivePower(afterDetach, afterDetach.bases[0].minions[0], 0)).toBe(10);
    });

    it('电子猿基地：猴子实验室只按本基地每个随从自身行动数量动态加力量', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_monkey_lab', [
                    makeMinion('here-one', 'sharks_mako', '0', 2, {
                        attachedActions: [{ uid: 'action-a', defId: 'cyborg_apes_shielding', ownerId: '0' }],
                    }),
                    makeMinion('here-none', 'sharks_mako', '1', 2),
                ]),
                makeBase('base_primate_park', [
                    makeMinion('there-two', 'sharks_mako', '0', 2, {
                        attachedActions: [
                            { uid: 'action-b', defId: 'cyborg_apes_shielding', ownerId: '0' },
                            { uid: 'action-c', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                        ],
                    }),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(3);
        expect(getEffectivePower(core, core.bases[0].minions[1], 0)).toBe(2);
        expect(getEffectivePower(core, core.bases[1].minions[0], 1)).toBe(2);

        const afterAttach = {
            ...core,
            bases: [{
                ...core.bases[0],
                minions: [{
                    ...core.bases[0].minions[0],
                    attachedActions: [
                        ...core.bases[0].minions[0].attachedActions,
                        { uid: 'action-d', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                    ],
                }, core.bases[0].minions[1]],
            }, core.bases[1]],
        };

        expect(getEffectivePower(afterAttach, afterAttach.bases[0].minions[0], 0)).toBe(4);
    });

    it('变形者：模仿者复制带天赋的随从后可通过天赋代理生效', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('copycat', 'shapeshifters_copycat', '0', 2, {
                    metadata: {
                        copiedAbilityDefId: 'cyborg_apes_baboom',
                        copiedAbilityUntilTurn: 1,
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'copycat', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        expect(result.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.limitType === 'action'
            && (event as any).payload?.reason === 'cyborg_apes_baboom',
        )).toBe(true);
    });

    it('变形者：模仿者复制其他已注册随从天赋时也会走通用天赋代理', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_the_vats', [
                    makeMinion('copycat', 'shapeshifters_copycat', '0', 2, {
                        metadata: {
                            copiedAbilityDefId: 'sharks_great_white',
                            copiedAbilityUntilTurn: 1,
                        },
                    }),
                    makeMinion('target-a', 'sharks_mako', '0', 1),
                    makeMinion('target-b', 'sharks_hammerhead', '1', 2),
                ]),
                makeBase('base_portal_room', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'copycat', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.sys.interaction.current?.data?.sourceId).toBe('sharks_great_white');
    });

    it('变形者：细胞结合复制带天赋的附着行动后可用该天赋', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('sacrifice', 'cyborg_apes_furious_george', '0', 2),
                makeMinion('host', 'sharks_hammerhead', '1', 3, {
                    attachedActions: [
                        { uid: 'cell-a', defId: 'shapeshifters_cellular_bonding', ownerId: '0' },
                        { uid: 'monkey-back-a', defId: 'cyborg_apes_monkey_on_your_back', ownerId: '0' },
                    ],
                    metadata: {
                        cellularBondingCardUid: 'cell-a',
                        cellularBondingCopiedActionDefId: 'cyborg_apes_monkey_on_your_back',
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'cell-a', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['sacrifice']);
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toContain('cell-a');
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toContain('monkey-back-a');
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toContain('host');
    });

    it('变形者：细胞结合复制其他已注册附着行动天赋后也会走通用天赋代理', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'sharks_hammerhead', '1', 3, {
                    attachedActions: [
                        { uid: 'cell-a', defId: 'shapeshifters_cellular_bonding', ownerId: '0' },
                        { uid: 'ladybug-a', defId: 'fairies_ladybug', ownerId: '0' },
                    ],
                    metadata: {
                        cellularBondingCardUid: 'cell-a',
                        cellularBondingCopiedActionDefId: 'fairies_ladybug',
                    },
                }),
                makeMinion('target-a', 'sharks_mako', '0', 1),
                makeMinion('target-b', 'sharks_hammerhead', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'cell-a', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.sys.interaction.current?.data?.sourceId).toBe('fairies_ladybug');
    });

    it('变形者：细胞结合复制丢失中继后能从附着行动触发抽牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-a', 'cyborg_apes_baboom', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'sharks_hammerhead', '0', 3, {
                    attachedActions: [
                        { uid: 'cell-a', defId: 'shapeshifters_cellular_bonding', ownerId: '0' },
                        { uid: 'uplink-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                    ],
                    metadata: {
                        cellularBondingCardUid: 'cell-a',
                        cellularBondingCopiedActionDefId: 'cyborg_apes_missing_uplink',
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '0',
            random: () => 0.5,
            now: 1000,
        });
        const final = applyEvents(core, triggered.events);

        expect(triggered.events.length).toBeGreaterThan(0);
        expect(final.players['0'].hand.map(card => card.uid)).toEqual(['draw-a']);
    });

    it('变形者：borrowed 细胞结合复制丢失中继后也应按控制者而不是真实 owner 触发抽牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-a', 'cyborg_apes_baboom', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'sharks_hammerhead', '0', 3, {
                    attachedActions: [
                        { uid: 'cell-borrowed', defId: 'shapeshifters_cellular_bonding', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                    ],
                    metadata: {
                        cellularBondingCardUid: 'cell-borrowed',
                        cellularBondingCopiedActionDefId: 'cyborg_apes_missing_uplink',
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '0',
            random: () => 0.5,
            now: 1000,
        });
        const final = applyEvents(core, triggered.events);

        const drawEvent = triggered.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent?.payload.playerId).toBe('0');
        expect(drawEvent?.payload.cardUids).toEqual(['draw-a']);
        expect(final.players['0'].hand.map(card => card.uid)).toEqual(['draw-a']);
        expect(final.players['1'].hand).toEqual([]);
    });

    it('变形者：细胞结合本体离场后，即使宿主残留 copied Missing Uplink metadata 也不应继续触发抽牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('draw-a', 'cyborg_apes_baboom', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'sharks_hammerhead', '0', 3, {
                    attachedActions: [
                        { uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                    ],
                    metadata: {
                        cellularBondingCardUid: 'cell-a',
                        cellularBondingCopiedActionDefId: 'cyborg_apes_missing_uplink',
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '0',
            random: () => 0.5,
            now: 1000,
        });
        const final = applyEvents(core, triggered.events);

        expect(triggered.events).toEqual([]);
        expect(final.players['0'].hand).toEqual([]);
    });

    it('变形者：细胞结合复制 Splice as Nice 后在原行动离场时仍提供持续 +2 力量', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'cell-a', defId: 'shapeshifters_cellular_bonding', ownerId: '0' },
                        { uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                    ],
                    metadata: {
                        cellularBondingCardUid: 'cell-a',
                        cellularBondingCopiedActionDefId: 'shapeshifters_splice_as_nice',
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const host = core.bases[0].minions[0];
        expect(getEffectivePower(core, host, 0)).toBe(4);

        const afterBondingGone = {
            ...core,
            bases: [{
                ...core.bases[0],
                minions: [{
                    ...host,
                    attachedActions: host.attachedActions.filter(action => action.uid !== 'cell-a'),
                }],
            }],
        };

        expect(getEffectivePower(afterBondingGone, afterBondingGone.bases[0].minions[0], 0)).toBe(2);
    });

    it('变形者：细胞结合复制 Juiced Up 后在原行动离场时仍按宿主全部附着行动数量给 +2 倍增', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'cell-a', defId: 'shapeshifters_cellular_bonding', ownerId: '0' },
                        { uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                        { uid: 'uplink-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                    ],
                    metadata: {
                        cellularBondingCardUid: 'cell-a',
                        cellularBondingCopiedActionDefId: 'cyborg_apes_juiced_up',
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const host = core.bases[0].minions[0];
        expect(getEffectivePower(core, host, 0)).toBe(8);

        const afterBondingGone = {
            ...core,
            bases: [{
                ...core.bases[0],
                minions: [{
                    ...host,
                    attachedActions: host.attachedActions.filter(action => action.uid !== 'cell-a'),
                }],
            }],
        };

        expect(getEffectivePower(afterBondingGone, afterBondingGone.bases[0].minions[0], 0)).toBe(2);
    });

    it('变形者：细胞结合复制 POD 版 Juiced Up 时仍应按宿主全部附着行动数量给 +2 倍增', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'cell-a', defId: 'shapeshifters_cellular_bonding', ownerId: '0' },
                        { uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                        { uid: 'uplink-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                    ],
                    metadata: {
                        cellularBondingCardUid: 'cell-a',
                        cellularBondingCopiedActionDefId: 'cyborg_apes_juiced_up_pod',
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(8);
    });

    it('变形者：细胞结合复制未显式适配的 Daisy Chain 持续力量时不应隐式代理 power surface', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'cell-a', defId: 'shapeshifters_cellular_bonding', ownerId: '0' },
                        { uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                    ],
                    metadata: {
                        cellularBondingCardUid: 'cell-a',
                        cellularBondingCopiedActionDefId: 'fairies_daisy_chain',
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(getEffectivePower(core, core.bases[0].minions[0], 0)).toBe(2);
    });

    it('变形者：细胞结合复制未显式适配的 Stasis Field 时不应隐式代理基地压制或回合开始自毁', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_portal_room',
                breakpoint: 4,
                minions: [
                    makeMinion('host', 'sharks_mako', '0', 2, {
                        attachedActions: [{ uid: 'cell-a', defId: 'shapeshifters_cellular_bonding', ownerId: '0' }],
                        metadata: {
                            cellularBondingCardUid: 'cell-a',
                            cellularBondingCopiedActionDefId: 'time_travelers_stasis_field',
                        },
                    }),
                    makeMinion('ally-a', 'sharks_mako', '0', 2),
                ],
                ongoingActions: [],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(isBaseAbilitySuppressed(core, 0)).toBe(false);
        const scoring = scoreOneBase({ ...core, scoringEligibleBaseIndices: [0] } as any, 0, [], '0', 999);
        expect(scoring.events.some(event => event.type === SU_EVENTS.BASE_SCORED)).toBe(true);

        const triggered = fireTriggers(core, 'onTurnStart', {
            state: core,
            playerId: '0',
            random: () => 0.5,
            now: 1000,
        });
        const final = applyEvents(core, triggered.events);

        expect(triggered.events).toEqual([]);
        expect(final.bases[0].minions[0].attachedActions.map(action => action.uid)).toEqual(['cell-a']);
        expect(final.players['0'].discard).toEqual([]);
    });

    it('变形者：细胞结合本体离场后，即使宿主残留 copied Monkey on Your Back metadata 也不应继续提供天赋', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('enemy-host', 'sharks_hammerhead', '1', 3, {
                    attachedActions: [
                        { uid: 'monkey-back-a', defId: 'cyborg_apes_monkey_on_your_back', ownerId: '0' },
                    ],
                    metadata: {
                        cellularBondingCardUid: 'cell-a',
                        cellularBondingCopiedActionDefId: 'cyborg_apes_monkey_on_your_back',
                    },
                }),
                makeMinion('target', 'sharks_mako', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'cell-a', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(false);
    });

    it('变形者：回到未来胶囊摧毁任意随从并给其拥有者立即额外随从机会', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('bacta-a', 'shapeshifters_bacta_the_future', 'action', '0'),
                        makeCard('wrong-owner-mimic', 'shapeshifters_mimic', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('enemy-owner-extra-mimic', 'shapeshifters_mimic', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('target', 'sharks_great_white', '1', 5),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bacta-a', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toContain('target');
        expect(result.finalState.core.players['1'].deck.map(card => card.uid)).not.toContain('target');
        expect(result.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.playerId === '1'
            && (event as any).payload?.limitType === 'minion'
            && (event as any).payload?.reason === 'shapeshifters_bacta_the_future',
        )).toBe(true);
        expect(result.finalState.sys.interaction.current?.playerId).toBe('1');
        expect(result.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_immediate_extra_minion');

        const prompt = result.finalState.sys.interaction.current;
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'enemy-owner-extra-mimic')).toBeTruthy();
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'wrong-owner-mimic')).toBeUndefined();
        const resolved = resolveInteractionChain(result.finalState, currentPrompt => {
            if (currentPrompt?.data?.sourceId === 'smashup_immediate_extra_minion_base') {
                const base = findInteractionOption(currentPrompt, candidate => candidate.value?.baseIndex === 0);
                expect(base).toBeTruthy();
                return { optionId: base.id };
            }
            const option = findInteractionOption(currentPrompt, candidate => candidate.value?.cardUid === 'enemy-owner-extra-mimic');
            expect(option).toBeTruthy();
            return { optionId: option.id };
        });
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['enemy-owner-extra-mimic']);
        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).not.toContain('enemy-owner-extra-mimic');
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('wrong-owner-mimic');
    });

    it('变形者：回到未来胶囊给敌方拥有者的额外随从机会允许跳过且不会强制打出', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('bacta-a', 'shapeshifters_bacta_the_future', 'action', '0'),
                        makeCard('wrong-owner-mimic', 'shapeshifters_mimic', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('enemy-owner-extra-mimic', 'shapeshifters_mimic', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('target', 'sharks_great_white', '1', 5),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bacta-a', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.sys.interaction.current?.playerId).toBe('1');
        expect(result.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_immediate_extra_minion');

        const resolved = resolveInteractionChain(result.finalState, currentPrompt => {
            const skip = findInteractionOption(currentPrompt, candidate => candidate.value?.skip === true);
            expect(skip).toBeTruthy();
            return { optionId: skip.id };
        });

        expect(resolved.finalState.sys.interaction.current).toBeUndefined();
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).toContain('target');
        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).toContain('enemy-owner-extra-mimic');
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('wrong-owner-mimic');
    });

    it('变形者：普通 Copycat 被真实摧毁后，不应冒出空语义的 copied Jumper reaction prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('bacta-a', 'shapeshifters_bacta_the_future', 'action', '0'),
                        makeCard('extra-mimic', 'shapeshifters_mimic', 'minion', '0'),
                    ],
                    factions: ['shapeshifters'],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1', {
                    factions: ['cyborg_apes'],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('target', 'shapeshifters_copycat', '0', 2),
            ])],
            baseDeck: ['base_faceless_city'],
            turnNumber: 1,
            nextUid: 100,
        };

        const destroyed = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bacta-a', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);

        expect(destroyed.success).toBe(true);
        expect(destroyed.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_immediate_extra_minion');

        const played = resolveInteractionChain(destroyed.finalState, currentPrompt => {
            if (currentPrompt?.data?.sourceId === 'smashup_immediate_extra_minion_base') {
                const base = findInteractionOption(currentPrompt, candidate => candidate.value?.baseIndex === 0);
                expect(base).toBeTruthy();
                return { optionId: base.id };
            }
            const extraMimic = findInteractionOption(currentPrompt, candidate => candidate.value?.cardUid === 'extra-mimic');
            expect(extraMimic).toBeTruthy();
            return { optionId: extraMimic.id };
        });

        expect(played.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['extra-mimic']);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toContain('target');
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.finalState.core.triggerQueue ?? []).toHaveLength(0);
    });

    it('变形者：壳牌游戏直接保护附着随从不被摧毁', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'shell-a', defId: 'shapeshifters_shell_game', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(isMinionProtected(core, core.bases[0].minions[0], 0, '1', 'destroy')).toBe(true);
    });

    it('变形者：壳牌游戏保护宿主走真实摧毁事件后仍留在基地', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('bacta-a', 'shapeshifters_bacta_the_future', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_the_vats', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'shell-a', defId: 'shapeshifters_shell_game', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bacta-a', targetBaseIndex: 0, targetMinionUid: 'host' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('host');
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('host');
        expect(result.finalState.sys.interaction.current?.playerId).toBe('0');
        expect(result.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_immediate_extra_minion');
    });

    it('变形者基地：生体培养缸禁止把同名随从打到这里', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m-copy', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('existing', 'sharks_mako', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm-copy', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(false);
    });

    it('变形者基地：生体培养缸允许不同名随从正常打到这里', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m-other', 'sharks_hammerhead', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('existing', 'sharks_mako', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm-other', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('m-other');
    });

    it('变形者基地：生体培养缸在 Me First 随从响应窗口也禁止同名随从打到这里', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('shinobi-copy', 'ninja_shinobi', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_the_vats', [
                makeMinion('existing', 'ninja_shinobi', '1', 15),
            ])],
            baseDeck: [],
            scoringEligibleBaseIndices: [0],
            turnNumber: 1,
            nextUid: 100,
        };
        const state = startSmashUpReactionSession(makeMatchState(core), {
            frameId: 'score-before:the-vats:test',
            frameKind: 'score-before',
            phase: 'optional',
            activePlayerId: '0',
            currentPlayerId: '1',
            consecutivePasses: 0,
            sourceBaseIndex: 0,
            responseWindowType: 'meFirst',
        } as any);
        state.sys.phase = 'scoreBases';

        const result = validate(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'shinobi-copy', baseIndex: 0 },
        } as any);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('该基地禁止打出该随从');
    });

    it('变形者基地：无面之城在随从打到这里后从牌库找同名随从加入手牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('same-copy', 'sharks_mako', 'minion', '0'),
                        makeCard('other-card', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [
                makeMinion('played', 'sharks_mako', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbility('base_faceless_city', 'onMinionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_faceless_city',
            playerId: '0',
            minionUid: 'played',
            minionDefId: 'sharks_mako',
            minionPower: 2,
            random: { random: () => 0.5, d: () => 1, range: () => 1, shuffle: cards => cards },
            now: 1000,
        });
        const final = applyEvents(core, result.events);

        expect(result.events.some(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toBe(true);
        expect(final.players['0'].hand.map(card => card.uid)).toContain('same-copy');
        expect(final.players['0'].deck.map(card => card.uid)).toEqual(['other-card']);
    });

    it('变形者基地：无面之城真实入口只剩一个同名候选时应自动加入手牌且不弹搜寻 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('same-copy', 'sharks_mako', 'minion', '0'),
                        makeCard('other-card', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [
                makeMinion('played', 'sharks_mako', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbilityWithMS('base_faceless_city', 'onMinionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_faceless_city',
            playerId: '0',
            minionUid: 'played',
            minionDefId: 'sharks_mako',
            minionPower: 2,
            random: { random: () => 0.5, d: () => 1, range: () => 1, shuffle: cards => cards },
            now: 1000,
        });

        expect(result.matchState?.sys.interaction.current).toBeUndefined();
        expect(result.events.some(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toBe(true);

        const final = applyEvents(core, result.events);
        expect(final.players['0'].hand.map(card => card.uid)).toEqual(['same-copy']);
        expect(final.players['0'].deck.map(card => card.uid)).toEqual(['other-card']);
    });

    it('变形者基地：无面之城在多个同名候选中允许玩家选择或跳过搜寻', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('same-a', 'sharks_mako', 'minion', '0'),
                        makeCard('other-card', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('same-b', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [
                makeMinion('played', 'sharks_mako', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbilityWithMS('base_faceless_city', 'onMinionPlayed', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_faceless_city',
            playerId: '0',
            minionUid: 'played',
            minionDefId: 'sharks_mako',
            minionPower: 2,
            random: { random: () => 0.5, d: () => 1, range: () => 1, shuffle: cards => cards },
            now: 1000,
        });

        expect(result.matchState?.sys.interaction.current?.data?.sourceId).toBe('base_faceless_city_choose');
        const resolved = resolveInteractionChain(result.matchState!, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'same-b');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['same-b']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['same-a', 'other-card']);

        const skipped = resolveInteractionChain(result.matchState!, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
            return { optionId: option.id };
        });
        expect(skipped.finalState.core.players['0'].hand).toEqual([]);
        expect(skipped.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['same-a', 'other-card', 'same-b']);

        const prompt = result.matchState!.sys.interaction.current!;
        const forgedState = {
            ...result.matchState!,
            sys: {
                ...result.matchState!.sys,
                interaction: {
                    ...result.matchState!.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                {
                                    id: 'forged-other-card',
                                    label: 'forged non matching minion',
                                    value: { cardUid: 'other-card' },
                                },
                            ],
                        },
                    },
                },
            },
        };
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-other-card' },
        } as any);
        expect(forged.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('other-card');
        expect(forged.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['same-a', 'other-card', 'same-b']);
    });

    it('变形者：变形术销毁己方随从后允许从牌库选择非第一张合格随从打到同基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-transmogrify', 'shapeshifters_transmogrify', 'action', '0')],
                    deck: [
                        makeCard('candidate-a', 'sharks_mako', 'minion', '0'),
                        makeCard('candidate-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('too-big', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [
                makeMinion('target', 'shapeshifters_mimic', '0', 4),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-transmogrify', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);

        expect(played.success).toBe(true);
        const searchPrompt = played.finalState.sys.interaction.current;
        expect(searchPrompt?.data?.sourceId).toBe('shapeshifters_transmogrify_search');
        expect(findInteractionOption(searchPrompt, candidate => candidate.value?.skip === true)).toBeTruthy();

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            return chooseCardOptionRejectingUnexpectedImmediateExtraMinion(prompt, 'candidate-b');
        });

        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_PLAYED && (event as any).payload?.cardUid === 'candidate-b')).toBe(true);
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('candidate-b');
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('target');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('candidate-b');
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.reason === 'shapeshifters_transmogrify'
            && (event as any).payload?.playTiming === 'immediate',
        )).toBe(false);
        expect(resolved.finalState.sys.interaction.current?.data?.sourceId).not.toBe('smashup_immediate_extra_minion');
    });

    it.each([
        {
            name: '变形术',
            sourceId: 'shapeshifters_transmogrify_search',
            makePromptState: () => {
                const core = {
                    players: {
                        '0': makePlayer('0', {
                            hand: [makeCard('a-transmogrify', 'shapeshifters_transmogrify', 'action', '0')],
                            deck: [
                                makeCard('candidate-a', 'sharks_mako', 'minion', '0'),
                                makeCard('candidate-b', 'sharks_hammerhead', 'minion', '0'),
                            ],
                        }),
                        '1': makePlayer('1'),
                    },
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 0,
                    bases: [makeBase('base_faceless_city', [
                        makeMinion('target', 'shapeshifters_mimic', '0', 4),
                    ])],
                    baseDeck: [],
                    turnNumber: 1,
                    nextUid: 100,
                };
                return runCommand(makeMatchState(core), {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: '0',
                    payload: { cardUid: 'a-transmogrify', targetBaseIndex: 0, targetMinionUid: 'target' },
                } as any).finalState;
            },
        },
        {
            name: 'G.E.L.F.',
            sourceId: 'shapeshifters_gelf_search',
            makePromptState: () => {
                const core = {
                    players: {
                        '0': makePlayer('0', {
                            deck: [
                                makeCard('candidate-a', 'sharks_mako', 'minion', '0'),
                                makeCard('candidate-b', 'sharks_hammerhead', 'minion', '0'),
                            ],
                        }),
                        '1': makePlayer('1'),
                    },
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 0,
                    bases: [makeBase('base_the_vats', [
                        makeMinion('gelf-a', 'shapeshifters_gelf', '0', 4),
                    ])],
                    baseDeck: [],
                    turnNumber: 1,
                    nextUid: 100,
                };
                return runCommand(makeMatchState(core), {
                    type: SU_COMMANDS.USE_TALENT,
                    playerId: '0',
                    payload: { minionUid: 'gelf-a', baseIndex: 0 },
                } as any).finalState;
            },
        },
        {
            name: '相似者',
            sourceId: 'shapeshifters_doppelganger_search',
            makePromptState: () => {
                const core = {
                    players: {
                        '0': makePlayer('0', {
                            deck: [
                                makeCard('candidate-a', 'sharks_mako', 'minion', '0'),
                                makeCard('candidate-b', 'sharks_hammerhead', 'minion', '0'),
                            ],
                            discard: [makeCard('dopp-a', 'shapeshifters_doppelganger', 'minion', '0')],
                        }),
                        '1': makePlayer('1'),
                    },
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 0,
                    bases: [makeBase('base_faceless_city', [])],
                    baseDeck: [],
                    turnNumber: 1,
                    nextUid: 100,
                };
                const triggered = fireTriggers(core, 'onMinionDiscardedFromBase', {
                    state: core,
                    matchState: makeMatchState(core),
                    playerId: '0',
                    baseIndex: 0,
                    triggerMinionUid: 'dopp-a',
                    triggerMinionDefId: 'shapeshifters_doppelganger',
                    random: () => 0.5,
                    now: 1000,
                });
                return triggered.matchState!;
            },
        },
    ])('变形者：$name 牌库搜随从 handler 拒绝 prompt 后晚加入的牌库候选', ({ sourceId, makePromptState }) => {
        const prompted = skipImmediateExtraMinionPrompt(makePromptState());
        const prompt = prompted.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe(sourceId);
        expect(prompt.data.allowedCardUids).toEqual(['candidate-a', 'candidate-b']);

        const forgedState = {
            ...prompted,
            core: {
                ...prompted.core,
                players: {
                    ...prompted.core.players,
                    '0': {
                        ...prompted.core.players['0'],
                        deck: [
                            ...prompted.core.players['0'].deck,
                            makeCard('late-candidate', 'sharks_hammerhead', 'minion', '0'),
                        ],
                    },
                },
            },
            sys: {
                ...prompted.sys,
                interaction: {
                    ...prompted.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                {
                                    id: 'forged-late-candidate',
                                    label: 'forged late candidate',
                                    value: {
                                        ...prompt.data.options[0].value,
                                        cardUid: 'late-candidate',
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-candidate' },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.bases.flatMap(base => base.minions.map(minion => minion.uid))).not.toContain('late-candidate');
        expect(forged.finalState.core.players['0'].deck.map(card => card.uid)).toContain('late-candidate');

        const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'candidate-b');
        expect(option).toBeTruthy();
        const missingSnapshotState = {
            ...prompted,
            sys: {
                ...prompted.sys,
                interaction: {
                    ...prompted.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            allowedCardUids: undefined,
                        },
                    },
                },
            },
        };
        const missingSnapshot = runCommand(missingSnapshotState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
        } as any);

        expect(missingSnapshot.success).toBe(true);
        expect(missingSnapshot.finalState.core.bases.flatMap(base => base.minions.map(minion => minion.uid))).not.toContain('candidate-b');
        expect(missingSnapshot.finalState.core.players['0'].deck.map(card => card.uid)).toContain('candidate-b');
    });

    it('变形者：你确定销毁己方随从后允许从弃牌堆选择非第一张合格随从并选择打出基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-really', 'shapeshifters_really', 'action', '0')],
                    discard: [
                        makeCard('discard-a', 'sharks_mako', 'minion', '0'),
                        makeCard('discard-b', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_faceless_city', [
                    makeMinion('target', 'shapeshifters_mimic', '0', 4),
                ]),
                makeBase('base_the_vats', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-really', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);

        expect(played.success).toBe(true);
        const searchPrompt = played.finalState.sys.interaction.current;
        expect(searchPrompt?.data?.sourceId).toBe('shapeshifters_really_search');
        expect(findInteractionOption(searchPrompt, candidate => candidate.value?.skip === true)).toBeTruthy();

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            if (prompt?.data?.sourceId === 'shapeshifters_really_base') {
                const option = findInteractionOption(prompt, candidate => candidate.value?.baseIndex === 1);
                return { optionId: option.id };
            }
            return chooseCardOptionRejectingUnexpectedImmediateExtraMinion(prompt, 'discard-b');
        });

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('target');
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('discard-b');
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toContain('discard-b');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('discard-b');
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.reason === 'shapeshifters_really'
            && (event as any).payload?.playTiming === 'immediate',
        )).toBe(false);
        expect(resolved.finalState.sys.interaction.current?.data?.sourceId).not.toBe('smashup_immediate_extra_minion');
    });

    it('变形者：你确定弃牌堆搜随从 handler 拒绝 prompt 后晚加入的弃牌候选', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-really', 'shapeshifters_really', 'action', '0')],
                    discard: [
                        makeCard('discard-a', 'sharks_mako', 'minion', '0'),
                        makeCard('discard-b', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [
                makeMinion('target', 'shapeshifters_mimic', '0', 4),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-really', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);
        const prompted = skipImmediateExtraMinionPrompt(played.finalState);
        const prompt = prompted.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('shapeshifters_really_search');
        expect(prompt.data.allowedCardUids).toEqual(['discard-a', 'discard-b']);

        const forgedState = {
            ...prompted,
            core: {
                ...prompted.core,
                players: {
                    ...prompted.core.players,
                    '0': {
                        ...prompted.core.players['0'],
                        discard: [
                            ...prompted.core.players['0'].discard,
                            makeCard('late-discard', 'sharks_hammerhead', 'minion', '0'),
                        ],
                    },
                },
            },
            sys: {
                ...prompted.sys,
                interaction: {
                    ...prompted.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                {
                                    id: 'forged-late-discard',
                                    label: 'forged late discard',
                                    value: { cardUid: 'late-discard' },
                                },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-discard' },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.bases[0].minions.map(minion => minion.uid)).not.toContain('late-discard');
        expect(forged.finalState.core.players['0'].discard.map(card => card.uid)).toContain('late-discard');

        const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'discard-b');
        expect(option).toBeTruthy();
        const missingSnapshotState = {
            ...prompted,
            sys: {
                ...prompted.sys,
                interaction: {
                    ...prompted.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            allowedCardUids: undefined,
                        },
                    },
                },
            },
        };
        const missingSnapshot = runCommand(missingSnapshotState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
        } as any);

        expect(missingSnapshot.success).toBe(true);
        expect(missingSnapshot.finalState.core.bases.flatMap(base => base.minions.map(minion => minion.uid))).not.toContain('discard-b');
        expect(missingSnapshot.finalState.core.players['0'].discard.map(card => card.uid)).toContain('discard-b');
    });

    it('变形者：你确定选打出基地 handler 拒绝 prompt 后新增基地伪造成候选', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-really', 'shapeshifters_really', 'action', '0')],
                    discard: [
                        makeCard('discard-a', 'sharks_mako', 'minion', '0'),
                        makeCard('discard-b', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_faceless_city', [
                    makeMinion('target', 'shapeshifters_mimic', '0', 4),
                ]),
                makeBase('base_the_vats', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-really', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);
        const searchPrompted = skipImmediateExtraMinionPrompt(played.finalState);
        const searchPrompt = searchPrompted.sys.interaction.current!;
        const discardOption = findInteractionOption(searchPrompt, candidate => candidate.value?.cardUid === 'discard-a');
        const basePromptedRaw = runCommand(searchPrompted, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: discardOption.id },
        } as any);
        const basePrompted = {
            ...basePromptedRaw,
            finalState: skipImmediateExtraMinionPrompt(basePromptedRaw.finalState),
        };
        const basePrompt = basePrompted.finalState.sys.interaction.current!;
        expect(basePrompt.data.sourceId).toBe('shapeshifters_really_base');
        expect(basePrompt.data.allowedBaseIndices).toEqual([0, 1]);

        const forgedState = {
            ...basePrompted.finalState,
            core: {
                ...basePrompted.finalState.core,
                bases: [
                    ...basePrompted.finalState.core.bases,
                    makeBase('base_monkey_lab', []),
                ],
            },
            sys: {
                ...basePrompted.finalState.sys,
                interaction: {
                    ...basePrompted.finalState.sys.interaction,
                    current: {
                        ...basePrompt,
                        data: {
                            ...basePrompt.data,
                            options: [
                                ...basePrompt.data.options,
                                {
                                    id: 'forged-late-base',
                                    label: 'forged late base',
                                    value: { cardUid: 'discard-a', baseIndex: 2 },
                                },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-base' },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.bases[2].minions.map(minion => minion.uid)).toEqual([]);
        expect(forged.finalState.core.players['0'].discard.map(card => card.uid)).toContain('discard-a');
    });

    it('变形者：G.E.L.F. 天赋将自身洗回牌库后允许选择非第一张合格随从打出', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('candidate-a', 'sharks_mako', 'minion', '0'),
                        makeCard('candidate-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('too-big', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('gelf-a', 'shapeshifters_gelf', '0', 4),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'gelf-a', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(true);
        const searchPrompt = talent.finalState.sys.interaction.current;
        expect(searchPrompt?.data?.sourceId).toBe('shapeshifters_gelf_search');
        expect(findInteractionOption(searchPrompt, candidate => candidate.value?.skip === true)).toBeTruthy();

        const resolved = resolveInteractionChain(talent.finalState, (prompt) => {
            return chooseCardOptionRejectingUnexpectedImmediateExtraMinion(prompt, 'candidate-b');
        });

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['candidate-b']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toContain('gelf-a');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('candidate-b');
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.reason === 'shapeshifters_gelf'
            && (event as any).payload?.playTiming === 'immediate',
        )).toBe(false);
        expect(resolved.finalState.sys.interaction.current?.data?.sourceId).not.toBe('smashup_immediate_extra_minion');
    });

    it('变形者：borrowed G.E.L.F. 天赋将自身放到拥有者牌库底时应保留 sourcePlayerId', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('candidate-a', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-tail', 'sharks_hammerhead', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('gelf-borrowed', 'shapeshifters_gelf', '0', 4, '1'),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'gelf-borrowed', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(true);
        const bottom = talent.events.find(event =>
            event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM
            && (event as any).payload?.cardUid === 'gelf-borrowed'
        ) as any;
        expect(bottom?.payload).toMatchObject({
            ownerId: '1',
            sourcePlayerId: '0',
            reason: 'shapeshifters_gelf',
        });
        expect(talent.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-tail', 'gelf-borrowed']);
        expect(talent.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
    });

    it('变形者：相似者从基地进弃牌堆后允许从牌库选择非第一张随从打到原基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('candidate-a', 'sharks_mako', 'minion', '0'),
                        makeCard('candidate-b', 'sharks_hammerhead', 'minion', '0'),
                    ],
                    discard: [makeCard('dopp-a', 'shapeshifters_doppelganger', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'dopp-a',
            triggerMinionDefId: 'shapeshifters_doppelganger',
            random: () => 0.5,
            now: 1000,
        });

        const searchPrompt = triggered.matchState?.sys.interaction.current;
        expect(searchPrompt?.data?.sourceId).toBe('shapeshifters_doppelganger_search');
        expect(findInteractionOption(searchPrompt, candidate => candidate.value?.skip === true)).toBeTruthy();

        const resolved = resolveInteractionChain(triggered.matchState!, (prompt) => {
            return chooseCardOptionRejectingUnexpectedImmediateExtraMinion(prompt, 'candidate-b');
        });

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('candidate-b');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('candidate-b');
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.reason === 'shapeshifters_doppelganger'
            && (event as any).payload?.playTiming === 'immediate',
        )).toBe(false);
        expect(resolved.finalState.sys.interaction.current?.data?.sourceId).not.toBe('smashup_immediate_extra_minion');
    });

    it('变形者：相似者被真实摧毁进入弃牌堆时也会触发搜牌并打回原基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('candidate-a', 'sharks_mako', 'minion', '0'),
                        makeCard('candidate-b', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('bacta-a', 'shapeshifters_bacta_the_future', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_faceless_city', [
                makeMinion('dopp-a', 'shapeshifters_doppelganger', '0', 5),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const destroyed = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bacta-a', targetBaseIndex: 0, targetMinionUid: 'dopp-a' },
        } as any);

        expect(destroyed.success).toBe(true);
        expect(destroyed.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_immediate_extra_minion');
        expect(destroyed.finalState.core.players['0'].discard.map(card => card.uid)).toContain('dopp-a');

        const resolved = resolveInteractionChain(destroyed.finalState, prompt => {
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_minion') {
                const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
                return { optionId: skip.id };
            }
            expect(prompt?.data?.sourceId).toBe('shapeshifters_doppelganger_search');
            expect(findInteractionOption(prompt, candidate => candidate.value?.skip === true)).toBeTruthy();
            return chooseCardOptionRejectingUnexpectedImmediateExtraMinion(prompt, 'candidate-b');
        });

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('candidate-b');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('candidate-b');
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.reason === 'shapeshifters_doppelganger'
            && (event as any).payload?.playTiming === 'immediate',
        )).toBe(false);
        expect(resolved.finalState.sys.interaction.current?.data?.sourceId).not.toBe('smashup_immediate_extra_minion');
    });

    it('电子猿：为了香蕉只摧毁其他玩家打到指定基地和仆从上的行动', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-bananas', 'cyborg_apes_going_bananas', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_monkey_lab',
                minions: [
                    makeMinion('host-a', 'cyborg_apes_furious_george', '0', 2, {
                        attachedActions: [{ uid: 'attach-a', defId: 'cyborg_apes_cyberevolution', ownerId: '0' }],
                    }),
                    makeMinion('host-b', 'sharks_mako', '1', 2, {
                        attachedActions: [{ uid: 'attach-b', defId: 'shapeshifters_splice_as_nice', ownerId: '1' }],
                    }),
                ],
                ongoingActions: [
                    { uid: 'base-action-own', defId: 'super_spies_mindraker', ownerId: '0' },
                    { uid: 'base-action-other', defId: 'time_travelers_stasis_field', ownerId: '1' },
                ],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-bananas', targetBaseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'host-a')?.attachedActions.map(action => action.uid)).toEqual(['attach-a']);
        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'host-b')?.attachedActions).toEqual([]);
        expect(result.finalState.core.bases[0].ongoingActions.map(action => action.uid)).toEqual(['base-action-own']);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('attach-a');
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toContain('attach-b');
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toContain('base-action-other');
    });

    it('电子猿：猴子在你的背上天赋摧毁同基地敌方低力量随从并把本卡放到底', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'monkey-back-a', defId: 'cyborg_apes_monkey_on_your_back', ownerId: '0' }],
                }),
                makeMinion('target', 'sharks_hammerhead', '1', 3),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'monkey-back-a', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['host']);
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toContain('monkey-back-a');
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('monkey-back-a');
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toContain('target');
    });

    it('电子猿：borrowed 猴子在你的背上应按控制者找到宿主并在结算后回到真实拥有者牌库底', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{
                        uid: 'monkey-back-borrowed',
                        defId: 'cyborg_apes_monkey_on_your_back',
                        ownerId: '1',
                        metadata: { sourceControllerId: '0' },
                    } as any],
                }),
                makeMinion('target', 'sharks_hammerhead', '1', 3),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'monkey-back-borrowed', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        const bottom = result.events.find(event =>
            event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM
            && (event as any).payload?.cardUid === 'monkey-back-borrowed'
            && (event as any).payload?.reason === 'cyborg_apes_monkey_on_your_back'
        ) as any;
        expect(bottom?.payload).toMatchObject({
            ownerId: '1',
            sourcePlayerId: '0',
        });
        expect(result.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['host']);
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('monkey-back-borrowed');
        expect(result.finalState.core.players['1'].deck.map(card => card.uid)).toContain('monkey-back-borrowed');
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toContain('target');
    });

    it('电子猿：猴子在你的背上多目标时由玩家选择且拒绝伪造高力量目标', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'monkey-back-a', defId: 'cyborg_apes_monkey_on_your_back', ownerId: '0' }],
                }),
                makeMinion('enemy-a', 'sharks_hammerhead', '1', 3),
                makeMinion('enemy-b', 'sharks_mako', '1', 4),
                makeMinion('enemy-big', 'sharks_great_white', '1', 5),
                makeMinion('own-low', 'sharks_mako', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'monkey-back-a', baseIndex: 0 },
        } as any);

        const prompt = result.finalState.sys.interaction.current;
        expect(result.success).toBe(true);
        expect(prompt?.data?.sourceId).toBe('cyborg_apes_monkey_on_your_back_choose');
        expect(findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'enemy-a')).toBeTruthy();
        expect(findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'enemy-b')).toBeTruthy();
        expect(findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'enemy-big')).toBeUndefined();
        expect(findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'own-low')).toBeUndefined();

        const handler = getInteractionHandler('cyborg_apes_monkey_on_your_back_choose');
        const forged = handler?.(
            result.finalState,
            '0',
            { minionUid: 'enemy-big' },
            prompt?.data,
            () => 0.5,
            1001,
        );
        expect(forged?.events).toEqual([]);

        const resolved = resolveInteractionChain(result.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'enemy-b');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['host', 'enemy-a', 'enemy-big', 'own-low']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toContain('monkey-back-a');
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).toContain('enemy-b');
    });

    it('电子猿：猴子在你的背上 handler 缺少候选或本行动快照时拒绝执行', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'monkey-back-a', defId: 'cyborg_apes_monkey_on_your_back', ownerId: '0' }],
                }),
                makeMinion('enemy-a', 'sharks_hammerhead', '1', 3),
                makeMinion('enemy-b', 'sharks_mako', '1', 4),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'monkey-back-a', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        const prompt = result.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('cyborg_apes_monkey_on_your_back_choose');
        const option = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'enemy-b');
        expect(option).toBeTruthy();

        const withoutAllowedSnapshot = {
            ...result.finalState,
            sys: {
                ...result.finalState.sys,
                interaction: {
                    ...result.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            allowedMinionUids: undefined,
                        },
                    },
                },
            },
        };
        const missingAllowed = runCommand(withoutAllowedSnapshot, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
        } as any);

        expect(missingAllowed.success).toBe(true);
        expect(missingAllowed.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['host', 'enemy-a', 'enemy-b']);
        expect(missingAllowed.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('monkey-back-a');
        expect(missingAllowed.finalState.core.players['1'].discard.map(card => card.uid)).not.toContain('enemy-b');

        const withoutActionSnapshot = {
            ...result.finalState,
            sys: {
                ...result.finalState.sys,
                interaction: {
                    ...result.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            actionUid: undefined,
                        },
                    },
                },
            },
        };
        const missingAction = runCommand(withoutActionSnapshot, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
        } as any);

        expect(missingAction.success).toBe(true);
        expect(missingAction.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['host', 'enemy-a', 'enemy-b']);
        expect(missingAction.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('monkey-back-a');
        expect(missingAction.finalState.core.players['1'].discard.map(card => card.uid)).not.toContain('enemy-b');
    });

    it('电子猿：Baboom 的额外行动只能打到 Baboom 自己身上', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('boost-a', 'cyborg_apes_cyberevolution', 'action', '0'),
                        makeCard('base-action-a', 'cyborg_apes_going_bananas', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('baboom-a', 'cyborg_apes_baboom', '0', 2),
                makeMinion('other-a', 'sharks_mako', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'baboom-a', baseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        const firstPrompt = result.finalState.sys.interaction.current;
        expect(firstPrompt?.data?.sourceId).toBe('smashup_immediate_extra_action');
        expect(findInteractionOption(firstPrompt, candidate => candidate.value?.cardUid === 'base-action-a')).toBeUndefined();

        const resolved = resolveInteractionChain(result.finalState, prompt => {
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_action') {
                const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'boost-a');
                return { optionId: option.id };
            }
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_action_minion') {
                expect(findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'other-a')).toBeUndefined();
                const option = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'baboom-a');
                return { optionId: option.id };
            }
            throw new Error(`未处理的 Baboom 额外行动交互：${prompt?.data?.sourceId ?? 'unknown'}`);
        });

        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'baboom-a')?.attachedActions.map(action => action.uid)).toEqual(['boost-a']);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'other-a')?.attachedActions).toEqual([]);
    });

    it('电子猿：Baboom 的额外行动只有一个合法目标时仍需显式确认附着到 Baboom', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('boost-a', 'cyborg_apes_cyberevolution', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('baboom-a', 'cyborg_apes_baboom', '0', 2),
                makeMinion('other-a', 'sharks_mako', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'baboom-a', baseIndex: 0 },
        } as any);
        const resolved = resolveInteractionChain(talent.finalState, prompt => {
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_action') {
                const boost = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'boost-a');
                expect(boost).toBeTruthy();
                return { optionId: boost.id };
            }
            const target = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'baboom-a');
            expect(target).toBeTruthy();
            return { optionId: target.id };
        });

        expect(resolved.finalState.sys.interaction.current).toBeUndefined();
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'baboom-a')?.attachedActions.map(action => action.uid)).toEqual(['boost-a']);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'other-a')?.attachedActions).toEqual([]);
    });

    it('电子猿：Baboom 选择跳过额外行动后应直接收口且不强制打出任何行动', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('boost-a', 'cyborg_apes_cyberevolution', 'action', '0'),
                        makeCard('base-action-a', 'cyborg_apes_going_bananas', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('baboom-a', 'cyborg_apes_baboom', '0', 2),
                makeMinion('other-a', 'sharks_mako', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'baboom-a', baseIndex: 0 },
        } as any);
        const actionPrompt = talent.finalState.sys.interaction.current;
        expect(actionPrompt?.data?.sourceId).toBe('smashup_immediate_extra_action');
        const skip = findInteractionOption(actionPrompt, candidate => candidate.value?.skip === true);
        expect(skip).toBeTruthy();

        const skipped = runCommand(talent.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: skip.id },
        } as any);

        expect(skipped.success).toBe(true);
        expect(skipped.finalState.sys.interaction.current).toBeUndefined();
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid).sort()).toEqual(['base-action-a', 'boost-a']);
        expect(skipped.finalState.core.bases[0].minions.find(minion => minion.uid === 'baboom-a')?.attachedActions).toEqual([]);
        expect(skipped.finalState.core.bases[0].minions.find(minion => minion.uid === 'other-a')?.attachedActions).toEqual([]);
    });

    it('电子猿：Baboom 有多张合法额外行动时应允许选择非第一张并显式确认附着目标', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('boost-a', 'cyborg_apes_cyberevolution', 'action', '0'),
                        makeCard('boost-b', 'cyborg_apes_juiced_up', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('baboom-a', 'cyborg_apes_baboom', '0', 2),
                makeMinion('other-a', 'sharks_mako', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'baboom-a', baseIndex: 0 },
        } as any);
        const actionPrompt = talent.finalState.sys.interaction.current;
        expect(actionPrompt?.data?.sourceId).toBe('smashup_immediate_extra_action');
        expect(findInteractionOption(actionPrompt, candidate => candidate.value?.cardUid === 'boost-a')).toBeTruthy();
        const secondAction = findInteractionOption(actionPrompt, candidate => candidate.value?.cardUid === 'boost-b');
        expect(secondAction).toBeTruthy();

        const pickedSecond = resolveInteractionChain(talent.finalState, prompt => {
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_action') {
                return { optionId: secondAction.id };
            }
            const target = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'baboom-a');
            expect(target).toBeTruthy();
            return { optionId: target.id };
        });

        expect(pickedSecond.finalState.sys.interaction.current).toBeUndefined();
        expect(pickedSecond.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['boost-a']);
        expect(pickedSecond.finalState.core.bases[0].minions.find(minion => minion.uid === 'baboom-a')?.attachedActions.map(action => action.uid)).toEqual(['boost-b']);
        expect(pickedSecond.finalState.core.bases[0].minions.find(minion => minion.uid === 'other-a')?.attachedActions).toEqual([]);
    });

    it('电子猿：Baboom 当前牌池中的所有合法额外行动都应显式确认附着到 source 本体', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('back-a', 'cyborg_apes_monkey_on_your_back', 'action', '0'),
                        makeCard('evo-a', 'cyborg_apes_cyberevolution', 'action', '0'),
                        makeCard('juice-a', 'cyborg_apes_juiced_up', 'action', '0'),
                        makeCard('fly-a', 'cyborg_apes_flying_monkey', 'action', '0'),
                        makeCard('shield-a', 'cyborg_apes_shielding', 'action', '0'),
                        makeCard('uplink-a', 'cyborg_apes_missing_uplink', 'action', '0'),
                        makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '0'),
                        makeCard('monkey-do-a', 'cyborg_apes_monkey_see_monkey_do', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_monkey_lab', [
                    makeMinion('baboom-a', 'cyborg_apes_baboom', '0', 2),
                    makeMinion('other-own-a', 'sharks_mako', '0', 2),
                    makeMinion('other-enemy-a', 'sharks_hammerhead', '1', 2),
                ]),
                makeBase('base_portal_room', [
                    makeMinion('other-base-minion', 'time_travelers_jumper', '0', 2),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'baboom-a', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(true);
        const actionPrompt = talent.finalState.sys.interaction.current;
        expect(actionPrompt?.data?.sourceId).toBe('smashup_immediate_extra_action');

        const optionCardUids = (actionPrompt?.data?.options ?? [])
            .map((option: any) => option?.value?.cardUid)
            .filter((uid: unknown): uid is string => typeof uid === 'string')
            .sort();

        expect(optionCardUids).toEqual([
            'back-a',
            'evo-a',
            'fly-a',
            'juice-a',
            'shield-a',
            'uplink-a',
        ]);

        for (const cardUid of optionCardUids) {
            const option = findInteractionOption(actionPrompt, candidate => candidate.value?.cardUid === cardUid);
            expect(option).toBeTruthy();

            const resolved = resolveInteractionChain(talent.finalState, prompt => {
                if (prompt?.data?.sourceId === 'smashup_immediate_extra_action') {
                    return { optionId: option.id };
                }
                const target = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'baboom-a');
                expect(target).toBeTruthy();
                return { optionId: target.id };
            });

            expect(resolved.finalState.sys.interaction.current).toBeUndefined();
            expect(
                resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'baboom-a')?.attachedActions.map(action => action.uid),
            ).toEqual([cardUid]);
            expect(
                resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'other-own-a')?.attachedActions,
            ).toEqual([]);
            expect(
                resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'other-enemy-a')?.attachedActions,
            ).toEqual([]);
            expect(
                resolved.finalState.core.bases[1].minions.find(minion => minion.uid === 'other-base-minion')?.attachedActions,
            ).toEqual([]);
        }
    });

    it('电子猿：同基地有两只 Baboom 时额外行动应只附着到发动天赋的那一只', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('boost-a', 'cyborg_apes_cyberevolution', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('baboom-source', 'cyborg_apes_baboom', '0', 2),
                makeMinion('baboom-other', 'cyborg_apes_baboom', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'baboom-source', baseIndex: 0 },
        } as any);
        const actionPrompt = talent.finalState.sys.interaction.current;
        expect(actionPrompt?.data?.sourceId).toBe('smashup_immediate_extra_action');
        const selectedAction = findInteractionOption(actionPrompt, candidate => candidate.value?.cardUid === 'boost-a');
        expect(selectedAction).toBeTruthy();

        const picked = resolveInteractionChain(talent.finalState, prompt => {
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_action') {
                return { optionId: selectedAction.id };
            }
            const target = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'baboom-source');
            expect(target).toBeTruthy();
            return { optionId: target.id };
        });

        expect(picked.finalState.sys.interaction.current).toBeUndefined();
        expect(picked.finalState.core.bases[0].minions.find(minion => minion.uid === 'baboom-source')?.attachedActions.map(action => action.uid)).toEqual(['boost-a']);
        expect(picked.finalState.core.bases[0].minions.find(minion => minion.uid === 'baboom-other')?.attachedActions).toEqual([]);
    });

    it('电子猿：猴子见，猴子做将任意数量的行动加入手牌并洗回其余牌', () => {
        const reverseRandom = {
            shuffle: <T,>(items: T[]) => [...items].reverse(),
            random: () => 0.5,
            d: () => 1,
            range: (min: number) => min,
        };
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('monkey-do-a', 'cyborg_apes_monkey_see_monkey_do', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'cyborg_apes_cyberevolution', 'action', '0'),
                        makeCard('deck-b', 'cyborg_apes_shielding', 'action', '0'),
                        makeCard('deck-c', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-d', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-e', 'super_spies_from_q_with_love', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'monkey-do-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('cyborg_apes_monkey_see_monkey_do_choose');

        const resolved = resolveInteractionChain(played.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'deck-b');
            return { optionIds: [option.id] };
        }, reverseRandom);

        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('deck-b');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-e',
            'deck-d',
            'deck-c',
            'deck-a',
        ]);
    });

    it('电子猿：猴子见猴子做没有行动可拿时也会洗回展示牌', () => {
        const reverseRandom = {
            shuffle: <T,>(items: T[]) => [...items].reverse(),
            random: () => 0.5,
            d: () => 1,
            range: (min: number) => min,
        };
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('monkey-do-a', 'cyborg_apes_monkey_see_monkey_do', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-c', 'sharks_tiger_shark', 'minion', '0'),
                        makeCard('deck-d', 'sharks_great_white', 'minion', '0'),
                        makeCard('deck-e', 'sharks_megalodon', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'monkey-do-a' },
        } as any, reverseRandom);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('deck-a');
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-e',
            'deck-d',
            'deck-c',
            'deck-b',
            'deck-a',
        ]);
    });

    it('电子猿：猴子见猴子做有行动候选时也可以选择 0 张行动', () => {
        const reverseRandom = {
            shuffle: <T,>(items: T[]) => [...items].reverse(),
            random: () => 0.5,
            d: () => 1,
            range: (min: number) => min,
        };
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('monkey-do-a', 'cyborg_apes_monkey_see_monkey_do', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'cyborg_apes_cyberevolution', 'action', '0'),
                        makeCard('deck-b', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-c', 'cyborg_apes_shielding', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'monkey-do-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('cyborg_apes_monkey_see_monkey_do_choose');

        const resolved = runCommand(played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionIds: [] },
        } as any, reverseRandom);

        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('deck-a');
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('deck-c');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-c', 'deck-b', 'deck-a']);
    });

    it('电子猿：猴子见猴子做 handler 拒绝 prompt 后伪造的未展示行动', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('monkey-do-a', 'cyborg_apes_monkey_see_monkey_do', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'cyborg_apes_cyberevolution', 'action', '0'),
                        makeCard('deck-b', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-c', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-d', 'sharks_tiger_shark', 'minion', '0'),
                        makeCard('deck-e', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'monkey-do-a' },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('cyborg_apes_monkey_see_monkey_do_choose');
        expect(prompt.data.inspectedUids).toEqual(['deck-a', 'deck-b', 'deck-c', 'deck-d', 'deck-e']);
        expect(prompt.data.allowedCardUids).toEqual(['deck-a']);

        const forgedState = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                players: {
                    ...played.finalState.core.players,
                    '0': {
                        ...played.finalState.core.players['0'],
                        deck: [
                            makeCard('late-action', 'super_spies_from_q_with_love', 'action', '0'),
                            ...played.finalState.core.players['0'].deck,
                        ],
                    },
                },
            },
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-action', label: 'forged late action', value: { cardUid: 'late-action' } },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionIds: ['forged-late-action'] },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('late-action');
        expect(forged.finalState.core.players['0'].deck.map(card => card.uid)).toContain('late-action');
    });

    it('电子猿：猴子见猴子做 handler 拒绝重复选择同一张展示行动', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('monkey-do-a', 'cyborg_apes_monkey_see_monkey_do', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'cyborg_apes_cyberevolution', 'action', '0'),
                        makeCard('deck-b', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-c', 'cyborg_apes_shielding', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'monkey-do-a' },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('cyborg_apes_monkey_see_monkey_do_choose');

        const handler = getInteractionHandler('cyborg_apes_monkey_see_monkey_do_choose');
        const handled = handler?.(
            played.finalState,
            '0',
            [{ cardUid: 'deck-a' }, { cardUid: 'deck-a' }],
            prompt.data,
            { shuffle: <T,>(items: T[]) => [...items].reverse(), random: () => 0.5, d: () => 1, range: () => 1 },
            1001,
        );

        expect(handled?.events).toEqual([]);
    });

    it('电子猿：丢失中继在拥有者回合结束从 attachedActions 触发抽牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', { deck: [makeCard('draw-a', 'cyborg_apes_baboom', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'uplink-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '0',
            random: () => 0.5,
            now: 1000,
        });
        const final = applyEvents(core, triggered.events);

        expect(triggered.events.length).toBeGreaterThan(0);
        expect(final.players['0'].hand.map(card => card.uid)).toEqual(['draw-a']);
        expect(final.players['0'].deck).toEqual([]);
    });

    it('电子猿：borrowed 丢失中继应按控制者而不是真实 owner 在控制者回合结束抽牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', { deck: [makeCard('draw-a', 'cyborg_apes_baboom', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'uplink-borrowed', defId: 'cyborg_apes_missing_uplink', ownerId: '1', metadata: { sourceControllerId: '0' } } as any],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '0',
            random: () => 0.5,
            now: 1000,
        });
        const final = applyEvents(core, triggered.events);

        const drawEvent = triggered.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent?.payload.playerId).toBe('0');
        expect(drawEvent?.payload.cardUids).toEqual(['draw-a']);
        expect(final.players['0'].hand.map(card => card.uid)).toEqual(['draw-a']);
        expect(final.players['1'].hand).toEqual([]);
    });

    it('电子猿：多个丢失中继在各自拥有者回合结束逐张抽牌，其他玩家回合不触发', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'cyborg_apes_baboom', 'minion', '0'),
                        makeCard('draw-b', 'cyborg_apes_furious_george', 'minion', '0'),
                        makeCard('draw-c', 'cyborg_apes_cyberback', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host-a', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'uplink-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                }),
                makeMinion('host-b', 'sharks_mako', '1', 2, {
                    attachedActions: [{ uid: 'uplink-b', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const p1TurnEnd = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '1',
            random: () => 0.5,
            now: 1000,
        });
        expect(p1TurnEnd.events).toEqual([]);

        const p0TurnEnd = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '0',
            random: () => 0.5,
            now: 1001,
        });
        const final = applyEvents(core, p0TurnEnd.events);

        const drawEvent = p0TurnEnd.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvent?.payload.cardUids).toEqual(['draw-a', 'draw-b']);
        expect(final.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b']);
        expect(final.players['0'].deck.map(card => card.uid)).toEqual(['draw-c']);
    });

    it('电子猿：丢失中继在牌库不足时应先抽旧牌库顶部再洗弃牌续抽', () => {
        const reshuffleRandom = {
            shuffle: <T,>(items: T[]) => [...items].reverse(),
            random: () => 0.5,
            d: (max: number) => Math.max(1, Math.floor(max / 2)),
            range: (min: number, max: number) => Math.floor((min + max) / 2),
        };
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'cyborg_apes_baboom', 'minion', '0')],
                    discard: [
                        makeCard('discard-a', 'cyborg_apes_furious_george', 'minion', '0'),
                        makeCard('discard-b', 'cyborg_apes_cyberback', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host-a', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'uplink-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                }),
                makeMinion('host-b', 'cyborg_apes_cyberback', '0', 5, {
                    attachedActions: [{ uid: 'uplink-b', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const p0TurnEnd = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '0',
            random: reshuffleRandom,
            now: 1000,
        });
        const final = applyEvents(core, p0TurnEnd.events);

        expect(p0TurnEnd.events.map(event => event.type)).toEqual([
            SU_EVENTS.DECK_RESHUFFLED,
            SU_EVENTS.CARDS_DRAWN,
        ]);
        const reshuffleEvent = p0TurnEnd.events.find(event => event.type === SU_EVENTS.DECK_RESHUFFLED) as any;
        const drawEvent = p0TurnEnd.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(reshuffleEvent?.payload.deckUids).toEqual(['discard-b', 'discard-a']);
        expect(drawEvent?.payload.cardUids).toEqual(['deck-a', 'discard-b']);
        expect(final.players['0'].hand.map(card => card.uid)).toEqual(['deck-a', 'discard-b']);
        expect(final.players['0'].deck.map(card => card.uid)).toEqual(['discard-a']);
        expect(final.players['0'].discard).toEqual([]);
    });

    it('电子猿：丢失中继在多 owner 混挂时只聚合当前拥有者的实例', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('p0-draw-a', 'cyborg_apes_baboom', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-draw-a', 'cyborg_apes_furious_george', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('shared-host', 'sharks_mako', '1', 2, {
                    owner: '1',
                    attachedActions: [
                        { uid: 'uplink-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' },
                        { uid: 'uplink-b', defId: 'cyborg_apes_missing_uplink', ownerId: '1' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const p0TurnEnd = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '0',
            random: { shuffle: <T,>(items: T[]) => [...items], random: () => 0.5, d: (max: number) => Math.max(1, Math.floor(max / 2)), range: (min: number, max: number) => Math.floor((min + max) / 2) },
            now: 1000,
        });
        const p0Final = applyEvents(core, p0TurnEnd.events);
        const p0DrawEvent = p0TurnEnd.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(p0DrawEvent?.payload.playerId).toBe('0');
        expect(p0DrawEvent?.payload.cardUids).toEqual(['p0-draw-a']);
        expect(p0Final.players['0'].hand.map(card => card.uid)).toEqual(['p0-draw-a']);
        expect(p0Final.players['1'].hand).toEqual([]);

        const p1TurnEnd = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '1',
            random: { shuffle: <T,>(items: T[]) => [...items], random: () => 0.5, d: (max: number) => Math.max(1, Math.floor(max / 2)), range: (min: number, max: number) => Math.floor((min + max) / 2) },
            now: 1001,
        });
        const p1Final = applyEvents(core, p1TurnEnd.events);
        const p1DrawEvent = p1TurnEnd.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(p1DrawEvent?.payload.playerId).toBe('1');
        expect(p1DrawEvent?.payload.cardUids).toEqual(['p1-draw-a']);
        expect(p1Final.players['1'].hand.map(card => card.uid)).toEqual(['p1-draw-a']);
        expect(p1Final.players['0'].hand).toEqual([]);
    });

    it('电子猿：丢失中继在额外回合结束时也应按拥有者实例数抽牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('draw-a', 'cyborg_apes_baboom', 'minion', '0'),
                        makeCard('draw-b', 'cyborg_apes_furious_george', 'minion', '0'),
                        makeCard('draw-c', 'cyborg_apes_cyberback', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            activeExtraTurn: { playerId: '0', returnToPlayerIndex: 1, reason: 'base_portal_room' },
            bases: [makeBase('base_portal_room', [
                makeMinion('host-a', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'uplink-a', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                }),
                makeMinion('host-b', 'sharks_mako', '2', 2, {
                    attachedActions: [{ uid: 'uplink-b', defId: 'cyborg_apes_missing_uplink', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 3,
            nextUid: 100,
        };

        const extraTurnEnd = fireTriggers(core, 'onTurnEnd', {
            state: core,
            playerId: '0',
            random: () => 0.5,
            now: 1003,
        });
        const final = applyEvents(core, extraTurnEnd.events);

        const drawEvent = extraTurnEnd.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvent?.payload.cardUids).toEqual(['draw-a', 'draw-b']);
        expect(final.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b']);
        expect(final.players['0'].deck.map(card => card.uid)).toEqual(['draw-c']);
    });

    it('电子猿：克莱德2.0让同基地己方随从身上的行动离场时可选择进手牌', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('clyde', 'cyborg_apes_clyde_2_0', '0', 4),
                makeMinion('host', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bananas-a', targetBaseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('cyborg_apes_clyde_2_0_detach');
        expect(prompt?.playerId).toBe('0');
        expect(played.finalState.core.bases[0].minions.find(minion => minion.uid === 'host')?.attachedActions.map(action => action.uid)).toEqual(['shield-a']);

        const returned = resolveInteractionChain(played.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.returnToHand === true);
            return { optionId: option.id };
        });

        expect(returned.finalState.core.bases[0].minions.find(minion => minion.uid === 'host')?.attachedActions).toEqual([]);
        expect(returned.finalState.core.players['0'].hand.map(card => card.uid)).toContain('shield-a');
        expect(returned.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('shield-a');
    });

    it('电子猿：克莱德2.0选择不收入手牌时行动正常进弃牌堆', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('clyde', 'cyborg_apes_clyde_2_0', '0', 4),
                makeMinion('host', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bananas-a', targetBaseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('cyborg_apes_clyde_2_0_detach');

        const discarded = resolveInteractionChain(played.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.returnToHand === false);
            return { optionId: option.id };
        });

        expect(discarded.finalState.core.bases[0].minions.find(minion => minion.uid === 'host')?.attachedActions).toEqual([]);
        expect(discarded.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('shield-a');
        expect(discarded.finalState.core.players['0'].discard.map(card => card.uid)).toContain('shield-a');
    });

    it('电子猿：克莱德2.0选择收入手牌时，敌方拥有的附着行动也应进入克莱德控制者手牌', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('clyde', 'cyborg_apes_clyde_2_0', '0', 4),
                makeMinion('host', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'foreign-shield', defId: 'cyborg_apes_shielding', ownerId: '1' }],
                }),
            ])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const prompted = processClydeDetachChoices([{
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: 'foreign-shield',
                defId: 'cyborg_apes_shielding',
                ownerId: '1',
                reason: 'test-detach',
            },
            timestamp: 1000,
        } as any], makeMatchState(core), 1001);

        expect(prompted.matchState?.sys.interaction.current?.data?.sourceId).toBe('cyborg_apes_clyde_2_0_detach');
        expect(prompted.matchState?.sys.interaction.current?.playerId).toBe('0');

        const returned = resolveInteractionChain(prompted.matchState!, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.returnToHand === true);
            return { optionId: option.id };
        });

        expect(returned.finalState.core.bases[0].minions.find(minion => minion.uid === 'host')?.attachedActions).toEqual([]);
        expect(returned.finalState.core.players['0'].hand.map(card => card.uid)).toContain('foreign-shield');
        expect(returned.finalState.core.players['1'].hand.map(card => card.uid)).not.toContain('foreign-shield');
        expect(returned.finalState.core.players['1'].discard.map(card => card.uid)).not.toContain('foreign-shield');
    });

    it('电子猿：克莱德2.0选择进入弃牌堆时，敌方拥有的附着行动应回到其拥有者弃牌堆', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('clyde', 'cyborg_apes_clyde_2_0', '0', 4),
                makeMinion('host', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'foreign-shield', defId: 'cyborg_apes_shielding', ownerId: '1' }],
                }),
            ])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const prompted = processClydeDetachChoices([{
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: 'foreign-shield',
                defId: 'cyborg_apes_shielding',
                ownerId: '1',
                reason: 'test-detach',
            },
            timestamp: 1000,
        } as any], makeMatchState(core), 1001);

        expect(prompted.matchState?.sys.interaction.current?.data?.sourceId).toBe('cyborg_apes_clyde_2_0_detach');

        const discarded = resolveInteractionChain(prompted.matchState!, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.returnToHand === false);
            return { optionId: option.id };
        });

        expect(discarded.finalState.core.bases[0].minions.find(minion => minion.uid === 'host')?.attachedActions).toEqual([]);
        expect(discarded.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('foreign-shield');
        expect(discarded.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('foreign-shield');
        expect(discarded.finalState.core.players['1'].discard.map(card => card.uid)).toContain('foreign-shield');
    });

    it('电子猿：克莱德2.0处理同批离场事件时，应按前置移动后的现场判断是否仍同基地', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_monkey_lab', [
                    makeMinion('clyde', 'cyborg_apes_clyde_2_0', '0', 4),
                    makeMinion('host', 'cyborg_apes_furious_george', '0', 2, {
                        attachedActions: [{ uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' }],
                    }),
                ]),
                makeBase('base_faceless_city', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const prompted = processClydeDetachChoices([
            {
                type: SU_EVENTS.MINION_MOVED,
                payload: {
                    minionUid: 'host',
                    minionDefId: 'cyborg_apes_furious_george',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'test_move_host_before_detach',
                },
                timestamp: 1000,
            } as any,
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'shield-a',
                    defId: 'cyborg_apes_shielding',
                    ownerId: '0',
                    reason: 'test-detach-after-move',
                },
                timestamp: 1001,
            } as any,
        ], makeMatchState(core), 1002);

        expect(prompted.matchState?.sys.interaction.current).toBeUndefined();
        expect(prompted.events.some(event => event.type === SU_EVENTS.ONGOING_DETACHED)).toBe(true);
    });

    it('电子猿：赛博守护者允许从弃牌堆把持续行动打到自己身上', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('evo-a', 'cyborg_apes_cyberevolution', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('cyberback-a', 'cyborg_apes_cyberback', '0', 5),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'evo-a',
                targetBaseIndex: 0,
                targetMinionUid: 'cyberback-a',
                fromDiscard: true,
            },
        } as any);

        expect(result.success).toBe(true);
        const cyberback = result.finalState.core.bases[0].minions.find(minion => minion.uid === 'cyberback-a');
        expect(cyberback?.attachedActions.map(action => action.uid)).toContain('evo-a');
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('evo-a');
    });

    it('电子猿：赛博守护者从弃牌堆打行动时拒绝非持续附着行动和伪造目标', () => {
        const baseCore = {
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('evo-a', 'cyborg_apes_cyberevolution', 'action', '0'),
                        makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('own-cyberback', 'cyborg_apes_cyberback', '0', 5),
                makeMinion('own-other', 'sharks_mako', '0', 2),
                makeMinion('enemy-cyberback', 'cyborg_apes_cyberback', '1', 5),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const standardAction = runCommand(makeMatchState(baseCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'bananas-a',
                targetBaseIndex: 0,
                targetMinionUid: 'own-cyberback',
                fromDiscard: true,
            },
        } as any);
        expect(standardAction.success).toBe(false);

        const enemyCyberback = runCommand(makeMatchState(baseCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'evo-a',
                targetBaseIndex: 0,
                targetMinionUid: 'enemy-cyberback',
                fromDiscard: true,
            },
        } as any);
        expect(enemyCyberback.success).toBe(false);

        const nonCyberback = runCommand(makeMatchState(baseCore), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'evo-a',
                targetBaseIndex: 0,
                targetMinionUid: 'own-other',
                fromDiscard: true,
            },
        } as any);
        expect(nonCyberback.success).toBe(false);

        expect(baseCore.players['0'].discard.map(card => card.uid)).toEqual(['evo-a', 'bananas-a']);
    });

    it('电子猿：borrowed Going Bananas 应按控制者而不是真实 owner 移除其他玩家控制的基地与附着行动', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_monkey_lab',
                ongoingActions: [
                    { uid: 'base-own-borrowed', defId: 'time_travelers_stasis_field', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                    { uid: 'base-other-borrowed', defId: 'super_spies_mindraker', ownerId: '0', metadata: { sourceControllerId: '1' } } as any,
                ],
                minions: [makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'attached-own-borrowed', defId: 'cyborg_apes_cyberevolution', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                        { uid: 'attached-other-borrowed', defId: 'shapeshifters_splice_as_nice', ownerId: '0', metadata: { sourceControllerId: '1' } } as any,
                    ],
                })],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bananas-a', targetBaseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.bases[0].ongoingActions.map(action => action.uid)).toEqual(['base-own-borrowed']);
        expect(result.finalState.core.bases[0].minions.find(minion => minion.uid === 'host')?.attachedActions.map(action => action.uid)).toEqual(['attached-own-borrowed']);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toContain('base-other-borrowed');
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toContain('attached-other-borrowed');
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).not.toContain('base-own-borrowed');
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).not.toContain('attached-own-borrowed');
    });

    it('电子猿：护盾打出时摧毁该仆从上其他玩家的行动并保留己方行动', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('shield-a', 'cyborg_apes_shielding', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'own-existing', defId: 'cyborg_apes_juiced_up', ownerId: '0' },
                        { uid: 'other-existing', defId: 'shapeshifters_splice_as_nice', ownerId: '1' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'shield-a', targetBaseIndex: 0, targetMinionUid: 'host' },
        } as any);

        expect(result.success).toBe(true);
        const host = result.finalState.core.bases[0].minions.find(minion => minion.uid === 'host');
        expect(host?.attachedActions.map(action => action.uid)).toEqual(['own-existing', 'shield-a']);
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toContain('other-existing');
    });

    it('电子猿：borrowed 护盾应按控制者而不是真实 owner 摧毁宿主上其他玩家控制的行动', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('shield-a', 'cyborg_apes_shielding', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'own-borrowed', defId: 'cyborg_apes_juiced_up', ownerId: '1', metadata: { sourceControllerId: '0' } } as any,
                        { uid: 'other-borrowed', defId: 'shapeshifters_splice_as_nice', ownerId: '0', metadata: { sourceControllerId: '1' } } as any,
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'shield-a', targetBaseIndex: 0, targetMinionUid: 'host' },
        } as any);

        expect(result.success).toBe(true);
        const host = result.finalState.core.bases[0].minions.find(minion => minion.uid === 'host');
        expect(host?.attachedActions.map(action => action.uid)).toEqual(['own-borrowed', 'shield-a']);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toContain('other-borrowed');
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).not.toContain('own-borrowed');
    });

    it('电子猿：护盾持续保护宿主上的其他行动不受对手行动影响', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                        { uid: 'protected-action', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bananas-a', targetBaseIndex: 0 },
        } as any);

        expect(result.success).toBe(true);
        const host = result.finalState.core.bases[0].minions.find(minion => minion.uid === 'host');
        expect(host?.attachedActions.map(action => action.uid)).toEqual(['protected-action']);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toContain('shield-a');
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('protected-action');
    });

    it('电子猿：护盾被前置不同来源事件移除后，不应继续保护随后离场的同宿主其他行动', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                        { uid: 'protected-action', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const filtered = filterProtectedAffectEvents([
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'shield-a',
                    defId: 'cyborg_apes_shielding',
                    ownerId: '0',
                    reason: 'time_travelers_time_walk',
                    sourcePlayerId: '0',
                    sourceCardUid: 'walk-a',
                    sourceDefId: 'time_travelers_time_walk',
                    sourceControllerId: '0',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            } as any,
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'protected-action',
                    defId: 'cyborg_apes_cyberevolution',
                    ownerId: '0',
                    reason: 'cyborg_apes_going_bananas',
                    sourcePlayerId: '1',
                    sourceCardUid: 'bananas-a',
                    sourceDefId: 'cyborg_apes_going_bananas',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1001,
            } as any,
        ], core as any, '1');

        expect(filtered.map(event => (event as any).payload?.cardUid)).toEqual(['shield-a', 'protected-action']);
    });

    it('电子猿：borrowed attached action 因保护被拦截附着时，应回真实 owner 弃牌并保留 sourceControllerId', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('protected-host', 'sharks_mako', '1', 3, {
                    attachedActions: [
                        { uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '1' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const filtered = filterProtectedAffectEvents([
            {
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: {
                    cardUid: 'borrowed-evo',
                    defId: 'cyborg_apes_cyberevolution',
                    ownerId: '1',
                    sourcePlayerId: '0',
                    targetType: 'minion',
                    targetBaseIndex: 0,
                    targetMinionUid: 'protected-host',
                },
                timestamp: 1000,
            } as any,
        ], core as any, '0');

        const blockedAttachDetach = filtered.find((event: any) =>
            event.type === SU_EVENTS.ONGOING_DETACHED
            && event.payload?.cardUid === 'borrowed-evo',
        ) as any;
        expect(blockedAttachDetach?.payload).toEqual(expect.objectContaining({
            cardUid: 'borrowed-evo',
            defId: 'cyborg_apes_cyberevolution',
            ownerId: '1',
            reason: 'cyborg_apes_cyberevolution_blocked_attach',
            sourcePlayerId: '0',
            sourceCardUid: 'borrowed-evo',
            sourceDefId: 'cyborg_apes_cyberevolution',
            sourceControllerId: '0',
            sourceBaseIndex: 0,
        }));

        const final = applyEvents(core as any, filtered);
        expect(final.players['1'].discard.map((card: any) => card.uid)).toContain('borrowed-evo');
        expect(final.players['0'].discard.map((card: any) => card.uid)).not.toContain('borrowed-evo');
    });

    it('电子猿：护盾被前置不同来源事件移除后，不应继续保护随后移动的宿主', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [
                makeBase('base_monkey_lab', [
                    makeMinion('host', 'sharks_mako', '0', 2, {
                        attachedActions: [{ uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' }],
                    }),
                ]),
                makeBase('base_faceless_city', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const filtered = filterProtectedMoveEvents([
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'shield-a',
                    defId: 'cyborg_apes_shielding',
                    ownerId: '0',
                    reason: 'time_travelers_time_walk',
                    sourcePlayerId: '0',
                    sourceCardUid: 'walk-a',
                    sourceDefId: 'time_travelers_time_walk',
                    sourceControllerId: '0',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            } as any,
            {
                type: SU_EVENTS.MINION_MOVED,
                payload: {
                    minionUid: 'host',
                    fromBaseIndex: 0,
                    toBaseIndex: 1,
                    reason: 'bear_cavalry_bear_hug',
                    sourcePlayerId: '1',
                    sourceCardUid: 'hug-a',
                    sourceDefId: 'bear_cavalry_bear_hug',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1001,
            } as any,
        ], core as any, '1');

        expect(filtered.map(event => event.type)).toEqual([
            SU_EVENTS.ONGOING_DETACHED,
            SU_EVENTS.MINION_MOVED,
        ]);
    });

    it('电子猿：护盾被前置不同来源事件移除后，不应继续保护随后被消灭的宿主', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const filtered = filterProtectedDestroyEvents([
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'shield-a',
                    defId: 'cyborg_apes_shielding',
                    ownerId: '0',
                    reason: 'time_travelers_time_walk',
                    sourcePlayerId: '0',
                    sourceCardUid: 'walk-a',
                    sourceDefId: 'time_travelers_time_walk',
                    sourceControllerId: '0',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            } as any,
            {
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: 'host',
                    fromBaseIndex: 0,
                    ownerId: '0',
                    controllerId: '0',
                    destroyerId: '1',
                    reason: 'sharks_blood_in_the_water',
                    sourcePlayerId: '1',
                    sourceCardUid: 'blood-a',
                    sourceDefId: 'sharks_blood_in_the_water',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1001,
            } as any,
        ], core as any, '1');

        expect(filtered.map(event => event.type)).toEqual([
            SU_EVENTS.ONGOING_DETACHED,
            SU_EVENTS.MINION_DESTROYED,
        ]);
    });

    it('电子猿：护盾被前置不同来源事件移除后，不应继续保护随后回手的宿主', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const filtered = filterProtectedReturnEvents([
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'shield-a',
                    defId: 'cyborg_apes_shielding',
                    ownerId: '0',
                    reason: 'time_travelers_time_walk',
                    sourcePlayerId: '0',
                    sourceCardUid: 'walk-a',
                    sourceDefId: 'time_travelers_time_walk',
                    sourceControllerId: '0',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            } as any,
            {
                type: SU_EVENTS.MINION_RETURNED,
                payload: {
                    minionUid: 'host',
                    minionDefId: 'sharks_mako',
                    fromBaseIndex: 0,
                    toPlayerId: '0',
                    reason: 'alien_beam_up',
                    sourcePlayerId: '1',
                    sourceCardUid: 'beam-a',
                    sourceDefId: 'alien_beam_up',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1001,
            } as any,
        ], core as any, '1');

        expect(filtered.map(event => event.type)).toEqual([
            SU_EVENTS.ONGOING_DETACHED,
            SU_EVENTS.MINION_RETURNED,
        ]);
    });

    it('电子猿：护盾被前置不同来源事件移除后，不应继续保护随后放到牌库底的宿主', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const filtered = filterProtectedDeckBottomEvents([
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'shield-a',
                    defId: 'cyborg_apes_shielding',
                    ownerId: '0',
                    reason: 'time_travelers_time_walk',
                    sourcePlayerId: '0',
                    sourceCardUid: 'walk-a',
                    sourceDefId: 'time_travelers_time_walk',
                    sourceControllerId: '0',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            } as any,
            {
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: 'host',
                    defId: 'sharks_mako',
                    ownerId: '0',
                    reason: 'samurai_way_of_the_warrior',
                    sourcePlayerId: '1',
                    sourceCardUid: 'warrior-a',
                    sourceDefId: 'samurai_way_of_the_warrior',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1001,
            } as any,
        ], core as any, '1');

        expect(filtered.map(event => event.type)).toEqual([
            SU_EVENTS.ONGOING_DETACHED,
            SU_EVENTS.CARD_TO_DECK_BOTTOM,
        ]);
    });

    it('电子猿：护盾被前置不同来源事件移除后，不应继续保护随后放到牌库顶的宿主', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const filtered = filterProtectedDeckBottomEvents([
            {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'shield-a',
                    defId: 'cyborg_apes_shielding',
                    ownerId: '0',
                    reason: 'time_travelers_time_walk',
                    sourcePlayerId: '0',
                    sourceCardUid: 'walk-a',
                    sourceDefId: 'time_travelers_time_walk',
                    sourceControllerId: '0',
                    sourceBaseIndex: 0,
                },
                timestamp: 1000,
            } as any,
            {
                type: SU_EVENTS.CARD_TO_DECK_TOP,
                payload: {
                    cardUid: 'host',
                    defId: 'sharks_mako',
                    ownerId: '0',
                    reason: 'mythic_greeks_audience_participation',
                    sourcePlayerId: '1',
                    sourceCardUid: 'audience-a',
                    sourceDefId: 'mythic_greeks_audience_participation',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 1001,
            } as any,
        ], core as any, '1');

        expect(filtered.map(event => event.type)).toEqual([
            SU_EVENTS.ONGOING_DETACHED,
            SU_EVENTS.CARD_TO_DECK_TOP,
        ]);
    });

    it('变形者：细胞结合复制护盾后在原护盾离场后仍保护宿主其他行动，但不应错误保护自己', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '1'),
                        makeCard('bananas-b', 'cyborg_apes_going_bananas', 'action', '1'),
                    ],
                    actionLimit: 2,
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'cell-a', defId: 'shapeshifters_cellular_bonding', ownerId: '0' },
                        { uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' },
                        { uid: 'protected-action', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                    ],
                    metadata: {
                        cellularBondingCardUid: 'cell-a',
                        cellularBondingCopiedActionDefId: 'cyborg_apes_shielding',
                    },
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const first = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bananas-a', targetBaseIndex: 0 },
        } as any);

        expect(first.success).toBe(true);
        const hostAfterFirst = first.finalState.core.bases[0].minions.find(minion => minion.uid === 'host');
        expect(hostAfterFirst?.attachedActions.map(action => action.uid)).toEqual(['cell-a', 'protected-action']);
        expect(first.finalState.core.players['0'].discard.map(card => card.uid)).toContain('shield-a');
        expect(first.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('cell-a');
        expect(first.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('protected-action');

        const second = runCommand(first.finalState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bananas-b', targetBaseIndex: 0 },
        } as any);

        expect(second.success).toBe(true);
        const hostAfterSecond = second.finalState.core.bases[0].minions.find(minion => minion.uid === 'host');
        expect(hostAfterSecond?.attachedActions.map(action => action.uid)).toEqual(['protected-action']);
        expect(second.finalState.core.players['0'].discard.map(card => card.uid)).toContain('shield-a');
        expect(second.finalState.core.players['0'].discard.map(card => card.uid)).toContain('cell-a');
        expect(second.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('protected-action');
    });

    it('电子猿基地：猴子实验室按每个随从身上的行动数量给该随从加力量', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('one-action', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'action-a', defId: 'cyborg_apes_shielding', ownerId: '0' }],
                }),
                makeMinion('two-actions', 'sharks_mako', '1', 2, {
                    attachedActions: [
                        { uid: 'action-b', defId: 'cyborg_apes_shielding', ownerId: '1' },
                        { uid: 'action-c', defId: 'cyborg_apes_missing_uplink', ownerId: '1' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const [oneAction, twoActions] = core.bases[0].minions;

        expect(getEffectivePower(core, oneAction, 0)).toBe(3);
        expect(getEffectivePower(core, twoActions, 0)).toBe(4);
    });

    it('电子猿基地：灵长公园阻止这里随从身上的行动在离场时被 Clyde 2.0 收回手牌', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_primate_park', [
                makeMinion('clyde', 'cyborg_apes_clyde_2_0', '0', 4),
                makeMinion('host', 'cyborg_apes_furious_george', '0', 2, {
                    attachedActions: [{ uid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const final = applyEvents(core, [{
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: { cardUid: 'shield-a', defId: 'cyborg_apes_shielding', ownerId: '0', reason: 'test' },
            timestamp: 1000,
        } as any]);

        expect(final.players['0'].hand.map(card => card.uid)).not.toContain('shield-a');
        expect(final.players['0'].discard.map(card => card.uid)).toContain('shield-a');
    });

    it('超级间谍：杀戮许可展示对手牌库顶并自动弃掉所有随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-permit', 'super_spies_permit_to_kill', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('weak', 'sharks_mako', 'minion', '1'),
                        makeCard('safe', 'cyborg_apes_going_bananas', 'action', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-permit' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.sys.interaction.current).toBeUndefined();
        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_MILLED && (event as any).payload?.cardUids?.includes('weak'))).toBe(true);
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toContain('weak');
        expect(result.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['safe']);
    });

    it('超级间谍：杀戮许可让施放者按任意顺序放回非随从展示牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-permit', 'super_spies_permit_to_kill', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('safe-a', 'cyborg_apes_going_bananas', 'action', '1'),
                        makeCard('safe-b', 'time_travelers_time_is_fleeting', 'action', '1'),
                        makeCard('deck-rest', 'sharks_mako', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-permit' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.sys.interaction.current?.data?.sourceId).toBe('super_spies_permit_to_kill_order');

        const resolved = resolveInteractionChain(result.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate =>
                candidate.value?.targetPlayerId === '1'
                && candidate.value?.topUids?.join(',') === 'safe-b,safe-a',
            );
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['safe-b', 'safe-a', 'deck-rest']);
    });

    it('超级间谍：杀戮许可遇到空牌库或单张展示时不应创建多余排序 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-permit', 'super_spies_permit_to_kill', 'action', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2', {
                    deck: [
                        makeCard('p2-only-action', 'super_spies_from_q_with_love', 'action', '2'),
                    ],
                }),
                '3': makePlayer('3', {
                    deck: [
                        makeCard('p3-only-minion', 'time_travelers_time_raider', 'minion', '3'),
                    ],
                }),
            },
            turnOrder: ['0', '1', '2', '3'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-permit' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.sys.interaction.current).toBeUndefined();
        expect(result.finalState.core.players['1'].deck).toEqual([]);
        expect(result.finalState.core.players['2'].deck.map(card => card.uid)).toEqual(['p2-only-action']);
        expect(result.finalState.core.players['3'].deck).toEqual([]);
        expect(result.finalState.core.players['3'].discard.map(card => card.uid)).toEqual(['p3-only-minion']);
    });

    it('超级间谍：杀戮许可在四人局中应依次处理每位其他玩家的展示牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-permit', 'super_spies_permit_to_kill', 'action', '0')],
                    deck: [makeCard('p0-untouched', 'super_spies_spy', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-action-a', 'cyborg_apes_going_bananas', 'action', '1'),
                        makeCard('p1-action-b', 'time_travelers_time_is_fleeting', 'action', '1'),
                        makeCard('p1-rest', 'super_spies_for_my_eyes_only', 'action', '1'),
                    ],
                }),
                '2': makePlayer('2', {
                    deck: [
                        makeCard('p2-action-a', 'super_spies_mindraker', 'action', '2'),
                        makeCard('p2-action-b', 'super_spies_from_q_with_love', 'action', '2'),
                        makeCard('p2-rest', 'time_travelers_time_walk', 'action', '2'),
                    ],
                }),
                '3': makePlayer('3', {
                    deck: [
                        makeCard('p3-action-a', 'cyborg_apes_cyberevolution', 'action', '3'),
                        makeCard('p3-action-b', 'super_spies_live_and_let_chum', 'action', '3'),
                        makeCard('p3-rest', 'sharks_mako', 'minion', '3'),
                    ],
                }),
            },
            turnOrder: ['0', '1', '2', '3'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-permit' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.sys.interaction.current?.data?.sourceId).toBe('super_spies_permit_to_kill_order');
        expect(result.finalState.sys.interaction.current?.data?.targetPlayerId).toBe('1');
        expect(result.finalState.sys.interaction.queue.map(prompt => prompt.data?.targetPlayerId)).toEqual(['2', '3']);

        const seenTargetPlayers: string[] = [];
        const resolved = resolveInteractionChain(result.finalState, prompt => {
            const targetPlayerId = prompt?.data?.targetPlayerId as string | undefined;
            if (!targetPlayerId) throw new Error(`未处理的 Permit to Kill 交互：${prompt?.data?.sourceId ?? 'unknown'}`);
            seenTargetPlayers.push(targetPlayerId);

            const expectedTop = targetPlayerId === '1'
                ? 'p1-action-b,p1-action-a'
                : targetPlayerId === '2'
                    ? 'p2-action-b,p2-action-a'
                    : 'p3-action-b,p3-action-a';
            const option = findInteractionOption(prompt, candidate =>
                candidate.value?.targetPlayerId === targetPlayerId
                && candidate.value?.topUids?.join(',') === expectedTop,
            );
            return { optionId: option.id };
        });

        expect(seenTargetPlayers).toEqual(['1', '2', '3']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-untouched']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['a-permit']);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-action-b', 'p1-action-a', 'p1-rest']);
        expect(resolved.finalState.core.players['2'].deck.map(card => card.uid)).toEqual(['p2-action-b', 'p2-action-a', 'p2-rest']);
        expect(resolved.finalState.core.players['3'].deck.map(card => card.uid)).toEqual(['p3-action-b', 'p3-action-a', 'p3-rest']);
    });

    it('超级间谍：杀戮许可排序 handler 拒绝夹带未展示的牌库牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-permit', 'super_spies_permit_to_kill', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('safe-a', 'cyborg_apes_going_bananas', 'action', '1'),
                        makeCard('safe-b', 'time_travelers_time_is_fleeting', 'action', '1'),
                        makeCard('deck-rest', 'super_spies_from_q_with_love', 'action', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-permit' },
        } as any);

        expect(result.success).toBe(true);
        const prompt = result.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('super_spies_permit_to_kill_order');

        const forgedState = {
            ...result.finalState,
            sys: {
                ...result.finalState.sys,
                interaction: {
                    ...result.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                {
                                    id: 'forged-unrevealed-card',
                                    label: 'forged unrevealed',
                                    value: { targetPlayerId: '1', topUids: ['deck-rest', 'safe-a'], bottomUids: [] },
                                },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-unrevealed-card' },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['safe-a', 'safe-b', 'deck-rest']);
    });

    it('超级间谍：杀戮许可不会让高力量随从回到牌库顶', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-permit', 'super_spies_permit_to_kill', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('strong-a', 'sharks_great_white', 'minion', '1'),
                        makeCard('strong-b', 'time_travelers_time_raider', 'minion', '1'),
                        makeCard('deck-rest', 'cyborg_apes_going_bananas', 'action', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-permit' },
        } as any);

        expect(result.success).toBe(true);
        const resolved = resolveInteractionChain(result.finalState, (prompt) => {
            const option = findInteractionOption(prompt, candidate =>
                candidate.value?.targetPlayerId === '1'
                && candidate.value?.discardUids?.join(',') === 'strong-a,strong-b'
                && candidate.value?.topUids?.length === 0,
            );
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['strong-a', 'strong-b']);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['deck-rest']);
    });

    it('超级间谍：抛弃我的间谍让其他玩家自己选择要弃的随从牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('spy-action-a', 'super_spies_the_spy_who_ditched_me', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('minion-a', 'sharks_mako', 'minion', '1'),
                        makeCard('minion-b', 'sharks_hammerhead', 'minion', '1'),
                    ],
                }),
                '2': makePlayer('2', {
                    hand: [makeCard('action-only', 'super_spies_for_my_eyes_only', 'action', '2')],
                }),
            },
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'spy-action-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.playerId).toBe('1');
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('super_spies_the_spy_who_ditched_me_discard');
        expect(played.events.some(event =>
            event.type === SU_EVENTS.REVEAL_HAND
            && (event as any).payload?.targetPlayerId === '2'
            && (event as any).payload?.cards?.[0]?.uid === 'action-only',
        )).toBe(true);

        const resolved = resolveInteractionChain(played.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'minion-b');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['minion-b']);
        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['minion-a']);
    });

    it('超级间谍：抛弃我的间谍真实入口遇到唯一随从时应自动弃掉且不弹弃牌 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('spy-action-a', 'super_spies_the_spy_who_ditched_me', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('single-minion', 'sharks_mako', 'minion', '1')],
                }),
                '2': makePlayer('2', {
                    hand: [makeCard('action-only', 'super_spies_for_my_eyes_only', 'action', '2')],
                }),
            },
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'spy-action-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.finalState.core.players['1'].hand.map(card => card.uid)).toEqual([]);
        expect(played.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['single-minion']);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.REVEAL_HAND
            && (event as any).payload?.targetPlayerId === '2'
            && (event as any).payload?.cards?.[0]?.uid === 'action-only',
        )).toBe(true);
    });

    it('超级间谍：抛弃我的间谍弃随从 handler 拒绝非本次候选的晚加入随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('spy-action-a', 'super_spies_the_spy_who_ditched_me', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('minion-a', 'sharks_mako', 'minion', '1'),
                        makeCard('minion-b', 'sharks_hammerhead', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'spy-action-a' },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('super_spies_the_spy_who_ditched_me_discard');

        const forgedState = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                players: {
                    ...played.finalState.core.players,
                    '1': {
                        ...played.finalState.core.players['1'],
                        hand: [
                            ...played.finalState.core.players['1'].hand,
                            makeCard('late-minion', 'time_travelers_time_raider', 'minion', '1'),
                        ],
                    },
                },
            },
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-minion', label: 'forged late minion', value: { cardUid: 'late-minion' } },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '1',
            payload: { optionId: 'forged-late-minion' },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.players['1'].hand.map(card => card.uid)).toEqual(['minion-a', 'minion-b', 'late-minion']);
        expect(forged.finalState.core.players['1'].discard.map(card => card.uid)).toEqual([]);
    });

    it('超级间谍：让对手鱼饵在多个低力量随从中按玩家选择摧毁目标', () => {
        const core = {
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [
                makeMinion('low-a', 'sharks_mako', '0', 2),
                makeMinion('low-b', 'sharks_hammerhead', '1', 3),
                makeMinion('high-c', 'sharks_megalodon', '1', 5),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const special = resolveSpecial('super_spies_live_and_let_chum');
        expect(special).toBeTruthy();
        const result = special!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'live-a',
            defId: 'super_spies_live_and_let_chum',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: () => 0.5,
            now: 1000,
        } as any);

        expect(result.matchState?.sys.interaction.current?.data?.sourceId).toBe('super_spies_live_and_let_chum_choose');
        expect(findInteractionOption(result.matchState?.sys.interaction.current, candidate => candidate.value?.minionUid === 'high-c')).toBeUndefined();
        const resolved = resolveInteractionChain(result.matchState!, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'low-b');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['low-a', 'high-c']);
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).toContain('low-b');

        const prompt = result.matchState!.sys.interaction.current!;
        const forgedState = {
            ...result.matchState!,
            core: {
                ...result.matchState!.core,
                bases: [{
                    ...result.matchState!.core.bases[0],
                    minions: [
                        ...result.matchState!.core.bases[0].minions,
                        makeMinion('late-low', 'sharks_mako', '1', 2),
                    ],
                }],
            },
            sys: {
                ...result.matchState!.sys,
                interaction: {
                    ...result.matchState!.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-low', label: 'forged late low', value: { minionUid: 'late-low' } },
                            ],
                        },
                    },
                },
            },
        };
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-low' },
        } as any);
        expect(forged.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('late-low');
        expect(forged.finalState.core.players['1'].discard.map(card => card.uid)).not.toContain('late-low');
    });

    it('超级间谍：让对手鱼饵选择受 Shell Game 保护的低力量宿主时不应摧毁该宿主', () => {
        const core = {
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [
                makeMinion('shell-host', 'shapeshifters_copycat', '1', 3, {
                    attachedActions: [{ uid: 'shell-a', defId: 'shapeshifters_shell_game', ownerId: '1' }],
                }),
                makeMinion('low-b', 'time_travelers_time_raider', '1', 3),
                makeMinion('high-c', 'cyborg_apes_silverback', '1', 5),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const special = resolveSpecial('super_spies_live_and_let_chum');
        expect(special).toBeTruthy();
        const result = special!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'live-a',
            defId: 'super_spies_live_and_let_chum',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: () => 0.5,
            now: 1000,
        } as any);

        const prompt = result.matchState?.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('super_spies_live_and_let_chum_choose');
        expect(findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'shell-host')).toBeTruthy();
        expect(findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'low-b')).toBeTruthy();
        expect(findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'high-c')).toBeUndefined();

        const resolved = resolveInteractionChain(result.matchState!, currentPrompt => {
            const option = findInteractionOption(currentPrompt, candidate => candidate.value?.minionUid === 'shell-host');
            expect(option).toBeTruthy();
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['shell-host', 'low-b', 'high-c']);
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).not.toContain('shell-host');
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.MINION_DESTROYED
            && (event as any).payload?.minionUid === 'shell-host',
        )).toBe(false);
    });

    it('超级间谍：基地永远不够在多个低力量随从中按玩家选择控制目标', () => {
        const core = {
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [
                makeMinion('low-a', 'sharks_mako', '1', 2),
                makeMinion('low-b', 'sharks_hammerhead', '1', 3),
                makeMinion('high-c', 'sharks_megalodon', '1', 5),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const special = resolveSpecial('super_spies_the_base_is_not_enough');
        expect(special).toBeTruthy();
        const result = special!({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'base-a',
            defId: 'super_spies_the_base_is_not_enough',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: () => 0.5,
            now: 1000,
        } as any);

        expect(result.matchState?.sys.interaction.current?.data?.sourceId).toBe('super_spies_the_base_is_not_enough_choose');
        expect(findInteractionOption(result.matchState?.sys.interaction.current, candidate => candidate.value?.minionUid === 'high-c')).toBeUndefined();
        const resolved = resolveInteractionChain(result.matchState!, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'low-b');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'low-b')?.controller).toBe('0');
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'low-a')?.controller).toBe('1');
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.MINION_METADATA_UPDATED
            && (event as any).payload?.reason === 'super_spies_the_base_is_not_enough',
        )).toBe(true);

        const afterTurnEnd = applyEvents(resolved.finalState.core, [{
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '0', nextPlayerIndex: 1 },
            timestamp: 1001,
        } as any]);
        expect(afterTurnEnd.bases[0].minions.find(minion => minion.uid === 'low-b')?.controller).toBe('1');

        const prompt = result.matchState!.sys.interaction.current!;
        const forgedState = {
            ...result.matchState!,
            core: {
                ...result.matchState!.core,
                bases: [{
                    ...result.matchState!.core.bases[0],
                    minions: [
                        ...result.matchState!.core.bases[0].minions,
                        makeMinion('late-low', 'sharks_mako', '1', 2),
                    ],
                }],
            },
            sys: {
                ...result.matchState!.sys,
                interaction: {
                    ...result.matchState!.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-low', label: 'forged late low', value: { minionUid: 'late-low' } },
                            ],
                        },
                    },
                },
            },
        };
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-low' },
        } as any);
        expect(forged.finalState.core.bases[0].minions.find(minion => minion.uid === 'late-low')?.controller).toBe('1');
    });

    it('超级间谍：间谍查看牌库顶三张后由玩家选择顶/底顺序', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('spy-a', 'super_spies_spy', 'minion', '0')],
                    deck: [
                        makeCard('deck-a', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-c', 'sharks_tiger_shark', 'minion', '0'),
                        makeCard('deck-d', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'spy-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('super_spies_spy_reorder');

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            const option = findInteractionOption(prompt, candidate =>
                candidate.value?.topUids?.join(',') === 'deck-b'
                && candidate.value?.bottomUids?.join(',') === 'deck-c,deck-a',
            );
            return { optionId: option.id };
        });

        expect(resolved.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-b',
            'deck-d',
            'deck-c',
            'deck-a',
        ]);
    });

    it('超级间谍：间谍重排 handler 拒绝把未查看牌伪造成已查看牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('spy-a', 'super_spies_spy', 'minion', '0')],
                    deck: [
                        makeCard('deck-a', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-c', 'sharks_tiger_shark', 'minion', '0'),
                        makeCard('deck-d', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'spy-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('super_spies_spy_reorder');
        expect(prompt?.data?.inspectedUids).toEqual(['deck-a', 'deck-b', 'deck-c']);

        const handler = getInteractionHandler('super_spies_spy_reorder');
        const handled = handler?.(
            played.finalState,
            '0',
            { targetPlayerId: '0', topUids: ['deck-d'], bottomUids: ['deck-a', 'deck-b'] },
            prompt?.data,
            () => 0.5,
            1001,
        );

        expect(handled?.events).toEqual([]);
    });

    it('超级间谍：间谍只有一张牌时应自动查看且不弹重排 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('spy-a', 'super_spies_spy', 'minion', '0')],
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'spy-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a']);
    });

    it('超级间谍：间谍牌库为空时不应创建重排 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('spy-a', 'super_spies_spy', 'minion', '0')],
                    deck: [],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'spy-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([]);
    });

    it('超级间谍：密探先选择任意数量玩家，只能操作已展示玩家的顶牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('operative-a', 'super_spies_operative', 'minion', '0')],
                    deck: [
                        makeCard('p0-top', 'sharks_mako', 'minion', '0'),
                        makeCard('p0-next', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-top', 'sharks_mako', 'minion', '1'),
                        makeCard('p1-next', 'sharks_hammerhead', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'operative-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('super_spies_operative_players');

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            if (prompt?.data?.sourceId === 'super_spies_operative_players') {
                const option = findInteractionOption(prompt, candidate => candidate.value?.targetPlayerId === '1');
                return { optionIds: [option.id] };
            }
            expect(prompt?.data?.sourceId).toBe('super_spies_operative_top_bottom');
            expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'p0-top')).toBeUndefined();
            const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'p1-top');
            return { optionIds: [option.id] };
        });

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-top', 'p0-next']);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-next', 'p1-top']);

        const playerPrompt = played.finalState.sys.interaction.current!;
        const p1Option = findInteractionOption(playerPrompt, candidate => candidate.value?.targetPlayerId === '1');
        const missingAllowedState = {
            ...played.finalState,
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...playerPrompt,
                        data: {
                            ...playerPrompt.data,
                            allowedPlayerIds: undefined,
                        },
                    },
                },
            },
        };
        const missingAllowed = runCommand(missingAllowedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionIds: [p1Option.id] },
        } as any);

        expect(missingAllowed.success).toBe(true);
        expect(missingAllowed.events.some(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toBe(false);
        expect(missingAllowed.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-top', 'p1-next']);

        const playerHandler = getInteractionHandler('super_spies_operative_players');
        const duplicatePlayer = playerHandler?.(
            played.finalState,
            '0',
            [{ targetPlayerId: '1' }, { targetPlayerId: '1' }],
            playerPrompt.data,
            () => 0.5,
            1001,
        );
        expect(duplicatePlayer?.events).toEqual([]);
    });

    it('超级间谍：密探可以选择不展示任何玩家牌库', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('operative-a', 'super_spies_operative', 'minion', '0')],
                    deck: [makeCard('p0-top', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-top', 'sharks_mako', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'operative-a', baseIndex: 0 },
        } as any);

        const resolved = resolveInteractionChain(played.finalState, prompt => {
            expect(prompt?.data?.sourceId).toBe('super_spies_operative_players');
            return { optionIds: [] };
        });

        expect(resolved.events.some(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toBe(false);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-top']);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-top']);
        expect(resolved.finalState.sys.interaction.current).toBeUndefined();
    });

    it('超级间谍：密探放底 handler 拒绝重复伪造同一张展示牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('operative-a', 'super_spies_operative', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-top', 'sharks_mako', 'minion', '1'),
                        makeCard('p1-next', 'sharks_hammerhead', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'operative-a', baseIndex: 0 },
        } as any);

        const playerPrompt = played.finalState.sys.interaction.current!;
        const targetPlayerOption = findInteractionOption(playerPrompt, candidate => candidate.value?.targetPlayerId === '1');
        const revealed = runCommand(played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionIds: [targetPlayerOption.id] },
        } as any);

        const bottomPrompt = revealed.finalState.sys.interaction.current;
        expect(bottomPrompt?.data?.sourceId).toBe('super_spies_operative_top_bottom');
        expect(bottomPrompt?.data?.revealedByPlayer).toEqual({ '1': ['p1-top'] });

        const handler = getInteractionHandler('super_spies_operative_top_bottom');
        const handled = handler?.(
            revealed.finalState,
            '0',
            [
                { targetPlayerId: '1', cardUid: 'p1-top' },
                { targetPlayerId: '1', cardUid: 'p1-top' },
            ],
            bottomPrompt?.data,
            () => 0.5,
            1001,
        );

        expect(handled?.events).toEqual([]);

        const mixedInvalid = handler?.(
            revealed.finalState,
            '0',
            [
                { targetPlayerId: '1', cardUid: 'p1-top' },
                { targetPlayerId: '0', cardUid: 'p0-top' },
            ],
            bottomPrompt?.data,
            () => 0.5,
            1001,
        );

        expect(mixedInvalid?.events).toEqual([]);
    });

    it('超级间谍：只为我的眼睛允许把己方牌库顶五张拆分到顶/底并按非默认顺序排列', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('eyes-a', 'super_spies_for_my_eyes_only', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-c', 'sharks_tiger_shark', 'minion', '0'),
                        makeCard('deck-d', 'sharks_great_white', 'minion', '0'),
                        makeCard('deck-e', 'cyborg_apes_baboom', 'minion', '0'),
                        makeCard('deck-f', 'super_spies_spy', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'eyes-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('super_spies_for_my_eyes_only_reorder');

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            const option = findInteractionOption(prompt, candidate =>
                candidate.value?.topUids?.join(',') === 'deck-c,deck-a'
                && candidate.value?.bottomUids?.join(',') === 'deck-e,deck-b,deck-d',
            );
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-c',
            'deck-a',
            'deck-f',
            'deck-e',
            'deck-b',
            'deck-d',
        ]);
    });

    it('超级间谍：只为我的眼睛 handler 只接受本次查看的五张牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('eyes-a', 'super_spies_for_my_eyes_only', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-c', 'sharks_tiger_shark', 'minion', '0'),
                        makeCard('deck-d', 'sharks_great_white', 'minion', '0'),
                        makeCard('deck-e', 'cyborg_apes_baboom', 'minion', '0'),
                        makeCard('deck-f', 'super_spies_spy', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'eyes-a' },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('super_spies_for_my_eyes_only_reorder');
        expect(prompt?.data?.inspectedUids).toEqual(['deck-a', 'deck-b', 'deck-c', 'deck-d', 'deck-e']);

        const handler = getInteractionHandler('super_spies_for_my_eyes_only_reorder');
        const handled = handler?.(
            played.finalState,
            '0',
            { targetPlayerId: '0', topUids: ['deck-f'], bottomUids: ['deck-a', 'deck-b', 'deck-c', 'deck-d'] },
            prompt?.data,
            () => 0.5,
            1001,
        );

        expect(handled?.events).toEqual([]);
    });

    it('超级间谍：只为我的眼睛只有一张牌时应自动查看且不弹重排 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('eyes-a', 'super_spies_for_my_eyes_only', 'action', '0')],
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'eyes-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a']);
    });

    it('超级间谍：只为我的眼睛牌库为空时不应创建重排 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('eyes-a', 'super_spies_for_my_eyes_only', 'action', '0')],
                    deck: [],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'eyes-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([]);
    });

    it('超级间谍：来自Q的爱抽三张后允许选择旧手牌和新抽牌各一张弃掉', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('q-a', 'super_spies_from_q_with_love', 'action', '0'),
                        makeCard('old-hand', 'sharks_mako', 'minion', '0'),
                    ],
                    deck: [
                        makeCard('draw-a', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('draw-b', 'sharks_tiger_shark', 'minion', '0'),
                        makeCard('draw-c', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'q-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('super_spies_from_q_with_love_discard');

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            const oldHand = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'old-hand');
            const drawC = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'draw-c');
            return { optionIds: [oldHand.id, drawC.id] };
        });

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(
            expect.arrayContaining(['q-a', 'old-hand', 'draw-c']),
        );
    });

    it('超级间谍：来自Q的爱弃牌 handler 只能接受本次投影手牌且必须弃足数量', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('q-a', 'super_spies_from_q_with_love', 'action', '0'),
                        makeCard('old-hand', 'sharks_mako', 'minion', '0'),
                    ],
                    deck: [
                        makeCard('draw-a', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('draw-b', 'sharks_tiger_shark', 'minion', '0'),
                        makeCard('draw-c', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'q-a' },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('super_spies_from_q_with_love_discard');

        const handler = getInteractionHandler('super_spies_from_q_with_love_discard');
        const wrongCount = handler?.(
            played.finalState,
            '0',
            [{ cardUid: 'old-hand' }],
            prompt.data,
            () => 0.5,
            1001,
        );
        expect(wrongCount?.events).toEqual([]);

        const missingSnapshot = handler?.(
            played.finalState,
            '0',
            [{ cardUid: 'old-hand' }, { cardUid: 'draw-a' }],
            { ...prompt.data, allowedCardUids: undefined },
            () => 0.5,
            1001,
        );
        expect(missingSnapshot?.events).toEqual([]);

        const forgedState = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                players: {
                    ...played.finalState.core.players,
                    '0': {
                        ...played.finalState.core.players['0'],
                        hand: [
                            ...played.finalState.core.players['0'].hand,
                            makeCard('late-hand', 'time_travelers_time_walk', 'action', '0'),
                        ],
                    },
                },
            },
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-hand', label: 'forged late hand', value: { cardUid: 'late-hand' } },
                            ],
                        },
                    },
                },
            },
        };
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionIds: ['old-hand', 'forged-late-hand'] },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['old-hand', 'draw-a', 'draw-b', 'draw-c', 'late-hand']);
        expect(forged.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['q-a']);
    });

    it('超级间谍：来自Q的爱在投影手牌只剩一张时应只要求弃这一张', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('q-a', 'super_spies_from_q_with_love', 'action', '0'),
                        makeCard('old-hand', 'sharks_mako', 'minion', '0'),
                    ],
                    deck: [],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'q-a' },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('super_spies_from_q_with_love_discard');
        expect(prompt?.data?.multi).toEqual({ min: 1, max: 1 });
        expect(prompt?.data?.allowedCardUids).toEqual(['old-hand']);

        const resolved = runCommand(played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionIds: ['old-hand'] },
        } as any);

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.sys.interaction.current).toBeUndefined();
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([]);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(
            expect.arrayContaining(['q-a', 'old-hand']),
        );
    });

    it('超级间谍：来自Q的爱在投影手牌为空时不应创建弃牌 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('q-a', 'super_spies_from_q_with_love', 'action', '0')],
                    deck: [],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'q-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([]);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['q-a']);
    });

    it('超级间谍：弃牌永恒展示到随从为止并弃掉所有展示牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('forever-a', 'super_spies_discards_are_forever', 'action', '0')],
                    deck: [
                        makeCard('p0-action', 'cyborg_apes_going_bananas', 'action', '0'),
                        makeCard('p0-minion', 'sharks_mako', 'minion', '0'),
                        makeCard('p0-rest', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-action-a', 'super_spies_for_my_eyes_only', 'action', '1'),
                        makeCard('p1-action-b', 'cyborg_apes_cyberevolution', 'action', '1'),
                        makeCard('p1-minion', 'sharks_hammerhead', 'minion', '1'),
                        makeCard('p1-rest', 'sharks_mako', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'forever-a' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.events.filter(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toHaveLength(2);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['forever-a', 'p0-action', 'p0-minion']);
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-rest']);
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['p1-action-a', 'p1-action-b', 'p1-minion']);
        expect(result.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-rest']);
    });

    it('超级间谍：弃牌永恒在顶牌直接是随从时只弃掉这一张展示牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('forever-a', 'super_spies_discards_are_forever', 'action', '0')],
                    deck: [
                        makeCard('p0-minion', 'sharks_mako', 'minion', '0'),
                        makeCard('p0-rest', 'cyborg_apes_going_bananas', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-minion', 'sharks_hammerhead', 'minion', '1'),
                        makeCard('p1-rest', 'sharks_mako', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'forever-a' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.events.filter(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toHaveLength(2);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['forever-a', 'p0-minion']);
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-rest']);
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['p1-minion']);
        expect(result.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-rest']);
    });

    it('超级间谍：弃牌永恒遇到空牌库玩家时应跳过该玩家并继续处理其他玩家', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('forever-a', 'super_spies_discards_are_forever', 'action', '0')],
                    deck: [],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-action-a', 'cyborg_apes_cyberevolution', 'action', '1'),
                        makeCard('p1-minion', 'sharks_hammerhead', 'minion', '1'),
                        makeCard('p1-rest', 'sharks_mako', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'forever-a' },
        } as any);

        expect(result.success).toBe(true);
        const revealEvents = result.events.filter(event => event.type === SU_EVENTS.REVEAL_DECK_TOP) as any[];
        expect(revealEvents).toHaveLength(1);
        expect(revealEvents[0].payload.targetPlayerId).toBe('1');
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['forever-a']);
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['p1-action-a', 'p1-minion']);
        expect(result.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-rest']);
    });

    it('超级间谍：弃牌永恒在三人 turnOrder 下应依次处理每位玩家直到各自翻到首个随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('forever-a', 'super_spies_discards_are_forever', 'action', '0')],
                    deck: [
                        makeCard('p0-action-a', 'cyborg_apes_going_bananas', 'action', '0'),
                        makeCard('p0-minion', 'sharks_mako', 'minion', '0'),
                        makeCard('p0-rest', 'sharks_hammerhead', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-minion', 'sharks_hammerhead', 'minion', '1'),
                        makeCard('p1-rest', 'sharks_mako', 'minion', '1'),
                    ],
                }),
                '2': makePlayer('2', {
                    deck: [
                        makeCard('p2-action-a', 'time_travelers_time_walk', 'action', '2'),
                        makeCard('p2-action-b', 'cyborg_apes_cyberevolution', 'action', '2'),
                        makeCard('p2-minion', 'sharks_great_white', 'minion', '2'),
                        makeCard('p2-rest', 'sharks_mako', 'minion', '2'),
                    ],
                }),
            },
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'forever-a' },
        } as any);

        expect(result.success).toBe(true);
        const revealEvents = result.events.filter(event => event.type === SU_EVENTS.REVEAL_DECK_TOP) as any[];
        expect(revealEvents.map(event => event.payload.targetPlayerId)).toEqual(['0', '1', '2']);
        expect(result.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['forever-a', 'p0-action-a', 'p0-minion']);
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-rest']);
        expect(result.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['p1-minion']);
        expect(result.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-rest']);
        expect(result.finalState.core.players['2'].discard.map(card => card.uid)).toEqual(['p2-action-a', 'p2-action-b', 'p2-minion']);
        expect(result.finalState.core.players['2'].deck.map(card => card.uid)).toEqual(['p2-rest']);
    });

    it('超级间谍：心灵扳机只在该基地计分窗口阻止其他玩家向该基地打行动', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_isis_swingin_pad',
                minions: [],
                ongoingActions: [{ uid: 'mind-a', defId: 'super_spies_mindraker', ownerId: '0' }],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(isOperationRestricted(core, 0, '1', 'play_action')).toBe(false);
        expect(isOperationRestricted(core, 0, '1', 'play_action', { activationWindow: 'meFirst' })).toBe(true);
        expect(isOperationRestricted(core, 0, '0', 'play_action', { activationWindow: 'meFirst' })).toBe(false);
    });

    it('超级间谍：borrowed Mindraker 应按控制者而不是真实 owner 在计分窗口阻止其他玩家向该基地打行动', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_isis_swingin_pad',
                minions: [],
                ongoingActions: [{ uid: 'mind-borrowed', defId: 'super_spies_mindraker', ownerId: '1', metadata: { sourceControllerId: '0' } } as any],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(isOperationRestricted(core, 0, '1', 'play_action')).toBe(false);
        expect(isOperationRestricted(core, 0, '1', 'play_action', { activationWindow: 'meFirst' })).toBe(true);
        expect(isOperationRestricted(core, 0, '0', 'play_action', { activationWindow: 'meFirst' })).toBe(false);
    });

    it('超级间谍：同一基地上若同时有两张不同控制者的 Mindraker，不应因第一张同名来源而放行对手在计分窗口打行动', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_isis_swingin_pad',
                minions: [],
                ongoingActions: [
                    { uid: 'mind-p0', defId: 'super_spies_mindraker', ownerId: '0' },
                    { uid: 'mind-p1', defId: 'super_spies_mindraker', ownerId: '0', metadata: { sourceControllerId: '1' } } as any,
                ],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(isOperationRestricted(core, 0, '0', 'play_action')).toBe(false);
        expect(isOperationRestricted(core, 0, '0', 'play_action', { activationWindow: 'meFirst' })).toBe(true);
        expect(isOperationRestricted(core, 0, '1', 'play_action', { activationWindow: 'meFirst' })).toBe(true);
    });

    it('超级间谍：鼹鼠在计分窗口必须通过 ACTIVATE_SPECIAL 校验暴露真实响应入口', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_primate_park',
                breakpoint: 20,
                minions: [
                    makeMinion('mole-a', 'super_spies_mole', '0', 10),
                    makeMinion('anchor-a', 'time_travelers_doctor_when', '1', 10),
                ],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const state = makeMatchState(core);
        state.sys.phase = 'scoreBases';
        state.sys.responseWindow = {
            current: {
                id: 'mole-window',
                windowType: 'meFirst',
                sourceId: 'smashup_reaction_choose',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        } as any;

        const validation = validate(state, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { minionUid: 'mole-a', baseIndex: 0 },
        } as any);

        expect(validation.valid).toBe(true);
    });

    it('超级间谍：鼹鼠 before scoring 特技授予同基地立即额外特殊行动', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('mole-a', 'super_spies_mole', '0', 2),
                    makeMinion('target-a', 'sharks_mako', '1', 2, {
                        attachedActions: [{ uid: 'target-action', defId: 'cyborg_apes_shielding', ownerId: '1' }],
                    }),
                ]),
                makeBase('base_secret_volcano_headquarters', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const special = resolveSpecial('super_spies_mole');

        const result = special?.({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mole-a',
            defId: 'super_spies_mole',
            baseIndex: 0,
            random: () => 0.5,
            now: 1000,
        } as any);

        const limit = result?.events.find(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.limitType === 'action'
            && (event as any).payload?.reason === 'super_spies_mole');
        expect(limit).toBeTruthy();
        expect((limit as any).payload?.restrictToBase).toBe(0);
        expect((limit as any).payload?.specialActionWindow).toBe('meFirst');

        const prompted = queueImmediateExtraPlayInteractions(makeMatchState(core), result!.events as any);
        expect(prompted.sys.interaction.current?.data?.sourceId).toBe('smashup_immediate_extra_action');

        const resolved = resolveInteractionChain(prompted, prompt => {
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_action') {
                const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'bananas-a');
                return { optionId: option.id };
            }
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_action_base') {
                expect(findInteractionOption(prompt, candidate => candidate.value?.baseIndex === 1)).toBeUndefined();
                const option = findInteractionOption(prompt, candidate => candidate.value?.baseIndex === 0);
                return { optionId: option.id };
            }
            throw new Error(`未处理的 Mole 额外行动交互：${prompt?.data?.sourceId ?? 'unknown'}`);
        });

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('bananas-a');
        expect(resolved.finalState.core.bases[0].minions[1].attachedActions.map(action => action.uid)).toEqual([]);
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).toContain('target-action');
    });

    it('超级间谍：鼹鼠在真实计分窗口应把同基地的 Going Bananas 暴露为额外行动并继续基地目标链', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mole-bananas-hand', 'cyborg_apes_going_bananas', 'action', '0')],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_the_vats',
                    breakpoint: 18,
                    minions: [
                        makeMinion('mole-p0-anchor', 'time_travelers_jumper', '0', 6),
                        makeMinion('mole-special-a', 'super_spies_mole', '0', 4),
                        makeMinion('mole-p1-target', 'sharks_hammerhead', '1', 5, {
                            attachedActions: [{ uid: 'mole-target-action', defId: 'cyborg_apes_cyberevolution', ownerId: '1' }],
                        }),
                    ],
                }),
                makeBase('base_portal_room', []),
            ],
            baseDeck: ['base_the_nexus'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        const reactionPrompt = advance.finalState.sys.interaction.current;
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const moleOption = findInteractionOption(reactionPrompt, candidate =>
            candidate.value?.kind === 'activate_special'
            && candidate.value?.minionUid === 'mole-special-a'
            && candidate.value?.baseIndex === 0,
        );
        expect(moleOption).toBeTruthy();

        const afterMole = runCommand(advance.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: reactionPrompt!.playerId,
            payload: { optionId: moleOption.id },
            timestamp: 1001,
        } as any);

        expect(afterMole.success).toBe(true);
        const extraPrompt = afterMole.finalState.sys.interaction.current;
        expect(extraPrompt?.data?.sourceId).toBe('smashup_immediate_extra_action');

        const resolved = resolveInteractionChain(afterMole.finalState, prompt => {
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_action') {
                const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'mole-bananas-hand');
                expect(option).toBeTruthy();
                return { optionId: option.id };
            }
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_action_base') {
                expect(findInteractionOption(prompt, candidate => candidate.value?.baseIndex === 1)).toBeUndefined();
                const option = findInteractionOption(prompt, candidate => candidate.value?.baseIndex === 0);
                expect(option).toBeTruthy();
                return { optionId: option.id };
            }
            if (
                prompt?.data?.sourceId === 'smashup_reaction_choose'
                && prompt.resolutionFrameId?.startsWith('onMinionDiscardedFromBase:')
            ) {
                const triggerOption = findInteractionOption(prompt, candidate => candidate.value?.kind === 'trigger');
                expect(triggerOption).toBeTruthy();
                return { optionId: triggerOption.id };
            }
            throw new Error(`未处理的 Mole 真实计分窗口交互：${prompt?.data?.sourceId ?? 'unknown'}`);
        });
        let replayedCore = makeMatchState(core).core;
        let sawActionPlayed = false;
        for (const event of resolved.events) {
            replayedCore = reduce(replayedCore, event as any);
            if (event.type === SU_EVENTS.ACTION_PLAYED) {
                sawActionPlayed = true;
                expect(replayedCore.players['0'].hand.map(card => card.uid)).not.toContain('mole-bananas-hand');
            }
        }

        expect(sawActionPlayed).toBe(true);
        const finalized = advancePostScoringDelay(resolved.finalState, '0');
        expect(finalized.finalState.core.players['1'].discard.map(card => card.uid)).toContain('mole-target-action');
        expect(finalized.finalState.core.players['0'].vp).toBe(3);
        expect(finalized.finalState.core.players['1'].vp).toBe(1);
        expect(finalized.finalState.core.bases[0].defId).toBe('base_the_nexus');
    });

    it('超级间谍：鼹鼠额外特殊行动受 Mindraker 计分窗口禁令约束', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_isis_swingin_pad',
                ongoingActions: [{ uid: 'mindraker-a', defId: 'super_spies_mindraker', ownerId: '1' }],
                minions: [makeMinion('mole-a', 'super_spies_mole', '0', 2)],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const special = resolveSpecial('super_spies_mole');

        const result = special?.({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'mole-a',
            defId: 'super_spies_mole',
            baseIndex: 0,
            random: () => 0.5,
            now: 1000,
        } as any);

        const prompted = queueImmediateExtraPlayInteractions(makeMatchState(core), result!.events as any);
        const prompt = prompted.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('smashup_immediate_extra_action');
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'bananas-a')).toBeUndefined();
        expect(findInteractionOption(prompt, candidate => candidate.value?.skip === true)).toBeTruthy();
    });

    it('超级间谍：鼹鼠在真实计分窗口放弃额外行动后必须正常收口，且 Primate Park 只会正常清场不会把随从回手', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mind-bananas-hand', 'cyborg_apes_going_bananas', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase({
                    defId: 'base_primate_park',
                    breakpoint: 20,
                    minions: [
                        makeMinion('mind-p0-anchor', 'time_travelers_jumper', '0', 10),
                        makeMinion('mind-mole-a', 'super_spies_mole', '0', 2),
                        makeMinion('mind-p1-anchor', 'time_travelers_doctor_when', '1', 10),
                    ],
                    ongoingActions: [
                        { uid: 'mindraker-a', defId: 'super_spies_mindraker', ownerId: '1' },
                    ],
                }),
                makeBase('base_portal_room', []),
            ],
            baseDeck: ['base_the_nexus'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        const reactionPrompt = advance.finalState.sys.interaction.current;
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');

        const moleOption = findInteractionOption(reactionPrompt, candidate =>
            candidate.value?.kind === 'activate_special'
            && candidate.value?.minionUid === 'mind-mole-a'
            && candidate.value?.baseIndex === 0,
        );
        expect(moleOption).toBeTruthy();

        const afterMole = runCommand(advance.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: reactionPrompt!.playerId,
            payload: { optionId: moleOption.id },
            timestamp: 1001,
        } as any);

        expect(afterMole.success).toBe(true);
        const extraPrompt = afterMole.finalState.sys.interaction.current;
        expect(extraPrompt?.data?.sourceId).toBe('smashup_immediate_extra_action');
        expect(findInteractionOption(extraPrompt, candidate => candidate.value?.skip === true)).toBeTruthy();
        expect(findInteractionOption(extraPrompt, candidate => candidate.value?.cardUid === 'mind-bananas-hand')).toBeUndefined();

        const skipOption = findInteractionOption(extraPrompt, candidate => candidate.value?.skip === true);
        const skipped = runCommand(afterMole.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: extraPrompt!.playerId,
            payload: { optionId: skipOption.id },
            timestamp: 1002,
        } as any);

        expect(skipped.success).toBe(true);
        const nestedPrompt = skipped.finalState.sys.interaction.current;
        expect(nestedPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
        expect(nestedPrompt?.resolutionFrameId?.startsWith('onMinionDiscardedFromBase:')).toBe(true);
        const nestedTriggerOption = findInteractionOption(nestedPrompt, candidate => candidate.value?.kind === 'trigger');
        expect(nestedTriggerOption).toBeTruthy();

        const afterNestedTrigger = runCommand(skipped.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: nestedPrompt!.playerId,
            payload: { optionId: nestedTriggerOption.id },
            timestamp: 1003,
        } as any);

        expect(afterNestedTrigger.success).toBe(true);
        expect(afterNestedTrigger.finalState.sys.interaction.current).toBeUndefined();
        expect(afterNestedTrigger.finalState.sys.responseWindow?.current).toBeUndefined();
        const settled = advancePostScoringDelay(afterNestedTrigger.finalState, '0');
        expect(settled.finalState.sys.phase).toBe('playCards');
        expect(settled.finalState.core.currentPlayerIndex).toBe(1);
        expect(settled.finalState.core.players['0'].vp).toBe(3);
        expect(settled.finalState.core.players['1'].vp).toBe(2);
        expect(settled.finalState.core.bases[0].defId).toBe('base_the_nexus');
        expect(settled.finalState.core.baseDiscard).toEqual(['base_primate_park']);
        expect(settled.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'mind-bananas-hand',
            'mind-p0-anchor',
            'mind-mole-a',
        ]);
        expect(settled.finalState.core.players['1'].discard.map(card => card.uid)).toEqual([
            'mindraker-a',
            'mind-p1-anchor',
        ]);
    });

    it('超级间谍基地：秘密火山总部计分前只展示各玩家牌库顶一张并打出展示出的随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('p0-minion-a', 'sharks_mako', 'minion', '0'),
                        makeCard('p0-stop', 'cyborg_apes_going_bananas', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-minion-a', 'sharks_mako', 'minion', '1'),
                        makeCard('p1-minion-b', 'sharks_hammerhead', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbility('base_secret_volcano_headquarters', 'beforeScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_secret_volcano_headquarters',
            playerId: '0',
            now: 1000,
        });
        const final = applyEvents(core, result.events);

        expect(result.events.filter(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toHaveLength(2);
        expect(final.bases[0].minions.map(minion => minion.uid)).toEqual(['p0-minion-a', 'p1-minion-a']);
        expect(final.players['0'].deck.map(card => card.uid)).toEqual(['p0-stop']);
        expect(final.players['1'].deck.map(card => card.uid)).toEqual(['p1-minion-b']);
    });

    it('超级间谍基地：秘密火山总部在双方都翻出随从时应把两张展示随从都打到这里', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('p0-minion-a', 'sharks_mako', 'minion', '0'),
                        makeCard('p0-rest', 'cyborg_apes_going_bananas', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-minion-a', 'sharks_hammerhead', 'minion', '1'),
                        makeCard('p1-rest', 'super_spies_spy', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbility('base_secret_volcano_headquarters', 'beforeScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_secret_volcano_headquarters',
            playerId: '0',
            now: 1000,
        });
        const final = applyEvents(core, result.events);

        expect(result.events.filter(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toHaveLength(2);
        expect(result.events.filter(event => event.type === SU_EVENTS.MINION_PLAYED)).toHaveLength(2);
        expect(final.bases[0].minions.map(minion => minion.uid)).toEqual(['p0-minion-a', 'p1-minion-a']);
        expect(final.players['0'].deck.map(card => card.uid)).toEqual(['p0-rest']);
        expect(final.players['1'].deck.map(card => card.uid)).toEqual(['p1-rest']);
    });

    it('超级间谍基地：秘密火山总部在双方都翻出行动时不应把任何牌打到这里', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('p0-action-a', 'cyborg_apes_going_bananas', 'action', '0'),
                        makeCard('p0-rest', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-action-a', 'time_travelers_time_walk', 'action', '1'),
                        makeCard('p1-rest', 'sharks_hammerhead', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbility('base_secret_volcano_headquarters', 'beforeScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_secret_volcano_headquarters',
            playerId: '0',
            now: 1000,
        });
        const final = applyEvents(core, result.events);

        expect(result.events.filter(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toHaveLength(2);
        expect(result.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
        expect(final.bases[0].minions).toEqual([]);
        expect(final.players['0'].deck.map(card => card.uid)).toEqual(['p0-action-a', 'p0-rest']);
        expect(final.players['1'].deck.map(card => card.uid)).toEqual(['p1-action-a', 'p1-rest']);
    });

    it('超级间谍基地：秘密火山总部在三人 turnOrder 下应按顺序让每位玩家各展示一张并只打出其中的随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('p0-minion-a', 'sharks_mako', 'minion', '0'),
                        makeCard('p0-rest', 'cyborg_apes_going_bananas', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('p1-action-a', 'time_travelers_time_walk', 'action', '1'),
                        makeCard('p1-rest', 'sharks_hammerhead', 'minion', '1'),
                    ],
                }),
                '2': makePlayer('2', {
                    deck: [
                        makeCard('p2-minion-a', 'super_spies_spy', 'minion', '2'),
                        makeCard('p2-rest', 'sharks_great_white', 'minion', '2'),
                    ],
                }),
            },
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbility('base_secret_volcano_headquarters', 'beforeScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_secret_volcano_headquarters',
            playerId: '0',
            now: 1000,
        });
        const final = applyEvents(core, result.events);

        const revealEvents = result.events.filter(event => event.type === SU_EVENTS.REVEAL_DECK_TOP) as any[];
        expect(revealEvents).toHaveLength(3);
        expect(revealEvents.map(event => event.payload.targetPlayerId)).toEqual(['0', '1', '2']);
        expect(result.events.filter(event => event.type === SU_EVENTS.MINION_PLAYED)).toHaveLength(2);
        expect(final.bases[0].minions.map(minion => minion.uid)).toEqual(['p0-minion-a', 'p2-minion-a']);
        expect(final.players['0'].deck.map(card => card.uid)).toEqual(['p0-rest']);
        expect(final.players['1'].deck.map(card => card.uid)).toEqual(['p1-action-a', 'p1-rest']);
        expect(final.players['2'].deck.map(card => card.uid)).toEqual(['p2-rest']);
    });

    it('时间旅行者：从头来过返回己方随从并授予只能重打该随从的额外额度', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-do-over', 'time_travelers_do_over', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-do-over', targetBaseIndex: 0, targetMinionUid: 'jumper-a' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.core.bases[0].minions.some(minion => minion.uid === 'jumper-a')).toBe(false);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toContain('jumper-a');
        expect(result.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.limitType === 'minion'
            && (event as any).payload?.sameNameDefId === 'time_travelers_jumper'
            && (event as any).payload?.specificCardUid === 'jumper-a',
        )).toBe(true);
    });

    it('时间旅行者：从头来过的立即额外随从只允许刚返回手牌的那张牌，即使普通随从额度仍可用', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a-do-over', 'time_travelers_do_over', 'action', '0'),
                        makeCard('same-jumper', 'time_travelers_jumper', 'minion', '0'),
                        makeCard('wrong-mako', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-do-over', targetBaseIndex: 0, targetMinionUid: 'jumper-a' },
        } as any);

        expect(result.success).toBe(true);
        const prompt = result.finalState.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('smashup_immediate_extra_minion');
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'jumper-a')).toBeTruthy();
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'same-jumper')).toBeUndefined();
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'wrong-mako')).toBeUndefined();

        const forgedState = {
            ...result.finalState,
            sys: {
                ...result.finalState.sys,
                interaction: {
                    ...result.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        options: [
                            ...(prompt?.options ?? []),
                            {
                                id: 'forged-same-name-decoy',
                                label: '伪造同名但不是刚返回的随从',
                                value: { cardUid: 'same-jumper', defId: 'time_travelers_jumper' },
                            },
                        ],
                    },
                },
            },
        };
        const forged = runCommand(forgedState as any, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-same-name-decoy' },
        } as any);

        expect(forged.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(forged.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(
            expect.arrayContaining(['jumper-a', 'same-jumper', 'wrong-mako']),
        );
    });

    it('时间旅行者：从头来过在放弃额外随从后应直接收口并保留刚返回的那张牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-do-over', 'time_travelers_do_over', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-do-over', targetBaseIndex: 0, targetMinionUid: 'jumper-a' },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('smashup_immediate_extra_minion');

        const skipped = resolveInteractionChain(played.finalState, currentPrompt => {
            const option = findInteractionOption(currentPrompt, candidate => candidate.value?.skip === true);
            return { optionId: option.id };
        });

        expect(skipped.finalState.sys.interaction.current).toBeUndefined();
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).toContain('jumper-a');
    });

    it('时间旅行者：从头来过允许把刚返回的随从重新打到另一基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a-do-over', 'time_travelers_do_over', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
                ]),
                makeBase('base_the_deep', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-do-over', targetBaseIndex: 0, targetMinionUid: 'jumper-a' },
        } as any);

        expect(played.success).toBe(true);
        const resolved = resolveInteractionChain(played.finalState, (prompt, _state, step) => {
            if (step === 0) {
                expect(prompt?.data?.sourceId).toBe('smashup_immediate_extra_minion');
                const returned = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'jumper-a');
                expect(returned).toBeTruthy();
                return { optionId: returned.id };
            }
            expect(prompt?.data?.sourceId).toBe('smashup_immediate_extra_minion_base');
            expect(findInteractionOption(prompt, candidate => candidate.value?.baseIndex === 0)).toBeTruthy();
            const otherBase = findInteractionOption(prompt, candidate => candidate.value?.baseIndex === 1);
            expect(otherBase).toBeTruthy();
            return { optionId: otherBase.id };
        });

        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'jumper-a')).toBe(false);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'jumper-a')).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('jumper-a');
    });

    it('时间旅行者：时间掠夺者天赋允许选择弃牌堆任意一张放到牌库底', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                    discard: [
                        makeCard('discard-a', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('discard-b', 'super_spies_from_q_with_love', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('raider-a', 'time_travelers_time_raider', '0', 3),
            ])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'raider-a', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(true);
        const timeRaiderPrompt = getSimpleChoicePrompt(talent.finalState, 'time_travelers_time_raider_choose');
        expect(getPromptOptions(timeRaiderPrompt)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                value: expect.objectContaining({ cardUid: 'discard-a', defId: 'sharks_hammerhead' }),
                displayMode: 'card',
            }),
            expect.objectContaining({
                value: expect.objectContaining({ cardUid: 'discard-b', defId: 'super_spies_from_q_with_love' }),
                displayMode: 'card',
            }),
        ]));

        const resolved = resolveInteractionChain(talent.finalState, (prompt) => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'discard-b');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a', 'discard-b']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-a']);

        const prompt = talent.finalState.sys.interaction.current!;
        const forgedState = {
            ...talent.finalState,
            core: {
                ...talent.finalState.core,
                players: {
                    ...talent.finalState.core.players,
                    '0': {
                        ...talent.finalState.core.players['0'],
                        discard: [
                            ...talent.finalState.core.players['0'].discard,
                            makeCard('late-card', 'sharks_mako', 'minion', '0'),
                        ],
                    },
                },
            },
            sys: {
                ...talent.finalState.sys,
                interaction: {
                    ...talent.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-card', label: 'forged late card', value: { cardUid: 'late-card' } },
                            ],
                        },
                    },
                },
            },
        };
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-card' },
        } as any);
        expect(forged.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a']);
        expect(forged.finalState.core.players['0'].discard.map(card => card.uid)).toContain('late-card');
    });

    it('时间旅行者：时间掠夺者弃牌堆只有一张牌时应自动放到牌库底且不弹 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                    discard: [makeCard('discard-a', 'time_travelers_time_walk', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('raider-a', 'time_travelers_time_raider', '0', 3),
            ])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'raider-a', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(true);
        expect(talent.finalState.sys.interaction.current).toBeUndefined();
        expect(talent.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);
        expect(talent.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a', 'discard-a']);
        expect(talent.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([]);
    });

    it('时间旅行者：时间掠夺者弃牌堆为空时应给出反馈且不创建 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('raider-a', 'time_travelers_time_raider', '0', 3),
            ])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'raider-a', baseIndex: 0 },
        } as any);

        const feedback = talent.events.find(event => event.type === SU_EVENTS.ABILITY_FEEDBACK) as any;
        expect(talent.success).toBe(true);
        expect(talent.finalState.sys.interaction.current).toBeUndefined();
        expect(feedback?.payload?.messageKey).toBe('feedback.discard_empty');
        expect(talent.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(false);
        expect(talent.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([]);
        expect(talent.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([]);
    });

    it('时间旅行者：时间掠夺者选择被他人拥有的弃牌时，仍应进入其拥有者牌库底而不是当前玩家牌库底', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                    discard: [makeCard('borrowed-discard-a', 'super_spies_from_q_with_love', 'action', '1')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('owner-deck-a', 'ghosts_spectre', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('raider-a', 'time_travelers_time_raider', '0', 3),
            ])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'raider-a', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(true);
        expect(talent.finalState.sys.interaction.current).toBeUndefined();
        expect(talent.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: expect.objectContaining({
                cardUid: 'borrowed-discard-a',
                ownerId: '1',
            }),
        }));
        expect(talent.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a']);
        expect(talent.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['owner-deck-a', 'borrowed-discard-a']);
        expect(talent.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([]);
    });

    it('时间旅行者：往复时间者进场允许选择弃牌堆行动放到牌库顶', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('repeater-a', 'time_travelers_repeater_perfect', 'minion', '0')],
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                    discard: [
                        makeCard('action-a', 'super_spies_from_q_with_love', 'action', '0'),
                        makeCard('action-b', 'time_travelers_1_21_gigawatts', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'repeater-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        const repeaterPrompt = getSimpleChoicePrompt(played.finalState, 'time_travelers_repeater_perfect_choose');
        expect(getPromptOptions(repeaterPrompt)).toEqual(expect.arrayContaining([
            expect.objectContaining({
                value: expect.objectContaining({ cardUid: 'action-a', defId: 'super_spies_from_q_with_love' }),
                displayMode: 'card',
            }),
            expect.objectContaining({
                value: expect.objectContaining({ cardUid: 'action-b', defId: 'time_travelers_1_21_gigawatts' }),
                displayMode: 'card',
            }),
        ]));

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'action-b');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['action-b', 'deck-a']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['action-a']);

        const prompt = played.finalState.sys.interaction.current!;
        const forgedState = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                players: {
                    ...played.finalState.core.players,
                    '0': {
                        ...played.finalState.core.players['0'],
                        discard: [
                            ...played.finalState.core.players['0'].discard,
                            makeCard('late-action', 'super_spies_from_q_with_love', 'action', '0'),
                        ],
                    },
                },
            },
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-action', label: 'forged late action', value: { cardUid: 'late-action' } },
                            ],
                        },
                    },
                },
            },
        };
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-action' },
        } as any);
        expect(forged.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a']);
        expect(forged.finalState.core.players['0'].discard.map(card => card.uid)).toContain('late-action');
    });

    it('时间旅行者：往复时间者在混合弃牌堆中只提供行动候选，所选行动进牌库顶而其余牌保留', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('repeater-a', 'time_travelers_repeater_perfect', 'minion', '0')],
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                    discard: [
                        makeCard('discard-minion-a', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('discard-action-a', 'super_spies_from_q_with_love', 'action', '0'),
                        makeCard('discard-action-b', 'time_travelers_time_walk', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'repeater-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('time_travelers_repeater_perfect_choose');
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'discard-action-a')).toBeTruthy();
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'discard-action-b')).toBeTruthy();
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'discard-minion-a')).toBeUndefined();

        const resolved = resolveInteractionChain(played.finalState, promptState => {
            const option = findInteractionOption(promptState, candidate => candidate.value?.cardUid === 'discard-action-b');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['discard-action-b', 'deck-a']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['discard-minion-a', 'discard-action-a']);
    });

    it('时间旅行者：往复时间者弃牌堆只有一张行动时应自动放到牌库顶且不弹 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('repeater-a', 'time_travelers_repeater_perfect', 'minion', '0')],
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                    discard: [makeCard('action-a', 'super_spies_from_q_with_love', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'repeater-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_TOP)).toBe(true);
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['action-a', 'deck-a']);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([]);
    });

    it('时间旅行者：往复时间者弃牌堆为空时应给出反馈且不创建 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('repeater-a', 'time_travelers_repeater_perfect', 'minion', '0')],
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'repeater-a', baseIndex: 0 },
        } as any);

        const feedback = played.events.find(event => event.type === SU_EVENTS.ABILITY_FEEDBACK) as any;
        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(feedback?.payload?.messageKey).toBe('feedback.discard_empty');
        expect(played.events.some(event => event.type === SU_EVENTS.CARD_TO_DECK_TOP)).toBe(false);
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a']);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([]);
    });

    it('时间旅行者：往复时间者选择被他人拥有的弃牌行动时，仍应进入其拥有者牌库顶而不是当前玩家牌库顶', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('repeater-a', 'time_travelers_repeater_perfect', 'minion', '0')],
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                    discard: [makeCard('borrowed-action-a', 'super_spies_from_q_with_love', 'action', '1')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('owner-deck-a', 'ghosts_spectre', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'repeater-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_TOP,
            payload: expect.objectContaining({
                cardUid: 'borrowed-action-a',
                ownerId: '1',
            }),
        }));
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a']);
        expect(played.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['borrowed-action-a', 'owner-deck-a']);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([]);
    });

    it('时间旅行者：1.21千兆瓦将所选弃牌类型洗入整副牌库，并拒绝伪造牌种', () => {
        const reverseRandom = {
            shuffle: <T,>(items: T[]) => [...items].reverse(),
            random: () => 0.5,
            d: () => 1,
            range: (min: number) => min,
        };
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('giga-a', 'time_travelers_1_21_gigawatts', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'sharks_great_white', 'minion', '0'),
                        makeCard('deck-b', 'sharks_mako', 'minion', '0'),
                    ],
                    discard: [
                        makeCard('action-a', 'super_spies_from_q_with_love', 'action', '0'),
                        makeCard('minion-a', 'time_travelers_jumper', 'minion', '0'),
                        makeCard('minion-b', 'time_travelers_doctor_when', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'giga-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('time_travelers_1_21_gigawatts_choose');
        expect(played.finalState.sys.interaction.current?.data?.allowedCardTypes).toEqual(['action', 'minion']);

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.cardType === 'minion');
            return { optionId: option.id };
        }, reverseRandom);

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-b',
            'deck-a',
            'minion-b',
            'minion-a',
        ]);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['action-a', 'giga-a']);

        const prompt = played.finalState.sys.interaction.current!;
        const forgedBaseTypeState = {
            ...played.finalState,
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-base-type', label: 'forged base type', value: { cardType: 'base' } },
                            ],
                        },
                    },
                },
            },
        };
        const forgedBaseType = runCommand(forgedBaseTypeState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-base-type' },
        } as any, reverseRandom);
        expect(forgedBaseType.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a', 'deck-b']);
        expect(forgedBaseType.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([
            'action-a',
            'minion-a',
            'minion-b',
            'giga-a',
        ]);

        const forgedAllowedSetState = {
            ...played.finalState,
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            allowedCardTypes: ['action'],
                        },
                    },
                },
            },
        };
        const minionOption = findInteractionOption(prompt, candidate => candidate.value?.cardType === 'minion');
        const forgedAllowedSet = runCommand(forgedAllowedSetState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: minionOption.id },
        } as any, reverseRandom);
        expect(forgedAllowedSet.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a', 'deck-b']);
        expect(forgedAllowedSet.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([
            'action-a',
            'minion-a',
            'minion-b',
            'giga-a',
        ]);
    });

    it('时间旅行者：1.21千兆瓦选择行动牌种时，应按弃牌真实 owner 分别洗回各自牌库', () => {
        const reverseRandom = {
            shuffle: <T,>(items: T[]) => [...items].reverse(),
            random: () => 0.5,
            d: () => 1,
            range: (min: number) => min,
        };
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('giga-owner-split', 'time_travelers_1_21_gigawatts', 'action', '0')],
                    deck: [makeCard('p0-deck-a', 'sharks_mako', 'minion', '0')],
                    discard: [
                        makeCard('borrowed-action-a', 'super_spies_from_q_with_love', 'action', '1'),
                        makeCard('own-action-a', 'cyborg_apes_juiced_up', 'action', '0'),
                        makeCard('minion-a', 'time_travelers_jumper', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-a', 'ghosts_spectre', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'giga-owner-split' },
        } as any, reverseRandom);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('time_travelers_1_21_gigawatts_choose');

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.cardType === 'action');
            return { optionId: option.id };
        }, reverseRandom);

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({
                playerId: '1',
                sourcePlayerId: '0',
            }),
        }));
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'p0-deck-a',
            'giga-owner-split',
            'own-action-a',
        ]);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual([
            'p1-deck-a',
            'borrowed-action-a',
        ]);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['minion-a']);
    });

    it('时间旅行者：1.21千兆瓦在弃牌堆只剩单一牌种时应自动洗回整副牌库且不弹牌种选择 prompt', () => {
        const reverseRandom = {
            shuffle: <T,>(items: T[]) => [...items].reverse(),
            random: () => 0.5,
            d: () => 1,
            range: (min: number) => min,
        };
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('giga-single', 'time_travelers_1_21_gigawatts', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'sharks_great_white', 'minion', '0'),
                        makeCard('deck-b', 'sharks_mako', 'minion', '0'),
                    ],
                    discard: [
                        makeCard('action-a', 'super_spies_from_q_with_love', 'action', '0'),
                        makeCard('action-b', 'cyborg_apes_going_bananas', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'giga-single' },
        } as any, reverseRandom);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.events.some(event =>
            event.type === SU_EVENTS.SYS_INTERACTION_STARTED
            && (event as any).payload?.sourceId === 'time_travelers_1_21_gigawatts_choose',
        )).toBe(false);
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-b',
            'deck-a',
            'action-b',
            'action-a',
        ]);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['giga-single']);
    });

    it('时间旅行者：1.21千兆瓦在弃牌堆只剩行动时，仍应按弃牌真实 owner 自动分别洗回各自牌库', () => {
        const reverseRandom = {
            shuffle: <T,>(items: T[]) => [...items].reverse(),
            random: () => 0.5,
            d: () => 1,
            range: (min: number) => min,
        };
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('giga-owner-split-auto', 'time_travelers_1_21_gigawatts', 'action', '0')],
                    deck: [makeCard('p0-deck-a', 'sharks_great_white', 'minion', '0')],
                    discard: [
                        makeCard('borrowed-action-a', 'super_spies_from_q_with_love', 'action', '1'),
                        makeCard('own-action-a', 'cyborg_apes_juiced_up', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-a', 'ghosts_spectre', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'giga-owner-split-auto' },
        } as any, reverseRandom);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.events.filter(event => event.type === SU_EVENTS.DECK_REORDERED)).toHaveLength(2);
        expect(played.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({
                playerId: '1',
                sourcePlayerId: '0',
            }),
        }));
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'p0-deck-a',
            'own-action-a',
        ]);
        expect(played.finalState.core.players['1'].deck.map(card => card.uid)).toEqual([
            'p1-deck-a',
            'borrowed-action-a',
        ]);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['giga-owner-split-auto']);
    });

    it('时间旅行者：1.21千兆瓦在弃牌堆为空时应给出反馈且不创建牌种选择 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('giga-empty', 'time_travelers_1_21_gigawatts', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'sharks_great_white', 'minion', '0'),
                        makeCard('deck-b', 'sharks_mako', 'minion', '0'),
                    ],
                    discard: [],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'giga-empty' },
        } as any);

        const feedback = played.events.find(event => event.type === SU_EVENTS.ABILITY_FEEDBACK) as any;
        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(feedback?.payload?.messageKey).toBe('feedback.discard_empty');
        expect(played.events.some(event =>
            event.type === SU_EVENTS.SYS_INTERACTION_STARTED
            && (event as any).payload?.sourceId === 'time_travelers_1_21_gigawatts_choose',
        )).toBe(false);
        expect(played.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(false);
        expect(played.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a', 'deck-b']);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['giga-empty']);
    });

    it('时间旅行者：静滞立场压制基地能力，并在拥有者回合开始脱离', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_portal_room',
                minions: [
                    makeMinion('power-a', 'sharks_megalodon', '0', 10),
                    makeMinion('power-b', 'sharks_megalodon', '0', 10),
                    makeMinion('power-c', 'sharks_megalodon', '1', 10),
                ],
                ongoingActions: [{ uid: 'stasis-a', defId: 'time_travelers_stasis_field', ownerId: '0' }],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        expect(isBaseAbilitySuppressed(core, 0)).toBe(true);
        expect(getScoringEligibleBaseIndices(core)).toEqual([]);
        const scoring = scoreOneBase({ ...core, scoringEligibleBaseIndices: [0] } as any, 0, [], '0', 999);
        expect(scoring.events.some(event => event.type === SU_EVENTS.BASE_SCORED)).toBe(false);

        const triggered = fireTriggers(core, 'onTurnStart', {
            state: core,
            playerId: '0',
            random: () => 0.5,
            now: 1000,
        });
        const final = applyEvents(core, triggered.events);

        expect(triggered.events.length).toBeGreaterThan(0);
        expect(final.bases[0].ongoingActions).toEqual([]);
        expect(final.players['0'].discard.map(card => card.uid)).toContain('stasis-a');
    });

    it('时间旅行者：跳跃者从基地进弃牌堆后通过 optional reaction 选择是否回手', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('jumper-a', 'time_travelers_jumper', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const queued = collectTriggers(core, 'onMinionDiscardedFromBase', {
            state: core,
            playerId: '0',
            triggerMinionUid: 'jumper-a',
            triggerMinionDefId: 'time_travelers_jumper',
            random: () => 0.5,
            now: 1000,
        });
        const trigger = (queued as any)?.payload?.triggers?.[0];
        expect(trigger?.resolutionClass).toBe('optional');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: [trigger] }),
            { shuffle: <T,>(items: T[]) => [...items], random: () => 0.5, d: () => 1, range: (min: number) => min },
            1001,
        );
        expect(prompted?.state.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');
        const pass = findInteractionOption(prompted?.state.sys.interaction.current, option => option.id === 'pass');
        const passed = runCommand(prompted!.state, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: pass.id },
        } as any);
        expect(passed.finalState.core.players['0'].discard.map(card => card.uid)).toContain('jumper-a');
        expect(passed.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('jumper-a');

        const promptedAgain = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: [trigger] }),
            { shuffle: <T,>(items: T[]) => [...items], random: () => 0.5, d: () => 1, range: (min: number) => min },
            1002,
        );
        const triggerOption = findInteractionOption(promptedAgain?.state.sys.interaction.current, option => option.value?.kind === 'trigger');
        const accepted = runCommand(promptedAgain!.state, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: triggerOption.id },
        } as any);
        expect(accepted.events.some(event =>
            event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD
            && (event as any).payload?.cardUids?.includes('jumper-a'),
        )).toBe(true);
        expect(accepted.finalState.core.players['0'].hand.map(card => card.uid)).toContain('jumper-a');
        expect(accepted.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('jumper-a');
    });

    it('时间旅行者：跳跃者被真实摧毁进入弃牌堆后仍通过 optional reaction 回手', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('bacta-a', 'shapeshifters_bacta_the_future', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_portal_room', [
                makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const destroyed = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bacta-a', targetBaseIndex: 0, targetMinionUid: 'jumper-a' },
        } as any);

        expect(destroyed.success).toBe(true);
        expect(destroyed.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_immediate_extra_minion');
        expect(destroyed.finalState.core.players['0'].discard.map(card => card.uid)).toContain('jumper-a');

        const resolved = resolveInteractionChain(destroyed.finalState, prompt => {
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_minion') {
                const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
                return { optionId: skip.id };
            }
            expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
            const triggerOption = findInteractionOption(prompt, option => option.value?.kind === 'trigger');
            return { optionId: triggerOption.id };
        });

        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD
            && (event as any).payload?.cardUids?.includes('jumper-a'),
        )).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('jumper-a');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('jumper-a');
    });

    it('时间旅行者：跳跃者在 Tar Pits 首次被真实摧毁并改放牌库底时，不应触发 optional recover reaction', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('bacta-a', 'shapeshifters_bacta_the_future', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_tar_pits', [
                makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const destroyed = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bacta-a', targetBaseIndex: 0, targetMinionUid: 'jumper-a' },
        } as any);

        expect(destroyed.success).toBe(true);
        expect(destroyed.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_immediate_extra_minion');
        expect(destroyed.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('jumper-a');
        expect(destroyed.finalState.core.players['0'].deck.map(card => card.uid)).toContain('jumper-a');

        const resolved = resolveInteractionChain(destroyed.finalState, prompt => {
            expect(prompt?.data?.sourceId).toBe('smashup_immediate_extra_minion');
            const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
            expect(skip).toBeTruthy();
            return { optionId: skip.id };
        });

        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD
            && (event as any).payload?.cardUids?.includes('jumper-a'),
        )).toBe(false);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('jumper-a');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('jumper-a');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toContain('jumper-a');
        expect(resolved.finalState.sys.interaction.current).toBeUndefined();
    });

    it('时间旅行者：跳跃者在 Temple of Goju 计分后被放牌库底时，不应触发 optional recover reaction', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'time_travelers_time_raider', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('deck-b', 'sharks_mako', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_temple_of_goju',
                breakpoint: 18,
                minions: [
                    makeMinion('jumper-a', 'time_travelers_jumper', '0', 10),
                    makeMinion('enemy-a', 'sharks_mako', '1', 9),
                ],
            })],
            baseDeck: ['base_portal_room'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
            scoringEligibleBaseIndices: [0],
        };

        const scoring = scoreOneBase(
            core as any,
            0,
            core.baseDeck,
            '0',
            999,
            undefined,
            makeMatchState(core as any),
        );
        const finalCore = applyEvents(core as any, scoring.events);

        expect(scoring.events.some(event =>
            event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM
            && (event as any).payload?.cardUid === 'jumper-a',
        )).toBe(true);
        expect(scoring.events.some(event =>
            event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD
            && (event as any).payload?.cardUids?.includes('jumper-a'),
        )).toBe(false);
        expect(scoring.matchState?.sys.interaction.current).toBeUndefined();
        expect((scoring.matchState?.core.triggerQueue ?? []).some((trigger: any) => trigger?.sourceDefId === 'time_travelers_jumper')).toBe(false);
        expect(finalCore.players['0'].hand.map(card => card.uid)).not.toContain('jumper-a');
        expect(finalCore.players['0'].discard.map(card => card.uid)).not.toContain('jumper-a');
        expect(finalCore.players['0'].deck.map(card => card.uid)).toEqual(['deck-a', 'jumper-a']);
    });

    it('时间旅行者：跳跃者在普通基地计分弃牌后仍可通过 optional reaction 回手', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_portal_room',
                breakpoint: 18,
                minions: [
                    makeMinion('jumper-a', 'time_travelers_jumper', '0', 10),
                    makeMinion('enemy-a', 'sharks_mako', '1', 9),
                ],
            })],
            baseDeck: ['base_faceless_city'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
            scoringEligibleBaseIndices: [0],
        };

        const scoring = scoreOneBase(
            core as any,
            0,
            core.baseDeck,
            '0',
            999,
            undefined,
            makeMatchState(core as any),
        );

        expect(scoring.matchState?.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const resolved = resolveInteractionChain(scoring.matchState!, prompt => {
            expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
            const triggerOption = findInteractionOption(prompt, option => option.value?.kind === 'trigger');
            expect(triggerOption).toBeTruthy();
            return { optionId: triggerOption.id };
        });

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('jumper-a');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('jumper-a');
        expect(resolved.finalState.core.bases.some(base =>
            base.minions.some(minion => minion.uid === 'jumper-a'),
        )).toBe(false);
    });

    it('变形者：Copycat 复制 Jumper 后在普通基地计分弃牌时仍可代理 optional recover 回手', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_portal_room',
                breakpoint: 18,
                minions: [
                    makeMinion('copy-a', 'shapeshifters_copycat', '0', 10, {
                        metadata: {
                            copiedAbilityDefId: 'time_travelers_jumper',
                            copiedAbilityUntilTurn: 1,
                        },
                    }),
                    makeMinion('enemy-a', 'sharks_mako', '1', 9),
                ],
            })],
            baseDeck: ['base_faceless_city'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
            scoringEligibleBaseIndices: [0],
        };

        const scoring = scoreOneBase(
            core as any,
            0,
            core.baseDeck,
            '0',
            999,
            undefined,
            makeMatchState(core as any),
        );

        expect(scoring.matchState?.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const resolved = resolveInteractionChain(scoring.matchState!, prompt => {
            expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
            const triggerOption = findInteractionOption(prompt, option => option.value?.kind === 'trigger');
            expect(triggerOption).toBeTruthy();
            return { optionId: triggerOption.id };
        });

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('copy-a');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('copy-a');
        expect(resolved.finalState.core.bases.some(base =>
            base.minions.some(minion => minion.uid === 'copy-a'),
        )).toBe(false);
    });

    it('变形者：Copycat 复制 Jumper 后被真实摧毁时，应代理其 optional recover trigger 回手', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('copy-a', 'shapeshifters_copycat', 'minion', '0'),
                        makeCard('bacta-a', 'shapeshifters_bacta_the_future', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('enemy-jumper', 'time_travelers_jumper', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const copycatPlayed = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'copy-a', baseIndex: 0, targetMinionUid: 'enemy-jumper' },
        } as any);

        expect(copycatPlayed.success).toBe(true);
        expect(copycatPlayed.finalState.sys.interaction.current).toBeUndefined();

        const copiedCopycat = copycatPlayed.finalState.core.bases[0].minions.find(minion => minion.uid === 'copy-a');
        expect(copiedCopycat?.metadata?.copiedAbilityDefId).toBe('time_travelers_jumper');

        const destroyed = runCommand(copycatPlayed.finalState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bacta-a', targetBaseIndex: 0, targetMinionUid: 'copy-a' },
        } as any);

        expect(destroyed.success).toBe(true);
        expect(destroyed.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_immediate_extra_minion');
        expect(destroyed.finalState.core.players['0'].discard.map(card => card.uid)).toContain('copy-a');

        const resolved = resolveInteractionChain(destroyed.finalState, prompt => {
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_minion') {
                const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
                return { optionId: skip.id };
            }
            expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
            const triggerOption = findInteractionOption(prompt, option => option.value?.kind === 'trigger');
            return { optionId: triggerOption.id };
        });

        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD
            && (event as any).payload?.cardUids?.includes('copy-a'),
        )).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('copy-a');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('copy-a');
    });

    it('时间旅行者：被他人控制的跳跃者被真实摧毁后应由 controller 决定，但仍回到 owner 手牌', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('bacta-a', 'shapeshifters_bacta_the_future', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_portal_room', [
                makeMinion('stolen-jumper', 'time_travelers_jumper', '1', 2, { owner: '0' }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const destroyed = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bacta-a', targetBaseIndex: 0, targetMinionUid: 'stolen-jumper' },
        } as any);

        expect(destroyed.success).toBe(true);
        expect(destroyed.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_immediate_extra_minion');
        expect(destroyed.finalState.sys.interaction.current?.playerId).toBe('0');
        expect(destroyed.finalState.core.players['0'].discard.map(card => card.uid)).toContain('stolen-jumper');
        const resolved = resolveInteractionChain(destroyed.finalState, prompt => {
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_minion') {
                expect(prompt.playerId).toBe('0');
                const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
                return { optionId: skip.id };
            }
            expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
            expect(prompt?.playerId).toBe('1');
            const triggerOption = findInteractionOption(prompt, option => option.value?.kind === 'trigger');
            return { optionId: triggerOption.id };
        });

        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD
            && (event as any).payload?.playerId === '0'
            && (event as any).payload?.cardUids?.includes('stolen-jumper'),
        )).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('stolen-jumper');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('stolen-jumper');
        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).not.toContain('stolen-jumper');
    });

    it('时间盒子：被他人控制的跳跃者从弃牌堆回 owner 手牌后，应继续由 owner 获得第 5 枚计数进场选择', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('bacta-a', 'shapeshifters_bacta_the_future', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_portal_room', [
                makeMinion('stolen-jumper', 'time_travelers_jumper', '1', 2, { owner: '0' }),
            ])],
            titans: [{
                uid: 'time-box-a',
                defId: 'time_travelers_time_box',
                faction: 'time_travelers',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'setaside' as const },
                powerCounters: 0,
                talentUsed: false,
                metadata: { timeBoxCounters: 4 },
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const destroyed = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bacta-a', targetBaseIndex: 0, targetMinionUid: 'stolen-jumper' },
        } as any);

        expect(destroyed.success).toBe(true);
        expect(destroyed.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_immediate_extra_minion');
        expect(destroyed.finalState.sys.interaction.current?.playerId).toBe('0');
        expect(destroyed.finalState.core.players['0'].discard.map(card => card.uid)).toContain('stolen-jumper');

        const resolved = resolveInteractionChain(destroyed.finalState, (prompt, state) => {
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_minion') {
                expect(prompt.playerId).toBe('0');
                const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
                return { optionId: skip.id };
            }

            if (prompt?.data?.sourceId === 'smashup_reaction_choose' && prompt?.playerId === '1') {
                const triggerOption = findInteractionOption(prompt, option => {
                    const triggerId = option.value?.triggerId;
                    const trigger = state.core.triggerQueue?.find(entry => entry.id === triggerId);
                    return option.value?.kind === 'trigger' && trigger?.sourceDefId === 'time_travelers_jumper';
                });
                expect(triggerOption).toBeTruthy();
                return { optionId: triggerOption.id };
            }

            if (prompt?.data?.sourceId === 'smashup_reaction_choose' && prompt?.playerId === '0') {
                const timeBoxOption = findInteractionOption(prompt, candidate => {
                    const triggerId = candidate.value?.triggerId;
                    const trigger = state.core.triggerQueue?.find(entry => entry.id === triggerId);
                    return trigger?.sourceDefId === 'time_travelers_time_box';
                });
                expect(timeBoxOption).toBeTruthy();
                return { optionId: timeBoxOption.id };
            }

            if (prompt?.data?.sourceId === 'titan_time_travelers_time_box_play') {
                expect(prompt.playerId).toBe('0');
                const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
                return { optionId: skip.id };
            }

            throw new Error(`未处理的被控制 Jumper -> Time Box 交互：${prompt?.data?.sourceId ?? 'unknown'}:${prompt?.playerId ?? 'unknown'}`);
        });

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('stolen-jumper');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('stolen-jumper');
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'time-box-a')?.metadata?.timeBoxCounters).toBe(5);
    });

    it('时间旅行者：时间漫步授予本回合额外随从和行动、抽两张，并将本牌放牌库底', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('walk-a', 'time_travelers_time_walk', 'action', '0')],
                    deck: [
                        makeCard('draw-a', 'sharks_mako', 'minion', '0'),
                        makeCard('draw-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-rest', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'walk-a' },
        } as any);

        expect(result.success).toBe(true);
        expect(result.events.filter(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.reason === 'time_travelers_time_walk',
        )).toHaveLength(2);
        expect(result.events.find(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.limitType === 'minion',
        ) as any).not.toMatchObject({ payload: { playTiming: 'immediate' } });
        expect(result.events.find(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.limitType === 'action',
        ) as any).not.toMatchObject({ payload: { playTiming: 'immediate' } });
        expect(result.finalState.sys.interaction.current?.data?.sourceId).not.toBe('smashup_immediate_extra_minion');
        expect(result.finalState.core.players['0'].minionLimit).toBe(2);
        expect(result.finalState.core.players['0'].actionLimit).toBe(2);
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b']);
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-rest', 'walk-a']);
    });

    it('时间旅行者：被他人拥有的时间漫步结算后，仍应进入其拥有者牌库底而不是当前玩家牌库底', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('walk-a', 'time_travelers_time_walk', 'action', '1')],
                    deck: [
                        makeCard('draw-a', 'sharks_mako', 'minion', '0'),
                        makeCard('draw-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-rest', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-rest', 'sharks_tiger_shark', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'walk-a' },
        } as any);

        expect(result.success).toBe(true);
        const bottomEvent = result.events.find(event =>
            event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM
            && (event as any).payload?.reason === 'time_travelers_time_walk'
        ) as any;
        expect(bottomEvent?.payload).toMatchObject({
            cardUid: 'walk-a',
            ownerId: '1',
            sourcePlayerId: '0',
        });
        expect(result.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b']);
        expect(result.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-rest']);
        expect(result.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-deck-rest', 'walk-a']);
    });

    it('时间旅行者：时间流逝允许从基地弃牌堆选择替换基地', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: ['base_monkey_lab'],
            baseDiscard: ['base_the_vats', 'base_faceless_city'],
            turnNumber: 1,
            nextUid: 100,
        };
        const special = resolveSpecial('time_travelers_time_is_fleeting');

        const result = special?.({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'time-fleeting-a',
            defId: 'time_travelers_time_is_fleeting',
            baseIndex: 0,
            random: () => 0.5,
            now: 1000,
        });
        const resolved = resolveInteractionChain(result!.matchState!, (prompt) => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.baseDefId === 'base_faceless_city');
            return { optionId: option.id };
        });

        expect(resolved.events.some(event => event.type === SU_EVENTS.BASE_DECK_REORDERED)).toBe(true);
        expect(resolved.finalState.core.baseDeck[0]).toBe('base_faceless_city');
        expect(resolved.finalState.core.baseDiscard).toEqual(['base_the_vats']);
    });

    it('时间旅行者：时间流逝在基地弃牌堆只有一个合法候选时应自动放到基地牌库顶且不弹 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: ['base_monkey_lab'],
            baseDiscard: ['base_portal_room', 'base_the_vats'],
            turnNumber: 1,
            nextUid: 100,
        };
        const special = resolveSpecial('time_travelers_time_is_fleeting');

        const result = special?.({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'time-fleeting-a',
            defId: 'time_travelers_time_is_fleeting',
            baseIndex: 0,
            random: () => 0.5,
            now: 1000,
        });

        expect(result?.matchState).toBeUndefined();
        expect(result?.events).toEqual([
            expect.objectContaining({
                type: SU_EVENTS.BASE_DECK_REORDERED,
                payload: expect.objectContaining({
                    topDefIds: ['base_the_vats'],
                    reason: 'time_travelers_time_is_fleeting',
                }),
            }),
        ]);
    });

    it('时间旅行者：时间流逝不能选择刚计分进入弃牌堆的基地', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: ['base_monkey_lab'],
            baseDiscard: ['base_portal_room', 'base_the_vats', 'base_faceless_city'],
            turnNumber: 1,
            nextUid: 100,
        };
        const special = resolveSpecial('time_travelers_time_is_fleeting');

        const result = special?.({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'time-fleeting-a',
            defId: 'time_travelers_time_is_fleeting',
            baseIndex: 0,
            random: () => 0.5,
            now: 1000,
        });

        const prompt = result!.matchState!.sys.interaction.current!;
        expect(findInteractionOption(prompt, candidate => candidate.value?.baseDefId === 'base_portal_room')).toBeUndefined();

        const forgedState = {
            ...result!.matchState!,
            sys: {
                ...result!.matchState!.sys,
                interaction: {
                    ...result!.matchState!.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                {
                                    id: 'forged-scored-base',
                                    label: 'forged scored base',
                                    value: { baseDefId: 'base_portal_room' },
                                },
                            ],
                        },
                    },
                },
            },
        };
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-scored-base' },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.baseDeck).toEqual(['base_monkey_lab']);
        expect(forged.finalState.core.baseDiscard).toEqual(['base_portal_room', 'base_the_vats', 'base_faceless_city']);
    });

    it('时间旅行者：时间流逝真实计分后应使用选择的弃牌堆基地替换已计分基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('time-fleeting-a', 'time_travelers_time_is_fleeting', 'action', '0')],
                    deck: [
                        makeCard('draw-a', 'time_travelers_jumper', 'minion', '0'),
                        makeCard('draw-b', 'time_travelers_time_raider', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_monkey_lab', [
                    makeMinion('winner', 'time_travelers_time_raider', '0', 24),
                ]),
                makeBase('base_portal_room', []),
            ],
            baseDeck: ['base_primate_park'],
            baseDiscard: ['base_the_vats', 'base_faceless_city'],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const resolved = resolveInteractionChain(advance.finalState, (prompt) => {
            if (prompt?.data?.sourceId === 'smashup_reaction_choose') {
                const option = findInteractionOption(prompt, candidate =>
                    candidate.value?.kind === 'play_action'
                    && candidate.value?.cardUid === 'time-fleeting-a',
                );
                return { optionId: option.id };
            }
            const option = findInteractionOption(prompt, candidate =>
                candidate.value?.baseDefId === 'base_faceless_city',
            );
            return { optionId: option.id };
        });

        expect(resolved.events.some(event => event.type === SU_EVENTS.BASE_DECK_REORDERED)).toBe(true);
        const delayUntil = (resolved.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil;
        expect(typeof delayUntil).toBe('number');
        const finalized = runCommand(resolved.finalState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: delayUntil,
        } as any);

        expect(finalized.success).toBe(true);
        expect(finalized.events.some(event =>
            event.type === SU_EVENTS.BASE_REPLACED
            && (event.payload as { newBaseDefId?: string }).newBaseDefId === 'base_faceless_city',
        )).toBe(true);
        expect(finalized.finalState.core.bases[0].defId).toBe('base_faceless_city');
        expect(finalized.finalState.core.baseDeck).toEqual(['base_primate_park']);
        expect(finalized.finalState.core.baseDiscard).toEqual(['base_the_vats', 'base_monkey_lab']);
        expect(finalized.finalState.core.players['0'].discard.map(card => card.uid)).toContain('time-fleeting-a');
    });

    it('时间旅行者：时间流逝真实计分后若只剩一个合法基地弃牌堆候选则应自动替换而不弹第二层 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('time-fleeting-a', 'time_travelers_time_is_fleeting', 'action', '0')],
                    deck: [
                        makeCard('draw-a', 'time_travelers_jumper', 'minion', '0'),
                        makeCard('draw-b', 'time_travelers_time_raider', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_monkey_lab', [
                    makeMinion('winner', 'time_travelers_time_raider', '0', 24),
                ]),
                makeBase('base_the_vats', []),
            ],
            baseDeck: ['base_primate_park'],
            baseDiscard: ['base_faceless_city'],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const resolved = resolveInteractionChain(advance.finalState, (prompt) => {
            expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
            const option = findInteractionOption(prompt, candidate =>
                candidate.value?.kind === 'play_action'
                && candidate.value?.cardUid === 'time-fleeting-a',
            );
            return { optionId: option.id };
        });

        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.BASE_DECK_REORDERED
            && (event.payload as { topDefIds?: string[]; reason?: string }).reason === 'time_travelers_time_is_fleeting'
            && JSON.stringify((event.payload as { topDefIds?: string[] }).topDefIds) === JSON.stringify(['base_faceless_city']),
        )).toBe(true);
        const delayUntil = (resolved.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil;
        expect(typeof delayUntil).toBe('number');
        const finalized = runCommand(resolved.finalState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: delayUntil,
        } as any);

        expect(finalized.success).toBe(true);
        expect(finalized.finalState.sys.interaction.current).toBeUndefined();
        expect(finalized.finalState.core.bases[0].defId).toBe('base_faceless_city');
        expect(finalized.finalState.core.baseDeck).toEqual(['base_primate_park']);
        expect(finalized.finalState.core.baseDiscard).toEqual(['base_monkey_lab']);
        expect(finalized.finalState.core.players['0'].discard.map(card => card.uid)).toContain('time-fleeting-a');
    });

    it('时间旅行者：时间流逝真实计分后若基地牌库已空且只剩一个合法基地弃牌堆候选，仍应使用该候选替换而不是退回旧 reshuffle 池', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('time-fleeting-a', 'time_travelers_time_is_fleeting', 'action', '0')],
                    deck: [
                        makeCard('draw-a', 'time_travelers_jumper', 'minion', '0'),
                        makeCard('draw-b', 'time_travelers_time_raider', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_monkey_lab', [
                    makeMinion('winner', 'time_travelers_time_raider', '0', 24),
                ]),
                makeBase('base_the_vats', []),
            ],
            baseDeck: [],
            baseDiscard: ['base_faceless_city'],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const resolved = resolveInteractionChain(advance.finalState, (prompt) => {
            expect(prompt?.data?.sourceId).toBe('smashup_reaction_choose');
            const option = findInteractionOption(prompt, candidate =>
                candidate.value?.kind === 'play_action'
                && candidate.value?.cardUid === 'time-fleeting-a',
            );
            return { optionId: option.id };
        });

        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.BASE_DECK_REORDERED
            && (event.payload as { topDefIds?: string[]; reason?: string }).reason === 'time_travelers_time_is_fleeting'
            && JSON.stringify((event.payload as { topDefIds?: string[] }).topDefIds) === JSON.stringify(['base_faceless_city']),
        )).toBe(true);
        const delayUntil = (resolved.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil;
        expect(typeof delayUntil).toBe('number');
        const finalized = runCommand(resolved.finalState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: delayUntil,
        } as any);

        expect(finalized.success).toBe(true);
        expect(finalized.events.some(event =>
            event.type === SU_EVENTS.BASE_REPLACED
            && (event.payload as { newBaseDefId?: string }).newBaseDefId === 'base_faceless_city',
        )).toBe(true);
        expect(finalized.finalState.core.bases[0].defId).toBe('base_faceless_city');
        expect(finalized.finalState.core.baseDeck).toEqual([]);
        expect(finalized.finalState.core.baseDiscard).toEqual(['base_monkey_lab']);
        expect(finalized.finalState.core.players['0'].discard.map(card => card.uid)).toContain('time-fleeting-a');
    });

    it('时间旅行者：时间流逝在同一计分响应窗先结算后，仍应继续保留虫洞 special 入口', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('time-fleeting-a', 'time_travelers_time_is_fleeting', 'action', '0'),
                        makeCard('wormhole-a', 'time_travelers_wormhole', 'action', '0'),
                    ],
                    deck: [
                        makeCard('draw-a', 'time_travelers_doctor_when', 'minion', '0'),
                        makeCard('draw-b', 'time_travelers_time_raider', 'minion', '0'),
                        makeCard('deck-rest', 'time_travelers_1_21_gigawatts', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_monkey_lab', [
                    makeMinion('winner-a', 'time_travelers_time_raider', '0', 14),
                    makeMinion('traveler-a', 'time_travelers_jumper', '0', 10),
                    makeMinion('enemy-a', 'sharks_mako', '1', 5),
                ]),
                makeBase('base_portal_room', []),
            ],
            baseDeck: ['base_primate_park'],
            baseDiscard: ['base_the_vats', 'base_faceless_city'],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const promptSequence: string[] = [];
        const resolved = resolveInteractionChain(advance.finalState, (prompt, state) => {
            const refreshedState = refreshInteractionOptions(state);
            const refreshedPrompt = refreshedState.sys.interaction.current;
            promptSequence.push(refreshedPrompt?.data?.sourceId ?? prompt?.data?.sourceId ?? 'unknown');

            if (refreshedPrompt?.data?.sourceId === 'smashup_reaction_choose') {
                const wormholeOption = findInteractionOption(refreshedPrompt, candidate =>
                    candidate.value?.kind === 'play_action'
                    && candidate.value?.cardUid === 'wormhole-a',
                );
                const timeFleetingOption = findInteractionOption(refreshedPrompt, candidate =>
                    candidate.value?.kind === 'play_action'
                    && candidate.value?.cardUid === 'time-fleeting-a',
                );

                if (refreshedPrompt?.resolutionFrameId?.startsWith('onMinionDiscardedFromBase:')) {
                    const triggerOption = findInteractionOption(refreshedPrompt, candidate => candidate.value?.kind === 'trigger');
                    expect(triggerOption).toBeDefined();
                    return { optionId: triggerOption.id };
                }

                if (!promptSequence.includes('time_travelers_time_is_fleeting_choose')) {
                    expect(timeFleetingOption).toBeDefined();
                    expect(wormholeOption).toBeDefined();
                    return { optionId: timeFleetingOption.id };
                }

                expect(wormholeOption).toBeDefined();
                return { optionId: wormholeOption.id };
            }

            if (refreshedPrompt?.data?.sourceId === 'time_travelers_time_is_fleeting_choose') {
                const option = findInteractionOption(refreshedPrompt, candidate =>
                    candidate.value?.baseDefId === 'base_faceless_city',
                );
                return { optionId: option.id };
            }

            if (refreshedPrompt?.data?.sourceId === 'time_travelers_wormhole_choose') {
                const option = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'winner-a');
                return { optionIds: [option.id] };
            }

            throw new Error(`未处理的 Time Is Fleeting / Wormhole 多 special 交互：${refreshedPrompt?.data?.sourceId ?? prompt?.data?.sourceId ?? 'unknown'}`);
        });

        expect(promptSequence).toEqual([
            'smashup_reaction_choose',
            'smashup_reaction_choose',
            'time_travelers_time_is_fleeting_choose',
            'smashup_reaction_choose',
            'time_travelers_wormhole_choose',
        ]);
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.BASE_DECK_REORDERED
            && (event.payload as { reason?: string }).reason === 'time_travelers_time_is_fleeting',
        )).toBe(true);
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.DECK_REORDERED
            && (event.payload as { playerId?: string }).playerId === '0',
        )).toBe(true);
        const finalized = advancePostScoringDelay(resolved.finalState, '0');
        expect(finalized.finalState.core.bases[0].defId).toBe('base_faceless_city');
        expect(finalized.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-rest', 'winner-a']);
        expect(finalized.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['traveler-a', 'draw-a', 'draw-b']);
        expect(finalized.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([
            'time-fleeting-a',
            'wormhole-a',
        ]);
        expect(finalized.finalState.core.players['1'].discard.map(card => card.uid)).toEqual(['enemy-a']);
        expect(finalized.finalState.sys.interaction.current).toBeUndefined();
    });

    it('时间旅行者基地：传送门室在计分后排队赢家额外回合并在回合结束时消费', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbility('base_portal_room', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_portal_room',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 2 }],
            now: 1000,
        });
        const queued = applyEvents(core, result.events);
        const extraStarted = applyEvents(queued, [{
            type: SU_EVENTS.TURN_ENDED,
            payload: {
                playerId: '0',
                nextPlayerIndex: 0,
                extraTurnPlayerId: '0',
                extraTurnReturnToPlayerIndex: 1,
                extraTurnReason: 'base_portal_room',
            },
            timestamp: 1001,
        } as any]);
        const returned = applyEvents(extraStarted, [{
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '0', nextPlayerIndex: 1, completedExtraTurn: true },
            timestamp: 1002,
        } as any]);

        expect(result.events.some(event => event.type === SU_EVENTS.EXTRA_TURN_QUEUED)).toBe(true);
        expect(queued.pendingExtraTurns).toEqual([{ playerId: '0', returnToPlayerIndex: 1, reason: 'base_portal_room' }]);
        expect(extraStarted.currentPlayerIndex).toBe(0);
        expect(extraStarted.pendingExtraTurns).toBeUndefined();
        expect(extraStarted.activeExtraTurn).toEqual({ playerId: '0', returnToPlayerIndex: 1, reason: 'base_portal_room' });
        expect(returned.currentPlayerIndex).toBe(1);
        expect(returned.activeExtraTurn).toBeUndefined();
    });

    it('时间旅行者基地：传送门室的可选额外回合选择权属于赢家而不是当前回合玩家', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const random = { shuffle: <T,>(items: T[]) => [...items], random: () => 0.5, d: () => 1, range: (min: number) => min };
        const queued = collectBaseAbilityTriggers({
            core,
            timing: 'afterScoring',
            ownerPlayerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '1', power: 5, vp: 2 }],
            frameId: 'score-after:0:1000',
            sourceEventId: 'score-after:0:1000',
            now: 1000,
        });
        const trigger = (queued as any)?.payload?.triggers?.[0];
        expect(trigger?.ownerPlayerId).toBe('1');

        const prompted = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: [trigger] } as any),
            random,
            1001,
        );
        expect(prompted?.state.sys.interaction.current?.playerId).toBe('1');
        expect(prompted?.state.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const pass = findInteractionOption(prompted?.state.sys.interaction.current, option => option.id === 'pass');
        const skipped = runCommand(prompted!.state, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '1',
            payload: { optionId: pass.id },
        } as any, random);
        expect(skipped.events.some(event => event.type === SU_EVENTS.EXTRA_TURN_QUEUED)).toBe(false);
        expect(skipped.finalState.core.pendingExtraTurns).toBeUndefined();

        const promptedAgain = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: [trigger] } as any),
            random,
            1002,
        );
        const triggerOption = findInteractionOption(promptedAgain?.state.sys.interaction.current, option => option.value?.kind === 'trigger');
        const accepted = runCommand(promptedAgain!.state, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '1',
            payload: { optionId: triggerOption.id },
        } as any, random);
        expect(accepted.finalState.core.pendingExtraTurns).toEqual([{ playerId: '1', returnToPlayerIndex: 1, reason: 'base_portal_room' }]);
    });

    it('时间旅行者基地：传送门室若 afterScoring chooser 不在 turnOrder 中，则不应排出额外回合选择 trigger', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const queued = collectBaseAbilityTriggers({
            core,
            timing: 'afterScoring',
            ownerPlayerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '2', power: 5, vp: 2 }],
            frameId: 'score-after:0:1003',
            sourceEventId: 'score-after:0:1003',
            now: 1003,
        });

        expect(queued).toBeUndefined();
    });

    it('时间旅行者基地：传送门室在三人顺位下应于额外回合结束后回到原本下一位玩家', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbility('base_portal_room', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_portal_room',
            playerId: '1',
            rankings: [{ playerId: '0', power: 6, vp: 3 }],
            now: 1100,
        });
        const queued = applyEvents(core, result.events);
        const extraStarted = applyEvents(queued, [{
            type: SU_EVENTS.TURN_ENDED,
            payload: {
                playerId: '1',
                nextPlayerIndex: 0,
                extraTurnPlayerId: '0',
                extraTurnReturnToPlayerIndex: 2,
                extraTurnReason: 'base_portal_room',
            },
            timestamp: 1101,
        } as any]);
        const returned = applyEvents(extraStarted, [{
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '0', nextPlayerIndex: 2, completedExtraTurn: true },
            timestamp: 1102,
        } as any]);

        expect(queued.pendingExtraTurns).toEqual([{ playerId: '0', returnToPlayerIndex: 2, reason: 'base_portal_room' }]);
        expect(extraStarted.currentPlayerIndex).toBe(0);
        expect(extraStarted.activeExtraTurn).toEqual({ playerId: '0', returnToPlayerIndex: 2, reason: 'base_portal_room' });
        expect(returned.currentPlayerIndex).toBe(2);
        expect(returned.activeExtraTurn).toBeUndefined();
    });

    it('时间旅行者基地：传送门室存在多条待执行额外回合时应按队列顺序消费', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
            pendingExtraTurns: [
                { playerId: '2', returnToPlayerIndex: 1, reason: 'base_portal_room' },
                { playerId: '1', returnToPlayerIndex: 2, reason: 'base_portal_room' },
            ],
        };

        const firstExtraStarted = applyEvents(core, [{
            type: SU_EVENTS.TURN_ENDED,
            payload: {
                playerId: '0',
                nextPlayerIndex: 2,
                extraTurnPlayerId: '2',
                extraTurnReturnToPlayerIndex: 1,
                extraTurnReason: 'base_portal_room',
            },
            timestamp: 1201,
        } as any]);
        const firstExtraReturned = applyEvents(firstExtraStarted, [{
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '2', nextPlayerIndex: 1, completedExtraTurn: true },
            timestamp: 1202,
        } as any]);
        const secondExtraStarted = applyEvents(firstExtraReturned, [{
            type: SU_EVENTS.TURN_ENDED,
            payload: {
                playerId: '1',
                nextPlayerIndex: 1,
                extraTurnPlayerId: '1',
                extraTurnReturnToPlayerIndex: 2,
                extraTurnReason: 'base_portal_room',
            },
            timestamp: 1203,
        } as any]);
        const secondExtraReturned = applyEvents(secondExtraStarted, [{
            type: SU_EVENTS.TURN_ENDED,
            payload: { playerId: '1', nextPlayerIndex: 2, completedExtraTurn: true },
            timestamp: 1204,
        } as any]);

        expect(firstExtraStarted.currentPlayerIndex).toBe(2);
        expect(firstExtraStarted.pendingExtraTurns).toEqual([{ playerId: '1', returnToPlayerIndex: 2, reason: 'base_portal_room' }]);
        expect(firstExtraStarted.activeExtraTurn).toEqual({ playerId: '2', returnToPlayerIndex: 1, reason: 'base_portal_room' });

        expect(firstExtraReturned.currentPlayerIndex).toBe(1);
        expect(firstExtraReturned.pendingExtraTurns).toEqual([{ playerId: '1', returnToPlayerIndex: 2, reason: 'base_portal_room' }]);
        expect(firstExtraReturned.activeExtraTurn).toBeUndefined();

        expect(secondExtraStarted.currentPlayerIndex).toBe(1);
        expect(secondExtraStarted.pendingExtraTurns).toBeUndefined();
        expect(secondExtraStarted.activeExtraTurn).toEqual({ playerId: '1', returnToPlayerIndex: 2, reason: 'base_portal_room' });

        expect(secondExtraReturned.currentPlayerIndex).toBe(2);
        expect(secondExtraReturned.pendingExtraTurns).toBeUndefined();
        expect(secondExtraReturned.activeExtraTurn).toBeUndefined();
    });

    it("超级间谍基地：ISI摇摆据点让赢家重排自己牌库顶三张", () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-a', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-c', 'sharks_tiger_shark', 'minion', '0'),
                        makeCard('deck-d', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbilityWithMS('base_isis_swingin_pad', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_isis_swingin_pad',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
            now: 1000,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.REVEAL_DECK_TOP)).toBe(true);
        expect(result.matchState?.sys.interaction.current?.data?.sourceId).toBe('base_isis_swingin_pad_reorder');

        const resolved = resolveInteractionChain(result.matchState!, (prompt) => {
            const sourceId = prompt?.data?.sourceId;
            if (sourceId === 'base_isis_swingin_pad_reorder') {
                const option = findInteractionOption(prompt, candidate =>
                    candidate.value?.targetPlayerId === '0'
                    && candidate.value?.topUids?.join(',') === 'deck-c,deck-a'
                    && candidate.value?.bottomUids?.join(',') === 'deck-b',
                );
                return { optionId: option.id };
            }
            throw new Error(`未处理的 ISI 交互：${sourceId ?? 'unknown'}`);
        });

        expect(resolved.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-c',
            'deck-a',
            'deck-d',
            'deck-b',
        ]);
        expect(resolved.finalState.sys.interaction.current).toBeUndefined();
    });

    it("超级间谍基地：ISI摇摆据点真实计分后保留并重排赢家牌库", () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-a', 'super_spies_spy', 'minion', '0'),
                        makeCard('deck-b', 'super_spies_operative', 'minion', '0'),
                        makeCard('deck-c', 'super_spies_mole', 'minion', '0'),
                        makeCard('deck-d', 'super_spies_secret_agent', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('winner', 'super_spies_secret_agent', '0', 22),
                ]),
                makeBase('base_secret_volcano_headquarters', []),
            ],
            baseDeck: ['base_portal_room'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const resolved = resolveInteractionChain(advance.finalState, (prompt, state) => {
            if (prompt?.data?.sourceId === 'smashup_reaction_choose') {
                const option = findInteractionOption(prompt, candidate => {
                    const triggerId = candidate.value?.triggerId;
                    const trigger = state.core.triggerQueue?.find(entry => entry.id === triggerId);
                    return trigger?.sourceDefId === 'base_isis_swingin_pad';
                });
                return { optionId: option.id };
            }
            const option = findInteractionOption(prompt, candidate =>
                candidate.value?.targetPlayerId === '0'
                && candidate.value?.topUids?.join(',') === 'deck-c,deck-a'
                && candidate.value?.bottomUids?.join(',') === 'deck-b',
            );
            return { optionId: option.id };
        });

        expect(resolved.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        const delayUntil = (resolved.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil;
        expect(typeof delayUntil).toBe('number');
        const finalized = runCommand(resolved.finalState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: delayUntil,
        } as any);

        expect(finalized.success).toBe(true);
        expect(finalized.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-d',
            'deck-b',
        ]);
        expect(finalized.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'deck-c',
            'deck-a',
        ]);
        expect(finalized.finalState.core.bases[0].defId).toBe('base_portal_room');
    });

    it("超级间谍基地：ISI摇摆据点真实计分后可跳过响应并正常继续收口", () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-a', 'super_spies_spy', 'minion', '0'),
                        makeCard('deck-b', 'super_spies_operative', 'minion', '0'),
                        makeCard('deck-c', 'super_spies_mole', 'minion', '0'),
                        makeCard('deck-d', 'super_spies_secret_agent', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('winner', 'super_spies_secret_agent', '0', 22),
                ]),
                makeBase('base_secret_volcano_headquarters', []),
            ],
            baseDeck: ['base_portal_room'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const prompt = advance.finalState.sys.interaction.current!;
        const passOption = findInteractionOption(prompt, candidate => candidate.value?.kind === 'pass');
        const skipped = runCommand(advance.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: prompt.playerId,
            payload: { interactionId: prompt.id, optionId: passOption.id },
            timestamp: 1001,
        } as any);

        expect(skipped.success).toBe(true);
        expect(skipped.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(false);
        const delayUntil = (skipped.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil;
        expect(typeof delayUntil).toBe('number');
        const finalized = runCommand(skipped.finalState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: delayUntil,
        } as any);

        expect(finalized.success).toBe(true);
        expect(finalized.finalState.sys.phase).toBe('playCards');
        expect(finalized.finalState.core.currentPlayerIndex).toBe(1);
        expect(finalized.finalState.sys.interaction.current).toBeUndefined();
        expect(finalized.finalState.sys.responseWindow?.current).toBeUndefined();
        expect((finalized.finalState.core.triggerQueue ?? []).some(trigger => trigger.sourceDefId === 'base_isis_swingin_pad')).toBe(false);
        expect(finalized.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-c',
            'deck-d',
        ]);
        expect(finalized.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([
            'deck-a',
            'deck-b',
        ]);
        expect(finalized.finalState.core.bases[0].defId).toBe('base_portal_room');
    });

    it("超级间谍基地：ISI摇摆据点在短牌库下仍可按赢家看到的牌重排", () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('isi-short-a', 'super_spies_spy', 'minion', '0'),
                        makeCard('isi-short-b', 'super_spies_operative', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('winner', 'super_spies_secret_agent', '0', 22),
                ]),
                makeBase('base_secret_volcano_headquarters', []),
            ],
            baseDeck: ['base_portal_room'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbilityWithMS('base_isis_swingin_pad', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_isis_swingin_pad',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
            now: 1000,
        });

        const prompt = result.matchState?.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('base_isis_swingin_pad_reorder');
        expect(prompt?.data?.inspectedUids).toEqual(['isi-short-a', 'isi-short-b']);

        const resolved = resolveInteractionChain(result.matchState!, prompt => {
            const option = findInteractionOption(prompt, candidate =>
                candidate.value?.targetPlayerId === '0'
                && candidate.value?.topUids?.join(',') === 'isi-short-b'
                && candidate.value?.bottomUids?.join(',') === 'isi-short-a',
            );
            return { optionId: option.id };
        });

        expect(resolved.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'isi-short-b',
            'isi-short-a',
        ]);
        expect(resolved.finalState.sys.interaction.current).toBeUndefined();
    });

    it("超级间谍基地：ISI摇摆据点 handler 拒绝未查看牌进入顶/底分区", () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('deck-a', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-c', 'sharks_tiger_shark', 'minion', '0'),
                        makeCard('deck-d', 'sharks_great_white', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [])],
            baseDeck: [],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbilityWithMS('base_isis_swingin_pad', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_isis_swingin_pad',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
            now: 1000,
        });

        const prompt = result.matchState?.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('base_isis_swingin_pad_reorder');
        expect(prompt?.data?.inspectedUids).toEqual(['deck-a', 'deck-b', 'deck-c']);

        const handler = getInteractionHandler('base_isis_swingin_pad_reorder');
        const handled = handler?.(
            result.matchState!,
            '0',
            { targetPlayerId: '0', topUids: ['deck-d'], bottomUids: ['deck-a', 'deck-b'] },
            prompt?.data,
            () => 0.5,
            1001,
        );

        expect(handled?.events).toEqual([]);
    });

    it('变形者：有丝分裂在多张同名手牌中按玩家选择额外打出对象', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mitosis-a', 'shapeshifters_mitosis', 'action', '0'),
                        makeCard('same-a', 'sharks_mako', 'minion', '0'),
                        makeCard('same-b', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('target', 'sharks_mako', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mitosis-a', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('shapeshifters_mitosis_choose');
        expect(findInteractionOption(prompt, candidate => candidate.value?.skip === true)).toBeTruthy();

        const resolved = resolveInteractionChain(played.finalState, prompt => {
            return chooseCardOptionRejectingUnexpectedImmediateExtraMinion(prompt, 'same-b');
        });

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['target', 'same-b']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['same-a']);
        expect(resolved.finalState.sys.interaction.current?.data?.sourceId).not.toBe('smashup_immediate_extra_minion');
    });

    it('变形者：有丝分裂同名手牌选择拒绝非本次候选的晚加入同名牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mitosis-a', 'shapeshifters_mitosis', 'action', '0'),
                        makeCard('same-a', 'sharks_mako', 'minion', '0'),
                        makeCard('same-b', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_vats', [
                makeMinion('target', 'sharks_mako', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mitosis-a', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('shapeshifters_mitosis_choose');

        const forgedState = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                players: {
                    ...played.finalState.core.players,
                    '0': {
                        ...played.finalState.core.players['0'],
                        hand: [
                            ...played.finalState.core.players['0'].hand,
                            makeCard('late-same', 'sharks_mako', 'minion', '0'),
                        ],
                    },
                },
            },
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                {
                                    id: 'forged-late-same',
                                    label: 'forged late same',
                                    value: { cardUid: 'late-same', baseIndex: 0, sameNameDefId: 'sharks_mako' },
                                },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-same' },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['target']);
        expect(forged.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['same-a', 'same-b', 'late-same']);
    });

    it('变形者：有丝分裂的同名判定支持 POD 别名而不是只比较 defId 字符串', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('mitosis-a', 'shapeshifters_mitosis', 'action', '0'),
                        makeCard('pod-invader', 'alien_invader_pod', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_faceless_city', [
                makeMinion('target', 'alien_invader', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'mitosis-a', targetBaseIndex: 0, targetMinionUid: 'target' },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('shapeshifters_mitosis_choose');
        expect(findInteractionOption(prompt, candidate => candidate.value?.skip === true)).toBeTruthy();

        const resolved = resolveInteractionChain(played.finalState, prompt => {
            return chooseCardOptionRejectingUnexpectedImmediateExtraMinion(prompt, 'pod-invader');
        });

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['target', 'pod-invader']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([]);
        expect(resolved.finalState.sys.interaction.current?.data?.sourceId).not.toBe('smashup_immediate_extra_minion');
    });

    it('电子猿：飞猴在计分后按玩家选择另一基地并可跳过自动移动', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_primate_park', [
                    makeMinion('host', 'sharks_mako', '0', 2, {
                        attachedActions: [{ uid: 'flying-a', defId: 'cyborg_apes_flying_monkey', ownerId: '0' }],
                    }),
                ]),
                makeBase('base_monkey_lab', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: () => 0.5,
            now: 1000,
        });

        expect(triggered.matchState?.sys.interaction.current?.data?.sourceId).toBe('cyborg_apes_flying_monkey_move');

        const resolved = resolveInteractionChain(triggered.matchState!, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.toBaseIndex === 1);
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(resolved.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual(['host']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('flying-a');
    });

    it('电子猿：borrowed 飞猴在计分后应把移动选择权交给控制者而不是真实 owner', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_primate_park', [
                    makeMinion('host', 'sharks_mako', '0', 2, {
                        attachedActions: [{ uid: 'flying-borrowed', defId: 'cyborg_apes_flying_monkey', ownerId: '1', metadata: { sourceControllerId: '0' } } as any],
                    }),
                ]),
                makeBase('base_monkey_lab', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: () => 0.5,
            now: 1000,
        });

        expect(triggered.matchState?.sys.interaction.current?.data?.sourceId).toBe('cyborg_apes_flying_monkey_move');
        expect(triggered.matchState?.sys.interaction.current?.playerId).toBe('0');
    });

    it('变形者：borrowed 细胞结合复制飞猴后也应把移动选择权交给控制者而不是真实 owner', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_primate_park', [
                    makeMinion('bond-host', 'sharks_mako', '0', 2, {
                        attachedActions: [{
                            uid: 'bond-borrowed',
                            defId: 'shapeshifters_cellular_bonding',
                            ownerId: '1',
                            metadata: { sourceControllerId: '0' },
                        } as any],
                        metadata: {
                            cellularBondingCardUid: 'bond-borrowed',
                            cellularBondingCopiedActionDefId: 'cyborg_apes_flying_monkey',
                        } as any,
                    }),
                ]),
                makeBase('base_monkey_lab', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            sourceCardUid: 'bond-borrowed',
            sourceBaseIndex: 0,
            sourceControllerId: '0',
            random: () => 0.5,
            now: 1001,
        });

        expect(triggered.matchState?.sys.interaction.current?.data?.sourceId).toBe('cyborg_apes_flying_monkey_move');
        expect(triggered.matchState?.sys.interaction.current?.playerId).toBe('0');
        expect(triggered.matchState?.sys.interaction.current?.data?.allowedFlyingMonkeyMoves).toEqual([{
            minionUid: 'bond-host',
            actionUid: 'bond-borrowed',
            fromBaseIndex: 0,
            toBaseIndex: 1,
            reason: 'shapeshifters_cellular_bonding_flying_monkey',
        }]);
    });

    it('电子猿：飞猴真实计分后移动宿主并摧毁本行动进入弃牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    factions: ['cyborg_apes'],
                    minionsPlayed: 1,
                    deck: [
                        makeCard('draw-a', 'cyborg_apes_cyberback', 'minion', '0'),
                        makeCard('draw-b', 'cyborg_apes_chimp_chi', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', { factions: ['super_spies'] }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_monkey_lab', [
                    makeMinion('flying-host', 'cyborg_apes_cyberback', '0', 24, {
                        attachedActions: [{ uid: 'flying-action', defId: 'cyborg_apes_flying_monkey', ownerId: '0' }],
                    }),
                ]),
                makeBase('base_secret_volcano_headquarters', []),
            ],
            baseDeck: ['base_portal_room'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.interaction.current?.data?.sourceId).toBe('cyborg_apes_flying_monkey_move');

        const resolved = resolveInteractionChain(advance.finalState, (prompt, state) => {
            if (prompt?.data?.sourceId === 'smashup_reaction_choose') {
                const option = findInteractionOption(prompt, candidate => {
                    const triggerId = candidate.value?.triggerId;
                    const trigger = state.core.triggerQueue?.find(entry => entry.id === triggerId);
                    return trigger?.sourceDefId === 'cyborg_apes_flying_monkey';
                });
                return { optionId: option.id };
            }
            if (prompt?.data?.sourceId === 'cyborg_apes_flying_monkey_move') {
                const option = findInteractionOption(prompt, candidate => candidate.value?.toBaseIndex === 1);
                return { optionId: option.id };
            }
            throw new Error(`未处理的飞猴真实计分交互：${prompt?.data?.sourceId ?? 'unknown'}`);
        });
        const delayUntil = (resolved.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil;
        expect(typeof delayUntil).toBe('number');
        const finalized = runCommand(resolved.finalState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: delayUntil,
        } as any);

        expect(finalized.success).toBe(true);

        const sourceBase = finalized.finalState.core.bases[0];
        const destinationBase = finalized.finalState.core.bases[1];
        const movedHost = destinationBase.minions.find(minion => minion.uid === 'flying-host');

        expect(sourceBase.defId).toBe('base_portal_room');
        expect(sourceBase.minions.map(minion => minion.uid)).toEqual([]);
        expect(destinationBase.defId).toBe('base_secret_volcano_headquarters');
        expect(destinationBase.minions.map(minion => minion.uid)).toEqual(['flying-host', 'draw-a']);
        expect(movedHost?.attachedActions.map(action => action.uid)).not.toContain('flying-action');
        expect(finalized.finalState.core.players['0'].discard.map(card => card.uid)).toContain('flying-action');
    });

    it('电子猿：飞猴真实计分后跳过移动时应按正常计分清场进入弃牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    factions: ['cyborg_apes'],
                    minionsPlayed: 1,
                    deck: [
                        makeCard('draw-a', 'cyborg_apes_cyberback', 'minion', '0'),
                        makeCard('draw-b', 'cyborg_apes_chimp_chi', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', { factions: ['super_spies'] }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_monkey_lab', [
                    makeMinion('flying-host', 'cyborg_apes_cyberback', '0', 24, {
                        attachedActions: [{ uid: 'flying-action', defId: 'cyborg_apes_flying_monkey', ownerId: '0' }],
                    }),
                ]),
                makeBase('base_secret_volcano_headquarters', []),
            ],
            baseDeck: ['base_portal_room'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.interaction.current?.data?.sourceId).toBe('cyborg_apes_flying_monkey_move');

        const resolved = resolveInteractionChain(advance.finalState, prompt => {
            if (prompt?.data?.sourceId === 'cyborg_apes_flying_monkey_move') {
                const option = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
                return { optionId: option.id };
            }
            throw new Error(`未处理的飞猴跳过计分交互：${prompt?.data?.sourceId ?? 'unknown'}`);
        });
        const delayUntil = (resolved.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil;
        expect(typeof delayUntil).toBe('number');
        const finalized = runCommand(resolved.finalState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: delayUntil,
        } as any);

        expect(finalized.success).toBe(true);

        const sourceBase = finalized.finalState.core.bases[0];
        const destinationBase = finalized.finalState.core.bases[1];

        expect(sourceBase.defId).toBe('base_portal_room');
        expect(sourceBase.minions.map(minion => minion.uid)).toEqual([]);
        expect(destinationBase.defId).toBe('base_secret_volcano_headquarters');
        expect(destinationBase.minions.map(minion => minion.uid)).toEqual([]);
        expect(finalized.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-a', 'draw-b']);
        expect(finalized.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(
            expect.arrayContaining(['flying-host', 'flying-action']),
        );
    });

    it('电子猿：飞猴 handler 拒绝 prompt 后伪造的新随从行动和新目的地', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_primate_park', [
                    makeMinion('host', 'sharks_mako', '0', 2, {
                        attachedActions: [{ uid: 'flying-a', defId: 'cyborg_apes_flying_monkey', ownerId: '0' }],
                    }),
                ]),
                makeBase('base_monkey_lab', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            random: () => 0.5,
            now: 1000,
        });
        const prompt = triggered.matchState!.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('cyborg_apes_flying_monkey_move');
        expect(prompt.data.allowedFlyingMonkeyMoves).toEqual([{
            minionUid: 'host',
            actionUid: 'flying-a',
            fromBaseIndex: 0,
            toBaseIndex: 1,
            reason: 'cyborg_apes_flying_monkey',
        }]);

        const forgedLateTarget = {
            ...triggered.matchState!,
            core: {
                ...triggered.matchState!.core,
                bases: [
                    makeBase('base_primate_park', [
                        ...triggered.matchState!.core.bases[0].minions,
                        makeMinion('late-host', 'sharks_mako', '0', 2, {
                            attachedActions: [{ uid: 'late-flying', defId: 'cyborg_apes_flying_monkey', ownerId: '0' }],
                        }),
                    ]),
                    triggered.matchState!.core.bases[1],
                ],
            },
            sys: {
                ...triggered.matchState!.sys,
                interaction: {
                    ...triggered.matchState!.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                {
                                    id: 'forged-late-target',
                                    label: 'forged late target',
                                    value: {
                                        minionUid: 'late-host',
                                        actionUid: 'late-flying',
                                        fromBaseIndex: 0,
                                        toBaseIndex: 1,
                                        reason: 'cyborg_apes_flying_monkey',
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        };

        const forgedLateResult = runCommand(forgedLateTarget, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-target' },
        } as any);

        expect(forgedLateResult.success).toBe(true);
        expect(forgedLateResult.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['host', 'late-host']);
        expect(forgedLateResult.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual([]);
        expect(forgedLateResult.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([]);

        const forgedDestination = {
            ...triggered.matchState!,
            core: {
                ...triggered.matchState!.core,
                bases: [
                    triggered.matchState!.core.bases[0],
                    triggered.matchState!.core.bases[1],
                    makeBase('base_faceless_city', []),
                ],
            },
            sys: {
                ...triggered.matchState!.sys,
                interaction: {
                    ...triggered.matchState!.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                {
                                    id: 'forged-new-base',
                                    label: 'forged new base',
                                    value: {
                                        minionUid: 'host',
                                        actionUid: 'flying-a',
                                        fromBaseIndex: 0,
                                        toBaseIndex: 2,
                                        reason: 'cyborg_apes_flying_monkey',
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        };

        const forgedDestinationResult = runCommand(forgedDestination, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-new-base' },
        } as any);

        expect(forgedDestinationResult.success).toBe(true);
        expect(forgedDestinationResult.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['host']);
        expect(forgedDestinationResult.finalState.core.bases[1].minions.map(minion => minion.uid)).toEqual([]);
        expect(forgedDestinationResult.finalState.core.bases[2].minions.map(minion => minion.uid)).toEqual([]);
        expect(forgedDestinationResult.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([]);
    });

    it('超级间谍：秘密特工让打出行动的玩家自己选择弃掉任意手牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('hand-a', 'sharks_mako', 'minion', '0'),
                        makeCard('hand-b', 'super_spies_from_q_with_love', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [
                makeMinion('agent-a', 'super_spies_secret_agent', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: () => 0.5,
            now: 1000,
        });

        expect(triggered.matchState?.sys.interaction.current?.data?.sourceId).toBe('super_spies_secret_agent_discard');

        const resolved = resolveInteractionChain(triggered.matchState!, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'hand-b');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['hand-a']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toContain('hand-b');
    });

    it('超级间谍：秘密特工弃牌 handler 拒绝非本次候选的晚加入手牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('hand-a', 'sharks_mako', 'minion', '0'),
                        makeCard('hand-b', 'super_spies_from_q_with_love', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_isis_swingin_pad', [
                makeMinion('agent-a', 'super_spies_secret_agent', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const triggered = fireTriggers(core, 'onActionPlayed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            random: () => 0.5,
            now: 1000,
        });
        const prompt = triggered.matchState!.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('super_spies_secret_agent_discard');

        const forgedState = {
            ...triggered.matchState!,
            core: {
                ...triggered.matchState!.core,
                players: {
                    ...triggered.matchState!.core.players,
                    '0': {
                        ...triggered.matchState!.core.players['0'],
                        hand: [
                            ...triggered.matchState!.core.players['0'].hand,
                            makeCard('late-hand', 'time_travelers_time_walk', 'action', '0'),
                        ],
                    },
                },
            },
            sys: {
                ...triggered.matchState!.sys,
                interaction: {
                    ...triggered.matchState!.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-hand', label: 'forged late hand', value: { cardUid: 'late-hand' } },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-hand' },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['hand-a', 'hand-b', 'late-hand']);
        expect(forged.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([]);
    });

    it('超级间谍：秘密特工在真实 PLAY_ACTION 链上应让行动玩家弃一张剩余手牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('stasis-a', 'time_travelers_stasis_field', 'action', '0'),
                        makeCard('hand-a', 'sharks_mako', 'minion', '0'),
                        makeCard('hand-b', 'time_travelers_time_walk', 'action', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.SUPER_SPIES, SMASHUP_FACTION_IDS.TIME_TRAVELERS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.TIME_TRAVELERS, SMASHUP_FACTION_IDS.CYBORG_APES],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('agent-a', 'super_spies_secret_agent', '1', 2),
                ]),
                makeBase('base_portal_room', []),
            ],
            baseDeck: ['base_the_nexus'],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'stasis-a', targetBaseIndex: 1 },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.core.bases[1]?.ongoingActions.map(card => card.uid)).toContain('stasis-a');
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('super_spies_secret_agent_discard');
        expect(played.finalState.sys.interaction.current?.playerId).toBe('0');
    });

    it('超级间谍：秘密特工在真实 PLAY_ACTION 链上若只剩一张手牌应自动弃掉且不弹 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('stasis-a', 'time_travelers_stasis_field', 'action', '0'),
                        makeCard('hand-a', 'sharks_mako', 'minion', '0'),
                    ],
                    factions: [SMASHUP_FACTION_IDS.SUPER_SPIES, SMASHUP_FACTION_IDS.TIME_TRAVELERS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.TIME_TRAVELERS, SMASHUP_FACTION_IDS.CYBORG_APES],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('agent-a', 'super_spies_secret_agent', '1', 2),
                ]),
                makeBase('base_portal_room', []),
            ],
            baseDeck: ['base_the_nexus'],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'stasis-a', targetBaseIndex: 1 },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.core.bases[1]?.ongoingActions.map(card => card.uid)).toContain('stasis-a');
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([]);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['hand-a']);
    });

    it('超级间谍：秘密特工在真实 PLAY_ACTION 链上若打完后已无剩余手牌则不应创建弃牌 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('stasis-a', 'time_travelers_stasis_field', 'action', '0')],
                    factions: [SMASHUP_FACTION_IDS.SUPER_SPIES, SMASHUP_FACTION_IDS.TIME_TRAVELERS],
                }),
                '1': makePlayer('1', {
                    factions: [SMASHUP_FACTION_IDS.TIME_TRAVELERS, SMASHUP_FACTION_IDS.CYBORG_APES],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_isis_swingin_pad', [
                    makeMinion('agent-a', 'super_spies_secret_agent', '1', 2),
                ]),
                makeBase('base_portal_room', []),
            ],
            baseDeck: ['base_the_nexus'],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'stasis-a', targetBaseIndex: 1 },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.core.bases[1]?.ongoingActions.map(card => card.uid)).toContain('stasis-a');
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).toEqual([]);
        expect(played.finalState.core.players['0'].discard.map(card => card.uid)).toEqual([]);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
    });

    it('时间旅行者：令人震惊在弃牌堆多张行动中按玩家选择要打出的行动', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('astounding-a', 'time_travelers_its_astounding', 'action', '0')],
                    discard: [
                        makeCard('action-a', 'super_spies_for_my_eyes_only', 'action', '0'),
                        makeCard('action-b', 'time_travelers_time_walk', 'action', '0'),
                    ],
                    deck: [makeCard('draw-a', 'sharks_mako', 'minion', '0'), makeCard('draw-b', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'astounding-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('time_travelers_its_astounding_choose');

        const prompt = played.finalState.sys.interaction.current;
        const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'action-b');
        const resolved = runCommand(played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: prompt!.playerId,
            payload: { optionId: option.id },
        } as any);

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('action-b');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['action-a', 'astounding-a']);
        expect(resolved.finalState.core.players['0'].deck.at(-1)?.uid).toBe('action-b');
        expect(resolved.finalState.core.players['0'].minionLimit).toBe(2);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(2);
    });

    it('时间旅行者：令人震惊从弃牌堆打出会继续创建 runtime prompt 的行动时，不应丢失后续交互链', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('astounding-a', 'time_travelers_its_astounding', 'action', '0')],
                    discard: [makeCard('eyes-a', 'super_spies_for_my_eyes_only', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-c', 'sharks_tiger_shark', 'minion', '0'),
                        makeCard('deck-d', 'sharks_great_white', 'minion', '0'),
                        makeCard('deck-e', 'sharks_mako', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'astounding-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('super_spies_for_my_eyes_only_reorder');

        const resolved = resolveInteractionChain(played.finalState, (prompt) => {
            const option = findInteractionOption(prompt, candidate =>
                candidate.value?.topUids?.join(',') === 'deck-c,deck-a'
                && candidate.value?.bottomUids?.join(',') === 'deck-d,deck-b,deck-e',
            );
            return { optionId: option.id };
        });

        expect(resolved.finalState.sys.interaction.current).toBeUndefined();
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['astounding-a', 'eyes-a']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-c',
            'deck-a',
            'deck-d',
            'deck-b',
            'deck-e',
        ]);
    });

    it('时间旅行者：令人震惊 handler 拒绝 prompt 后晚加入的弃牌堆行动', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('astounding-a', 'time_travelers_its_astounding', 'action', '0')],
                    discard: [
                        makeCard('action-a', 'super_spies_for_my_eyes_only', 'action', '0'),
                        makeCard('action-b', 'time_travelers_time_walk', 'action', '0'),
                    ],
                    deck: [makeCard('draw-a', 'sharks_mako', 'minion', '0'), makeCard('draw-b', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'astounding-a' },
        } as any);

        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.allowedCardUids).toEqual(['action-a', 'action-b']);
        const forgedState = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                players: {
                    ...played.finalState.core.players,
                    '0': {
                        ...played.finalState.core.players['0'],
                        discard: [
                            ...played.finalState.core.players['0'].discard,
                            makeCard('late-action', 'time_travelers_time_walk', 'action', '0'),
                        ],
                    },
                },
            },
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-action', label: 'forged late action', value: { cardUid: 'late-action' } },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-action' },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.players['0'].discard.map(card => card.uid)).toContain('late-action');
        expect(forged.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['draw-a', 'draw-b']);
        expect(forged.finalState.core.players['0'].minionLimit ?? 1).toBe(1);
        expect(forged.finalState.core.players['0'].actionLimit ?? 1).toBe(1);
    });

    it('时间旅行者：令人震惊从弃牌堆打需要基地目标的行动时保留目标链并执行该行动效果', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('astounding-a', 'time_travelers_its_astounding', 'action', '0')],
                    discard: [makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_monkey_lab', [
                    makeMinion('host-a', 'sharks_mako', '0', 2, {
                        attachedActions: [
                            { uid: 'own-action', defId: 'cyborg_apes_cyberevolution', ownerId: '0' },
                            { uid: 'enemy-action', defId: 'shapeshifters_splice_as_nice', ownerId: '1' },
                        ],
                    }),
                ]),
                makeBase('base_portal_room', [
                    makeMinion('host-b', 'sharks_mako', '1', 2, {
                        attachedActions: [{ uid: 'other-base-action', defId: 'cyborg_apes_shielding', ownerId: '1' }],
                    }),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'astounding-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('time_travelers_its_astounding_target');

        const prompt = played.finalState.sys.interaction.current;
        const targetBase = findInteractionOption(prompt, candidate => candidate.value?.targetBaseIndex === 0);
        const resolved = runCommand(played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: prompt!.playerId,
            payload: { optionId: targetBase.id },
        } as any);

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions[0].attachedActions.map(action => action.uid)).toEqual(['own-action']);
        expect(resolved.finalState.core.bases[1].minions[0].attachedActions.map(action => action.uid)).toEqual(['other-base-action']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['astounding-a', 'bananas-a']);
    });

    it('时间旅行者：令人震惊从弃牌堆打需要随从目标的持续行动时保留目标链并附着到所选宿主', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('astounding-a', 'time_travelers_its_astounding', 'action', '0')],
                    discard: [makeCard('evo-a', 'cyborg_apes_cyberevolution', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_the_vats', [
                    makeMinion('own-host', 'time_travelers_jumper', '0', 2),
                ]),
                makeBase('base_portal_room', [
                    makeMinion('enemy-host', 'sharks_mako', '1', 2),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'astounding-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('time_travelers_its_astounding_target');

        const prompt = played.finalState.sys.interaction.current;
        expect(findInteractionOption(prompt, candidate => candidate.value?.targetMinionUid === 'own-host')).toBeTruthy();
        expect(findInteractionOption(prompt, candidate => candidate.value?.targetMinionUid === 'enemy-host')).toBeTruthy();

        const targetEnemyHost = findInteractionOption(prompt, candidate => candidate.value?.targetMinionUid === 'enemy-host');
        const resolved = runCommand(played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: prompt!.playerId,
            payload: { optionId: targetEnemyHost.id },
        } as any);

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].minions[0].attachedActions).toEqual([]);
        expect(resolved.finalState.core.bases[1].minions[0].attachedActions.map(action => action.uid)).toEqual(['evo-a']);
        expect(getEffectivePower(resolved.finalState.core, resolved.finalState.core.bases[1].minions[0], 1)).toBe(5);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['astounding-a']);
    });

    it('时间旅行者：令人震惊从弃牌堆打出 borrowed 持续行动时，附着后仍应保留真实 owner', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('astounding-a', 'time_travelers_its_astounding', 'action', '0')],
                    discard: [makeCard('borrowed-evo', 'cyborg_apes_cyberevolution', 'action', '1')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_the_vats', [
                    makeMinion('host-a', 'time_travelers_jumper', '0', 2),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'astounding-a' },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('time_travelers_its_astounding_target');

        const targetHost = findInteractionOption(prompt, candidate => candidate.value?.targetMinionUid === 'host-a');
        const resolved = runCommand(played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: prompt!.playerId,
            payload: { optionId: targetHost.id },
        } as any);

        expect(resolved.success).toBe(true);
        const host = resolved.finalState.core.bases[0].minions[0];
        expect(host.attachedActions).toHaveLength(1);
        expect(host.attachedActions[0]).toMatchObject({
            uid: 'borrowed-evo',
            defId: 'cyborg_apes_cyberevolution',
            ownerId: '1',
        });
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['astounding-a']);
        expect(resolved.finalState.core.players['1'].discard.map(card => card.uid)).toEqual([]);
    });

    it('时间旅行者：令人震惊目标 handler 会拒绝伪造的不合法目标', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('astounding-a', 'time_travelers_its_astounding', 'action', '0')],
                    discard: [makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host-a', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'enemy-action', defId: 'shapeshifters_splice_as_nice', ownerId: '1' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'astounding-a' },
        } as any);
        const prompt = played.finalState.sys.interaction.current;
        const forgedState = {
            ...played.finalState,
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt!,
                        data: {
                            ...prompt!.data,
                            options: [
                                ...prompt!.data.options,
                                {
                                    id: 'forged-base',
                                    label: 'forged',
                                    value: { cardUid: 'bananas-a', targetBaseIndex: 99 },
                                },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-base' },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.bases[0].minions[0].attachedActions.map(action => action.uid)).toEqual(['enemy-action']);
        expect(forged.finalState.core.players['0'].discard.map(card => card.uid)).toContain('bananas-a');
    });

    it('时间旅行者：令人震惊目标 handler 拒绝 prompt 后晚加入的新合法目标', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('astounding-a', 'time_travelers_its_astounding', 'action', '0')],
                    discard: [makeCard('bananas-a', 'cyborg_apes_going_bananas', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('host-a', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'enemy-action-a', defId: 'shapeshifters_splice_as_nice', ownerId: '1' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'astounding-a' },
        } as any);
        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('time_travelers_its_astounding_target');
        expect(prompt.data.allowedDiscardActionTargets).toEqual([{ cardUid: 'bananas-a', targetBaseIndex: 0 }]);

        const forgedState = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                bases: [
                    ...played.finalState.core.bases,
                    makeBase('base_portal_room', [
                        makeMinion('host-b', 'sharks_mako', '1', 2, {
                            attachedActions: [{ uid: 'enemy-action-b', defId: 'cyborg_apes_shielding', ownerId: '1' }],
                        }),
                    ]),
                ],
            },
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                {
                                    id: 'forged-late-live-target',
                                    label: 'forged late live target',
                                    value: { cardUid: 'bananas-a', targetBaseIndex: 1 },
                                },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-live-target' },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.bases[0].minions[0].attachedActions.map(action => action.uid)).toEqual(['enemy-action-a']);
        expect(forged.finalState.core.bases[1].minions[0].attachedActions.map(action => action.uid)).toEqual(['enemy-action-b']);
        expect(forged.finalState.core.players['0'].discard.map(card => card.uid)).toContain('bananas-a');
    });

    it('时间旅行者：时间流动可选择场上行动而不是只返回随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('slip-a', 'time_travelers_into_the_time_slip', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_portal_room',
                minions: [makeMinion('minion-a', 'sharks_mako', '0', 2)],
                ongoingActions: [{ uid: 'stasis-a', defId: 'time_travelers_stasis_field', ownerId: '1' }],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'slip-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('time_travelers_into_the_time_slip_choose');
        expect(
            findInteractionOption(
                getSimpleChoicePrompt(played.finalState, 'time_travelers_into_the_time_slip_choose'),
                candidate => candidate.value?.cardUid === 'minion-a',
            )?.value?.minionUid,
        ).toBe('minion-a');

        const resolved = resolveInteractionChain(played.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'stasis-a');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.bases[0].ongoingActions).toEqual([]);
        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).toContain('stasis-a');
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toContain('minion-a');
    });

    it('时间旅行者：时间流动真实入口只剩一个场上候选时应自动回手且不弹选择 prompt', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('slip-a', 'time_travelers_into_the_time_slip', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase({
                defId: 'base_portal_room',
                minions: [],
                ongoingActions: [{ uid: 'stasis-only', defId: 'time_travelers_stasis_field', ownerId: '1' }],
            })],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'slip-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current).toBeUndefined();
        expect(played.finalState.core.bases[0].ongoingActions).toEqual([]);
        expect(played.finalState.core.players['1'].hand.map(card => card.uid)).toContain('stasis-only');
        expect(played.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('stasis-only');
    });

    it('时间旅行者：时间流动可返回附着行动且 handler 拒绝非本次候选场上牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('slip-a', 'time_travelers_into_the_time_slip', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('host-a', 'sharks_mako', '0', 2, {
                    attachedActions: [{ uid: 'attached-a', defId: 'cyborg_apes_shielding', ownerId: '1' }],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'slip-a' },
        } as any);

        const prompt = played.finalState.sys.interaction.current;
        expect(prompt?.data?.targetType).toBe('board');
        expect(findInteractionOption(prompt!, candidate => candidate.value?.cardUid === 'host-a').value?.minionUid).toBe('host-a');
        const resolved = resolveInteractionChain(played.finalState, currentPrompt => {
            const option = findInteractionOption(currentPrompt, candidate => candidate.value?.cardUid === 'attached-a');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.bases[0].minions[0].attachedActions).toEqual([]);
        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).toContain('attached-a');

        const forgedState = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                bases: [{
                    ...played.finalState.core.bases[0],
                    ongoingActions: [{ uid: 'late-action', defId: 'time_travelers_stasis_field', ownerId: '1' }],
                }],
            },
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt!.data,
                            options: [
                                ...prompt!.data.options,
                                { id: 'forged-late-action', label: 'forged late action', value: { cardUid: 'late-action' } },
                            ],
                        },
                    },
                },
            },
        };
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-action' },
        } as any);

        expect(forged.finalState.core.bases[0].ongoingActions.map(action => action.uid)).toContain('late-action');
        expect(forged.finalState.core.players['1'].hand.map(card => card.uid)).not.toContain('late-action');
    });

    it('时间旅行者：时间流动让被他人控制的随从回到其拥有者而不是控制者手牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('slip-a', 'time_travelers_into_the_time_slip', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('borrowed-a', 'sharks_mako', '0', 2, { owner: '1' }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'slip-a' },
        } as any);
        expect(played.success).toBe(true);

        const resolved = resolveInteractionChain(played.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'borrowed-a');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual([]);
        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).toContain('borrowed-a');
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('borrowed-a');
    });

    it('时间旅行者：时间博士在多个己方随从中按玩家选择返回对象', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('doctor-a', 'time_travelers_doctor_when', 'minion', '0'),
                        makeCard('same-raider', 'time_travelers_time_raider', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
                makeMinion('raider-a', 'time_travelers_time_raider', '0', 3),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'doctor-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('time_travelers_doctor_when_choose');

        const resolved = resolveInteractionChain(played.finalState, prompt => {
            if (prompt?.data?.sourceId === 'smashup_immediate_extra_minion') {
                expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'raider-a')).toBeTruthy();
                expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'same-raider')).toBeUndefined();
                const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
                return { optionId: skip.id };
            }
            const option = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'raider-a');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('raider-a');
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('same-raider');
        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['jumper-a', 'doctor-a']);
    });

    it('时间旅行者：时间博士的立即额外随从执行前仍拒绝伪造同名诱饵', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('doctor-a', 'time_travelers_doctor_when', 'minion', '0'),
                        makeCard('same-raider', 'time_travelers_time_raider', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('raider-a', 'time_travelers_time_raider', '0', 3),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'doctor-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        const returned = runCommand(played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'raider-a' },
        } as any);

        expect(returned.success).toBe(true);
        const prompt = returned.finalState.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('smashup_immediate_extra_minion');
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'raider-a')).toBeTruthy();
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'same-raider')).toBeUndefined();

        const forgedState = {
            ...returned.finalState,
            sys: {
                ...returned.finalState.sys,
                interaction: {
                    ...returned.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        options: [
                            ...(prompt?.options ?? []),
                            {
                                id: 'forged-same-raider-decoy',
                                label: '伪造同名但不是刚返回的随从',
                                value: { cardUid: 'same-raider', defId: 'time_travelers_time_raider' },
                            },
                        ],
                    },
                },
            },
        };

        const forged = runCommand(forgedState as any, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-same-raider-decoy' },
        } as any);

        expect(forged.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['doctor-a']);
        expect(forged.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(
            expect.arrayContaining(['raider-a', 'same-raider']),
        );
    });

    it('时间旅行者：时间博士在放弃额外随从后应直接收口并保留刚返回的那张牌', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('doctor-a', 'time_travelers_doctor_when', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('raider-a', 'time_travelers_time_raider', '0', 3),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'doctor-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        const returned = runCommand(played.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'raider-a' },
        } as any);

        expect(returned.success).toBe(true);
        const prompt = returned.finalState.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('smashup_immediate_extra_minion');

        const skipped = resolveInteractionChain(returned.finalState, currentPrompt => {
            const option = findInteractionOption(currentPrompt, candidate => candidate.value?.skip === true);
            return { optionId: option.id };
        });

        expect(skipped.finalState.sys.interaction.current).toBeUndefined();
        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['doctor-a']);
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).toContain('raider-a');
    });

    it('时间旅行者：时间博士允许把刚返回的随从重新打到另一基地', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('doctor-a', 'time_travelers_doctor_when', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('raider-a', 'time_travelers_time_raider', '0', 3),
                ]),
                makeBase('base_the_deep', []),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'doctor-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        const resolved = resolveInteractionChain(played.finalState, (prompt, _state, step) => {
            if (step === 0) {
                expect(prompt?.data?.sourceId).toBe('time_travelers_doctor_when_choose');
                const returned = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'raider-a');
                expect(returned).toBeTruthy();
                return { optionId: returned.id };
            }
            if (step === 1) {
                expect(prompt?.data?.sourceId).toBe('smashup_immediate_extra_minion');
                const returned = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'raider-a');
                expect(returned).toBeTruthy();
                return { optionId: returned.id };
            }
            expect(prompt?.data?.sourceId).toBe('smashup_immediate_extra_minion_base');
            expect(findInteractionOption(prompt, candidate => candidate.value?.baseIndex === 0)).toBeTruthy();
            const otherBase = findInteractionOption(prompt, candidate => candidate.value?.baseIndex === 1);
            expect(otherBase).toBeTruthy();
            return { optionId: otherBase.id };
        });

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['doctor-a']);
        expect(resolved.finalState.core.bases[1].minions.some(minion => minion.uid === 'raider-a')).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('raider-a');
    });

    it('时间旅行者：时间博士的 may 可以跳过且不能伪造返回自身', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('doctor-a', 'time_travelers_doctor_when', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'doctor-a', baseIndex: 0 },
        } as any);

        const prompt = played.finalState.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('time_travelers_doctor_when_choose');
        expect(findInteractionOption(prompt, candidate => candidate.value?.skip === true)).toBeTruthy();

        const skipped = resolveInteractionChain(played.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
            return { optionId: option.id };
        });

        expect(skipped.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['jumper-a', 'doctor-a']);
        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('jumper-a');
        expect(skipped.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload?.reason === 'time_travelers_doctor_when',
        )).toBe(false);
        expect(skipped.finalState.sys.interaction.current).toBeUndefined();

        const forgedState = {
            ...played.finalState,
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt!.data,
                            options: [
                                ...prompt!.data.options,
                                { id: 'forged-doctor-self', label: 'forged self', value: { minionUid: 'doctor-a' } },
                            ],
                        },
                    },
                },
            },
        };
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-doctor-self' },
        } as any);

        expect(forged.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['jumper-a', 'doctor-a']);
        expect(forged.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('doctor-a');
    });

    it('时间旅行者：时间博士回手选择拒绝非本次候选的晚加入己方随从', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('doctor-a', 'time_travelers_doctor_when', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'doctor-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('time_travelers_doctor_when_choose');

        const forgedState = {
            ...played.finalState,
            core: {
                ...played.finalState.core,
                bases: [{
                    ...played.finalState.core.bases[0],
                    minions: [
                        ...played.finalState.core.bases[0].minions,
                        makeMinion('late-raider', 'time_travelers_time_raider', '0', 3),
                    ],
                }],
            },
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            options: [
                                ...prompt.data.options,
                                { id: 'forged-late-raider', label: 'forged late raider', value: { minionUid: 'late-raider' } },
                            ],
                        },
                    },
                },
            },
        };

        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: 'forged-late-raider' },
        } as any);

        expect(forged.success).toBe(true);
        expect(forged.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['jumper-a', 'doctor-a', 'late-raider']);
        expect(forged.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('late-raider');
    });

    it('时间旅行者：时间博士回手 handler 缺少本次候选快照或本体快照时拒绝执行', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('doctor-a', 'time_travelers_doctor_when', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'doctor-a', baseIndex: 0 },
        } as any);

        expect(played.success).toBe(true);
        const prompt = played.finalState.sys.interaction.current!;
        expect(prompt.data.sourceId).toBe('time_travelers_doctor_when_choose');
        const option = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'jumper-a');
        expect(option).toBeTruthy();

        const withoutAllowedSnapshot = {
            ...played.finalState,
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            allowedMinionUids: undefined,
                        },
                    },
                },
            },
        };
        const missingAllowed = runCommand(withoutAllowedSnapshot, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
        } as any);

        expect(missingAllowed.success).toBe(true);
        expect(missingAllowed.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['jumper-a', 'doctor-a']);
        expect(missingAllowed.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('jumper-a');

        const withoutDoctorSnapshot = {
            ...played.finalState,
            sys: {
                ...played.finalState.sys,
                interaction: {
                    ...played.finalState.sys.interaction,
                    current: {
                        ...prompt,
                        data: {
                            ...prompt.data,
                            doctorUid: undefined,
                        },
                    },
                },
            },
        };
        const missingDoctor = runCommand(withoutDoctorSnapshot, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionId: option.id },
        } as any);

        expect(missingDoctor.success).toBe(true);
        expect(missingDoctor.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['jumper-a', 'doctor-a']);
        expect(missingDoctor.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('jumper-a');
    });

    it('时间旅行者：虫洞允许选择任意数量的这里己方随从洗入牌库', () => {
        const reverseRandom = {
            random: () => 0.5,
            d: () => 1,
            range: () => 1,
            shuffle: <T,>(cards: T[]) => [...cards].reverse(),
        };
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                    hand: [makeCard('wormhole-a', 'time_travelers_wormhole', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
                makeMinion('raider-a', 'time_travelers_time_raider', '0', 3),
                makeMinion('enemy-a', 'sharks_mako', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const special = resolveSpecial('time_travelers_wormhole');

        const result = special?.({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'wormhole-a',
            defId: 'time_travelers_wormhole',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: reverseRandom,
            now: 1000,
        });

        expect(result?.events).toEqual([]);
        const prompt = result!.matchState?.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('time_travelers_wormhole_choose');
        expect(prompt?.data?.multi).toEqual({ min: 0, max: 2 });
        expect(prompt?.data?.allowedMinionUids).toEqual(['jumper-a', 'raider-a']);
        expect(findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'enemy-a')).toBeUndefined();

        const resolved = resolveInteractionChain(result!.matchState!, (currentPrompt) => {
            const option = findInteractionOption(currentPrompt, candidate => candidate.value?.minionUid === 'raider-a');
            return { optionIds: [option.id] };
        }, reverseRandom);

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['jumper-a', 'enemy-a']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['raider-a', 'deck-a']);

        const forgedState = {
            ...result!.matchState!,
            core: {
                ...result!.matchState!.core,
                bases: [
                    makeBase('base_portal_room', [
                        makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
                        makeMinion('raider-a', 'time_travelers_time_raider', '0', 3),
                        makeMinion('late-a', 'time_travelers_jumper', '0', 2),
                        makeMinion('enemy-a', 'sharks_mako', '1', 2),
                    ]),
                ],
            },
            sys: {
                ...result!.matchState!.sys,
                interaction: {
                    ...result!.matchState!.sys.interaction,
                    current: {
                        ...prompt!,
                        data: {
                            ...prompt!.data,
                            options: [
                                ...(prompt!.data.options ?? []),
                                { id: 'forged-late-a', label: 'forged late minion', value: { minionUid: 'late-a' } },
                            ],
                        },
                    },
                },
            },
        };
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionIds: ['forged-late-a'] },
        } as any);
        expect(forged.success).toBe(true);
        expect(forged.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['jumper-a', 'raider-a', 'late-a', 'enemy-a']);
        expect(forged.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['deck-a']);
    });

    it('时间旅行者：虫洞全选时应把这里所有己方随从都洗入其拥有者牌库', () => {
        const reverseRandom = {
            random: () => 0.5,
            d: () => 1,
            range: () => 1,
            shuffle: <T,>(cards: T[]) => [...cards].reverse(),
        };
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                    hand: [makeCard('wormhole-a', 'time_travelers_wormhole', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [
                makeMinion('jumper-a', 'time_travelers_jumper', '0', 2),
                makeMinion('raider-a', 'time_travelers_time_raider', '0', 3),
                makeMinion('enemy-a', 'sharks_mako', '1', 2),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };
        const special = resolveSpecial('time_travelers_wormhole');

        const result = special?.({
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'wormhole-a',
            defId: 'time_travelers_wormhole',
            baseIndex: 0,
            targetBaseIndex: 0,
            random: reverseRandom,
            now: 1000,
        });

        const prompt = result!.matchState?.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('time_travelers_wormhole_choose');
        const jumperOption = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'jumper-a');
        const raiderOption = findInteractionOption(prompt, candidate => candidate.value?.minionUid === 'raider-a');
        const resolved = resolveInteractionChain(result!.matchState!, () => ({
            optionIds: [jumperOption.id, raiderOption.id],
        }), reverseRandom);

        expect(resolved.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['enemy-a']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['raider-a', 'jumper-a', 'deck-a']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('jumper-a');
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('raider-a');
    });

    it('时间旅行者：虫洞后全员让过会进入延迟清场并消费未选择的传送门室触发', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('wormhole-a', 'time_travelers_wormhole', 'action', '0')],
                    deck: [makeCard('deck-a', 'time_travelers_jumper', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('jumper-a', 'time_travelers_jumper', '0', 10),
                    makeMinion('raider-a', 'time_travelers_time_raider', '0', 14),
                    makeMinion('enemy-a', 'cyborg_apes_cyberback', '1', 2),
                ]),
            ],
            baseDeck: ['base_faceless_city'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);
        expect(advance.success).toBe(true);

        let reactionState = advance.finalState;
        let reactionPrompt = reactionState.sys.interaction.current!;
        expect(reactionPrompt.data.sourceId).toBe('smashup_reaction_choose');
        if (reactionPrompt.resolutionFrameId?.startsWith('onMinionDiscardedFromBase:')) {
            const nestedTriggerOption = findInteractionOption(reactionPrompt, candidate => candidate.value?.kind === 'trigger');
            expect(nestedTriggerOption).toBeTruthy();
            const afterNestedTrigger = runCommand(reactionState, {
                type: 'SYS_INTERACTION_RESPOND',
                playerId: reactionPrompt.playerId,
                payload: { optionId: nestedTriggerOption.id },
                timestamp: 1001,
            } as any);
            expect(afterNestedTrigger.success).toBe(true);
            reactionState = afterNestedTrigger.finalState;
            reactionPrompt = reactionState.sys.interaction.current!;
            expect(reactionPrompt.data.sourceId).toBe('smashup_reaction_choose');
        }
        const wormholeOption = findInteractionOption(reactionPrompt, candidate =>
            candidate.value?.kind === 'play_action'
            && candidate.value?.cardUid === 'wormhole-a',
        );
        expect(wormholeOption).toBeTruthy();
        const playWormhole = runCommand(reactionState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: reactionPrompt.playerId,
            payload: { optionId: wormholeOption.id },
            timestamp: 1002,
        } as any);
        expect(playWormhole.success).toBe(true);

        const wormholePrompt = playWormhole.finalState.sys.interaction.current!;
        expect(wormholePrompt.data.sourceId).toBe('time_travelers_wormhole_choose');
        const raiderOption = findInteractionOption(wormholePrompt, candidate =>
            candidate.value?.minionUid === 'raider-a',
        );
        const chooseRaider = runCommand(playWormhole.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: wormholePrompt.playerId,
            payload: { optionIds: [raiderOption.id] },
            timestamp: 1002,
        } as any);
        expect(chooseRaider.success).toBe(true);

        const portalPrompt = chooseRaider.finalState.sys.interaction.current!;
        expect(portalPrompt.data.sourceId).toBe('smashup_reaction_choose');
        expect(findInteractionOption(portalPrompt, candidate => {
            const trigger = chooseRaider.finalState.core.triggerQueue?.find(entry => entry.id === candidate.value?.triggerId);
            return trigger?.sourceDefId === 'base_portal_room';
        })).toBeTruthy();
        const passOption = findInteractionOption(portalPrompt, candidate => candidate.value?.kind === 'pass');
        const passPortalRoom = runCommand(chooseRaider.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: portalPrompt.playerId,
            payload: { optionId: passOption.id },
            timestamp: 1003,
        } as any);
        expect(passPortalRoom.success).toBe(true);
        expect(passPortalRoom.finalState.sys.interaction.current).toBeUndefined();
        expect(passPortalRoom.finalState.sys.responseWindow?.current).toBeUndefined();
        const afterNestedPass = advancePostScoringDelay(passPortalRoom.finalState, '0');
        expect(afterNestedPass.finalState.core.triggerQueue?.some(trigger => trigger.sourceDefId === 'base_portal_room') === true).toBe(false);
        expect(afterNestedPass.finalState.core.bases[0].defId).toBe('base_faceless_city');
        expect([
            ...afterNestedPass.finalState.core.players['0'].deck.map(card => card.uid),
            ...afterNestedPass.finalState.core.players['0'].hand.map(card => card.uid),
        ]).toContain('raider-a');
        expect(afterNestedPass.finalState.core.players['0'].hand.map(card => card.uid)).toContain('jumper-a');
        expect(afterNestedPass.finalState.core.players['1'].discard.map(card => card.uid)).toContain('enemy-a');
    });

    it('时间旅行者：虫洞空选时不产生虫洞移动事件，其余计分后链路按正常合同继续', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('wormhole-a', 'time_travelers_wormhole', 'action', '0')],
                    deck: [makeCard('deck-a', 'time_travelers_jumper', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('jumper-a', 'time_travelers_jumper', '0', 10),
                    makeMinion('raider-a', 'time_travelers_time_raider', '0', 14),
                    makeMinion('enemy-a', 'cyborg_apes_cyberback', '1', 2),
                ]),
            ],
            baseDeck: ['base_faceless_city'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);
        expect(advance.success).toBe(true);

        let reactionState = advance.finalState;
        let reactionPrompt = reactionState.sys.interaction.current!;
        if (reactionPrompt.resolutionFrameId?.startsWith('onMinionDiscardedFromBase:')) {
            const nestedTriggerOption = findInteractionOption(reactionPrompt, candidate => candidate.value?.kind === 'trigger');
            expect(nestedTriggerOption).toBeTruthy();
            const afterNestedTrigger = runCommand(reactionState, {
                type: 'SYS_INTERACTION_RESPOND',
                playerId: reactionPrompt.playerId,
                payload: { optionId: nestedTriggerOption.id },
                timestamp: 1001,
            } as any);
            expect(afterNestedTrigger.success).toBe(true);
            reactionState = afterNestedTrigger.finalState;
            reactionPrompt = reactionState.sys.interaction.current!;
            expect(reactionPrompt.data.sourceId).toBe('smashup_reaction_choose');
        }
        const wormholeOption = findInteractionOption(reactionPrompt, candidate =>
            candidate.value?.kind === 'play_action'
            && candidate.value?.cardUid === 'wormhole-a',
        );
        expect(wormholeOption).toBeTruthy();
        const playWormhole = runCommand(reactionState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: reactionPrompt.playerId,
            payload: { optionId: wormholeOption.id },
            timestamp: 1002,
        } as any);
        expect(playWormhole.success).toBe(true);

        const wormholePrompt = playWormhole.finalState.sys.interaction.current!;
        expect(wormholePrompt.data.sourceId).toBe('time_travelers_wormhole_choose');
        const chooseNone = runCommand(playWormhole.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: wormholePrompt.playerId,
            payload: { optionIds: [] },
            timestamp: 1002,
        } as any);
        expect(chooseNone.success).toBe(true);
        expect(
            chooseNone.events.filter(event => !event.type.startsWith('SYS_')),
        ).toEqual([]);
        expect(chooseNone.finalState.core.players['0'].discard.map(card => card.uid)).toContain('wormhole-a');
        expect(chooseNone.finalState.core.bases[0].minions.map(minion => minion.uid)).toEqual(['raider-a', 'enemy-a']);

        const portalPrompt = chooseNone.finalState.sys.interaction.current!;
        expect(portalPrompt.data.sourceId).toBe('smashup_reaction_choose');
        const passOption = findInteractionOption(portalPrompt, candidate => candidate.value?.kind === 'pass');
        const passPortalRoom = runCommand(chooseNone.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: portalPrompt.playerId,
            payload: { optionId: passOption.id },
            timestamp: 1003,
        } as any);
        expect(passPortalRoom.success).toBe(true);
        expect(passPortalRoom.finalState.sys.interaction.current).toBeUndefined();
        expect(passPortalRoom.finalState.sys.responseWindow?.current).toBeUndefined();
        const afterNestedPass = advancePostScoringDelay(passPortalRoom.finalState, '0');
        expect(afterNestedPass.finalState.core.bases[0].defId).toBe('base_faceless_city');
        expect(afterNestedPass.finalState.core.players['1'].discard.map(card => card.uid)).toContain('enemy-a');
        expect(afterNestedPass.finalState.core.baseDiscard).toEqual(['base_portal_room']);
        expect(afterNestedPass.finalState.sys.interaction.current).toBeUndefined();
        expect(afterNestedPass.finalState.sys.responseWindow?.current).toBeUndefined();
        expect(passPortalRoom.events.some(event =>
            event.type === 'su:card_to_deck_bottom'
            && ['jumper-a', 'raider-a'].includes((event.payload as { cardUid?: string } | undefined)?.cardUid ?? ''),
        )).toBe(false);
        expect(passPortalRoom.events.some(event =>
            event.type === 'su:deck_reordered'
            && (event.payload as { reason?: string } | undefined)?.reason === 'time_travelers_wormhole',
        )).toBe(false);
    });

    it('时间旅行者：虫洞应允许选择你控制但归其他玩家拥有的随从，并将其洗回拥有者牌库', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('wormhole-a', 'time_travelers_wormhole', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'time_travelers_jumper', 'minion', '0'),
                        makeCard('deck-b', 'time_travelers_time_raider', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-a', 'cyborg_apes_baboom', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_portal_room', [
                    makeMinion('owned-a', 'time_travelers_time_raider', '0', 10),
                    makeMinion('borrowed-a', 'sharks_mako', '0', 14, { owner: '1' }),
                    makeMinion('enemy-a', 'cyborg_apes_cyberback', '1', 2),
                ]),
            ],
            baseDeck: ['base_faceless_city'],
            baseDiscard: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);
        expect(advance.success).toBe(true);

        const reactionPrompt = advance.finalState.sys.interaction.current!;
        const wormholeOption = findInteractionOption(reactionPrompt, candidate =>
            candidate.value?.kind === 'play_action'
            && candidate.value?.cardUid === 'wormhole-a',
        );
        const playWormhole = runCommand(advance.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: reactionPrompt.playerId,
            payload: { optionId: wormholeOption.id },
            timestamp: 1001,
        } as any);
        expect(playWormhole.success).toBe(true);

        const wormholePrompt = playWormhole.finalState.sys.interaction.current!;
        expect(wormholePrompt.data.sourceId).toBe('time_travelers_wormhole_choose');
        expect(findInteractionOption(wormholePrompt, candidate => candidate.value?.minionUid === 'borrowed-a')).toBeTruthy();
        expect(findInteractionOption(wormholePrompt, candidate => candidate.value?.minionUid === 'owned-a')).toBeTruthy();
        expect(findInteractionOption(wormholePrompt, candidate => candidate.value?.minionUid === 'enemy-a')).toBeFalsy();

        const borrowedOption = findInteractionOption(wormholePrompt, candidate =>
            candidate.value?.minionUid === 'borrowed-a',
        );
        const chooseBorrowed = runCommand(playWormhole.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: wormholePrompt.playerId,
            payload: { optionIds: [borrowedOption.id] },
            timestamp: 1002,
        } as any);
        expect(chooseBorrowed.success).toBe(true);
        const wormholeBottom = chooseBorrowed.events.find(event =>
            event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM
            && (event as any).payload?.cardUid === 'borrowed-a'
            && (event as any).payload?.reason === 'time_travelers_wormhole'
        ) as any;
        expect(wormholeBottom?.payload).toMatchObject({
            ownerId: '1',
            sourcePlayerId: '0',
        });

        const portalPrompt = chooseBorrowed.finalState.sys.interaction.current!;
        const passOption = findInteractionOption(portalPrompt, candidate => candidate.value?.kind === 'pass');
        const passPortalRoom = runCommand(chooseBorrowed.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: portalPrompt.playerId,
            payload: { optionId: passOption.id },
            timestamp: 1003,
        } as any);
        expect(passPortalRoom.success).toBe(true);
        const finalized = advancePostScoringDelay(passPortalRoom.finalState, '0');

        const p0Zones = [
            ...finalized.finalState.core.players['0'].hand.map(card => card.uid),
            ...finalized.finalState.core.players['0'].deck.map(card => card.uid),
            ...finalized.finalState.core.players['0'].discard.map(card => card.uid),
        ];
        const p1Zones = [
            ...finalized.finalState.core.players['1'].hand.map(card => card.uid),
            ...finalized.finalState.core.players['1'].deck.map(card => card.uid),
            ...finalized.finalState.core.players['1'].discard.map(card => card.uid),
        ];

        expect(finalized.finalState.core.bases[0].defId).toBe('base_faceless_city');
        expect(p0Zones).not.toContain('borrowed-a');
        expect(finalized.finalState.core.players['0'].discard.map(card => card.uid)).toContain('owned-a');
        expect(p1Zones).toContain('borrowed-a');
        expect(finalized.finalState.core.players['1'].discard.map(card => card.uid)).toContain('enemy-a');
    });

    it('电子猿基地：灵长类公园让赢家选择这里随从上的行动回到各自拥有者手牌', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_primate_park', [
                    makeMinion('host-a', 'sharks_mako', '0', 2, {
                        attachedActions: [
                            { uid: 'action-a', defId: 'cyborg_apes_flying_monkey', ownerId: '0' },
                            { uid: 'action-b', defId: 'cyborg_apes_shielding', ownerId: '1' },
                        ],
                    }),
                ]),
                makeBase('base_monkey_lab', [
                    makeMinion('host-b', 'sharks_mako', '0', 2, {
                        attachedActions: [
                            { uid: 'action-c', defId: 'cyborg_apes_juiced_up', ownerId: '1' },
                        ],
                    }),
                ]),
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbilityWithMS('base_primate_park', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_primate_park',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            now: 1000,
        });

        const prompt = result.matchState?.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('base_primate_park_return');
        expect(prompt?.data?.targetType).toBe('ongoing');
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'action-a')).toBeTruthy();
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'action-b')).toBeTruthy();
        expect(findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'action-c')).toBeUndefined();

        const forgedState = {
            ...result.matchState!,
            sys: {
                ...result.matchState!.sys,
                interaction: {
                    ...result.matchState!.sys.interaction,
                    current: {
                        ...prompt!,
                        data: {
                            ...prompt!.data,
                            options: [
                                ...prompt!.data.options,
                                { id: 'forged-other-base-action', label: 'forged', value: { cardUid: 'action-c' } },
                            ],
                        },
                    },
                },
            },
        };
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionIds: ['forged-other-base-action'] },
        } as any);

        expect(forged.finalState.core.bases[1].minions[0].attachedActions.map(action => action.uid)).toEqual(['action-c']);
        expect(forged.finalState.core.players['1'].hand.map(card => card.uid)).not.toContain('action-c');

        const resolved = resolveInteractionChain(result.matchState!, prompt => {
            const a = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'action-a');
            const b = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'action-b');
            return { optionIds: [a.id, b.id] };
        });

        expect(resolved.finalState.core.bases[0].minions[0].attachedActions).toEqual([]);
        expect(resolved.finalState.core.bases[1].minions[0].attachedActions.map(action => action.uid)).toEqual(['action-c']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('action-a');
        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).toContain('action-b');
    });

    it('电子猿基地：灵长类公园 handler 拒绝重复伪造同一张附着行动', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_primate_park', [
                makeMinion('host-a', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'action-a', defId: 'cyborg_apes_flying_monkey', ownerId: '0' },
                        { uid: 'action-b', defId: 'cyborg_apes_shielding', ownerId: '1' },
                    ],
                }),
            ])],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbilityWithMS('base_primate_park', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_primate_park',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            now: 1000,
        });
        const prompt = result.matchState?.sys.interaction.current;
        expect(prompt?.data?.sourceId).toBe('base_primate_park_return');
        expect(prompt?.data?.targetType).toBe('ongoing');

        const forgedState = {
            ...result.matchState!,
            sys: {
                ...result.matchState!.sys,
                interaction: {
                    ...result.matchState!.sys.interaction,
                    current: {
                        ...prompt!,
                        data: {
                            ...prompt!.data,
                            options: [
                                ...prompt!.data.options,
                                { id: 'forged-duplicate-action-a', label: 'forged', value: { cardUid: 'action-a' } },
                            ],
                        },
                    },
                },
            },
        };
        const forged = runCommand(forgedState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: { optionIds: ['action-a', 'forged-duplicate-action-a'] },
        } as any);

        expect(forged.finalState.core.bases[0].minions[0].attachedActions.map(action => action.uid)).toEqual(['action-a', 'action-b']);
        expect(forged.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('action-a');
    });

    it('时间盒子：从场上行动回手会触发不在场 Time Box 加计数', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_primate_park', [
                makeMinion('host-a', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'action-b', defId: 'cyborg_apes_shielding', ownerId: '1' },
                    ],
                }),
            ])],
            titans: [{
                uid: 'time-box-a',
                defId: 'time_travelers_time_box',
                faction: 'time_travelers',
                ownerId: '1',
                controllerId: '1',
                location: { zone: 'setaside' as const },
                powerCounters: 0,
                talentUsed: false,
                metadata: { timeBoxCounters: 4 },
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbilityWithMS('base_primate_park', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_primate_park',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            now: 1000,
        });

        expect(result.matchState?.sys.interaction.current?.data?.sourceId).toBe('base_primate_park_return');

        const resolved = resolveInteractionChain(result.matchState!, (prompt, state) => {
            if (prompt?.data?.sourceId === 'base_primate_park_return') {
                const b = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'action-b');
                return { optionIds: [b.id] };
            }
            if (prompt?.data?.sourceId === 'smashup_reaction_choose') {
                const option = findInteractionOption(prompt, candidate => {
                    const triggerId = candidate.value?.triggerId;
                    const trigger = state.core.triggerQueue?.find(entry => entry.id === triggerId);
                    return trigger?.sourceDefId === 'time_travelers_time_box';
                });
                return { optionId: option.id };
            }
            if (prompt?.data?.sourceId === 'titan_time_travelers_time_box_play') {
                const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
                return { optionId: skip.id };
            }
            throw new Error(`未处理的 Time Box 回手触发交互：${prompt?.data?.sourceId ?? 'unknown'}`);
        });

        expect(resolved.finalState.core.bases[0].minions[0].attachedActions).toEqual([]);
        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).toContain('action-b');
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'time-box-a')?.metadata?.timeBoxCounters).toBe(5);
    });

    it('时间盒子：BURIED_CARD_RETURNED_TO_HAND 从埋葬区回手时，也应触发不在场 Time Box 加计数', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [{
                defId: 'base_egyptian_tombs',
                minions: [],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'buried-a',
                    defId: 'sharks_mako',
                    ownerId: '1',
                    controllerId: '1',
                    trueOwnerId: '1',
                    buriedFrom: 'hand',
                }],
            }],
            titans: [{
                uid: 'time-box-a',
                defId: 'time_travelers_time_box',
                faction: 'time_travelers',
                ownerId: '1',
                controllerId: '1',
                location: { zone: 'setaside' as const },
                powerCounters: 0,
                talentUsed: false,
                metadata: { timeBoxCounters: 4 },
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const buriedReturnedToHandEvent = {
            type: SU_EVENTS.BURIED_CARD_RETURNED_TO_HAND,
            payload: {
                playerId: '1',
                cardUid: 'buried-a',
                baseIndex: 0,
            },
            timestamp: 1000,
        } as any;

        const processed = processReturnToHandTriggers([buriedReturnedToHandEvent], makeMatchState(core), '0', defaultTestRandom, 1000);

        const queued = processed.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED);
        expect(queued).toBeDefined();

        const returnedCore = reduce(core as any, buriedReturnedToHandEvent);

        const prompted = maybeResolveReactionQueue(makeMatchState({
            ...(returnedCore as any),
            triggerQueue: (queued as any).payload.triggers,
        }), defaultTestRandom, 1000);

        expect(prompted?.state.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const resolved = resolveInteractionChain(prompted!.state, (prompt, state) => {
            if (prompt?.data?.sourceId === 'smashup_reaction_choose') {
                const option = findInteractionOption(prompt, candidate => {
                    const triggerId = candidate.value?.triggerId;
                    const trigger = state.core.triggerQueue?.find(entry => entry.id === triggerId);
                    return trigger?.sourceDefId === 'time_travelers_time_box';
                });
                return { optionId: option.id };
            }
            if (prompt?.data?.sourceId === 'titan_time_travelers_time_box_play') {
                const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
                return { optionId: skip.id };
            }
            throw new Error(`未处理的埋葬回手 Time Box 触发交互：${prompt?.data?.sourceId ?? 'unknown'}`);
        });

        expect(resolved.finalState.core.players['1'].hand.map(card => card.uid)).toContain('buried-a');
        expect(resolved.finalState.core.bases[0].buriedCards ?? []).toEqual([]);
        expect(resolved.finalState.core.titans?.find(titan => titan.uid === 'time-box-a')?.metadata?.timeBoxCounters).toBe(5);
    });

    it('时间盒子：CARD_TRANSFERRED 从牌库进手牌时，不应误触发 onCardReturnedToHand', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-a', 'sharks_mako', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [],
            titans: [{
                uid: 'time-box-a',
                defId: 'time_travelers_time_box',
                faction: 'time_travelers',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'setaside' as const },
                powerCounters: 0,
                talentUsed: false,
                metadata: { timeBoxCounters: 4 },
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const processed = processReturnToHandTriggers([{
            type: SU_EVENTS.CARD_TRANSFERRED,
            payload: {
                cardUid: 'deck-a',
                defId: 'sharks_mako',
                fromPlayerId: '0',
                toPlayerId: '0',
                reason: 'wizard_mass_enchantment',
            },
            timestamp: 1000,
        } as any], makeMatchState(core), '0', defaultTestRandom, 1000);

        expect(processed.events).toHaveLength(1);
        expect(processed.events[0].type).toBe(SU_EVENTS.CARD_TRANSFERRED);
        expect(processed.matchState?.sys.interaction.current).toBeUndefined();
        expect(processed.matchState?.core.titans?.find(titan => titan.uid === 'time-box-a')?.metadata?.timeBoxCounters).toBe(4);
    });

    it('时间盒子：CARD_TRANSFERRED 从手牌转到手牌时，不应误触发 onCardReturnedToHand', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    hand: [makeCard('hand-a', 'sharks_mako', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [],
            titans: [{
                uid: 'time-box-a',
                defId: 'time_travelers_time_box',
                faction: 'time_travelers',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'setaside' as const },
                powerCounters: 0,
                talentUsed: false,
                metadata: { timeBoxCounters: 4 },
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const processed = processReturnToHandTriggers([{
            type: SU_EVENTS.CARD_TRANSFERRED,
            payload: {
                cardUid: 'hand-a',
                defId: 'sharks_mako',
                fromPlayerId: '1',
                toPlayerId: '0',
                reason: 'wizard_mass_enchantment',
            },
            timestamp: 1000,
        } as any], makeMatchState(core), '0', defaultTestRandom, 1000);

        expect(processed.events).toHaveLength(1);
        expect(processed.events[0].type).toBe(SU_EVENTS.CARD_TRANSFERRED);
        expect(processed.matchState?.sys.interaction.current).toBeUndefined();
        expect(processed.matchState?.core.titans?.find(titan => titan.uid === 'time-box-a')?.metadata?.timeBoxCounters).toBe(4);
    });

    it('时间盒子：已到 5 计数但上次跳过后，再放第 6 枚计数时仍应再次给进场选择', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', []), makeBase('base_the_nexus', [])],
            titans: [{
                uid: 'time-box-a',
                defId: 'time_travelers_time_box',
                faction: 'time_travelers',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'setaside' as const },
                powerCounters: 0,
                talentUsed: false,
                metadata: { timeBoxCounters: 5 },
            }],
            baseDeck: [],
            turnNumber: 2,
            nextUid: 100,
        };

        const triggered = fireTriggers(core as any, 'onTurnStart', {
            state: core as any,
            matchState: makeMatchState(core as any, 'startTurn', '0'),
            playerId: '0',
            random: { random: () => 0.5, d: () => 1, range: () => 1, shuffle: <T,>(items: T[]) => items },
            now: 1001,
        });

        expect(triggered.events.some(event =>
            event.type === SU_EVENTS.TITAN_METADATA_UPDATED
            && (event as any).payload?.metadataUpdate?.timeBoxCounters === 6,
        )).toBe(true);
        expect(triggered.matchState?.sys.interaction.current?.data?.sourceId).toBe('titan_time_travelers_time_box_play');
    });

    it('时间盒子：已经上场后，回合开始不应再触发牌库旁特殊计数', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            titans: [{
                uid: 'time-box-live',
                defId: 'time_travelers_time_box',
                faction: 'time_travelers',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'base' as const, baseIndex: 0, enteredAt: 1 },
                powerCounters: 0,
                talentUsed: false,
                metadata: { timeBoxCounters: 5, timeBoxPlayArmed: false },
            }],
            baseDeck: [],
            turnNumber: 2,
            nextUid: 100,
        };

        const triggered = fireTriggers(core as any, 'onTurnStart', {
            state: core as any,
            matchState: makeMatchState(core as any, 'startTurn', '0'),
            playerId: '0',
            random: { random: () => 0.5, d: () => 1, range: () => 1, shuffle: <T,>(items: T[]) => items },
            now: 1001,
        });

        expect(triggered.events.some(event => event.type === SU_EVENTS.TITAN_METADATA_UPDATED)).toBe(false);
        expect(triggered.matchState?.sys.interaction.current).toBeUndefined();
    });

    it('时间盒子：跳过本次第 5 枚计数进场后，不应在后续窗口继续保留手动 special 入口', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_primate_park', [
                makeMinion('host-a', 'sharks_mako', '0', 2, {
                    attachedActions: [
                        { uid: 'action-b', defId: 'cyborg_apes_shielding', ownerId: '0' },
                    ],
                }),
            ])],
            titans: [{
                uid: 'time-box-a',
                defId: 'time_travelers_time_box',
                faction: 'time_travelers',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'setaside' as const },
                powerCounters: 0,
                talentUsed: false,
                metadata: { timeBoxCounters: 4 },
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbilityWithMS('base_primate_park', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_primate_park',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            now: 1000,
        });

        const skipped = resolveInteractionChain(result.matchState!, (prompt, state) => {
            if (prompt?.data?.sourceId === 'base_primate_park_return') {
                const b = findInteractionOption(prompt, candidate => candidate.value?.cardUid === 'action-b');
                return { optionIds: [b.id] };
            }
            if (prompt?.data?.sourceId === 'smashup_reaction_choose') {
                const option = findInteractionOption(prompt, candidate => {
                    const triggerId = candidate.value?.triggerId;
                    const trigger = state.core.triggerQueue?.find(entry => entry.id === triggerId);
                    return trigger?.sourceDefId === 'time_travelers_time_box';
                });
                return { optionId: option.id };
            }
            if (prompt?.data?.sourceId === 'titan_time_travelers_time_box_play') {
                const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
                return { optionId: skip.id };
            }
            throw new Error(`未处理的 Time Box 跳过交互：${prompt?.data?.sourceId ?? 'unknown'}`);
        });

        expect(skipped.finalState.core.players['0'].hand.map(card => card.uid)).toContain('action-b');
        expect(skipped.finalState.core.titans?.find(titan => titan.uid === 'time-box-a')?.metadata?.timeBoxCounters).toBe(5);
        expect(skipped.finalState.sys.interaction.current).toBeUndefined();

        const validation = validate(skipped.finalState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'time-box-a', baseIndex: 0 },
            timestamp: 1001,
        } as any);

        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('时间盒子的进场机会已经结束');

        const resumed = maybeResolveReactionQueue(
            skipped.finalState,
            { random: () => 0.5, d: () => 1, range: (min: number) => min, shuffle: <T,>(items: T[]) => items },
            1002,
        );
        expect(resumed?.state.sys.interaction.current).toBeUndefined();
    });

    it('时间盒子：自己场上已有别的 Titan 时，只要 Time Box 本体不在场仍应继续加计数', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', [])],
            titans: [
                {
                    uid: 'time-box-a',
                    defId: 'time_travelers_time_box',
                    faction: 'time_travelers',
                    ownerId: '0',
                    controllerId: '0',
                    location: { zone: 'setaside' as const },
                    powerCounters: 0,
                    talentUsed: false,
                    metadata: { timeBoxCounters: 4 },
                },
                {
                    uid: 'other-titan-a',
                    defId: 'super_spies_moon_zero_three',
                    faction: 'super_spies',
                    ownerId: '0',
                    controllerId: '0',
                    location: { zone: 'base' as const, baseIndex: 0, enteredAt: 1 },
                    powerCounters: 0,
                    talentUsed: false,
                },
            ],
            baseDeck: [],
            turnNumber: 2,
            nextUid: 100,
        };

        const triggered = fireTriggers(core as any, 'onTurnStart', {
            state: core as any,
            matchState: makeMatchState(core as any, 'startTurn', '0'),
            playerId: '0',
            random: { random: () => 0.5, d: () => 1, range: () => 1, shuffle: <T,>(items: T[]) => items },
            now: 1002,
        });

        expect(triggered.events.some(event =>
            event.type === SU_EVENTS.TITAN_METADATA_UPDATED
            && (event as any).payload?.metadataUpdate?.timeBoxCounters === 5,
        )).toBe(true);
        expect(triggered.matchState?.sys.interaction.current?.data?.sourceId).toBe('titan_time_travelers_time_box_play');
    });

    it('时间盒子：别的 Titan 已在场时，跳过第 5 枚计数进场后也应清掉 armed 标记', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', []), makeBase('base_the_nexus', [])],
            titans: [
                {
                    uid: 'time-box-a',
                    defId: 'time_travelers_time_box',
                    faction: 'time_travelers',
                    ownerId: '0',
                    controllerId: '0',
                    location: { zone: 'setaside' as const },
                    powerCounters: 0,
                    talentUsed: false,
                    metadata: { timeBoxCounters: 4 },
                },
                {
                    uid: 'other-titan-a',
                    defId: 'super_spies_moon_zero_three',
                    faction: 'super_spies',
                    ownerId: '0',
                    controllerId: '0',
                    location: { zone: 'base' as const, baseIndex: 0, enteredAt: 1 },
                    powerCounters: 0,
                    talentUsed: false,
                },
            ],
            baseDeck: [],
            turnNumber: 2,
            nextUid: 100,
        };

        const triggered = fireTriggers(core as any, 'onTurnStart', {
            state: core as any,
            matchState: makeMatchState(core as any, 'startTurn', '0'),
            playerId: '0',
            random: { random: () => 0.5, d: () => 1, range: () => 1, shuffle: <T,>(items: T[]) => items },
            now: 1002,
        });

        expect(triggered.matchState?.sys.interaction.current?.data?.sourceId).toBe('titan_time_travelers_time_box_play');
        const promptedState = {
            ...triggered.matchState!,
            core: applyEvents(triggered.matchState!.core, triggered.events),
        };
        const skipped = resolveInteractionChain(promptedState, (prompt) => {
            if (prompt?.data?.sourceId === 'titan_time_travelers_time_box_play') {
                const skip = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
                return { optionId: skip.id };
            }
            throw new Error(`未处理的 Time Box 其他 Titan 在场跳过交互：${prompt?.data?.sourceId ?? 'unknown'}`);
        });

        expect(skipped.finalState.core.titans?.find(titan => titan.uid === 'time-box-a')?.metadata).toMatchObject({
            timeBoxCounters: 5,
            timeBoxPlayArmed: false,
        });
        const validation = validate(skipped.finalState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'time-box-a', baseIndex: 0 },
            timestamp: 1003,
        } as any);
        expect(validation.valid).toBe(false);
        const clearedOtherTitanState = {
            ...skipped.finalState,
            core: {
                ...skipped.finalState.core,
                titans: skipped.finalState.core.titans?.filter(titan => titan.uid !== 'other-titan-a'),
            },
        };
        const revalidation = validate(clearedOtherTitanState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'time-box-a', baseIndex: 0 },
            timestamp: 1004,
        } as any);
        expect(revalidation.valid).toBe(false);
        expect(revalidation.error).toBe('时间盒子的进场机会已经结束');
    });

    it('时间盒子：别人的回合开始时不应为你的 setaside Time Box 排触发窗口', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            bases: [makeBase('base_portal_room', [])],
            titans: [{
                uid: 'time-box-a',
                defId: 'time_travelers_time_box',
                faction: 'time_travelers',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'setaside' as const },
                powerCounters: 0,
                talentUsed: false,
                metadata: { timeBoxCounters: 5, timeBoxPlayArmed: false },
            }],
            baseDeck: [],
            turnNumber: 2,
            nextUid: 100,
        };

        const queued = collectTriggers(core as any, 'onTurnStart', {
            state: core as any,
            matchState: makeMatchState(core as any, 'startTurn', '1'),
            playerId: '1',
            random: { random: () => 0.5, d: () => 1, range: () => 1, shuffle: <T,>(items: T[]) => items },
            now: 1003,
        } as any);

        expect(queued).toBeUndefined();
    });

    it('时间盒子：天赋给予的额外随从只能打到其所在基地且必须力量 2 或更低', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('time-box-low-minion', 'pirate_first_mate', 'minion', '0'),
                        makeCard('time-box-high-minion', 'trickster_gnome', 'minion', '0'),
                    ],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', []), makeBase('base_the_nexus', [])],
            titans: [{
                uid: 'time-box-live',
                defId: 'time_travelers_time_box',
                faction: 'time_travelers',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'base' as const, baseIndex: 0, enteredAt: 1 },
                powerCounters: 0,
                talentUsed: false,
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talentResult = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 'time-box-live', baseIndex: 0 },
        } as any);
        expect(talentResult.success).toBe(true);

        expect(validate(talentResult.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'time-box-low-minion', baseIndex: 0 },
        } as any).valid).toBe(true);
        const offBaseValidation = validate(talentResult.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'time-box-low-minion', baseIndex: 1 },
        } as any);
        expect(offBaseValidation.valid).toBe(false);
        expect(talentResult.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);
        expect(validate(talentResult.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'time-box-high-minion', baseIndex: 0 },
        } as any)).toMatchObject({
            valid: false,
            error: '额外出牌只能打出力量≤2的随从',
        });
    });

    it('时间盒子：天赋给予的额外行动与低战力额外随从额度彼此独立', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('time-box-low-minion', 'pirate_first_mate', 'minion', '0'),
                        makeCard('time-box-action', 'time_travelers_time_walk', 'action', '0'),
                    ],
                    minionsPlayed: 1,
                    minionLimit: 1,
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_portal_room', []), makeBase('base_the_nexus', [])],
            titans: [{
                uid: 'time-box-live',
                defId: 'time_travelers_time_box',
                faction: 'time_travelers',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'base' as const, baseIndex: 0, enteredAt: 1 },
                powerCounters: 0,
                talentUsed: false,
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talentResult = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 'time-box-live', baseIndex: 0 },
        } as any);
        expect(talentResult.success).toBe(true);

        expect(validate(talentResult.finalState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'time-box-action' },
        } as any).valid).toBe(true);

        const actionResult = runCommand(talentResult.finalState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'time-box-action' },
        } as any);
        expect(actionResult.success).toBe(true);
        expect(actionResult.finalState.core.players['0'].baseLimitedMinionQuota?.[0]).toBe(1);

        expect(validate(actionResult.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'time-box-low-minion', baseIndex: 0 },
        } as any).valid).toBe(true);
    });

    it('三号空间站：查看自己牌库顶并放回牌库顶时，本回合首次检索只应获得 1 个标记', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    deck: [
                        makeCard('moon-self-top', 'super_spies_spy', 'minion', '0'),
                        makeCard('moon-self-next', 'super_spies_operative', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('moon-p1-top', 'time_travelers_jumper', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            titans: [{
                uid: 'moon-zero-self-live',
                defId: 'super_spies_moon_zero_three',
                faction: 'super_spies',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'base' as const, baseIndex: 0, enteredAt: 1 },
                powerCounters: 0,
                talentUsed: false,
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 'moon-zero-self-live', baseIndex: 0 },
        } as any);
        expect(talent.success).toBe(true);
        expect(talent.finalState.sys.interaction.current?.data?.sourceId).toBe('titan_super_spies_moon_zero_three_choose_player');

        const choosePlayer = runCommand(talent.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: {
                optionId: findInteractionOption(talent.finalState.sys.interaction.current, candidate => candidate.value?.targetPlayerId === '0')?.id,
            },
        } as any);

        const resolved = resolveInteractionChain(choosePlayer.finalState, prompt => {
            if (prompt?.data?.sourceId === 'titan_super_spies_moon_zero_three_choose_player') {
                const option = findInteractionOption(prompt, candidate => candidate.value?.targetPlayerId === '0');
                return { optionId: option.id };
            }

            const option = findInteractionOption(prompt, candidate => candidate.value?.placement === 'top');
            return { optionId: option.id };
        });

        const moonZero = resolved.finalState.core.titans?.find(candidate => candidate.uid === 'moon-zero-self-live');
        expect(moonZero?.powerCounters).toBe(1);
        expect(moonZero?.talentUsed).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['moon-self-top', 'moon-self-next']);
        expect(resolved.finalState.core.moonZeroThreeTriggeredTurnByTitan?.['moon-zero-self-live']).toBe(1);
    });

    it('三号空间站：同回合再次检索牌库时不应重复增加计数', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('spy-a', 'super_spies_spy', 'minion', '0')],
                    deck: [
                        makeCard('moon-self-top', 'super_spies_operative', 'minion', '0'),
                        makeCard('moon-self-next', 'super_spies_spy', 'minion', '0'),
                        makeCard('moon-self-third', 'time_travelers_jumper', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('moon-p1-top', 'time_travelers_jumper', 'minion', '1')],
                }),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            titans: [{
                uid: 'moon-zero-live',
                defId: 'super_spies_moon_zero_three',
                faction: 'super_spies',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'base' as const, baseIndex: 0, enteredAt: 1 },
                powerCounters: 0,
                talentUsed: false,
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const firstInspect = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 'moon-zero-live', baseIndex: 0 },
        } as any);
        expect(firstInspect.success).toBe(true);

        const chooseSelf = runCommand(firstInspect.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: {
                optionId: findInteractionOption(firstInspect.finalState.sys.interaction.current, candidate => candidate.value?.targetPlayerId === '0')?.id,
            },
        } as any);
        const resolvedFirstInspect = resolveInteractionChain(chooseSelf.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.placement === 'top');
            return { optionId: option.id };
        });
        expect(resolvedFirstInspect.finalState.core.moonZeroThreeTriggeredTurnByTitan?.['moon-zero-live']).toBe(1);
        expect(resolvedFirstInspect.finalState.core.titans?.find(candidate => candidate.uid === 'moon-zero-live')?.powerCounters).toBe(1);

        const secondInspect = runCommand(resolvedFirstInspect.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'spy-a', baseIndex: 0 },
        } as any);

        expect(secondInspect.success).toBe(true);
        expect(secondInspect.finalState.sys.interaction.current?.data?.sourceId).toBe('super_spies_spy_reorder');
        expect(secondInspect.finalState.core.moonZeroThreeTriggeredTurnByTitan?.['moon-zero-live']).toBe(1);
        expect(secondInspect.finalState.core.titans?.find(candidate => candidate.uid === 'moon-zero-live')?.powerCounters).toBe(1);
    });

    it('三号空间站：只为我的眼睛查看自己牌库顶五张时也应获得本回合首次检索计数', () => {
        const core = {
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('eyes-a', 'super_spies_for_my_eyes_only', 'action', '0')],
                    deck: [
                        makeCard('deck-a', 'sharks_mako', 'minion', '0'),
                        makeCard('deck-b', 'sharks_hammerhead', 'minion', '0'),
                        makeCard('deck-c', 'sharks_tiger_shark', 'minion', '0'),
                        makeCard('deck-d', 'sharks_great_white', 'minion', '0'),
                        makeCard('deck-e', 'cyborg_apes_baboom', 'minion', '0'),
                        makeCard('deck-f', 'super_spies_spy', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            titans: [{
                uid: 'moon-zero-eyes-live',
                defId: 'super_spies_moon_zero_three',
                faction: 'super_spies',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'base' as const, baseIndex: 0, enteredAt: 1 },
                powerCounters: 0,
                talentUsed: false,
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'eyes-a' },
        } as any);

        expect(played.success).toBe(true);
        expect(played.finalState.sys.interaction.current?.data?.sourceId).toBe('super_spies_for_my_eyes_only_reorder');

        const resolved = resolveInteractionChain(played.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate =>
                candidate.value?.topUids?.join(',') === 'deck-c,deck-a'
                && candidate.value?.bottomUids?.join(',') === 'deck-e,deck-b,deck-d',
            );
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual([
            'deck-c',
            'deck-a',
            'deck-f',
            'deck-e',
            'deck-b',
            'deck-d',
        ]);
        expect(resolved.finalState.core.moonZeroThreeTriggeredTurnByTitan?.['moon-zero-eyes-live']).toBe(1);
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 'moon-zero-eyes-live')?.powerCounters).toBe(1);
        expect(resolved.finalState.core.titans?.find(candidate => candidate.uid === 'moon-zero-eyes-live')?.talentUsed).toBe(false);
    });

    it('三号空间站：没有任何可查看牌库时应在校验阶段直接拒绝天赋', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_secret_volcano_headquarters', [])],
            titans: [{
                uid: 'moon-zero-empty',
                defId: 'super_spies_moon_zero_three',
                faction: 'super_spies',
                ownerId: '0',
                controllerId: '0',
                location: { zone: 'base' as const, baseIndex: 0, enteredAt: 1 },
                powerCounters: 0,
                talentUsed: false,
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const talent = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 'moon-zero-empty', baseIndex: 0 },
        } as any);

        expect(talent.success).toBe(false);
        expect(talent.error).toContain('没有可查看的牌库');
        expect(talent.finalState.sys.interaction.current).toBeUndefined();
        expect(talent.events.some(event => event.type === SU_EVENTS.TALENT_USED)).toBe(false);
    });

    it('三号空间站：多个合法基地并存时应允许打到任一合法基地并拒绝敌方随从所在基地', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_secret_volcano_headquarters', [
                    makeMinion('moon-own-a', 'pirate_first_mate', '0', 2),
                ]),
                makeBase('base_portal_room', []),
                makeBase('base_monkey_lab', [
                    makeMinion('moon-enemy-a', 'robot_microbot_guard', '1', 1),
                ]),
            ],
            titans: [{
                uid: 'moon-zero-multi-base',
                defId: 'super_spies_moon_zero_three',
                faction: 'super_spies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' as const },
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const state = makeMatchState(core);
        const base0Command = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'moon-zero-multi-base', baseIndex: 0 },
            timestamp: 1001,
        } as any;
        const base1Command = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'moon-zero-multi-base', baseIndex: 1 },
            timestamp: 1002,
        } as any;
        const base2Command = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'moon-zero-multi-base', baseIndex: 2 },
            timestamp: 1003,
        } as any;

        expect(validate(state, base0Command).valid).toBe(true);
        expect(validate(state, base1Command).valid).toBe(true);
        expect(validate(state, base2Command)).toMatchObject({
            valid: false,
            error: '你只能将三号空间站打出到没有其他玩家随从的基地',
        });

        const result = runCommand(state, base1Command);
        expect(result.success).toBe(true);
        expect(result.finalState.core.titans?.find(candidate => candidate.uid === 'moon-zero-multi-base')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 1,
        });
    });

    it('三号空间站：判定其他玩家随从时应按控制者而非拥有者', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_secret_volcano_headquarters', [
                    makeMinion('moon-borrowed-a', 'sharks_mako', '0', 2, '1'),
                ]),
                makeBase('base_portal_room', [
                    makeMinion('moon-enemy-controlled-a', 'robot_microbot_guard', '1', 1),
                ]),
            ],
            titans: [{
                uid: 'moon-zero-controller-check',
                defId: 'super_spies_moon_zero_three',
                faction: 'super_spies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' as const },
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const state = makeMatchState(core);
        const borrowedBaseCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'moon-zero-controller-check', baseIndex: 0 },
            timestamp: 1004,
        } as any;
        const enemyControlledBaseCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'moon-zero-controller-check', baseIndex: 1 },
            timestamp: 1005,
        } as any;

        expect(validate(state, borrowedBaseCommand).valid).toBe(true);
        expect(validate(state, enemyControlledBaseCommand)).toMatchObject({
            valid: false,
            error: '你只能将三号空间站打出到没有其他玩家随从的基地',
        });

        const result = runCommand(state, borrowedBaseCommand);
        expect(result.success).toBe(true);
        expect(result.finalState.core.titans?.find(candidate => candidate.uid === 'moon-zero-controller-check')?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
    });

    it('borrowed 三号空间站 special 也应按当前控制者而不是真实 owner 判断合法基地并保留真实 owner', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_secret_volcano_headquarters', [
                    makeMinion('moon-borrowed-a', 'sharks_mako', '0', 2, '1'),
                ]),
                makeBase('base_portal_room', [
                    makeMinion('moon-enemy-controlled-a', 'robot_microbot_guard', '1', 1),
                ]),
            ],
            titans: [{
                uid: 'moon-zero-controller-check',
                defId: 'super_spies_moon_zero_three',
                faction: 'super_spies',
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'setaside' as const },
            }],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const state = makeMatchState(core);
        const borrowedBaseCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'moon-zero-controller-check', baseIndex: 0 },
            timestamp: 1004,
        } as any;
        const enemyControlledBaseCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'moon-zero-controller-check', baseIndex: 1 },
            timestamp: 1005,
        } as any;

        expect(validate(state, borrowedBaseCommand).valid).toBe(true);
        expect(validate(state, enemyControlledBaseCommand)).toMatchObject({
            valid: false,
            error: '你只能将三号空间站打出到没有其他玩家随从的基地',
        });

        const result = runCommand(state, borrowedBaseCommand);
        expect(result.success).toBe(true);
        const titan = result.finalState.core.titans?.find(candidate => candidate.uid === 'moon-zero-controller-check');
        expect(titan?.location).toMatchObject({
            zone: 'base',
            baseIndex: 0,
        });
        expect(titan).toEqual(expect.objectContaining({
            ownerId: '0',
            controllerId: '0',
        }));
    });

    it('三号空间站：与时间盒子同时可从牌库旁发动时，先打出时间盒子后应统一阻止三号空间站继续发动', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_secret_volcano_headquarters', [
                    makeMinion('moon-timebox-own-a', 'super_spies_spy', '0', 2),
                ]),
                makeBase('base_portal_room', [
                    makeMinion('moon-timebox-enemy-a', 'time_travelers_jumper', '1', 2),
                ]),
            ],
            titans: [
                {
                    uid: 'moon-zero-vs-time-box',
                    defId: 'super_spies_moon_zero_three',
                    faction: 'super_spies',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' as const },
                },
                {
                    uid: 'time-box-vs-moon-zero',
                    defId: 'time_travelers_time_box',
                    faction: 'time_travelers',
                    ownerId: '0',
                    controllerId: '0',
                    powerCounters: 0,
                    talentUsed: false,
                    location: { zone: 'setaside' as const },
                    metadata: { timeBoxCounters: 5, timeBoxPlayArmed: true },
                },
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 100,
        };

        const state = makeMatchState(core);
        const moonZeroCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'moon-zero-vs-time-box', baseIndex: 0 },
            timestamp: 1006,
        } as any;
        const timeBoxCommand = {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: { titanUid: 'time-box-vs-moon-zero', baseIndex: 1 },
            timestamp: 1007,
        } as any;

        expect(validate(state, moonZeroCommand).valid).toBe(true);
        expect(validate(state, timeBoxCommand).valid).toBe(true);

        const result = runCommand(state, timeBoxCommand);
        expect(result.success).toBe(true);
        expect(result.finalState.core.titans?.find(candidate => candidate.uid === 'time-box-vs-moon-zero')).toMatchObject({
            location: { zone: 'base', baseIndex: 1 },
            metadata: expect.objectContaining({ timeBoxCounters: 0, timeBoxPlayArmed: false }),
        });
        expect(result.finalState.core.titans?.find(candidate => candidate.uid === 'moon-zero-vs-time-box')?.location).toMatchObject({
            zone: 'setaside',
        });

        expect(validate(result.finalState, moonZeroCommand)).toMatchObject({
            valid: false,
            error: '你已经有泰坦在场',
        });
    });

    it('时间旅行者基地：枢纽让赢家从基地弃牌堆选择一个基地放到牌库顶', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_nexus', [])],
            baseDeck: ['base_monkey_lab'],
            baseDiscard: ['base_the_vats', 'base_faceless_city', 'base_primate_park'],
            turnNumber: 1,
            nextUid: 100,
        };

        const result = triggerBaseAbilityWithMS('base_the_nexus', 'afterScoring', {
            state: core,
            baseIndex: 0,
            baseDefId: 'base_the_nexus',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 3 }],
            now: 1000,
        });

        expect(result.matchState?.sys.interaction.current?.data?.sourceId).toBe('base_the_nexus_choose');

        const resolved = resolveInteractionChain(result.matchState!, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.baseDefId === 'base_faceless_city');
            return { optionId: option.id };
        });

        expect(resolved.finalState.core.baseDeck).toEqual(['base_faceless_city', 'base_monkey_lab']);
        expect(resolved.finalState.core.baseDiscard).toEqual(['base_the_vats', 'base_primate_park']);
    });

    it('时间旅行者基地：枢纽真实计分后让过响应应继续按正常牌库顶替换基地', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_nexus', [
                makeMinion('winner', 'time_travelers_time_raider', '0', 20),
            ])],
            baseDeck: ['base_monkey_lab'],
            baseDiscard: ['base_the_vats', 'base_faceless_city', 'base_primate_park'],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const chooseBaseAbility = runCommand(advance.finalState, {
            type: 'SYS_INTERACTION_RESPOND',
            playerId: '0',
            payload: {
                optionId: findInteractionOption(advance.finalState.sys.interaction.current, candidate => {
                    const triggerId = candidate.value?.triggerId;
                    const trigger = advance.finalState.core.triggerQueue?.find(entry => entry.id === triggerId);
                    return trigger?.sourceDefId === 'base_the_nexus';
                })?.id,
            },
            timestamp: 1001,
        } as any);

        expect(chooseBaseAbility.success).toBe(true);
        expect(chooseBaseAbility.finalState.sys.interaction.current?.data?.sourceId).toBe('base_the_nexus_choose');

        const skipped = resolveInteractionChain(chooseBaseAbility.finalState, prompt => {
            const option = findInteractionOption(prompt, candidate => candidate.value?.skip === true);
            return { optionId: option.id };
        });

        const delayUntil = (skipped.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil;
        expect(typeof delayUntil).toBe('number');
        const finalized = runCommand(skipped.finalState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: delayUntil,
        } as any);

        expect(finalized.success).toBe(true);
        expect(finalized.finalState.sys.interaction.current).toBeUndefined();
        expect(finalized.finalState.sys.responseWindow?.current).toBeUndefined();
        expect(finalized.events.some(event =>
            event.type === SU_EVENTS.BASE_REPLACED
            && (event.payload as { newBaseDefId?: string }).newBaseDefId === 'base_monkey_lab',
        )).toBe(true);
        expect(finalized.finalState.core.bases[0].defId).toBe('base_monkey_lab');
        expect(finalized.finalState.core.baseDeck).toEqual([]);
        expect(finalized.finalState.core.baseDiscard).toEqual([
            'base_the_vats',
            'base_faceless_city',
            'base_primate_park',
            'base_the_nexus',
        ]);
    });

    it('时间旅行者基地：枢纽真实计分后应使用选择的基地替换已计分基地', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_nexus', [
                makeMinion('winner', 'time_travelers_time_raider', '0', 20),
            ])],
            baseDeck: ['base_monkey_lab'],
            baseDiscard: ['base_the_vats', 'base_faceless_city', 'base_primate_park'],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const resolved = resolveInteractionChain(advance.finalState, (prompt, state) => {
            if (prompt?.data?.sourceId === 'smashup_reaction_choose') {
                const option = findInteractionOption(prompt, candidate => {
                    const triggerId = candidate.value?.triggerId;
                    const trigger = state.core.triggerQueue?.find(entry => entry.id === triggerId);
                    return trigger?.sourceDefId === 'base_the_nexus';
                });
                return { optionId: option.id };
            }
            const option = findInteractionOption(prompt, candidate => candidate.value?.baseDefId === 'base_faceless_city');
            return { optionId: option.id };
        });

        expect(resolved.events.some(event => event.type === SU_EVENTS.BASE_DECK_REORDERED)).toBe(true);
        const delayUntil = (resolved.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil;
        expect(typeof delayUntil).toBe('number');
        const finalized = runCommand(resolved.finalState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: delayUntil,
        } as any);

        expect(finalized.success).toBe(true);
        expect(finalized.events.some(event =>
            event.type === SU_EVENTS.BASE_REPLACED
            && (event.payload as { newBaseDefId?: string }).newBaseDefId === 'base_faceless_city',
        )).toBe(true);
        expect(finalized.finalState.core.bases[0].defId).toBe('base_faceless_city');
        expect(finalized.finalState.core.baseDeck).toEqual(['base_monkey_lab']);
        expect(finalized.finalState.core.baseDiscard).toEqual(['base_the_vats', 'base_primate_park', 'base_the_nexus']);
    });

    it('时间旅行者基地：枢纽真实计分后若基地牌库已空且选择弃牌堆基地替换，应让所选基地替换并用其余弃牌堆与旧基地重建牌库', () => {
        const core = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_the_nexus', [
                makeMinion('winner', 'time_travelers_time_raider', '0', 20),
            ])],
            baseDeck: [],
            baseDiscard: ['base_the_vats', 'base_faceless_city', 'base_primate_park'],
            turnNumber: 1,
            nextUid: 100,
        };

        const advance = runCommand(makeMatchState(core), {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: 1000,
        } as any);

        expect(advance.success).toBe(true);
        expect(advance.finalState.sys.interaction.current?.data?.sourceId).toBe('smashup_reaction_choose');

        const resolved = resolveInteractionChain(advance.finalState, (prompt, state) => {
            if (prompt?.data?.sourceId === 'smashup_reaction_choose') {
                const option = findInteractionOption(prompt, candidate => {
                    const triggerId = candidate.value?.triggerId;
                    const trigger = state.core.triggerQueue?.find(entry => entry.id === triggerId);
                    return trigger?.sourceDefId === 'base_the_nexus';
                });
                return { optionId: option.id };
            }
            const option = findInteractionOption(prompt, candidate => candidate.value?.baseDefId === 'base_faceless_city');
            return { optionId: option.id };
        });

        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.BASE_DECK_REORDERED
            && (event.payload as { reason?: string }).reason === 'base_the_nexus',
        )).toBe(true);
        const delayUntil = (resolved.finalState.sys as any)._smashupPostScoringBaseRevealDelayUntil;
        expect(typeof delayUntil).toBe('number');
        const finalized = runCommand(resolved.finalState, {
            type: 'ADVANCE_PHASE',
            playerId: '0',
            payload: undefined,
            timestamp: delayUntil,
        } as any);

        expect(finalized.success).toBe(true);
        expect(finalized.events.some(event =>
            event.type === SU_EVENTS.BASE_REPLACED
            && (event.payload as { newBaseDefId?: string }).newBaseDefId === 'base_faceless_city',
        )).toBe(true);
        expect(finalized.finalState.core.bases[0].defId).toBe('base_faceless_city');
        expect(finalized.finalState.core.baseDeck).toEqual(['base_the_vats', 'base_primate_park', 'base_the_nexus']);
        expect(finalized.finalState.core.baseDiscard).toEqual([]);
    });
});
