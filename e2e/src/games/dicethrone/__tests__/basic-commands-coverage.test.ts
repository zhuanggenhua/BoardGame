/**
 * DiceThrone 基础命令覆盖测试
 *
 * 覆盖以下零覆盖命令：
 * 1. TOGGLE_DIE_LOCK — 锁定/解锁骰子
 * 2. REROLL_DIE — 重掷单个骰子（交互上下文中）
 * 3. RESOLVE_CHOICE — 解决选择交互
 */

import { describe, it, expect, vi } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { buildAiDecisionContext, registerRemoteAiProvider, resolveNextLocalAiAction, withAiActionStrategyTags } from '../../../engine/ai';
import { DiceThroneDomain } from '../domain';
import { buildDiceThroneAiLegalActions, diceThroneAiRuntime } from '../ai';
import { engineConfig } from '../game';
import {
    testSystems,
    createQueuedRandom,
    createNoResponseSetup,
    assertState,
    cmd,
    createSetupWithHand,
    fixedRandom,
    type CommandInput,
    createHeroMatchup,
    getCardById,
} from './test-utils';
import { DICETHRONE_CHARACTER_CATALOG, type DiceThroneCore } from '../domain/types';
import type { MatchState, RandomFn } from '../../../engine/types';
import { executePipeline } from '../../../engine/pipeline';
import { createInitializedState, injectPendingInteraction } from './test-utils';
import { resolveLocalPregameControlledPlayerId } from '../../../engine/transport/followCurrentTurnPlayer';
import { RESOURCE_IDS } from '../domain/resources';
import type { InteractionDescriptor } from '../domain/core-types';
import { STATUS_IDS, TOKEN_IDS } from '../domain/ids';
import { diceThroneCheatModifier } from '../domain/cheatModifier';

const pipelineConfig = { domain: DiceThroneDomain, systems: testSystems };

/** 执行命令并返回新状态 */
function execCmd(
    state: MatchState<DiceThroneCore>,
    command: CommandInput,
    random: RandomFn = fixedRandom,
): MatchState<DiceThroneCore> {
    const result = executePipeline(
        pipelineConfig,
        state,
        { type: command.type, playerId: command.playerId, payload: command.payload, timestamp: Date.now() },
        random,
        ['0', '1']
    );
    if (!result.success) {
        throw new Error(`命令执行失败: ${command.type} - ${result.error}`);
    }
    return result.state as MatchState<DiceThroneCore>;
}

/** 尝试执行命令，返回 pipeline 结果 */
function tryCmd(
    state: MatchState<DiceThroneCore>,
    command: CommandInput,
    random: RandomFn = fixedRandom,
) {
    return executePipeline(
        pipelineConfig,
        state,
        { type: command.type, playerId: command.playerId, payload: command.payload, timestamp: Date.now() },
        random,
        ['0', '1']
    );
}


// ============================================================================
// 1. TOGGLE_DIE_LOCK — 掷骰阶段锁定/解锁骰子
// ============================================================================

describe('TOGGLE_DIE_LOCK 锁定/解锁骰子', () => {
    it('GTR: 掷骰后锁定骰子，再次掷骰时锁定骰子不变', () => {
        // 第一次掷骰: [3,3,3,3,3]，锁定 die 0 后第二次掷骰: [1,1,1,1]（die 0 保持 3）
        const diceValues = [3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1];
        const random = createQueuedRandom(diceValues);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createNoResponseSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '锁定骰子后重掷不影响锁定骰',
            commands: [
                cmd('ADVANCE_PHASE', '0'),       // main1 -> offensiveRoll
                cmd('ROLL_DICE', '0'),            // 掷骰 [3,3,3,3,3]
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }), // 锁定 die 0
                cmd('ROLL_DICE', '0'),            // 再掷，die 0 保持
            ],
        });

        // 验证 die 0 被锁定且值不变
        const core = result.finalState.core;
        expect(core.dice[0].isKept).toBe(true);
        expect(core.dice[0].value).toBe(3);
        // 其他骰子被重掷
        expect(core.rollCount).toBe(2);
    });

    it('GTR: 锁定后解锁骰子', () => {
        const diceValues = [4, 4, 4, 4, 4, 2, 2, 2, 2, 2];
        const random = createQueuedRandom(diceValues);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createNoResponseSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '锁定后解锁骰子',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }),  // 锁定
                cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }),  // 解锁
                cmd('ROLL_DICE', '0'),                        // 全部重掷
            ],
        });

        const core = result.finalState.core;
        expect(core.dice[0].isKept).toBe(false);
        // 解锁后 die 0 也被重掷
        expect(core.dice[0].value).toBe(2);
    });

    it('非 offensiveRoll/defensiveRoll 阶段锁定骰子失败', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        // main1 阶段
        const result = tryCmd(state, cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }));
        expect(result.success).toBe(false);
    });

    it('未投掷前锁定骰子失败', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';

        const result = tryCmd(state, cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }));
        expect(result.success).toBe(false);
        expect(result.error).toBe('no_roll_yet');
    });



    it('非当前玩家锁定骰子失败', () => {
        const diceValues = [3, 3, 3, 3, 3];
        const random = createQueuedRandom(diceValues);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createNoResponseSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '非当前玩家锁定失败',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
            ],
        });

        // 玩家 1 尝试锁定
        const tryResult = tryCmd(result.finalState, cmd('TOGGLE_DIE_LOCK', '1', { dieId: 0 }));
        expect(tryResult.success).toBe(false);
    });

    it('确认掷骰后锁定骰子失败', () => {
        const diceValues = [3, 3, 3, 3, 3];
        const random = createQueuedRandom(diceValues);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createNoResponseSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '确认后锁定失败',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
            ],
        });

        const tryResult = tryCmd(result.finalState, cmd('TOGGLE_DIE_LOCK', '0', { dieId: 0 }));
        expect(tryResult.success).toBe(false);
    });

    it('不存在的骰子 ID 锁定失败', () => {
        const diceValues = [3, 3, 3, 3, 3];
        const random = createQueuedRandom(diceValues);

        const runner = new GameTestRunner({
            domain: DiceThroneDomain,
            systems: testSystems,
            playerIds: ['0', '1'],
            random,
            setup: createNoResponseSetup(),
            assertFn: assertState,
            silent: true,
        });

        const result = runner.run({
            name: '无效骰子ID',
            commands: [
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
            ],
        });

        const tryResult = tryCmd(result.finalState, cmd('TOGGLE_DIE_LOCK', '0', { dieId: 99 }));
        expect(tryResult.success).toBe(false);
    });
});

