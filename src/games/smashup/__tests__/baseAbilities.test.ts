/**
 * 大杀四方 - 基地能力系统测试
 *
 * 覆盖：
 * - Property 17: 基地能力事件顺序
 * - 基地能力注册表往返一致性
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import {
    registerBaseAbility,
    registerActiveBaseAbility,
    registerExtended,
    registerPodBaseAbilityAliases,
    triggerBaseAbility,
    triggerAllBaseAbilities,
    hasBaseAbility,
    hasActiveBaseAbility,
    clearBaseAbilityRegistry,
    getActiveBaseAbilityOptions,
    getBaseAbilityExecutor,
    getExtendedBaseAbilityExecutor,
    getBaseAbilityRegistrySize,
} from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import type { SmashUpCore, SmashUpEvent } from '../domain/types';
import {
    appendAbilityRuntimeContinuationProgram,
    createPromptProgram,
    createBranchProgram,
    createEffectProgram,
    createSequenceProgram,
    executeAbilityProgram,
    isAbilityRuntimeContinuationEvent,
    resolveAbilityRuntimePrompt,
    resumeAbilityRuntimeContinuationEvent,
} from '../domain/abilityRuntime';
import { getFirstPrompt, getPromptHandlerData, getPromptSourceId } from './helpers';

beforeEach(() => {
    clearBaseAbilityRegistry();
});

const emptyBaseOptions = {};

describe('基地能力注册表', () => {
    it('注册后可以解析到能力', () => {
        const executor = (_ctx: BaseAbilityContext) => ({ events: [] });
        registerBaseAbility('base_test', 'onMinionPlayed', executor, emptyBaseOptions);

        expect(hasBaseAbility('base_test', 'onMinionPlayed')).toBe(true);
        expect(hasBaseAbility('base_test', 'beforeScoring')).toBe(false);
        expect(hasBaseAbility('base_unknown', 'onMinionPlayed')).toBe(false);
    });

    it('注册表大小正确', () => {
        expect(getBaseAbilityRegistrySize()).toBe(0);

        registerBaseAbility('base_a', 'onMinionPlayed', () => ({ events: [] }), emptyBaseOptions);
        registerBaseAbility('base_a', 'beforeScoring', () => ({ events: [] }), emptyBaseOptions);
        registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), emptyBaseOptions);

        expect(getBaseAbilityRegistrySize()).toBe(3);
    });

    it('清空注册表', () => {
        registerBaseAbility('base_a', 'onMinionPlayed', () => ({ events: [] }), emptyBaseOptions);
        expect(getBaseAbilityRegistrySize()).toBe(1);

        clearBaseAbilityRegistry();
        expect(getBaseAbilityRegistrySize()).toBe(0);
    });

    it('触发已注册的基地能力返回事件', () => {
        const mockEvent: SmashUpEvent = {
            type: 'su:talent_used',
            payload: { playerId: '0', minionUid: 'm1', defId: 'test', baseIndex: 0 },
            timestamp: 1000,
        };
        registerBaseAbility('base_test', 'onMinionPlayed', () => ({
            events: [mockEvent],
        }), emptyBaseOptions);

        const ctx: BaseAbilityContext = {
            state: { bases: [] } as any,
            baseIndex: 0,
            baseDefId: 'base_test',
            playerId: '0',
            now: 1000,
        };

        const result = triggerBaseAbility('base_test', 'onMinionPlayed', ctx);
        expect(result.events).toHaveLength(1);
        expect(result.events[0]).toBe(mockEvent);
    });

    it('触发未注册的基地能力返回空数组', () => {
        const ctx: BaseAbilityContext = {
            state: { bases: [] } as any,
            baseIndex: 0,
            baseDefId: 'base_unknown',
            playerId: '0',
            now: 1000,
        };

        const result = triggerBaseAbility('base_unknown', 'onMinionPlayed', ctx);
        expect(result.events).toHaveLength(0);
    });

    it('triggerAllBaseAbilities 只触发 onMinionPlayed 所在基地', () => {
        let triggeredBaseIndex = -1;
        registerBaseAbility('base_a', 'onMinionPlayed', (ctx) => {
            triggeredBaseIndex = ctx.baseIndex;
            return { events: [] };
        }, emptyBaseOptions);
        registerBaseAbility('base_b', 'onMinionPlayed', () => {
            throw new Error('不应触发其他基地');
        }, emptyBaseOptions);

        const state = {
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        } as unknown as SmashUpCore;

        triggerAllBaseAbilities('onMinionPlayed', state, '0', 1000, {
            baseIndex: 0,
            minionUid: 'm1',
            minionDefId: 'test_minion',
            minionPower: 3,
        });

        expect(triggeredBaseIndex).toBe(0);
    });

    it('triggerAllBaseAbilities onTurnStart 触发所有基地', () => {
        const triggered: number[] = [];
        registerBaseAbility('base_a', 'onTurnStart', (ctx) => {
            triggered.push(ctx.baseIndex);
            return { events: [] };
        }, emptyBaseOptions);
        registerBaseAbility('base_b', 'onTurnStart', (ctx) => {
            triggered.push(ctx.baseIndex);
            return { events: [] };
        }, emptyBaseOptions);

        const state = {
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        } as unknown as SmashUpCore;

        triggerAllBaseAbilities('onTurnStart', state, '0', 1000);
        expect(triggered).toEqual([0, 1]);
    });

    it('POD 基地在已显式覆写一个普通时机时，仍应继承基础版其它时机', () => {
        const baseOnTurnStart = vi.fn(() => ({ events: [] }));
        const baseAfterScoring = vi.fn(() => ({ events: [] }));
        const podOnTurnStart = vi.fn(() => ({ events: [] }));

        registerBaseAbility('base_alias_source', 'onTurnStart', baseOnTurnStart, emptyBaseOptions);
        registerBaseAbility('base_alias_source', 'afterScoring', baseAfterScoring, emptyBaseOptions);
        registerBaseAbility('base_alias_source_pod', 'onTurnStart', podOnTurnStart, emptyBaseOptions);

        registerPodBaseAbilityAliases();

        expect(getBaseAbilityExecutor('base_alias_source_pod', 'onTurnStart')).toBe(podOnTurnStart);
        expect(getBaseAbilityExecutor('base_alias_source_pod', 'afterScoring')).toBe(baseAfterScoring);
    });

    it('POD 基地在已显式覆写一个扩展时机时，仍应继承基础版其它扩展时机', () => {
        const baseOnReveal = vi.fn(() => ({ events: [] }));
        const baseOnDestroy = vi.fn(() => ({ events: [] }));
        const podOnReveal = vi.fn(() => ({ events: [] }));

        registerExtended('base_extended_alias', 'onBaseRevealed', baseOnReveal);
        registerExtended('base_extended_alias', 'onMinionDestroyed', baseOnDestroy);
        registerExtended('base_extended_alias_pod', 'onBaseRevealed', podOnReveal);

        registerPodBaseAbilityAliases();

        expect(getExtendedBaseAbilityExecutor('base_extended_alias_pod', 'onBaseRevealed')).toBe(podOnReveal);
        expect(getExtendedBaseAbilityExecutor('base_extended_alias_pod', 'onMinionDestroyed')).toBe(baseOnDestroy);
    });

    it('POD 基地未显式注册主动能力时，应继承基础版主动能力', () => {
        registerActiveBaseAbility('base_active_alias', () => ({ events: [] }), {
            oncePerTurn: true,
        });

        registerPodBaseAbilityAliases();

        expect(hasActiveBaseAbility('base_active_alias_pod')).toBe(true);
        expect(getActiveBaseAbilityOptions('base_active_alias_pod')?.oncePerTurn).toBe(true);
    });
});

describe('能力运行时骨架', () => {
    it('effect program 返回确定性事件', () => {
        const event: SmashUpEvent = {
            type: 'su:talent_used',
            payload: { playerId: '0', minionUid: 'm1', defId: 'test', baseIndex: 0 },
            timestamp: 42,
        };

        const result = executeAbilityProgram(
            createEffectProgram(() => ({ events: [event] })),
            { playerId: '0' },
        );

        expect(result.events).toEqual([event]);
    });

    it('sequence 在领域事件落地后才恢复后续 branch program', () => {
        const result = executeAbilityProgram(
            createSequenceProgram(
                createEffectProgram(() => ([{ type: 'a', payload: {}, timestamp: 1 } as SmashUpEvent])),
                createBranchProgram({
                    when: (context: { allowed: boolean }) => context.allowed,
                    then: createEffectProgram(() => ([{ type: 'b', payload: {}, timestamp: 2 } as SmashUpEvent])),
                    else: createEffectProgram(() => ([{ type: 'c', payload: {}, timestamp: 3 } as SmashUpEvent])),
                }),
            ),
            { allowed: true },
        );

        expect(result.events.map(event => event.type)).toEqual([
            'a',
            'SYS_SMASHUP_ABILITY_RUNTIME_CONTINUE',
        ]);
        expect(isAbilityRuntimeContinuationEvent(result.events[1] as any)).toBe(true);

        const resumed = resumeAbilityRuntimeContinuationEvent(
            {
                core: {} as SmashUpCore,
                sys: {},
            } as any,
            result.events[1] as any,
        );

        expect(resumed?.events.map(event => event.type)).toEqual(['b']);
    });

    it('continuation 恢复时使用 pipeline 当前随机源', () => {
        const staleRandom = {
            random: () => 0,
            d: () => 1,
            range: (min: number) => min,
            shuffle: <T>(items: T[]) => [...items],
        };
        const pipelineRandom = {
            random: () => 0.9,
            d: (max: number) => max,
            range: (_min: number, max: number) => max,
            shuffle: <T>(items: T[]) => [...items].reverse(),
        };
        const afterCommitProgram = createEffectProgram((context: { random: typeof pipelineRandom }) => ([{
            type: 'runtime:random-used',
            payload: {
                die: context.random.d(6),
                order: context.random.shuffle(['a', 'b', 'c']),
            },
            timestamp: 2,
        } as SmashUpEvent]));

        const result = executeAbilityProgram(
            createEffectProgram((context: { random: typeof staleRandom }) => ({
                events: [{ type: 'runtime:commit-first', payload: {}, timestamp: 1 } as SmashUpEvent],
                context,
                nextProgram: afterCommitProgram,
            })),
            { random: staleRandom },
        );

        expect(result.events.map(event => event.type)).toEqual([
            'runtime:commit-first',
            'SYS_SMASHUP_ABILITY_RUNTIME_CONTINUE',
        ]);
        expect((result.events[1] as any).payload.continuation).toMatchObject({
            contextHasRandom: true,
        });

        const resumed = resumeAbilityRuntimeContinuationEvent(
            {
                core: {} as SmashUpCore,
                sys: {},
            } as any,
            result.events[1] as any,
            pipelineRandom,
        );

        expect(resumed?.events).toEqual([
            expect.objectContaining({
                type: 'runtime:random-used',
                payload: { die: 6, order: ['c', 'b', 'a'] },
            }),
        ]);
    });

    it('prompt program 恢复后会继续执行后续 sequence', () => {
        const promptProgram = createPromptProgram<
            { matchState: any; chosen?: string },
            SmashUpCore,
            SmashUpEvent
        >({
            sourceId: 'runtime_test_prompt',
            buildInteraction: (_context) => createSimpleChoice(
                'runtime-test-prompt',
                '0',
                '测试 prompt',
                [
                    { id: 'yes', label: '是', value: { chosen: 'yes' }, displayMode: 'button' as const },
                ],
                { sourceId: 'runtime_test_prompt', targetType: 'button', autoResolveIfSingle: false },
            ),
            queueInteraction: (context, interaction) => ({
                ...context.matchState,
                sys: {
                    ...context.matchState.sys,
                    interaction: {
                        current: interaction,
                        queue: [],
                    },
                },
            }),
            onResolve: ({ context, state, value }) => ({
                state,
                events: [],
                context: {
                    ...context,
                    matchState: state,
                    chosen: (value as { chosen?: string } | undefined)?.chosen,
                },
            }),
        });

        const initialState = {
            core: {} as SmashUpCore,
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                },
            },
        } as any;

        const initial = executeAbilityProgram(
            createSequenceProgram(
                promptProgram,
                createEffectProgram((context: { chosen?: string }) => ([{
                    type: 'runtime:continued',
                    payload: { chosen: context.chosen },
                    timestamp: 99,
                } as SmashUpEvent])),
            ),
            { matchState: initialState },
        );

        const queuedChoice = getFirstPrompt(initial.matchState!);
        const queuedHandlerData = getPromptHandlerData(queuedChoice) as {
            runtimePrompt?: {
                continuation?: {
                    contextHasMatchState?: boolean;
                    nextProgramId?: string;
                };
            };
        };
        expect(initial.suspended).toBe(true);
        expect(getPromptSourceId(queuedChoice)).toBe('runtime_test_prompt');
        expect(queuedHandlerData.runtimePrompt?.continuation).toMatchObject({
            contextHasMatchState: true,
            nextProgramId: expect.any(String),
        });

        const resumed = resolveAbilityRuntimePrompt(
            initial.matchState!,
            '0',
            { chosen: 'yes' },
            getPromptHandlerData(getFirstPrompt(initial.matchState!)) as Record<string, unknown>,
            {
                random: () => 0.5,
                d: () => 1,
                range: (min: number) => min,
                shuffle: <T>(items: T[]) => [...items],
            },
            99,
        );

        expect(resumed?.events).toEqual([
            expect.objectContaining({
                type: 'runtime:continued',
                payload: { chosen: 'yes' },
            }),
        ]);
    });

    it('已挂起 prompt 可以追加外部后续程序且不覆盖原 sequence', () => {
        const promptProgram = createPromptProgram<
            { matchState: any; chosen?: string; appended?: string },
            SmashUpCore,
            SmashUpEvent
        >({
            sourceId: 'runtime_append_prompt',
            buildInteraction: (_context) => createSimpleChoice(
                'runtime-append-prompt',
                '0',
                '测试 append prompt',
                [
                    { id: 'yes', label: '是', value: { chosen: 'yes' }, displayMode: 'button' as const },
                ],
                { sourceId: 'runtime_append_prompt', targetType: 'button', autoResolveIfSingle: false },
            ),
            queueInteraction: (context, interaction) => ({
                ...context.matchState,
                sys: {
                    ...context.matchState.sys,
                    interaction: {
                        current: interaction,
                        queue: [],
                    },
                },
            }),
            onResolve: ({ context, state, value }) => ({
                state,
                events: [],
                context: {
                    ...context,
                    matchState: state,
                    chosen: (value as { chosen?: string } | undefined)?.chosen,
                },
            }),
        });
        const originalFollowup = createEffectProgram((context: { chosen?: string }) => ([{
            type: 'runtime:original-followup',
            payload: { chosen: context.chosen },
            timestamp: 101,
        } as SmashUpEvent]));
        const appendedFollowup = createEffectProgram((context: { chosen?: string; appended?: string }) => ([{
            type: 'runtime:appended-followup',
            payload: { chosen: context.chosen, appended: context.appended },
            timestamp: 102,
        } as SmashUpEvent]));
        const initialState = {
            core: {} as SmashUpCore,
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                },
            },
        } as any;

        const initial = executeAbilityProgram(
            createSequenceProgram(promptProgram, originalFollowup),
            { matchState: initialState },
        );
        expect(initial.suspended).toBe(true);
        expect(initial.continuationId).toEqual(expect.any(String));

        const stateWithAppendedContinuation = appendAbilityRuntimeContinuationProgram(
            initial.matchState!,
            initial.continuationId!,
            appendedFollowup,
            {
                augmentContext: (context) => ({
                    ...((context && typeof context === 'object' && !Array.isArray(context))
                        ? context as Record<string, unknown>
                        : {}),
                    appended: 'external',
                }),
            },
        );

        const resumed = resolveAbilityRuntimePrompt(
            stateWithAppendedContinuation,
            '0',
            { chosen: 'yes' },
            getPromptHandlerData(getFirstPrompt(stateWithAppendedContinuation)) as Record<string, unknown>,
            {
                random: () => 0.5,
                d: () => 1,
                range: (min: number) => min,
                shuffle: <T>(items: T[]) => [...items],
            },
            102,
        );

        expect(resumed?.events).toEqual([
            expect.objectContaining({
                type: 'runtime:original-followup',
                payload: { chosen: 'yes' },
            }),
            expect.objectContaining({
                type: 'SYS_SMASHUP_ABILITY_RUNTIME_CONTINUE',
            }),
        ]);

        const appended = resumeAbilityRuntimeContinuationEvent(
            {
                core: {} as SmashUpCore,
                sys: {},
            } as any,
            resumed!.events[1] as any,
        );

        expect(appended?.events).toEqual([
            expect.objectContaining({
                type: 'runtime:appended-followup',
                payload: { chosen: 'yes', appended: 'external' },
            }),
        ]);
    });

    it('prompt continuation 在模块重载后仍可恢复后续 sequence', async () => {
        vi.resetModules();
        const runtimeA = await import('../domain/abilityRuntime');

        const buildRuntimeProgram = (runtime: typeof import('../domain/abilityRuntime')) => {
            const promptProgram = runtime.createPromptProgram<
                { matchState: any; chosen?: string },
                SmashUpCore,
                SmashUpEvent
            >({
                sourceId: 'runtime_reload_prompt',
                buildInteraction: (_context) => createSimpleChoice(
                    'runtime-reload-prompt',
                    '0',
                    '测试 reload prompt',
                    [
                        { id: 'yes', label: '是', value: { chosen: 'yes' }, displayMode: 'button' as const },
                    ],
                    { sourceId: 'runtime_reload_prompt', targetType: 'button', autoResolveIfSingle: false },
                ),
                queueInteraction: (context, interaction) => ({
                    ...context.matchState,
                    sys: {
                        ...context.matchState.sys,
                        interaction: {
                            current: interaction,
                            queue: [],
                        },
                    },
                }),
                onResolve: ({ context, state, value }) => ({
                    state,
                    events: [],
                    context: {
                        ...context,
                        matchState: state,
                        chosen: (value as { chosen?: string } | undefined)?.chosen,
                    },
                }),
            });

            return runtime.createSequenceProgram(
                promptProgram,
                runtime.createEffectProgram((context: { chosen?: string }) => ([{
                    type: 'runtime:reloaded',
                    payload: { chosen: context.chosen },
                    timestamp: 199,
                } as SmashUpEvent])),
            );
        };

        const initialState = {
            core: {} as SmashUpCore,
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                },
            },
        } as any;

        const initial = runtimeA.executeAbilityProgram(
            buildRuntimeProgram(runtimeA),
            { matchState: initialState },
        );

        const persistedState = structuredClone(initial.matchState!);
        const persistedInteractionData = structuredClone(
            getPromptHandlerData(getFirstPrompt(persistedState)) as Record<string, unknown>,
        );

        vi.resetModules();
        const runtimeB = await import('../domain/abilityRuntime');
        buildRuntimeProgram(runtimeB);

        const resumed = runtimeB.resolveAbilityRuntimePrompt(
            persistedState,
            '0',
            { chosen: 'yes' },
            persistedInteractionData,
            {
                random: () => 0.5,
                d: () => 1,
                range: (min: number) => min,
                shuffle: <T>(items: T[]) => [...items],
            },
            199,
        );

        expect(resumed?.events).toEqual([
            expect.objectContaining({
                type: 'runtime:reloaded',
                payload: { chosen: 'yes' },
            }),
        ]);
    });
});
