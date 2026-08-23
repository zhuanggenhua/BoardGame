import { beforeEach, describe, expect, it } from 'vitest';
import { buildAiDecisionContext, isAiActionOutcomeNoBenefit, registerGameAiRuntime, type AiLegalAction } from '../../../engine/ai';
import type { MatchState } from '../../../core/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { buildSmashUpAiLegalActions, smashUpAiRuntime } from '../ai';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type { SmashUpCore } from '../types';
import {
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
} from './helpers';
import { runCommand } from './testRunner';

const FIXED_RANDOM = {
    random: () => 0,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(items: T[]) => [...items],
};

function makeAiState(overrides?: Partial<MatchState<SmashUpCore>>): MatchState<SmashUpCore> {
    const baseState: MatchState<SmashUpCore> = {
        core: makeState({ bases: [] }) as any,
        sys: {
            phase: 'playCards',
            flowHalted: false,
            interaction: {
                current: null,
                queue: [],
            },
            responseWindow: {
                current: null,
                history: [],
            },
        } as any,
    };

    return {
        ...baseState,
        ...overrides,
        core: {
            ...baseState.core,
            ...(overrides?.core ?? {}),
        },
        sys: {
            ...baseState.sys,
            ...(overrides?.sys ?? {}),
        },
    } as MatchState<SmashUpCore>;
}

function buildRegisteredAiContext(state: MatchState<SmashUpCore>) {
    return buildAiDecisionContext({
        gameId: 'smashup',
        matchId: 'smashup-ai-interaction-choice-enumeration',
        playerId: '0',
        visibleState: state as MatchState<unknown>,
        rulesVersion: null,
        decisionBudgetMs: 250,
        source: 'local',
    });
}

function getRespondOptionId(action: AiLegalAction): string | undefined {
    const command = action.commands[0] as { payload?: { optionId?: string } } | undefined;
    return command?.payload?.optionId;
}

function runAiRespondAction(
    state: MatchState<SmashUpCore>,
    action: AiLegalAction,
): ReturnType<typeof runCommand> {
    const command = action.commands[0];
    return runCommand(
        state,
        {
            ...command,
            playerId: '0',
        } as any,
        FIXED_RANDOM,
    );
}