describe('AI legal actions', () => {
    it('setup 阶段应为本地 AI 生成选角动作', () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        const state: MatchState<DiceThroneCore> = {
            core,
            sys: {
                phase: 'setup',
                interaction: { queue: [] },
            } as MatchState<DiceThroneCore>['sys'],
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });

        expect(actions.some((action) =>
            action.kind === 'setup-select-character'
            && action.commands[0]?.type === 'SELECT_CHARACTER'
        )).toBe(true);
    });

    it('主流程阶段应生成推进回合动作', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions.some((action) => action.kind === 'advance-phase')).toBe(true);
    });

    it('本地 AI 不应生成 UNDO_SELL_CARD（避免卖牌↔撤回卖牌循环导致卡死）', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.activePlayerId = '0';
        state.sys.phase = 'main1';

        const player = state.core.players['0'];
        expect(player).toBeTruthy();
        const soldCard = player.hand[0];
        expect(soldCard).toBeTruthy();

        // 构造“可撤回卖牌”的状态：lastSoldCardId + discard 中存在该牌
        player.hand = player.hand.slice(1);
        player.discard = [soldCard, ...player.discard];
        (state.core as any).lastSoldCardId = soldCard.id;

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions.some((action) =>
            action.commands.some((cmd) => cmd.type === 'UNDO_SELL_CARD')
        )).toBe(false);
    });

    it('dt:card-interaction 的 selectPlayer 交互应生成 RESOLVE_INTERACTION 动作', () => {
        const state = createInitializedState(['0', '1', '2', '3'], fixedRandom);
        const interaction: InteractionDescriptor = {
            id: 'ai-select-player',
            playerId: '0',
            sourceCardId: 'moon-shadow-strike',
            type: 'selectPlayer',
            titleKey: 'interaction.selectPlayer',
            selectCount: 1,
            selected: [],
            targetPlayerIds: ['1', '3'],
        };
        injectPendingInteraction(state, interaction);

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions).toHaveLength(2);
        expect(actions.every((action) => action.kind === 'interaction-select-player')).toBe(true);
        expect(actions.map((action) => action.commands[0])).toEqual([
            { type: 'RESOLVE_INTERACTION', payload: { selectedPlayerIds: ['1'] } },
            { type: 'RESOLVE_INTERACTION', payload: { selectedPlayerIds: ['3'] } },
        ]);
    });

    it('本地 AI runner 在 selectPlayer 交互里不会卡死', async () => {
        const state = createInitializedState(['0', '1', '2', '3'], fixedRandom);
        const interaction: InteractionDescriptor = {
            id: 'ai-select-player',
            playerId: '0',
            sourceCardId: 'moon-shadow-strike',
            type: 'selectPlayer',
            titleKey: 'interaction.selectPlayer',
            selectCount: 1,
            selected: [],
            targetPlayerIds: ['1', '3'],
        };
        injectPendingInteraction(state, interaction);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('interaction-select-player');
        expect(resolution?.action.commands[0]?.type).toBe('RESOLVE_INTERACTION');
        expect([['1'], ['3']]).toContainEqual(
            (resolution?.action.commands[0]?.payload as { selectedPlayerIds?: string[] } | undefined)?.selectedPlayerIds,
        );
    });

    it('本地 AI 在 simple-choice 多选最少数量不可达时，应走通用 emergency skip fallback 而不是卡死', async () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.activePlayerId = '0';
        state.sys.phase = 'main2';
        state.sys.interaction = {
            current: {
                id: 'unsat-multi-choice',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    title: 'interaction.unsatMulti',
                    sourceId: 'test-unsat-multi',
                    multi: { min: 2, max: 2 },
                    options: [
                        {
                            id: 'disabled-only',
                            label: '唯一但不可选',
                            value: { targetId: 'm-1' },
                            disabled: true,
                        },
                        {
                            id: '__emergency_skip__',
                            label: '跳过（当前无可执行选项）',
                            value: {
                                __emergency_skip__: true,
                                __emergency_skip_reason__: 'min-selection-unreachable',
                            },
                        },
                    ],
                },
            } as unknown as NonNullable<typeof state.sys.interaction.current>,
            queue: [],
            isBlocked: false,
        };

        const context = buildAiDecisionContext({
            gameId: engineConfig.gameId,
            matchId: 'local:test-unsat-multi',
            playerId: '0',
            visibleState: state as MatchState<unknown>,
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai' },
        });

        expect(context.legalActions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: 'interaction-choice',
                commands: [{
                    type: 'SYS_INTERACTION_RESPOND',
                    payload: { optionIds: ['__emergency_skip__'] },
                }],
            }),
        ]));

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test-unsat-multi',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionIds: ['__emergency_skip__'] },
        });
    });

    it('本地 AI 在 simple-choice 多选最少数量不可达且没有显式 emergency 选项时，应主动取消交互而不是返回空动作', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.activePlayerId = '0';
        state.sys.phase = 'main2';
        state.sys.interaction = {
            current: {
                id: 'unsat-multi-choice-no-fallback-option',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    title: 'interaction.unsatMultiNoFallbackOption',
                    sourceId: 'test-unsat-multi-no-fallback-option',
                    multi: { min: 2, max: 2 },
                    options: [{
                        id: 'only-one-option',
                        label: '唯一可选项',
                        value: { customId: 'only-one-option' },
                    }],
                },
            } as unknown as NonNullable<typeof state.sys.interaction.current>,
            queue: [],
            isBlocked: false,
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions).toEqual([expect.objectContaining({
            kind: 'interaction-cancel',
            commands: [{
                type: 'SYS_INTERACTION_CANCEL',
                payload: { reason: 'no-legal-actions' },
            }],
        })]);
    });

    it('本地 AI 遇到暂未支持的 dt:card-interaction 类型时，应主动取消交互而不是卡死', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        const interaction = {
            id: 'ai-unsupported-card-interaction',
            playerId: '0',
            sourceCardId: 'card-unsupported',
            type: 'selectCardFromDiscard',
            titleKey: 'interaction.unsupported',
            selected: [],
        };

        injectPendingInteraction(state, interaction as unknown as InteractionDescriptor);

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions).toEqual([expect.objectContaining({
            kind: 'interaction-cancel',
            commands: [{
                type: 'SYS_INTERACTION_CANCEL',
                payload: { reason: 'no-legal-actions' },
            }],
        })]);
    });

    it('simple-choice 的 token/skip 选项会生成 aiHint，并优先选择增益选项', async () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.activePlayerId = '0';
        state.sys.phase = 'main2';
        state.sys.interaction = {
            current: {
                id: 'ai-choice-token',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    title: 'interaction.chooseToken',
                    sourceId: 'offensive-roll-end-token',
                    options: [
                        {
                            id: 'option-0',
                            label: '使用暴击',
                            value: { tokenId: TOKEN_IDS.CRIT, value: 1, customId: 'use-crit' },
                        },
                        {
                            id: 'option-1',
                            label: '跳过',
                            value: { value: 0, customId: 'skip' },
                        },
                    ],
                },
            } as unknown as NonNullable<typeof state.sys.interaction.current>,
            queue: [],
            isBlocked: false,
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        const useAction = actions.find((action) => action.metadata?.optionId === 'option-0');
        const skipAction = actions.find((action) => action.metadata?.optionId === 'option-1');

        expect(useAction?.aiHints?.some((hint) =>
            hint.effectIntent === 'resource' && hint.relationToActor === 'self'
        )).toBe(true);
        expect(skipAction?.aiHints?.some((hint) => hint.effectIntent === 'optional-skip')).toBe(true);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test-choice',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'option-0' },
        });
    });

    it('本地 AI 在敌方单选交互中优先选择更低血量的目标', async () => {
        const state = createInitializedState(['0', '1', '2', '3'], fixedRandom);
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
        state.core.players['3'].resources[RESOURCE_IDS.HP] = 8;

        const interaction: InteractionDescriptor = {
            id: 'ai-select-player-low-hp',
            playerId: '0',
            sourceCardId: 'moon-shadow-strike',
            type: 'selectPlayer',
            titleKey: 'interaction.selectPlayer',
            selectCount: 1,
            selected: [],
            targetPlayerIds: ['1', '3'],
        };
        injectPendingInteraction(state, interaction);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.kind).toBe('interaction-select-player');
        expect(resolution?.action.commands[0]).toEqual({
            type: 'RESOLVE_INTERACTION',
            payload: { selectedPlayerIds: ['3'] },
        });
    });

    it('本地 AI 在全体候选的增益选人交互里优先选择更需要增益的友方', async () => {
        const state = createInitializedState(['0', '1', '2', '3'], fixedRandom);
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 40;
        state.core.players['2'].resources[RESOURCE_IDS.HP] = 9;

        const interaction: InteractionDescriptor = {
            id: 'ai-select-friendly-buff-target',
            playerId: '0',
            sourceCardId: 'card-consecrate',
            type: 'selectPlayer',
            titleKey: 'interaction.selectPlayerForConsecrate',
            selectCount: 1,
            selected: [],
            targetPlayerIds: ['0', '1', '2', '3'],
            tokenGrantConfigs: [
                { tokenId: TOKEN_IDS.PROTECT, amount: 1 },
                { tokenId: TOKEN_IDS.RETRIBUTION, amount: 1 },
                { tokenId: TOKEN_IDS.CRIT, amount: 1 },
                { tokenId: TOKEN_IDS.ACCURACY, amount: 1 },
            ],
        };
        injectPendingInteraction(state, interaction);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.kind).toBe('interaction-select-player');
        expect(resolution?.action.commands[0]).toEqual({
            type: 'RESOLVE_INTERACTION',
            payload: { selectedPlayerIds: ['0'] },
        });
    });

    it('本地 AI 在移除全部状态交互里优先清理净收益更高的目标', async () => {
        const state = createInitializedState(['0', '1', '2', '3'], fixedRandom);
        state.core.players['0'].statusEffects[STATUS_IDS.BURN] = 1;
        state.core.players['3'].tokens[TOKEN_IDS.CRIT] = 1;
        state.core.players['3'].tokens[TOKEN_IDS.PROTECT] = 1;

        const interaction: InteractionDescriptor = {
            id: 'ai-select-best-cleanse-target',
            playerId: '0',
            sourceCardId: 'card-what-status',
            type: 'selectPlayer',
            titleKey: 'interaction.selectPlayerToRemoveAllStatus',
            selectCount: 1,
            selected: [],
            targetPlayerIds: ['0', '1', '2', '3'],
            requiresTargetWithStatus: true,
        };
        injectPendingInteraction(state, interaction);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.kind).toBe('interaction-select-player');
        expect(resolution?.action.commands[0]).toEqual({
            type: 'RESOLVE_INTERACTION',
            payload: { selectedPlayerIds: ['3'] },
        });
    });

    it('dt:card-interaction 的 selectStatus 交互应生成 REMOVE_STATUS 动作', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.players['1'].statusEffects.poison = 1;

        const interaction: InteractionDescriptor = {
            id: 'ai-select-status',
            playerId: '0',
            sourceCardId: 'remove-status-test',
            type: 'selectStatus',
            titleKey: 'interaction.selectStatusToRemove',
            selectCount: 1,
            selected: [],
            targetPlayerIds: ['1'],
        };
        injectPendingInteraction(state, interaction);

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'interaction-remove-status',
            commands: [{
                type: 'REMOVE_STATUS',
                payload: { targetPlayerId: '1', statusId: 'poison' },
            }],
            metadata: expect.objectContaining({
                strategyTags: ['purify-control'],
            }),
        }));
    });

    it('带 transferConfig 的 selectStatus 交互应生成 TRANSFER_STATUS 动作', () => {
        const state = createInitializedState(['0', '1', '2'], fixedRandom);
        state.core.players['1'].statusEffects.poison = 1;

        const interaction: InteractionDescriptor = {
            id: 'ai-transfer-status',
            playerId: '0',
            sourceCardId: 'transfer-status-test',
            type: 'selectStatus',
            titleKey: 'interaction.selectStatusToTransfer',
            selectCount: 1,
            selected: [],
            targetPlayerIds: ['0', '1', '2'],
            transferConfig: {},
        };
        injectPendingInteraction(state, interaction);

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'interaction-transfer-status',
            commands: [{
                type: 'TRANSFER_STATUS',
                payload: { fromPlayerId: '1', toPlayerId: '0', statusId: 'poison' },
            }],
            metadata: expect.objectContaining({
                strategyTags: ['purify-control'],
            }),
        }));
        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'interaction-transfer-status',
            commands: [{
                type: 'TRANSFER_STATUS',
                payload: { fromPlayerId: '1', toPlayerId: '2', statusId: 'poison' },
            }],
            metadata: expect.objectContaining({
                strategyTags: ['purify-control'],
            }),
        }));
    });


    it('本地 AI 在 remove-status 交互里优先移除己方减益，而不是敌方减益', async () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.players['0'].statusEffects[STATUS_IDS.BURN] = 1;
        state.core.players['1'].statusEffects[STATUS_IDS.POISON] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 12;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 28;

        const interaction: InteractionDescriptor = {
            id: 'ai-remove-own-debuff-first',
            playerId: '0',
            sourceCardId: 'remove-status-test',
            type: 'selectStatus',
            titleKey: 'interaction.selectStatusToRemove',
            selectCount: 1,
            selected: [],
            targetPlayerIds: ['0', '1'],
        };
        injectPendingInteraction(state, interaction);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.kind).toBe('interaction-remove-status');
        expect(resolution?.action.commands[0]).toEqual({
            type: 'REMOVE_STATUS',
            payload: { targetPlayerId: '0', statusId: STATUS_IDS.BURN },
        });
    });

    it('remove-status 交互会带 purify-control tag，并让通用 strategy profile scorer 参与评分', async () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.players['0'].statusEffects[STATUS_IDS.BURN] = 1;
        state.core.players['1'].tokens[TOKEN_IDS.PROTECT] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 12;

        const interaction: InteractionDescriptor = {
            id: 'ai-remove-status-strategy-tag',
            playerId: '0',
            sourceCardId: 'remove-status-test',
            type: 'selectStatus',
            titleKey: 'interaction.selectStatusToRemove',
            selectCount: 1,
            selected: [],
            targetPlayerIds: ['0', '1'],
        };
        injectPendingInteraction(state, interaction);

        const context = buildAiDecisionContext({
            gameId: 'dicethrone',
            matchId: 'dicethrone-remove-status-strategy-tag',
            playerId: '0',
            visibleState: state,
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'expert' },
        });

        const decision = await diceThroneAiRuntime.localPolicies.baseline.decide(context);
        const ownCleanupAction = context.legalActions.find((action) => {
            const command = action.commands[0];
            if (action.kind !== 'interaction-remove-status' || command?.type !== 'REMOVE_STATUS') return false;
            const payload = command.payload as { targetPlayerId?: string; statusId?: string } | undefined;
            return payload?.targetPlayerId === '0' && payload?.statusId === STATUS_IDS.BURN;
        });
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            actionId: string;
            contributions: Array<{ scorerId: string; score: number }>;
        }>;
        const ownCleanupEval = evaluations.find((item) => item.actionId === ownCleanupAction?.actionId);

        expect(ownCleanupAction?.metadata?.strategyTags).toEqual(['purify-control']);
        expect(ownCleanupEval?.contributions.some((item) => item.scorerId === 'strategy-profile-fit' && item.score > 0)).toBe(true);
    });

    it('本地 AI 在 transfer-status 交互里优先把己方减益转给低血量敌人', async () => {
        const state = createInitializedState(['0', '1', '2', '3'], fixedRandom);
        state.core.players['0'].statusEffects[STATUS_IDS.POISON] = 1;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 8;
        state.core.players['3'].resources[RESOURCE_IDS.HP] = 30;

        const interaction: InteractionDescriptor = {
            id: 'ai-transfer-own-debuff-to-enemy',
            playerId: '0',
            sourceCardId: 'transfer-status-test',
            type: 'selectStatus',
            titleKey: 'interaction.selectStatusToTransfer',
            selectCount: 1,
            selected: [],
            targetPlayerIds: ['0', '1', '2', '3'],
            transferConfig: {},
        };
        injectPendingInteraction(state, interaction);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.kind).toBe('interaction-transfer-status');
        expect(resolution?.action.commands[0]).toEqual({
            type: 'TRANSFER_STATUS',
            payload: { fromPlayerId: '0', toPlayerId: '1', statusId: STATUS_IDS.POISON },
        });
    });


    it('本地 AI 在 selectTargetStatus 交互里会把已选中的己方减益转给更脆弱的敌人', async () => {
        const state = createInitializedState(['0', '1', '2', '3'], fixedRandom);
        state.core.players['0'].statusEffects[STATUS_IDS.POISON] = 1;
        state.core.players['1'].resources[RESOURCE_IDS.HP] = 7;
        state.core.players['3'].resources[RESOURCE_IDS.HP] = 26;

        const interaction: InteractionDescriptor = {
            id: 'ai-transfer-selected-status-target',
            playerId: '0',
            sourceCardId: 'transfer-status-test',
            type: 'selectTargetStatus',
            titleKey: 'interaction.selectTransferTarget',
            selectCount: 1,
            selected: [],
            targetPlayerIds: ['0', '1', '3'],
            transferConfig: {
                sourcePlayerId: '0',
                statusId: STATUS_IDS.POISON,
            },
        };
        injectPendingInteraction(state, interaction);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.kind).toBe('interaction-transfer-status');
        expect(resolution?.action.commands[0]).toEqual({
            type: 'TRANSFER_STATUS',
            payload: { fromPlayerId: '0', toPlayerId: '1', statusId: STATUS_IDS.POISON },
        });
    });

    it('selectDie 多骰交互应枚举 1..selectCount 的合法骰子组合，而不是只生成单骰动作', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.dice = state.core.dice.slice(0, 3).map((die, index) => ({
            ...die,
            id: index,
            value: [1, 2, 5][index],
        }));

        const interaction: InteractionDescriptor = {
            id: 'ai-select-dice-multi',
            playerId: '0',
            sourceCardId: 'reroll-two-test',
            type: 'selectDie',
            titleKey: 'interaction.selectDiceToReroll',
            selectCount: 2,
            selected: [],
        };
        injectPendingInteraction(state, interaction);

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        const rerollPayloads = actions
            .filter((action) => action.kind === 'interaction-multistep')
            .map((action) => action.commands
                .filter((command) => command.type === 'REROLL_DIE')
                .map((command) => (command.payload as { dieId: number }).dieId)
                .join(','))
            .sort();

        expect(rerollPayloads).toEqual([
            '0',
            '0,1',
            '0,2',
            '1',
            '1,2',
            '2',
        ]);
    });

    it('本地 AI 在 selectDie=2 时应优先一次处理两颗低点骰，而不是只选第一颗', async () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.dice = state.core.dice.slice(0, 3).map((die, index) => ({
            ...die,
            id: index,
            value: [1, 2, 6][index],
        }));

        const interaction: InteractionDescriptor = {
            id: 'ai-select-dice-low-values',
            playerId: '0',
            sourceCardId: 'reroll-two-test',
            type: 'selectDie',
            titleKey: 'interaction.selectDiceToReroll',
            selectCount: 2,
            selected: [],
        };
        injectPendingInteraction(state, interaction);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.kind).toBe('interaction-multistep');
        expect(
            resolution?.action.commands
                .filter((command) => command.type === 'REROLL_DIE')
                .map((command) => (command.payload as { dieId: number }).dieId),
        ).toEqual([0, 1]);
    });

    it('targetOpponentDice 的 selectDie=2 应优先重掷对手高点骰子', async () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.dice = state.core.dice.slice(0, 3).map((die, index) => ({
            ...die,
            id: index,
            value: [1, 5, 6][index],
        }));

        const interaction: InteractionDescriptor = {
            id: 'ai-select-opponent-dice-high',
            playerId: '0',
            sourceCardId: 'reroll-opponent-dice-test',
            type: 'selectDie',
            titleKey: 'interaction.selectDiceToReroll',
            selectCount: 2,
            selected: [],
            diceOwnerId: '1',
            targetOpponentDice: true,
        };
        injectPendingInteraction(state, interaction);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.kind).toBe('interaction-multistep');
        expect(
            resolution?.action.commands
                .filter((command) => command.type === 'REROLL_DIE')
                .map((command) => (command.payload as { dieId: number }).dieId),
        ).toEqual([1, 2]);
    });

    it('modifyDie copy 双骰交互应生成有顺序的源骰→目标骰批动作，而不是单骰确认', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.dice = state.core.dice.slice(0, 3).map((die, index) => ({
            ...die,
            id: index,
            value: [6, 2, 4][index],
        }));

        const interaction: InteractionDescriptor = {
            id: 'ai-copy-die-multi',
            playerId: '0',
            sourceCardId: 'copy-die-test',
            type: 'modifyDie',
            titleKey: 'interaction.selectDieToCopy',
            selectCount: 2,
            selected: [],
            dieModifyConfig: { mode: 'copy' },
        };
        injectPendingInteraction(state, interaction);

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        const modifyPayloads = actions
            .filter((action) => action.kind === 'interaction-multistep')
            .map((action) => action.commands
                .filter((command) => command.type === 'MODIFY_DIE')
                .map((command) => {
                    const payload = command.payload as { dieId: number; newValue: number };
                    return `${payload.dieId}:${payload.newValue}`;
                })
                .join(','))
            .sort();

        expect(modifyPayloads).toEqual([
            '0:6,1:6',
            '0:6,2:6',
            '1:2,0:2',
            '1:2,2:2',
            '2:4,0:4',
            '2:4,1:4',
        ]);
    });

    it('targetOpponentDice 的 copy 交互应优先复制低点数压制对手骰面', async () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.dice = state.core.dice.slice(0, 3).map((die, index) => ({
            ...die,
            id: index,
            value: [6, 1, 4][index],
        }));

        const interaction: InteractionDescriptor = {
            id: 'ai-copy-opponent-dice-low',
            playerId: '0',
            sourceCardId: 'copy-opponent-die-test',
            type: 'modifyDie',
            titleKey: 'interaction.selectDieToCopy',
            selectCount: 2,
            selected: [],
            dieModifyConfig: { mode: 'copy' },
            diceOwnerId: '1',
            targetOpponentDice: true,
        };
        injectPendingInteraction(state, interaction);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        const modifyCommands = resolution?.action.commands
            .filter((command) => command.type === 'MODIFY_DIE')
            .map((command) => command.payload as { dieId: number; newValue: number }) ?? [];

        expect(modifyCommands.length).toBeGreaterThan(0);
        expect(modifyCommands.every((command) => command.newValue === 1)).toBe(true);
        expect(modifyCommands.some((command) => command.dieId === 1)).toBe(true);
    });

    it('targetOpponentDice 的 set 交互应优先压低高点骰子', async () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.dice = state.core.dice.slice(0, 3).map((die, index) => ({
            ...die,
            id: index,
            value: [6, 2, 3][index],
        }));

        const interaction: InteractionDescriptor = {
            id: 'ai-set-opponent-dice-low',
            playerId: '0',
            sourceCardId: 'set-opponent-die-test',
            type: 'modifyDie',
            titleKey: 'interaction.selectDieToSet',
            selectCount: 1,
            selected: [],
            dieModifyConfig: { mode: 'set', targetValue: 1 },
            diceOwnerId: '1',
            targetOpponentDice: true,
        };
        injectPendingInteraction(state, interaction);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        const modifyCommand = resolution?.action.commands.find((command) => command.type === 'MODIFY_DIE');
        expect(modifyCommand?.payload).toEqual({ dieId: 0, newValue: 1 });
    });

    it('targetOpponentDice 的 adjust 交互应优先处理低点骰子减少负收益', async () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.core.dice = state.core.dice.slice(0, 3).map((die, index) => ({
            ...die,
            id: index,
            value: [1, 4, 6][index],
        }));

        const interaction: InteractionDescriptor = {
            id: 'ai-adjust-opponent-dice-low',
            playerId: '0',
            sourceCardId: 'adjust-opponent-die-test',
            type: 'modifyDie',
            titleKey: 'interaction.selectDieToAdjust',
            selectCount: 1,
            selected: [],
            dieModifyConfig: { mode: 'adjust' },
            diceOwnerId: '1',
            targetOpponentDice: true,
        };
        injectPendingInteraction(state, interaction);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        const modifyCommand = resolution?.action.commands.find((command) => command.type === 'MODIFY_DIE');
        expect(modifyCommand?.payload).toEqual({ dieId: 0, newValue: 2 });
    });

    it('simple-choice exact-multi 交互应枚举所有合法组合，而不是固定前两个选项', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        state.sys.interaction = {
            ...state.sys.interaction,
            current: {
                id: 'ai-simple-choice-multi',
                kind: 'simple-choice',
                playerId: '0',
                data: {
                    sourceId: 'test_multi_simple_choice',
                    options: [
                        { id: 'opt-a', label: '选项 A' },
                        { id: 'opt-b', label: '选项 B' },
                        { id: 'opt-c', label: '选项 C' },
                    ],
                    multi: { min: 2, max: 2 },
                },
            } as any,
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        const payloads = actions
            .filter((action) => action.kind === 'interaction-choice')
            .map((action) => ((action.commands[0]?.payload as { optionIds?: string[] } | undefined)?.optionIds ?? []).join(','))
            .sort();

        expect(payloads).toEqual([
            'opt-a,opt-b',
            'opt-a,opt-c',
            'opt-b,opt-c',
        ]);
    });

    it('本地 AI runner 应在 setup 阶段选择角色', async () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        const state: MatchState<DiceThroneCore> = {
            core,
            sys: {
                phase: 'setup',
                interaction: { queue: [] },
            } as MatchState<DiceThroneCore>['sys'],
        };

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('setup-select-character');
        expect(resolution?.action.commands[0]).toMatchObject({
            type: 'SELECT_CHARACTER',
        });
        const selectedCharacterId = (resolution?.action.commands[0]?.payload as { characterId?: string } | undefined)?.characterId;
        expect(DICETHRONE_CHARACTER_CATALOG.map((item) => item.id)).toContain(selectedCharacterId);
    });

    it('setup 阶段应避开已被其他玩家选走的角色', () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        core.selectedCharacters['0'] = 'monk';

        const state: MatchState<DiceThroneCore> = {
            core,
            sys: {
                phase: 'setup',
                interaction: { queue: [] },
            } as MatchState<DiceThroneCore>['sys'],
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });

        const selectableCharacterIds = actions
            .filter((action) => action.kind === 'setup-select-character')
            .map((action) => (action.commands[0]?.payload as { characterId?: string } | undefined)?.characterId);

        expect(selectableCharacterIds.length).toBeGreaterThan(0);
        expect(selectableCharacterIds).not.toContain('monk');
    });

    it('本地 AI 在已选角色后应进入准备动作，而不是重复选角', () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        core.selectedCharacters['1'] = 'monk';

        const state: MatchState<DiceThroneCore> = {
            core,
            sys: {
                phase: 'setup',
                interaction: { queue: [] },
            } as MatchState<DiceThroneCore>['sys'],
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });

        expect(actions.some((action) => action.kind === 'setup-select-character')).toBe(false);
        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'setup-ready',
        }));
    });

    it('本地 AI 在 main1 应优先打出可用升级牌而不是直接推进阶段', async () => {
        const state = createSetupWithHand(['card-storm-assault-2'], { cp: 1 })(['0', '1'], fixedRandom);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('play-upgrade-card');
        expect(resolution?.action.commands[0]).toMatchObject({
            type: 'PLAY_UPGRADE_CARD',
            payload: {
                cardId: 'card-storm-assault-2',
                targetAbilityId: 'thunder-strike',
            },
        });
    });

    it('本地 AI 在 defensiveRoll 已选防御技能后应直接掷骰，而不是重复选择技能', async () => {
        const state = createHeroMatchup('monk', 'shadow_thief')(['0', '1'], fixedRandom);
        state.sys.phase = 'defensiveRoll';
        state.core.rollCount = 0;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            isDefendable: true,
            sourceAbilityId: 'fist-technique-5',
            defenseAbilityId: 'shadow-defense',
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });
        expect(actions.some((action) => action.kind === 'select-ability')).toBe(false);
        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'roll-dice',
        }));

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('roll-dice');
        expect(resolution?.action.commands[0]).toMatchObject({
            type: 'ROLL_DICE',
        });
    });

    it('防御阶段掷骰后应只暴露符合当前防御骰数量的最终技能，而不是全部防御技能', () => {
        const state = createHeroMatchup('monk', 'shadow_thief')(['0', '1'], fixedRandom);
        state.sys.phase = 'defensiveRoll';
        state.core.rollCount = 1;
        state.core.rollLimit = 1;
        state.core.rollDiceCount = 4;
        state.core.rollConfirmed = false;
        state.core.dice = state.core.dice.slice(0, 4);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            isDefendable: true,
            sourceAbilityId: 'fist-technique-5',
            defenseAbilityId: 'fearless-riposte',
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });
        const abilityIds = actions
            .filter((action) => action.kind === 'select-ability')
            .map((action) => action.metadata?.abilityId);

        expect(abilityIds).toEqual(['shadow-defense']);
        expect(actions.some((action) => action.kind === 'advance-phase')).toBe(false);
        expect(tryCmd(state, cmd('ADVANCE_PHASE', '1')).success).toBe(false);
    });

    it('本地 AI 在 defensiveRoll 骰面已确认且最终防御技能已选定后应推进阶段，而不是重复确认或重复选技能', async () => {
        const state = createHeroMatchup('monk', 'shadow_thief')(['0', '1'], fixedRandom);
        state.sys.phase = 'defensiveRoll';
        state.core.rollCount = 1;
        state.core.rollLimit = 1;
        state.core.rollDiceCount = 4;
        state.core.rollConfirmed = true;
        state.core.dice = state.core.dice.slice(0, 4);
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            isDefendable: true,
            sourceAbilityId: 'fist-technique-5',
            defenseAbilityId: 'shadow-defense',
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '1',
            state,
        });
        expect(actions.some((action) => action.kind === 'select-ability')).toBe(false);
        expect(actions.some((action) => action.kind === 'confirm-roll')).toBe(false);
        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'advance-phase',
        }));

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('advance-phase');
        expect(resolution?.action.commands[0]).toMatchObject({
            type: 'ADVANCE_PHASE',
        });
    });

    it('本地 AI 在 defensiveRoll 应能连续自动执行到离开防御阶段，而不是在重复动作上卡住', async () => {
        const random = createQueuedRandom([1, 1, 1, 1]);
        let state = createHeroMatchup('monk', 'shadow_thief')(['0', '1'], random);
        state.sys.phase = 'defensiveRoll';
        state.core.rollCount = 0;
        state.core.rollLimit = 1;
        state.core.rollDiceCount = 0;
        state.core.rollConfirmed = false;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            isDefendable: true,
            sourceAbilityId: 'fist-technique-5',
            defenseAbilityId: 'shadow-defense',
        };

        const executedKinds: string[] = [];
        for (let step = 0; step < 3; step += 1) {
            const resolution = await resolveNextLocalAiAction({
                engineConfig,
                state,
                matchId: 'local:test',
                seatControllers: {
                    '1': { type: 'local-ai' },
                },
            });

            expect(resolution?.playerId).toBe('1');
            expect(resolution?.action).toBeTruthy();
            executedKinds.push(resolution!.action.kind);

            for (const command of resolution!.action.commands) {
                state = execCmd(
                    state,
                    cmd(command.type as CommandInput['type'], resolution!.playerId, command.payload ?? {}),
                    random,
                );
            }
        }

        expect(executedKinds).toEqual(['roll-dice', 'confirm-roll', 'advance-phase']);
        expect(state.sys.phase).toBe('main2');
    });

    it('本地 AI 在 offensiveRoll 且 pendingAttack 已创建时不应重复选择技能或重复确认骰面', async () => {
        const state = createHeroMatchup('monk', 'shadow_thief')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.pendingAttack = {
            attackerId: '0',
            defenderId: '1',
            isDefendable: true,
            sourceAbilityId: 'fist-technique-5',
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });
        expect(actions.some((action) => action.kind === 'select-ability')).toBe(false);
        expect(actions.some((action) => action.kind === 'confirm-roll')).toBe(false);
        expect(actions).toContainEqual(expect.objectContaining({
            kind: 'advance-phase',
        }));

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).not.toBe('select-ability');
        expect(resolution?.action.kind).not.toBe('confirm-roll');
    });

    it('本地 AI 在太极响应窗口应执行一次 token 后跳过响应，并正确关闭窗口', async () => {
        const random = createQueuedRandom([1, 1]);
        let state = createHeroMatchup('monk', 'monk')(['0', '1'], random);
        state.core.players['0'].tokens.taiji = 2;
        state.core.pendingDamage = {
            id: 'dmg-ai-token',
            sourcePlayerId: '0',
            targetPlayerId: '1',
            originalDamage: 5,
            currentDamage: 5,
            responseType: 'beforeDamageDealt',
            responderId: '0',
            isFullyEvaded: false,
        };
        state.sys.responseWindow = {
            current: {
                id: 'rw-token',
                windowType: 'afterAttackResolved',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const executedKinds: string[] = [];
        const attemptKeys: string[] = [];
        for (let step = 0; step < 2; step += 1) {
            const resolution = await resolveNextLocalAiAction({
                engineConfig,
                state,
                matchId: 'local:test',
                seatControllers: {
                    '0': { type: 'local-ai' },
                },
            });

            expect(resolution?.playerId).toBe('0');
            expect(resolution?.action).toBeTruthy();
            expect(resolution?.attemptKey).toBeTruthy();
            executedKinds.push(resolution!.action.kind);
            attemptKeys.push(resolution!.attemptKey);

            for (const command of resolution!.action.commands) {
                state = execCmd(
                    state,
                    cmd(command.type as CommandInput['type'], resolution!.playerId, command.payload ?? {}),
                    random,
                );
            }
        }

        expect(executedKinds).toEqual(['token-response', 'skip-token-response']);
        expect(new Set(attemptKeys).size).toBe(2);
        expect(state.core.players['0'].tokens.taiji).toBe(1);
        expect(state.core.pendingDamage).toBeUndefined();
        expect(state.sys.interaction.current).toBeUndefined();
        expect(state.sys.responseWindow?.current).toBeUndefined();
        expect(state.core.activePlayerId).toBe('0');

        const next = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(next?.playerId).toBe('0');
        expect(next?.action.kind).toBe('advance-phase');
    });

    it('本地 AI 在致命伤害响应窗口应优先使用保命 token，而不是直接跳过响应', async () => {
        const state = createHeroMatchup('monk', 'paladin')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 2;
        state.core.pendingDamage = {
            id: 'dmg-ai-lethal-response',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 5,
            currentDamage: 5,
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        state.sys.responseWindow = {
            current: {
                id: 'rw-ai-lethal-response',
                windowType: 'afterAttackResolved',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const legalActions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(legalActions.some((action) => action.kind === 'response-pass')).toBe(true);
        expect(legalActions.some((action) => action.kind === 'skip-token-response')).toBe(true);
        expect(legalActions.some((action) => action.kind === 'token-response')).toBe(true);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('token-response');
        expect(resolution?.action.metadata).toMatchObject({
            tokenId: TOKEN_IDS.TAIJI,
        });
    });

    it('本地 AI 在多个防御 token 可用时，应优先选择保命收益更高的 token', async () => {
        const state = createHeroMatchup('monk', 'paladin')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.EVASIVE] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 2;
        state.core.pendingDamage = {
            id: 'dmg-ai-token-tiebreak',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 5,
            currentDamage: 5,
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        state.sys.responseWindow = {
            current: {
                id: 'rw-ai-token-tiebreak',
                windowType: 'afterAttackResolved',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('token-response');
        expect(resolution?.action.metadata).toMatchObject({
            tokenId: TOKEN_IDS.EVASIVE,
        });
    });

    it('本地 AI 在响应窗口同时拥有 token 与减伤牌时，应优先选择更稳妥的保命响应', async () => {
        const state = createHeroMatchup('monk', 'paladin')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 1;
        state.core.players['0'].tokens[TOKEN_IDS.EVASIVE] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 2;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 1;
        state.core.players['0'].hand = [getCardById('card-next-time')];
        state.core.pendingDamage = {
            id: 'dmg-ai-card-vs-token',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 6,
            currentDamage: 6,
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        state.sys.responseWindow = {
            current: {
                id: 'rw-ai-card-vs-token',
                windowType: 'afterAttackResolved',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('response-play-card');
        expect(resolution?.action.metadata).toMatchObject({
            cardId: 'card-next-time',
        });
    });

    it('pendingDamage 仍存在但 responseWindow 已空时，本地 AI 仍应生成 token 响应动作', () => {
        const state = createHeroMatchup('monk', 'paladin')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 1;
        state.core.pendingDamage = {
            id: 'dmg-ai-token-no-window',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 4,
            currentDamage: 4,
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        state.sys.phase = 'defensiveRoll';
        state.sys.responseWindow = { current: undefined } as typeof state.sys.responseWindow;

        const legalActions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(legalActions.some((action) => action.kind === 'token-response')).toBe(true);
        expect(legalActions.some((action) => action.kind === 'skip-token-response')).toBe(true);
        expect(legalActions.some((action) => action.kind === 'advance-phase')).toBe(false);
    });

    it('pendingDamage 仍存在但 responseWindow 已空时，本地 AI 仍应优先走 skip-token-response 而不是普通阶段动作', async () => {
        const state = createHeroMatchup('monk', 'paladin')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 0;
        state.core.pendingDamage = {
            id: 'dmg-ai-skip-no-window',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 4,
            currentDamage: 4,
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        state.sys.phase = 'defensiveRoll';
        state.sys.responseWindow = { current: undefined } as typeof state.sys.responseWindow;

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('skip-token-response');
    });

    it('本地 AI 不应在 main1 把下次不算当成主动出牌', async () => {
        const state = createHeroMatchup('gunslinger', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].hand = [getCardById('card-next-time')];
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 1;
        state.sys.phase = 'main1';

        const legalActions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(legalActions.some((action) =>
            action.kind === 'play-card'
            && action.metadata?.cardId === 'card-next-time'
        )).toBe(false);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).not.toBe('play-card');
    });

    it('本地 AI 在受伤响应窗口应能把下次不算作为 response-play-card 打出', async () => {
        let state = createHeroMatchup('gunslinger', 'monk')(['0', '1'], fixedRandom);
        state.core.players['0'].hand = [getCardById('card-next-time')];
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 1;
        state.core.pendingDamage = {
            id: 'dmg-ai-next-time-response',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 6,
            currentDamage: 6,
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        state.sys.responseWindow = {
            current: {
                id: 'rw-ai-next-time-response',
                windowType: 'afterAttackResolved',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const legalActions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(legalActions.some((action) =>
            action.kind === 'response-play-card'
            && action.metadata?.cardId === 'card-next-time'
        )).toBe(true);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('0');
        expect(resolution?.action.kind).toBe('response-play-card');
        expect(resolution?.action.metadata).toMatchObject({
            cardId: 'card-next-time',
        });

        for (const command of resolution!.action.commands) {
            state = execCmd(
                state,
                cmd(command.type as CommandInput['type'], resolution!.playerId, command.payload ?? {}),
            );
        }

        expect(state.core.players['0'].damageShields).toEqual([
            expect.objectContaining({
                sourceId: 'card-next-time',
                value: 6,
            }),
        ]);
        expect(state.core.players['0'].discard.map((card) => card.id)).toContain('card-next-time');
    });

    it('本地 AI 在响应窗口但不是当前响应者时不应生成响应动作', async () => {
        const state = createHeroMatchup('monk', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
        state.core.players['0'].hand = [getCardById('card-flick')];
        state.sys.responseWindow = {
            current: {
                id: 'rw-not-responder',
                windowType: 'afterRollConfirmed',
                responderQueue: ['1'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const legalActions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(legalActions.length).toBe(0);

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(resolution).toBeNull();
    });

    it('本地 AI 在 offensiveRoll 应先锁住高价值技能关键骰，再继续后续重投决策', async () => {
        const random = createQueuedRandom([6]);
        let state = createHeroMatchup('paladin', 'monk')(['0', '1'], random);
        state.sys.phase = 'offensiveRoll';
        state.core.rollCount = 1;
        state.core.rollLimit = 2;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = false;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 2;
        state.core.dice = [
            { id: 0, value: 1, symbol: 'fist', isKept: false },
            { id: 1, value: 2, symbol: 'sword', isKept: false },
            { id: 2, value: 6, symbol: 'pray', isKept: false },
            { id: 3, value: 2, symbol: 'sword', isKept: false },
            { id: 4, value: 6, symbol: 'pray', isKept: false },
        ];

        const first = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(first?.playerId).toBe('0');
        expect(first?.action.kind).toBe('toggle-die-lock');
        expect(typeof first?.action.metadata?.dieId).toBe('number');
        expect(first?.attemptKey).toBeTruthy();

        for (const command of first!.action.commands) {
            state = execCmd(
                state,
                cmd(command.type as CommandInput['type'], first!.playerId, command.payload ?? {}),
                random,
            );
        }

        const lockedDieId = first?.action.metadata?.dieId as number;
        expect(state.core.dice.find((die) => die.id === lockedDieId)?.isKept).toBe(true);

        const second = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(second?.playerId).toBe('0');
        expect(second?.action).toBeTruthy();
        expect(second?.attemptKey).toBeTruthy();
        expect(second?.attemptKey).not.toBe(first?.attemptKey);
    });

    it('本地 AI 在响应窗口存在可打补牌牌时，应优先出牌而不是直接 pass', async () => {
        let state = createHeroMatchup('paladin', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'main2';
        state.core.activePlayerId = '1';
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 2;
        state.core.players['0'].hand = [
            {
                id: 'card-super-double',
                name: 'Undefendable',
                type: 'action',
                cpCost: 2,
                timing: 'instant',
                description: 'draw 3',
                effects: [{ description: '抽取3张牌', action: { type: 'drawCard', target: 'self', drawCount: 3 }, timing: 'immediate' }],
            },
        ];
        state.sys.responseWindow = {
            current: {
                id: 'rw-then-breakpoint',
                windowType: 'thenBreakpoint',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const first = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(first?.playerId).toBe('0');
        expect(first?.action.kind).toBe('response-play-card');
        expect(first?.action.metadata).toMatchObject({ cardId: 'card-super-double' });

        for (const command of first!.action.commands) {
            state = execCmd(
                state,
                cmd(command.type as CommandInput['type'], first!.playerId, command.payload ?? {}),
            );
        }

        expect(state.sys.responseWindow?.current).toBeUndefined();
        expect(state.core.players['0'].hand.length).toBe(3);

        const second = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(second).toBeNull();
    });

    it('本地 AI 在手牌偏少时应优先使用教皇税抽牌，而不是直接推进阶段', async () => {
        const random = createQueuedRandom([6]);
        let state = createHeroMatchup('paladin', 'monk')(['0', '1'], random);
        state.sys.phase = 'main2';
        state.core.activePlayerId = '0';
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 3;
        state.core.players['0'].hand = [];

        const first = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(first?.playerId).toBe('0');
        expect(first?.action.kind).toBe('use-passive-ability');
        expect(first?.action.metadata).toMatchObject({
            passiveId: 'tithes',
            actionIndex: 1,
        });

        for (const command of first!.action.commands) {
            state = execCmd(
                state,
                cmd(command.type as CommandInput['type'], first!.playerId, command.payload ?? {}),
                random,
            );
        }

        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(0);
        expect(state.core.players['0'].hand.length).toBe(1);

        const second = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:test',
            seatControllers: {
                '0': { type: 'local-ai' },
            },
        });

        expect(second?.playerId).toBe('0');
        expect(second?.action).toBeTruthy();
        expect(second?.attemptKey).toBeTruthy();
        expect(second?.attemptKey).not.toBe(first?.attemptKey);
    });

    it('本地 AI 在已确认骰面时不应再使用教皇税重掷骰子（避免反复打开响应窗口打扰真人）', () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 3;

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        const rerollPassiveActions = actions.filter((action) => (
            action.kind === 'use-passive-ability'
            && action.commands.some((cmd) => {
                if (cmd.type !== 'USE_PASSIVE_ABILITY') return false;
                const payload = cmd.payload as { passiveId?: string; actionIndex?: number } | undefined;
                return payload?.passiveId === 'tithes' && payload?.actionIndex === 0;
            })
        ));
        expect(rerollPassiveActions).toHaveLength(0);
    });

    it('本地 AI 在未确认骰面且有可重掷骰子时应能使用教皇税重掷骰子', () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.activePlayerId = '0';
        state.core.rollCount = 1;
        state.core.rollLimit = 3;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = false;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 3;
        // 保证至少存在一个未锁定骰子
        state.core.dice = state.core.dice.map((die, index) => (index === 0 ? { ...die, isKept: false } : die));

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });

        expect(actions.some((action) => (
            action.kind === 'use-passive-ability'
            && action.commands.some((cmd) => {
                if (cmd.type !== 'USE_PASSIVE_ABILITY') return false;
                const payload = cmd.payload as { passiveId?: string; actionIndex?: number; targetDieId?: number } | undefined;
                return payload?.passiveId === 'tithes'
                    && payload?.actionIndex === 0
                    && typeof payload?.targetDieId === 'number';
            })
        ))).toBe(true);
    });

    it('不同难度会影响搜索行为，专家玩法噪声保持为 0', async () => {
        const state = createSetupWithHand(['card-enlightenment', 'card-boss-generous'], { cp: 0 })(['0', '1'], fixedRandom);
        const matchId = 'probe';

        const easyResolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId,
            seatControllers: {
                '0': { type: 'local-ai', difficulty: 'easy' },
            },
        });
        const expertResolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId,
            seatControllers: {
                '0': { type: 'local-ai', difficulty: 'expert' },
            },
        });

        expect(easyResolution?.action.kind).toBe('play-card');
        expect(expertResolution?.action.kind).toBe('play-card');
        expect(expertResolution?.action.metadata).toMatchObject({ cardId: 'card-enlightenment' });
        expect(easyResolution?.action.metadata).toMatchObject({ cardId: 'card-enlightenment' });

        const easyContext = buildAiDecisionContext({
            gameId: 'dicethrone',
            matchId,
            playerId: '0',
            visibleState: state,
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'easy' },
        });
        const expertContext = buildAiDecisionContext({
            gameId: 'dicethrone',
            matchId,
            playerId: '0',
            visibleState: state,
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'expert' },
        });

        const easyDecision = await diceThroneAiRuntime.localPolicies.baseline.decide(easyContext);
        const expertDecision = await diceThroneAiRuntime.localPolicies.baseline.decide(expertContext);
        const easyEvaluations = (easyDecision?.providerMetadata?.evaluations ?? []) as Array<{ searched?: boolean; noiseScore?: number }>;
        const expertEvaluations = (expertDecision?.providerMetadata?.evaluations ?? []) as Array<{ searched?: boolean; noiseScore?: number }>;

        expect(easyEvaluations.some((item) => item.searched)).toBe(false);
        expect(expertEvaluations.some((item) => item.searched)).toBe(true);
        expect(expertEvaluations.every((item) => item.noiseScore === 0)).toBe(true);
    });

    it('响应窗口 legal action 会附带 survive-response strategy tags', () => {
        const state = createHeroMatchup('monk', 'paladin')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 2;
        state.core.pendingDamage = {
            id: 'dmg-strategy-tags',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 5,
            currentDamage: 5,
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        state.sys.responseWindow = {
            current: {
                id: 'rw-strategy-tags',
                windowType: 'afterAttackResolved',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const actions = buildDiceThroneAiLegalActions({
            playerId: '0',
            state,
        });
        const tokenAction = actions.find((action) => action.kind === 'token-response');

        expect(tokenAction?.metadata?.strategyTags).toContain('survive-response');
        expect(tokenAction?.metadata?.cardStrategyTags).toBeUndefined();
    });

    it('withAiActionStrategyTags 默认只写 strategyTags，显式 opt-in 才镜像 legacy 字段', () => {
        expect(withAiActionStrategyTags({ foo: 'bar' }, ['survive-response'])).toEqual({
            foo: 'bar',
            strategyTags: ['survive-response'],
        });
        expect(withAiActionStrategyTags({ foo: 'bar' }, ['survive-response'], {
            mirrorLegacyCardStrategyTags: true,
        })).toEqual({
            foo: 'bar',
            strategyTags: ['survive-response'],
            cardStrategyTags: ['survive-response'],
        });
    });

    it('strategy profile scorer 会在高压响应窗口继续抬高保命动作评分', async () => {
        const state = createHeroMatchup('monk', 'paladin')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 2;
        state.core.pendingDamage = {
            id: 'dmg-strategy-priority',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 5,
            currentDamage: 5,
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        state.sys.responseWindow = {
            current: {
                id: 'rw-strategy-priority',
                windowType: 'afterAttackResolved',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const context = buildAiDecisionContext({
            gameId: 'dicethrone',
            matchId: 'dicethrone-strategy-priority',
            playerId: '0',
            visibleState: state,
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'expert' },
        });

        const decision = await diceThroneAiRuntime.localPolicies.baseline.decide(context);
        const evaluations = (decision?.providerMetadata?.evaluations ?? []) as Array<{
            actionId: string;
            kind: string;
            contributions: Array<{ scorerId: string; score: number }>;
        }>;
        const tokenAction = context.legalActions.find((action) => action.kind === 'token-response');
        const passAction = context.legalActions.find((action) => action.kind === 'response-pass');
        const tokenEval = evaluations.find((item) => item.actionId === tokenAction?.actionId);
        const passEval = evaluations.find((item) => item.actionId === passAction?.actionId);

        expect(tokenAction?.metadata?.strategyTags).toContain('survive-response');
        expect(tokenEval?.contributions.some((item) => item.scorerId === 'strategy-profile-fit' && item.score > 0)).toBe(true);
        expect(passEval?.contributions.some((item) => item.scorerId === 'strategy-profile-fit' && item.score > 0)).toBe(false);
        expect(decision?.actionId).toBe(tokenAction?.actionId);
    });

    it('专家难度 trace 会记录 strategy 驱动的 searchPriority，供通用搜索层复用', async () => {
        const state = createSetupWithHand(['card-enlightenment', 'card-boss-generous'], { cp: 0 })(['0', '1'], fixedRandom);
        const expertContext = buildAiDecisionContext({
            gameId: 'dicethrone',
            matchId: 'probe-strategy-priority',
            playerId: '0',
            visibleState: state,
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'expert' },
        });

        const expertDecision = await diceThroneAiRuntime.localPolicies.baseline.decide(expertContext);
        const expertEvaluations = (expertDecision?.providerMetadata?.evaluations ?? []) as Array<{
            kind: string;
            searchPriority?: number;
            shortlisted?: boolean;
        }>;

        expect(expertEvaluations.some((item) => (item.searchPriority ?? 0) > 0)).toBe(true);
        expect(expertEvaluations.some((item) => item.shortlisted)).toBe(true);
    });

    it('专家难度不会把无 projection 模型的骰面微操作抬进 strategy shortlist', async () => {
        const state = createHeroMatchup('paladin', 'monk')(['0', '1'], fixedRandom);
        state.sys.phase = 'offensiveRoll';
        state.core.rollCount = 1;
        state.core.rollLimit = 2;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = false;
        state.core.players['0'].resources[RESOURCE_IDS.CP] = 2;
        state.core.dice = [
            { id: 0, value: 1, symbol: 'fist', isKept: false },
            { id: 1, value: 2, symbol: 'sword', isKept: false },
            { id: 2, value: 6, symbol: 'pray', isKept: false },
            { id: 3, value: 2, symbol: 'sword', isKept: false },
            { id: 4, value: 6, symbol: 'pray', isKept: false },
        ];

        const expertContext = buildAiDecisionContext({
            gameId: 'dicethrone',
            matchId: 'probe-micro-priority-guard',
            playerId: '0',
            visibleState: state,
            rulesVersion: null,
            decisionBudgetMs: 250,
            source: 'local',
            seatController: { type: 'local-ai', difficulty: 'expert' },
        });

        const expertDecision = await diceThroneAiRuntime.localPolicies.baseline.decide(expertContext);
        const expertEvaluations = (expertDecision?.providerMetadata?.evaluations ?? []) as Array<{
            kind: string;
            searchPriority?: number;
        }>;

        expect(expertEvaluations.some((item) => item.kind === 'toggle-die-lock')).toBe(true);
        expect(expertEvaluations.some((item) => item.kind === 'roll-dice')).toBe(true);
        expect(
            expertEvaluations
                .filter((item) => item.kind === 'toggle-die-lock' || item.kind === 'roll-dice' || item.kind === 'confirm-roll')
                .every((item) => (item.searchPriority ?? 0) === 0),
        ).toBe(true);
    });

    it('远程 AI 在可见大动作决策点应调用 provider', async () => {
        const providerId = 'test-remote-major-visible';
        const decide = vi.fn(async (context) => {
            const action = context.legalActions.find((candidate) => candidate.kind === 'play-card');
            return action ? { actionId: action.actionId } : null;
        });
        registerRemoteAiProvider({
            id: providerId,
            decide,
        });

        const state = createSetupWithHand(['card-enlightenment'], { cp: 0 })(['0', '1'], fixedRandom);
        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'remote-major-visible',
            seatControllers: {
                '0': { type: 'remote-ai', providerId, fallbackPolicyId: 'baseline' },
            },
        });

        expect(decide).toHaveBeenCalledTimes(1);
        expect(resolution?.playerId).toBe('0');
        expect(resolution?.source).toBe('remote-ai');
        expect(resolution?.action.kind).toBe('play-card');
        expect(resolution?.action.metadata).toMatchObject({ cardId: 'card-enlightenment' });
    });

    it('远程 AI 在微决策响应窗口应直接走本地 fallback，不发远程请求', async () => {
        const providerId = 'test-remote-micro-bypass';
        const decide = vi.fn(async (context) => {
            const action = context.legalActions[0];
            return action ? { actionId: action.actionId } : null;
        });
        registerRemoteAiProvider({
            id: providerId,
            decide,
        });

        const state = createHeroMatchup('monk', 'paladin')(['0', '1'], fixedRandom);
        state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 1;
        state.core.players['0'].resources[RESOURCE_IDS.HP] = 2;
        state.core.pendingDamage = {
            id: 'dmg-remote-micro-response',
            sourcePlayerId: '1',
            targetPlayerId: '0',
            originalDamage: 5,
            currentDamage: 5,
            responseType: 'beforeDamageReceived',
            responderId: '0',
            isFullyEvaded: false,
        };
        state.sys.responseWindow = {
            current: {
                id: 'rw-remote-micro-response',
                windowType: 'afterAttackResolved',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'remote-micro-bypass',
            seatControllers: {
                '0': { type: 'remote-ai', providerId, fallbackPolicyId: 'baseline' },
            },
        });

        expect(decide).not.toHaveBeenCalled();
        expect(resolution?.playerId).toBe('0');
        expect(resolution?.source).toBe('remote-ai-fallback');
        expect(resolution?.action.kind).toBe('token-response');
        expect(resolution?.action.metadata).toMatchObject({
            tokenId: TOKEN_IDS.TAIJI,
        });
    });
});

describe('作弊发牌 atlas 索引保护', () => {
    const createUpgradeAtlasState = () => createHeroMatchup('gunslinger', 'monk', (core) => {
        const player = core.players['0'];
        player.hand = [];
        player.discard = [];
        player.deck = [
            getCardById('upgrade-deadeye-2'),
            ...player.deck.filter((card) => card.id !== 'upgrade-deadeye-2'),
        ];
    })(['0', '1'], fixedRandom);

    it('gunslinger slot 24 现在只对应 upgrade-deadeye-2，按 atlas index 应可唯一发牌', () => {
        const state = createUpgradeAtlasState();
        const nextCore = diceThroneCheatModifier.dealCardByAtlasIndex!(state.core, '0', 24);

        expect(nextCore.players['0'].hand.map((card) => card.id)).toEqual(['upgrade-deadeye-2']);
        expect(nextCore.players['0'].deck).toHaveLength(state.core.players['0'].deck.length - 1);
    });

    it('精确 deckIndex 发牌仍可发出 upgrade-deadeye-2', () => {
        const state = createUpgradeAtlasState();
        const nextCore = diceThroneCheatModifier.dealCardByIndex!(state.core, '0', 0);

        expect(nextCore.players['0'].hand.map((card) => card.id)).toEqual(['upgrade-deadeye-2']);
        expect(nextCore.players['0'].deck[0]?.id).not.toBe('upgrade-deadeye-2');
    });
});

describe('本地 AI setup 视角切换', () => {
    it('应先保留房主视角，房主选完后切到 AI 座位，AI 准备后回到房主', () => {
        const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
        const state: MatchState<DiceThroneCore> = {
            core,
            sys: {
                phase: 'setup',
                interaction: { queue: [] },
            } as MatchState<DiceThroneCore>['sys'],
        };

        expect(resolveLocalPregameControlledPlayerId({
            gameId: 'dicethrone',
            state,
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        })).toBe('0');

        core.selectedCharacters['0'] = 'barbarian';
        expect(resolveLocalPregameControlledPlayerId({
            gameId: 'dicethrone',
            state,
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        })).toBe('1');

        core.selectedCharacters['1'] = 'monk';
        expect(resolveLocalPregameControlledPlayerId({
            gameId: 'dicethrone',
            state,
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        })).toBe('1');

        core.readyPlayers['1'] = true;
        expect(resolveLocalPregameControlledPlayerId({
            gameId: 'dicethrone',
            state,
            localPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        })).toBe('0');
    });
});


// ============================================================================
// 2. REROLL_DIE — 交互上下文中重掷单个骰子
// ============================================================================

describe('REROLL_DIE 交互中重掷骰子', () => {
    it('有 pendingInteraction 时重掷骰子成功', () => {
        const diceValues = [3, 3, 3, 3, 3, 5]; // 第 6 个值用于重掷
        const random = createQueuedRandom(diceValues);

        // 先推进到 offensiveRoll 并掷骰
        let state = createInitializedState(['0', '1'], random);
        state = execCmd(state, cmd('ADVANCE_PHASE', '0'), random);
        state = execCmd(state, cmd('ROLL_DICE', '0'), random);

        const dieBefore = state.core.dice[0].value;
        expect(dieBefore).toBe(3);

        // 注入 pendingInteraction（模拟卡牌效果触发重掷交互）
        injectPendingInteraction(state, {
            id: 'reroll-test',
            playerId: '0',
            sourceCardId: 'test-card',
            type: 'rerollDie',
            titleKey: 'test',
            selectCount: 1,
            selected: [],
        });

        // 重掷 die 0
        state = execCmd(state, cmd('REROLL_DIE', '0', { dieId: 0 }), random);
        expect(state.core.dice[0].value).toBe(5);
    });

    it('无 pendingInteraction 时重掷失败', () => {
        const diceValues = [3, 3, 3, 3, 3];
        const random = createQueuedRandom(diceValues);

        let state = createInitializedState(['0', '1'], random);
        state = execCmd(state, cmd('ADVANCE_PHASE', '0'), random);
        state = execCmd(state, cmd('ROLL_DICE', '0'), random);

        const result = tryCmd(state, cmd('REROLL_DIE', '0', { dieId: 0 }), random);
        expect(result.success).toBe(false);
    });

    it('非交互玩家重掷失败', () => {
        const diceValues = [3, 3, 3, 3, 3];
        const random = createQueuedRandom(diceValues);

        let state = createInitializedState(['0', '1'], random);
        state = execCmd(state, cmd('ADVANCE_PHASE', '0'), random);
        state = execCmd(state, cmd('ROLL_DICE', '0'), random);

        injectPendingInteraction(state, {
            id: 'reroll-test',
            playerId: '0',
            sourceCardId: 'test-card',
            type: 'rerollDie',
            titleKey: 'test',
            selectCount: 1,
            selected: [],
        });

        // 玩家 1 尝试重掷
        const result = tryCmd(state, cmd('REROLL_DIE', '1', { dieId: 0 }), random);
        expect(result.success).toBe(false);
    });

    it('不存在的骰子 ID 重掷失败', () => {
        const diceValues = [3, 3, 3, 3, 3];
        const random = createQueuedRandom(diceValues);

        let state = createInitializedState(['0', '1'], random);
        state = execCmd(state, cmd('ADVANCE_PHASE', '0'), random);
        state = execCmd(state, cmd('ROLL_DICE', '0'), random);

        injectPendingInteraction(state, {
            id: 'reroll-test',
            playerId: '0',
            sourceCardId: 'test-card',
            type: 'rerollDie',
            titleKey: 'test',
            selectCount: 1,
            selected: [],
        });

        const result = tryCmd(state, cmd('REROLL_DIE', '0', { dieId: 99 }), random);
        expect(result.success).toBe(false);
    });
});


// ============================================================================
// 3. RESOLVE_CHOICE — 选择交互解决
//
// 注意：RESOLVE_CHOICE 在 execute 层是 no-op（break），validate 始终返回 ok()。
// 实际选择流程通过 SYS_INTERACTION_RESPOND 命令走 InteractionSystem。
// 这里测试 RESOLVE_CHOICE 命令本身的通过性，以及通过 GTR 测试完整选择流程。
// ============================================================================

describe('RESOLVE_CHOICE 选择交互', () => {
    it('RESOLVE_CHOICE 命令始终通过验证（no-op）', () => {
        const state = createInitializedState(['0', '1'], fixedRandom);
        const result = tryCmd(state, cmd('RESOLVE_CHOICE', '0', { statusId: 'knockdown' }));
        // validate 始终返回 ok()，execute 是 break（no-op）
        expect(result.success).toBe(true);
    });

    it('完整选择流程已在 monk-coverage.test.ts 中覆盖', () => {
        // RESOLVE_CHOICE 在 execute 层是 no-op（break），validate 始终返回 ok()。
        // 实际选择流程通过 SYS_INTERACTION_RESPOND 走 InteractionSystem：
        //   CHOICE_REQUESTED 事件 → InteractionSystem 队列 simple-choice →
        //   SYS_INTERACTION_RESPOND → SYS_INTERACTION_RESOLVED → CHOICE_RESOLVED
        // 完整选择流程（禅忘二选一等）已在 monk-coverage.test.ts 中通过 GTR 覆盖。
        // 这里仅验证 RESOLVE_CHOICE 命令本身的通过性。
        const state = createInitializedState(['0', '1'], fixedRandom);

        // 在任意阶段都能通过验证（因为 validate 始终返回 ok）
        const result1 = tryCmd(state, cmd('RESOLVE_CHOICE', '0', { statusId: 'knockdown' }));
        expect(result1.success).toBe(true);

        // 不同玩家也能通过
        const result2 = tryCmd(state, cmd('RESOLVE_CHOICE', '1', { statusId: 'poison' }));
        expect(result2.success).toBe(true);
    });
});
