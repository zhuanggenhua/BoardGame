/**
 * 教程端到端测试（含 TutorialSystem 活跃状态）
 *
 * 通过 SYS_TUTORIAL_START 启动教程，TutorialSystem 全程参与命令拦截和步骤推进。
 * 模拟客户端 TutorialContext 的行为：执行 AI 操作 → consumeAi → 手动推进。
 *
 * 教程流程：
 *   开局与 M 牌 → 即时抽牌和升级 → 掷骰攻击与防御
 *   → 出售筹响应费用 → 对手掷骰时介入 → 防御减伤与收入
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiceThroneDomain } from '../domain';
import { testSystems, createQueuedRandom } from './test-utils';
import { executePipeline, createInitialSystemState } from '../../../engine/pipeline';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import type { MatchState, PlayerId, TutorialAiAction } from '../../../engine/types';
import { TOKEN_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { INITIAL_CP } from '../domain/types';
import { DiceThroneTutorial } from '../tutorial';
import { TUTORIAL_COMMANDS } from '../../../engine/systems/TutorialSystem';
import { injectTutorialInteractionId } from '../../../engine/transport/tutorialAiCommand';
import { buildLocalDispatchCommand } from '../../../engine/transport/localDispatchCommand';
import { getCurrentInteractionData, getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import { resolveDiceThroneTokenResponseInteractionPendingDamageId } from '../domain/tokenResponseChoiceContract';

describe('教程端到端测试（TutorialSystem 活跃）', () => {
    const playerIds: PlayerId[] = ['0', '1'];
    const manifest = DiceThroneTutorial;

    // 每个测试独立创建 random，避免跨测试状态污染
    let random: ReturnType<typeof createQueuedRandom>;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
        (globalThis as any).__BG_GAME_MODE__ = 'tutorial';
        random = createQueuedRandom(manifest.randomPolicy!.values!);
    });

    afterEach(() => {
        vi.useRealTimers();
        delete (globalThis as any).__BG_GAME_MODE__;
    });

    const pipelineConfig = {
        domain: DiceThroneDomain,
        systems: testSystems,
    };

    const exec = (
        state: MatchState<DiceThroneCore>,
        type: string,
        playerId: PlayerId,
        payload: Record<string, unknown> = {},
        label = '',
    ): MatchState<DiceThroneCore> => {
        const command = { type, playerId, payload, timestamp: Date.now() } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (!result.success) {
            const t = state.sys.tutorial;
            const interaction = getCurrentInteractionSummary(state);
            const desc = label ? ` [${label}]` : '';
            throw new Error(
                `Command ${type} (p${playerId})${desc} failed: ${result.error}\n` +
                `  phase=${state.sys.phase} active=${state.core.activePlayerId}\n` +
                `  interaction=${interaction.kind ?? 'none'}:${interaction.id ?? 'none'}\n` +
                `  tutorialStep=${t.step?.id ?? 'none'} stepIndex=${t.stepIndex} active=${t.active}`
            );
        }
        return result.state as MatchState<DiceThroneCore>;
    };

    const tryExec = (
        state: MatchState<DiceThroneCore>,
        type: string,
        playerId: PlayerId,
        payload: Record<string, unknown> = {},
        isTutorialAiCommand = false,
    ): { state: MatchState<DiceThroneCore>; success: boolean; error?: string } => {
        const command = { type, playerId, payload, timestamp: Date.now(), ...(isTutorialAiCommand ? { skipValidation: true } : {}) } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) {
            return { state: result.state as MatchState<DiceThroneCore>, success: true };
        }
        return { state, success: false, error: result.error };
    };

    /** 模拟客户端消费 AI 操作 */
    const consumeAiActions = (
        state: MatchState<DiceThroneCore>,
        stepId: string,
        aiActions: TutorialAiAction[],
        label: string,
    ): MatchState<DiceThroneCore> => {
        let s = state;
        for (let i = 0; i < aiActions.length; i++) {
            const action = aiActions[i];
            const pid = action.playerId ?? s.core.activePlayerId;
            const payload = injectTutorialInteractionId({
                state: s,
                commandType: action.commandType,
                payload: action.payload as Record<string, unknown>,
                tutorialPlayerId: pid as PlayerId,
                isTutorialAiCommand: true,
            }) as Record<string, unknown>;
            if (action.commandType === 'SKIP_TOKEN_RESPONSE') {
                const pendingDamageId = resolveDiceThroneTokenResponseInteractionPendingDamageId({
                    ...getCurrentInteractionSummary(s),
                    data: getCurrentInteractionData(s),
                });
                expect(pendingDamageId, `${label}: AI action[${i}] should have a live token-response interaction`).toBeTypeOf('string');
                expect(payload).toMatchObject({ pendingDamageId });
            }
            const result = tryExec(s, action.commandType, pid as PlayerId, payload, true);
            if (!result.success) {
                throw new Error(
                    `AI action[${i}] ${action.commandType} (p${pid}) in step [${label}] failed: ${result.error}\n` +
                    `  phase=${s.sys.phase} active=${s.core.activePlayerId}\n` +
                    `  tutorialStep=${s.sys.tutorial.step?.id ?? 'none'} stepIndex=${s.sys.tutorial.stepIndex}`
                );
            }
            s = result.state;
        }
        s = exec(s, TUTORIAL_COMMANDS.AI_CONSUMED, '0', { stepId }, `${label}: consumeAi`);
        return s;
    };

    /** 手动推进教程步骤 */
    const nextStep = (
        state: MatchState<DiceThroneCore>,
        label: string,
        reason: 'manual' | 'auto' = 'manual',
    ): MatchState<DiceThroneCore> => {
        return exec(state, TUTORIAL_COMMANDS.NEXT, '0', { reason }, label);
    };


    const start = () => {
        let state: MatchState<DiceThroneCore> = {
            core: DiceThroneDomain.setup(playerIds, random),
            sys: createInitialSystemState(playerIds, testSystems, undefined),
        };
        state = exec(state, TUTORIAL_COMMANDS.START, '0', { manifest });
        state = consumeAiActions(state, 'setup', manifest.steps[0].aiActions!, 'setup');
        expect(state.sys.phase).toBe('main1');
        expect(state.core.players['0'].hand).toHaveLength(4);
        expect(state.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(50);
        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(INITIAL_CP);
        expect(state.core.pendingDamage).toBeUndefined();
        return state;
    };

    /** 每步执行清单要求的正式动作，并断言资源与真实规则结果。 */
    const walk = (useTaiji: boolean, stopAt = 'income-result') => {
        let s = start();
        const visited = new Set<string>();
        for (let guard = 0; guard < manifest.steps.length + 15; guard++) {
            const step = s.sys.tutorial.step!;
            visited.add(step.id);
            if (step.id === stopAt && !step.aiActions?.length) return { state: s, visited };
            if (step.aiActions?.length) {
                expect(step.aiActions.every(action => action.playerId === '1' || (step.id === 'opponent-defense' && action.playerId === '0'))).toBe(true);
                s = consumeAiActions(s, step.id, step.aiActions, step.id);
                if (step.id === stopAt && s.sys.tutorial.step?.id === step.id && !s.sys.tutorial.step.aiActions?.length) return { state: s, visited };
                if (s.sys.tutorial.step?.id === step.id) s = nextStep(s, step.id, step.autoAdvanceAfterAi ? 'auto' : 'manual');
                continue;
            }
            if (step.infoStep) {
                s = nextStep(s, step.id);
                continue;
            }
            switch (step.id) {
                case 'one-throw-play':
                    s = exec(s, 'PLAY_CARD', '0', { cardId: 'card-one-throw-fortune' });
                    expect(s.core.pendingBonusDiceSettlement).toBeDefined();
                    break;
                case 'one-throw-confirm':
                    s = exec(s, 'CONFIRM_ROLL', '0');
                    expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(2);
                    break;
                case 'double-play': {
                    s = exec(s, 'PLAY_CARD', '0', { cardId: 'card-double' });
                    expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(1);
                    expect(s.core.players['0'].hand.map(card => card.id)).toEqual(expect.arrayContaining(['card-thrust-punch-2', 'card-inner-peace']));
                    break;
                }
                case 'upgrade-card':
                    s = exec(s, 'PLAY_CARD', '0', { cardId: 'card-thrust-punch-2' });
                    expect(s.core.players['0'].abilityLevels?.['fist-technique']).toBe(2);
                    expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(0);
                    break;
                case 'advance':
                case 'resolve-attack':
                case 'defense-resolve':
                    s = exec(s, 'ADVANCE_PHASE', '0');
                    if (step.id === 'resolve-attack') expect(s.core.pendingAttack).toMatchObject({ sourceAbilityId: 'fist-technique-2-4', isDefendable: true });
                    break;
                case 'dice-play': {
                    s = exec(s, 'ROLL_DICE', '0');
                    expect(s.core.dice.map(die => die.value)).toEqual([1, 1, 1, 1, 3]);
                    break;
                }
                case 'dice-reroll': {
                    for (const dieId of [0, 1, 2, 3]) s = exec(s, 'TOGGLE_DIE_LOCK', '0', { dieId });
                    s = exec(s, 'ROLL_DICE', '0');
                    expect(s.core.dice.map(die => die.value)).toEqual([1, 1, 1, 1, 4]);
                    expect(s.core.dice.filter(die => die.isKept)).toHaveLength(4);
                    s = exec(s, 'CONFIRM_ROLL', '0');
                    break;
                }
                case 'abilities':
                    s = exec(s, 'SELECT_ABILITY', '0', { abilityId: 'fist-technique-2-4' });
                    break;
                case 'sell-card-intro': {
                    s = exec(s, 'SELL_CARD', '0', { cardId: 'card-palm-strike' });
                    expect(s.core.players['0'].hand).toHaveLength(2);
                    expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(1);
                    break;
                }
                case 'end-turn':
                    s = exec(s, 'ADVANCE_PHASE', '0');
                    if (s.sys.phase === 'discard') s = exec(s, 'ADVANCE_PHASE', '0');
                    break;
                case 'interference-play':
                    s = exec(s, 'PLAY_CARD', '0', { cardId: 'card-give-hand' });
                    expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(0);
                    expect(getCurrentInteractionSummary(s).kind).toBeTruthy();
                    break;
                case 'interference-target':
                    s = exec(s, 'REROLL_DIE', '0', { dieId: 0 });
                    s = exec(s, 'SYS_INTERACTION_CONFIRM', '0');
                    expect(s.core.dice[0].value).toBe(6);
                    break;
                case 'defense-start':
                    s = nextStep(s, 'defense showcase dismissed');
                    break;
                case 'defense-roll':
                    s = exec(s, 'ROLL_DICE', '0');
                    s = exec(s, 'CONFIRM_ROLL', '0');
                    break;
                case 'token-response': {
                    const pending = s.core.pendingDamage!;
                    expect(pending.responderId).toBe('0');
                    const beforeTaiji = s.core.players['0'].tokens[TOKEN_IDS.TAIJI];
                    const beforeHealth = s.core.players['0'].resources[RESOURCE_IDS.HP];
                    if (useTaiji) {
                        s = exec(s, 'USE_TOKEN', '0', { pendingDamageId: pending.id, tokenId: TOKEN_IDS.TAIJI, amount: 1 });
                        expect(s.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(beforeTaiji - 1);
                        expect(s.core.pendingDamage?.currentDamage).toBe(pending.currentDamage - 1);
                        expect(s.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(beforeHealth);
                        s = exec(s, 'SKIP_TOKEN_RESPONSE', '0', { pendingDamageId: pending.id });
                    } else {
                        s = exec(s, 'SKIP_TOKEN_RESPONSE', '0', { pendingDamageId: pending.id });
                        expect(s.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(beforeHealth - pending.currentDamage);
                    }
                    expect(s.core.pendingDamage).toBeUndefined();
                    break;
                }
                default: throw new Error(`未覆盖正式动作: ${step.id}`);
            }
        }
        const interaction = getCurrentInteractionSummary(s);
        throw new Error(`教程未完成: step=${s.sys.tutorial.step?.id ?? 'none'} phase=${s.sys.phase} interaction=${interaction.kind ?? 'none'} visited=${Array.from(visited).join(',')}`);
    };

    it.each([true, false])('亲手完成双人主线、响应牌并%s太极减伤', (useTaiji) => {
        const { state, visited } = walk(useTaiji);
        for (const id of ['double-play', 'one-throw-play', 'one-throw-confirm', 'upgrade-card', 'dice-play', 'dice-reroll', 'abilities', 'opponent-defense', 'sell-card-intro', 'response-control', 'interference-play', 'interference-target', 'defense-roll', 'token-response', 'income-result']) {
            expect(visited.has(id), id).toBe(true);
        }
        expect(state.core.activePlayerId).toBe('0');
        expect(state.sys.phase).toBe('main1');
        expect(state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(1);
        const finished = nextStep(state, 'finish');
        expect(finished.sys.tutorial.active).toBe(false);
    });

    it('误售后续响应牌会恢复出售前完整局面', () => {
        let { state } = walk(true, 'sell-card-intro');
        const original = state.core;
        state = exec(state, 'SELL_CARD', '0', { cardId: 'card-give-hand' });
        expect(state.sys.tutorial.step?.id).toBe('sale-branch-recovery');
        const { command } = buildLocalDispatchCommand({ state, commandType: TUTORIAL_COMMANDS.PREVIOUS, payload: { __tutorialAiCommand: true, __tutorialPlayerId: '0' }, localPregameControlledPlayerId: null });
        const recovery = executePipeline(pipelineConfig, state, command as DiceThroneCommand, random, playerIds);
        expect(recovery.success).toBe(true);
        state = recovery.state as MatchState<DiceThroneCore>;
        expect(state.sys.tutorial.step?.id).toBe('sell-card-intro');
        expect(state.core).toEqual(original);
    });

    it('可以合法不发动能力，恢复同一骰面后仍能亲手选择进攻', () => {
        let { state } = walk(true, 'abilities');
        const original = state.core;
        state = exec(state, 'ADVANCE_PHASE', '0');
        expect(state.sys.phase).toBe('main2');
        expect(state.sys.tutorial.step?.id).toBe('ability-branch-recovery');
        const { command } = buildLocalDispatchCommand({ state, commandType: TUTORIAL_COMMANDS.PREVIOUS, payload: { __tutorialAiCommand: true, __tutorialPlayerId: '0' }, localPregameControlledPlayerId: null });
        const recovery = executePipeline(pipelineConfig, state, command as DiceThroneCommand, random, playerIds);
        expect(recovery.success).toBe(true);
        state = recovery.state as MatchState<DiceThroneCore>;
        expect(state.sys.tutorial.step?.id).toBe('abilities');
        expect(state.core).toEqual(original);
        state = exec(state, 'SELECT_ABILITY', '0', { abilityId: 'fist-technique-2-4' });
        expect(state.sys.tutorial.step?.id).toBe('resolve-attack');
    });

});