describe('Smash Up AI 交互候选枚举', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
        registerGameAiRuntime(smashUpAiRuntime);
    });

    it('optional multi 交互应保留空选动作，避免链式 special 卡死', () => {
        const state = makeAiState({
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'miskatonic_field_trip_optional',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'miskatonic_field_trip',
                            options: [
                                { id: 'card-1', label: '选择 h1', value: { cardUid: 'h1' } },
                                { id: 'card-2', label: '选择 h2', value: { cardUid: 'h2' } },
                            ],
                            multi: { min: 0, max: 2 },
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        });

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const emptySelection = legalActions.find(action =>
            action.kind === 'interaction-choice'
            && (action.commands[0] as any)?.payload?.optionIds
            && Array.isArray((action.commands[0] as any).payload.optionIds)
            && (action.commands[0] as any).payload.optionIds.length === 0,
        );

        expect(emptySelection).toBeDefined();
        expect(emptySelection?.label).toContain('不选择');
        expect((emptySelection?.commands[0] as any)?.payload?.interactionId).toBe('miskatonic_field_trip_optional');
    });

    it('optional multi 显式提供 skip 按钮时，不应再额外生成空选择或 skip+卡牌混合动作', () => {
        const state = makeAiState({
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'optional-multi-with-skip',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'cthulhu_it_begins_again',
                            options: [
                                { id: 'card-1', label: '选择 a1', value: { cardUid: 'a1', defId: 'cthulhu_madness' } },
                                { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const },
                            ],
                            multi: { min: 0, max: 1 },
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        });

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const emptySelections = legalActions.filter(action =>
            action.kind === 'interaction-choice'
            && Array.isArray((action.commands[0] as any)?.payload?.optionIds)
            && (action.commands[0] as any).payload.optionIds.length === 0,
        );
        const hybridSkipCombos = legalActions.filter(action =>
            action.kind === 'interaction-choice'
            && Array.isArray((action.commands[0] as any)?.payload?.optionIds)
            && (action.commands[0] as any).payload.optionIds.includes('skip')
            && (action.commands[0] as any).payload.optionIds.length > 1,
        );

        expect(emptySelections).toHaveLength(0);
        expect(hybridSkipCombos).toHaveLength(0);
        expect(legalActions.some(action => (action.commands[0] as any)?.payload?.optionId === 'skip')).toBe(true);
        expect(legalActions.some(action => (action.commands[0] as any)?.payload?.optionId === 'card-1')).toBe(true);
    });

    it('ordered multi 交互应把不同顺序视为不同 AI 合法动作', () => {
        const state = makeAiState({
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'ordered-multi-test',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'fairies_titania',
                            options: [
                                { id: 'branch-a', label: '先做 A', value: { branchId: 'a' } },
                                { id: 'branch-b', label: '先做 B', value: { branchId: 'b' } },
                            ],
                            multi: { min: 2, max: 2, ordered: true },
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        });

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const orderedPayloads = legalActions
            .filter(action => action.kind === 'interaction-choice')
            .map(action => ((action.commands[0] as any)?.payload?.optionIds ?? []).join(','))
            .sort();

        expect(orderedPayloads).toEqual(['branch-a,branch-b', 'branch-b,branch-a']);
    });

    it('required 动态交互刷新后无合法选项时，AI 仍应拿到紧急跳过动作', () => {
        const state = makeAiState({
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'required-empty-live',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'alien_probe',
                            options: [
                                { id: 'stale-card', label: '过期手牌', value: { cardUid: 'stale-card', defId: 'pirate_first_mate' } },
                            ],
                            autoRefresh: 'hand',
                            responseValidationMode: 'live',
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        });

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const emergencyAction = legalActions.find(action =>
            action.kind === 'interaction-choice'
            && (action.commands[0] as any)?.payload?.optionId === '__emergency_skip__',
        );

        expect(emergencyAction).toBeDefined();
    });

    it('鬼屋交互在旧快照仍保留手牌、但 live 手牌已空时，AI 应改发 emergency skip', () => {
        const state = makeAiState({
            core: {
                players: {
                    '0': {
                        hand: [],
                        deck: [],
                        discard: [],
                    },
                },
            } as any,
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'base-haunted-house-live-empty',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'base_haunted_house_al9000',
                            options: [
                                { id: 'card-0', label: 'Cast the Runes', value: { cardUid: 'c94', defId: 'vikings_cast_the_runes' } },
                                { id: 'card-1', label: 'Ghostly Arrival', value: { cardUid: 'c114', defId: 'ghost_ghostly_arrival_pod' } },
                            ],
                            targetType: 'hand',
                            responseValidationMode: 'live',
                            optionsGenerator: (nextState: MatchState<SmashUpCore>) => {
                                const hand = nextState.core.players['0']?.hand ?? [];
                                return hand.map((card, index) => ({
                                    id: `card-${index}`,
                                    label: card.defId,
                                    value: { cardUid: card.uid, defId: card.defId },
                                }));
                            },
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        });

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const emergencyAction = legalActions.find(action =>
            action.kind === 'interaction-choice'
            && (action.commands[0] as any)?.payload?.interactionId === 'base-haunted-house-live-empty'
            && (action.commands[0] as any)?.payload?.optionId === '__emergency_skip__',
        );

        expect(emergencyAction).toBeDefined();
    });

    it('exact-multi 交互应枚举所有合法组合，而不是总拿前两个', () => {
        const state = makeAiState({
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'elder-thing-pod-destroy',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'elder_thing_elder_thing_pod_destroy',
                            options: [
                                { id: 'm1', label: '随从 1', value: { minionUid: 'm1' } },
                                { id: 'm2', label: '随从 2', value: { minionUid: 'm2' } },
                                { id: 'm3', label: '随从 3', value: { minionUid: 'm3' } },
                            ],
                            multi: { min: 2, max: 2 },
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        });

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const comboPayloads = legalActions
            .filter(action => action.kind === 'interaction-choice')
            .map(action => ((action.commands[0] as any)?.payload?.optionIds ?? []).join(','))
            .sort();

        expect(comboPayloads).toEqual(['m1,m2', 'm1,m3', 'm2,m3']);
    });

    it('single-choice 交互动作应把当前 interactionId 带进响应 payload', () => {
        const state = makeAiState({
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'single-choice-interaction-id',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'test_single_choice',
                            options: [
                                { id: 'opt-a', label: '选项 A', value: { branch: 'a' } },
                            ],
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        });

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const action = legalActions.find((candidate) => candidate.kind === 'interaction-choice');
        expect(action).toBeDefined();
        expect((action?.commands[0] as any)?.payload).toMatchObject({
            interactionId: 'single-choice-interaction-id',
            optionId: 'opt-a',
        });
    });

    it('野兽弃牌交互应让 AI 枚举每张可弃手牌，并用响应命令收口', async () => {
        const opened = runCommand(makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('beast-cost-a', 'aladdin_wish', 'action', '0'),
                        makeCard('beast-cost-b', 'frozen_snowgie', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('test_base', [
                makeMinion('beast-ai', 'beauty_and_the_beast_beast', '0', 4),
            ])],
        })), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'beast-ai', baseIndex: 0 },
        } as any, FIXED_RANDOM);

        expect(opened.success, opened.error).toBe(true);

        const context = buildRegisteredAiContext(opened.finalState);
        const optionIds = context.legalActions
            .filter(action => action.kind === 'interaction-choice')
            .map(getRespondOptionId)
            .sort();
        expect(optionIds).toEqual(['discard:beast-cost-a', 'discard:beast-cost-b']);

        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide(context);
        const chosenAction = context.legalActions.find(action => action.actionId === decision?.actionId);
        expect(chosenAction?.kind).toBe('interaction-choice');
        expect(['discard:beast-cost-a', 'discard:beast-cost-b']).toContain(getRespondOptionId(chosenAction!));

        const discardCostB = context.legalActions.find(action => getRespondOptionId(action) === 'discard:beast-cost-b');
        expect(discardCostB).toBeDefined();
        const resolved = runAiRespondAction(opened.finalState, discardCostB!);

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.sys.interaction.current).toBeFalsy();
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['beast-cost-a']);
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).toEqual(['beast-cost-b']);
        expect(resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'beast-ai')?.powerCounters).toBe(1);
    });

    it('木兰二选一交互应让 AI 同时保留两个分支，并能执行其中一个分支', async () => {
        const opened = runCommand(makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('mulan-ai-draw', 'frozen_snowgie', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_training_camp', [
                makeMinion('mulan-ai', 'mulan_mulan', '0', 5, {
                    powerCounters: 1,
                    metadata: { mulan_mulan_power_counter_turn: 1 },
                }),
            ])],
        })), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'mulan-ai', baseIndex: 0 },
        } as any, FIXED_RANDOM);

        expect(opened.success, opened.error).toBe(true);

        const context = buildRegisteredAiContext(opened.finalState);
        const optionIds = context.legalActions
            .filter(action => action.kind === 'interaction-choice')
            .map(getRespondOptionId)
            .sort();
        expect(optionIds).toEqual(['draw_card', 'extra_action']);

        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide(context);
        const chosenAction = context.legalActions.find(action => action.actionId === decision?.actionId);
        expect(chosenAction?.kind).toBe('interaction-choice');
        expect(['draw_card', 'extra_action']).toContain(getRespondOptionId(chosenAction!));

        const drawBranch = context.legalActions.find(action => getRespondOptionId(action) === 'draw_card');
        expect(drawBranch).toBeDefined();
        const resolved = runAiRespondAction(opened.finalState, drawBranch!);

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.sys.interaction.current).toBeFalsy();
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['mulan-ai-draw']);
        expect(resolved.finalState.core.players['0'].deck).toEqual([]);
        expect(resolved.finalState.core.players['0'].actionLimit).toBe(1);
    });

    it('field-source-target 交互应让 AI 直接枚举携带来源和目标的 live option', () => {
        const state = makeAiState({
            sys: {
                phase: 'scoreBases',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'world-champs-mummy-target-base',
                        playerId: '0',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'world_champs_mummy_after_scoring',
                            targetType: 'field-source-target',
                            options: [
                                {
                                    id: 'mummy-to-base-1',
                                    label: '把木乃伊埋到神秘花园',
                                    displayMode: 'field-source-target' as const,
                                    value: {
                                        fieldInteractionType: 'source-target',
                                        fieldSourceType: 'minion',
                                        fieldTargetType: 'base',
                                        sourceUid: 'wc-mummy-1',
                                        minionUid: 'wc-mummy-1',
                                        fromBaseIndex: 0,
                                        targetBaseIndex: 1,
                                        baseIndex: 1,
                                    },
                                },
                                {
                                    id: 'skip',
                                    label: '跳过',
                                    displayMode: 'button' as const,
                                    value: { skip: true },
                                },
                            ],
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        });

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        const targetAction = legalActions.find(action =>
            action.kind === 'interaction-choice'
            && (action.commands[0] as any)?.payload?.optionId === 'mummy-to-base-1',
        );
        const skipAction = legalActions.find(action =>
            action.kind === 'interaction-choice'
            && (action.commands[0] as any)?.payload?.optionId === 'skip',
        );

        expect(targetAction).toBeDefined();
        expect(skipAction).toBeDefined();
        expect((targetAction?.commands[0] as any)).toMatchObject({
            type: 'SYS_INTERACTION_RESPOND',
            payload: {
                interactionId: 'world-champs-mummy-target-base',
                optionId: 'mummy-to-base-1',
            },
        });
        expect(targetAction?.metadata).toMatchObject({
            interactionId: 'world-champs-mummy-target-base',
            optionId: 'mummy-to-base-1',
            displayMode: 'field-source-target',
            optionValue: {
                fieldInteractionType: 'source-target',
                fieldSourceType: 'minion',
                fieldTargetType: 'base',
                sourceUid: 'wc-mummy-1',
                minionUid: 'wc-mummy-1',
                targetBaseIndex: 1,
                baseIndex: 1,
            },
        });
    });

    it('暴力攻击没有可摧毁随从时，AI 不应把等力目标列为可打出的行动', async () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mega-attack-ai', 'mega_troopers_mega_attack', 'action', '0')],
                    actionLimit: 1,
                    actionsPlayed: 0,
                }),
                '1': makePlayer('1'),
            },
            currentPlayerIndex: 0,
            bases: [makeBase('base_training_camp', [
                makeMinion('yellow-trooper-ai', 'mega_troopers_yellow_trooper', '0', 4),
            ])],
        }));

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });
        const invalidMegaAttack = legalActions.find(action =>
            action.kind === 'play-action'
            && action.metadata?.defId === 'mega_troopers_mega_attack'
            && action.metadata?.targetMinionUid === 'yellow-trooper-ai',
        );

        expect(invalidMegaAttack).toBeUndefined();

        const context = buildRegisteredAiContext(state);
        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide(context);
        const chosenAction = context.legalActions.find(action => action.actionId === decision?.actionId);

        expect(chosenAction?.metadata?.defId).not.toBe('mega_troopers_mega_attack');

        const command = chosenAction?.commands[0];
        expect(command).toBeDefined();
        const resolved = runCommand(state, {
            ...command!,
            playerId: '0',
        } as any, FIXED_RANDOM);

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events.some(event =>
            event.type === SU_EVENTS.ABILITY_FEEDBACK
            && (event as any).payload?.messageKey === 'feedback.no_valid_targets',
        )).toBe(false);
    });

    it('暴力攻击存在低于己方总力量的目标时，AI 仍应保留该目标候选', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mega-attack-ai', 'mega_troopers_mega_attack', 'action', '0')],
                    actionLimit: 1,
                    actionsPlayed: 0,
                }),
                '1': makePlayer('1'),
            },
            currentPlayerIndex: 0,
            bases: [makeBase('base_training_camp', [
                makeMinion('yellow-trooper-ai', 'mega_troopers_yellow_trooper', '0', 4),
                makeMinion('chien-po-opponent', 'mulan_chien_po', '1', 3),
            ])],
        }));

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });
        const validMegaAttack = legalActions.find(action =>
            action.kind === 'play-action'
            && action.metadata?.defId === 'mega_troopers_mega_attack'
            && action.metadata?.targetMinionUid === 'chien-po-opponent',
        );

        expect(validMegaAttack).toBeDefined();
    });

    it('行动牌预演只有无有效目标反馈时，AI 不应把它当成收益动作', async () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('high-noon-ai', 'cowboys_high_noon', 'action', '0')],
                    actionLimit: 1,
                    actionsPlayed: 0,
                }),
                '1': makePlayer('1'),
            },
            currentPlayerIndex: 0,
            bases: [makeBase('base_training_camp', [])],
        }));

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });
        const noTargetAction = legalActions.find(action =>
            action.kind === 'play-action'
            && action.metadata?.defId === 'cowboys_high_noon',
        );
        expect(noTargetAction).toBeDefined();

        const dryRun = runCommand(state, {
            ...noTargetAction!.commands[0],
            playerId: '0',
        } as any, FIXED_RANDOM);
        expect(dryRun.success, dryRun.error).toBe(true);
        expect(dryRun.events.map(event => event.type)).toEqual([
            SU_EVENTS.ACTION_PLAYED,
            SU_EVENTS.ABILITY_FEEDBACK,
        ]);
        expect(dryRun.events.some(event =>
            event.type === SU_EVENTS.ABILITY_FEEDBACK
            && (event as any).payload?.messageKey === 'feedback.no_valid_targets',
        )).toBe(true);

        const context = buildRegisteredAiContext(state);
        const outcome = smashUpAiRuntime.projectActionOutcome?.({
            context,
            action: noTargetAction!,
        });
        expect(outcome).toMatchObject({
            status: 'succeeded',
            feedbackKeys: ['feedback.no_valid_targets'],
            hasMeaningfulEffect: false,
            hasOwnedFollowUp: false,
        });
        expect(outcome?.utilityDelta).toBeLessThanOrEqual(0);
        expect(isAiActionOutcomeNoBenefit(outcome, {
            treatNonPositiveUtilityAsNoBenefit: true,
        })).toBe(true);

        const decision = await smashUpAiRuntime.localPolicies!.baseline.decide(context);
        const chosenAction = context.legalActions.find(action => action.actionId === decision?.actionId);

        expect(chosenAction?.metadata?.defId).not.toBe('cowboys_high_noon');
        expect(chosenAction?.kind).toBe('advance-phase');
    });

    it('未知阻塞交互属于 AI 时应生成带 interactionId 的紧急取消动作', () => {
        const state = makeAiState({
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'smashup-custom-blocker',
                        playerId: '0',
                        kind: 'smashup:future-choice',
                        data: { sourceId: 'future-choice' },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        });

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        expect(legalActions).toHaveLength(1);
        expect(legalActions[0]).toMatchObject({
            kind: 'interaction-cancel',
            commands: [{
                type: 'SYS_INTERACTION_CANCEL',
                payload: {
                    interactionId: 'smashup-custom-blocker',
                    reason: 'missing-support',
                },
            }],
        });
    });

    it('交互属于其他玩家时不应继续生成当前 AI 的阶段动作', () => {
        const state = makeAiState({
            sys: {
                phase: 'playCards',
                flowHalted: false,
                interaction: {
                    current: {
                        id: 'smashup-other-player-choice',
                        playerId: '1',
                        kind: 'simple-choice',
                        data: {
                            sourceId: 'other-player-choice',
                            options: [{ id: 'ok', label: '确认' }],
                        },
                    },
                    queue: [],
                },
                responseWindow: { current: null, history: [] },
            } as any,
        });

        const legalActions = buildSmashUpAiLegalActions({
            playerId: '0',
            state: state as any,
        });

        expect(legalActions).toEqual([]);
    });
});
