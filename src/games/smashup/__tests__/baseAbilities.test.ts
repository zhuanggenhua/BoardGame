/**
 * 大杀四方 - 基地能力系统测试
 *
 * 覆盖：
 * - Property 17: 基地能力事件顺序
 * - 基地能力注册表往返一致性
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { asSimpleChoice, createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import {
    registerBaseAbility,
    triggerBaseAbility,
    triggerAllBaseAbilities,
    hasBaseAbility,
    clearBaseAbilityRegistry,
    getBaseAbilityRegistrySize,
} from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import type { SmashUpCore, SmashUpEvent } from '../domain/types';
import {
    createPromptProgram,
    createBranchProgram,
    createEffectProgram,
    createSequenceProgram,
    executeAbilityProgram,
    resolveAbilityRuntimePrompt,
} from '../domain/abilityRuntime';

beforeEach(() => {
    clearBaseAbilityRegistry();
});

const emptyEffectContract = { effectContract: {} };

describe('基地能力注册表', () => {
    it('注册后可以解析到能力', () => {
        const executor = (_ctx: BaseAbilityContext) => ({ events: [] });
        registerBaseAbility('base_test', 'onMinionPlayed', executor, emptyEffectContract);

        expect(hasBaseAbility('base_test', 'onMinionPlayed')).toBe(true);
        expect(hasBaseAbility('base_test', 'beforeScoring')).toBe(false);
        expect(hasBaseAbility('base_unknown', 'onMinionPlayed')).toBe(false);
    });

    it('注册表大小正确', () => {
        expect(getBaseAbilityRegistrySize()).toBe(0);

        registerBaseAbility('base_a', 'onMinionPlayed', () => ({ events: [] }), emptyEffectContract);
        registerBaseAbility('base_a', 'beforeScoring', () => ({ events: [] }), emptyEffectContract);
        registerBaseAbility('base_b', 'onTurnStart', () => ({ events: [] }), emptyEffectContract);

        expect(getBaseAbilityRegistrySize()).toBe(3);
    });

    it('清空注册表', () => {
        registerBaseAbility('base_a', 'onMinionPlayed', () => ({ events: [] }), emptyEffectContract);
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
        }), emptyEffectContract);

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
        }, emptyEffectContract);
        registerBaseAbility('base_b', 'onMinionPlayed', () => {
            throw new Error('不应触发其他基地');
        }, emptyEffectContract);

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
        }, emptyEffectContract);
        registerBaseAbility('base_b', 'onTurnStart', (ctx) => {
            triggered.push(ctx.baseIndex);
            return { events: [] };
        }, emptyEffectContract);

        const state = {
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        } as unknown as SmashUpCore;

        triggerAllBaseAbilities('onTurnStart', state, '0', 1000);
        expect(triggered).toEqual([0, 1]);
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

    it('sequence 与 branch program 按声明顺序执行', () => {
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

        expect(result.events.map(event => event.type)).toEqual(['a', 'b']);
    });

    it('prompt program 恢复后会继续执行后续 sequence', () => {
        const promptProgram = createPromptProgram<
            { matchState: any; chosen?: string },
            SmashUpCore,
            SmashUpEvent
        >({
            sourceId: 'runtime_test_prompt',
            buildInteraction: (context) => createSimpleChoice(
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

        const queuedChoice = asSimpleChoice(initial.matchState?.sys.interaction?.current);
        expect(initial.suspended).toBe(true);
        expect(queuedChoice?.sourceId).toBe('runtime_test_prompt');
        expect((initial.matchState?.sys.interaction?.current.data as {
            runtimePrompt?: {
                continuation?: {
                    contextHasMatchState?: boolean;
                    nextProgramId?: string;
                };
            };
        } | undefined)?.runtimePrompt?.continuation).toMatchObject({
            contextHasMatchState: true,
            nextProgramId: expect.any(String),
        });

        const resumed = resolveAbilityRuntimePrompt(
            initial.matchState!,
            '0',
            { chosen: 'yes' },
            initial.matchState!.sys.interaction.current.data as Record<string, unknown>,
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
                buildInteraction: (context) => createSimpleChoice(
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
            persistedState.sys.interaction.current.data as Record<string, unknown>,
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
