/**
 * 教程端到端测试（含 TutorialSystem 活跃状态）
 *
 * 通过 SYS_TUTORIAL_START 启动教程，TutorialSystem 全程参与命令拦截和步骤推进。
 * 模拟客户端 TutorialContext 的行为：执行 AI 操作 → consumeAi → 手动推进。
 *
 * 教程流程（与 tutorial.ts 步骤顺序一致）：
 *   setup → 读牌与出售 → 蓝框顿悟及奖励骰 → 首次攻击与防御
 *   → 主要阶段 2 用红框加倍补牌，留 CP 给对手回合的响应牌
 *   → 对手回合及当前玩家响应
 *   → AI回合（掌击+攻击）
 *   → 击倒说明 → 用已有净化保留进攻权与 CP → 清修升级 → 结束
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
    ): { state: MatchState<DiceThroneCore>; success: boolean; error?: string } => {
        const command = { type, playerId, payload, timestamp: Date.now() } as DiceThroneCommand;
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
            const result = tryExec(s, action.commandType, pid as PlayerId, payload);
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
    ): MatchState<DiceThroneCore> => {
        return exec(state, TUTORIAL_COMMANDS.NEXT, '0', { reason: 'manual' }, label);
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

    /** 每步只执行清单要求的正式动作，说明步骤读取后正常推进。 */
    const walk = (useChi: boolean | 'evasive', stopAt = 'finish') => {
        let s = start();
        const visited = new Set<string>();
        for (let guard = 0; guard < manifest.steps.length + 15; guard++) {
            const step = s.sys.tutorial.step!;
            visited.add(step.id);
            if (step.id === stopAt) return { state: s, visited };
            if (step.aiActions?.length) {
                expect(step.aiActions.every(action => action.playerId === '1')).toBe(true);
                s = consumeAiActions(s, step.id, step.aiActions, step.id);
                if (s.sys.tutorial.step?.id === step.id) s = nextStep(s, step.id);
                continue;
            }
            if (step.infoStep) {
                s = nextStep(s, step.id);
                continue;
            }
            switch (step.id) {
                case 'hand-inspect':
                    // 长按只打开正式本地检视层；真实触屏和不误出牌由浏览器验证。
                    s = exec(s, TUTORIAL_COMMANDS.NEXT, '0', { reason: 'auto' });
                    break;
                case 'defense-start':
                    s = nextStep(s, 'defense showcase dismissed');
                    break;
                case 'sell-card-intro': {
                    s = exec(s, 'SELL_CARD', '0', { cardId: 'card-palm-strike' });
                    expect(s.core.players['0'].hand).toHaveLength(3);
                    expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(2);
                    break;
                }
                case 'end-turn':
                    s = exec(s, 'ADVANCE_PHASE', '0');
                    // 正式 Board 在手牌不超限时自动交出回合。
                    if (s.sys.phase === 'discard') s = exec(s, 'ADVANCE_PHASE', '0');
                    break;
                case 'advance': case 'resolve-attack': case 'defense-resolve':
                    s = exec(s, 'ADVANCE_PHASE', '0');
                    if (step.id === 'defense-resolve') expect(s.core.players['0'].tokens.taiji).toBe(5);
                    break;
                case 'opponent-defense-response-pass':
                    s = exec(s, 'RESPONSE_PASS', '0');
                    break;
                case 'interference-target':
                    // 真实选骰由浏览器验证；领域链只需承接同一 interaction 到确认步骤。
                    s = exec(s, TUTORIAL_COMMANDS.NEXT, '0', { reason: 'auto' });
                    break;
                case 'interference-confirm':
                    s = exec(s, 'REROLL_DIE', '0', { dieId: 0 });
                    s = exec(s, 'SYS_INTERACTION_CONFIRM', '0');
                    break;
                case 'dice-roll': case 'defense-roll':
                    s = exec(s, 'ROLL_DICE', '0');
                    break;
                case 'dice-lock':
                    s = exec(s, 'TOGGLE_DIE_LOCK', '0', { dieId: 0 });
                    expect(s.core.dice.find(die => die.id === 0)?.isKept).toBe(true);
                    break;
                case 'dice-reroll': {
                    const kept = s.core.dice.find(die => die.id === 0)!;
                    const rolls = s.core.rollCount;
                    s = exec(s, 'ROLL_DICE', '0');
                    expect(s.core.dice.find(die => die.id === 0)?.value).toBe(kept.value);
                    expect(s.core.rollCount).toBe(rolls + 1);
                    expect(s.core.dice.map(die => die.value).sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5]);
                    break;
                }
                case 'enlightenment-play': case 'double-play': case 'interference-play': case 'meditation-2': {
                    const cardId = ({ 'enlightenment-play': 'card-enlightenment', 'double-play': 'card-double', 'interference-play': 'card-give-hand', 'meditation-2': 'card-meditation-2' } as Record<string,string>)[step.id];
                    const cp = s.core.players['0'].resources[RESOURCE_IDS.CP];
                    s = exec(s, 'PLAY_CARD', '0', { cardId });
                    if (step.id === 'double-play') {
                        expect(cp).toBe(2);
                        expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(1);
                        expect(s.core.players['0'].hand.map(card => card.id)).toEqual(expect.arrayContaining(['card-meditation-2', 'card-inner-peace']));
                    }
                    if (step.id === 'meditation-2') {
                        expect(s.core.players['0'].abilityLevels?.meditation).toBe(2);
                        expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(cp - 2);
                    }
                    break;
                }
                case 'enlightenment-confirm':
                    expect(s.core.pendingBonusDiceSettlement).toBeDefined();
                    s = exec(s, 'CONFIRM_ROLL', '0');
                    expect(s.core.players['0'].tokens).toMatchObject({ taiji: 2, evasive: 1, purify: 1 });
                    break;
                case 'dice-confirm': case 'defense-confirm':
                    s = exec(s, 'CONFIRM_ROLL', '0');
                    break;
                case 'abilities':
                    s = exec(s, 'SELECT_ABILITY', '0', { abilityId: 'harmony' });
                    break;
                case 'inner-peace-response':
                    expect(s.sys.responseWindow.current).toBeDefined();
                    s = exec(s, 'RESPONSE_PASS', '0');
                    break;
                case 'token-response-use': {
                    const pending = s.core.pendingDamage!;
                    expect(pending.responderId).toBe('0');
                    const chi = s.core.players['0'].tokens[TOKEN_IDS.TAIJI];
                    const hp = s.core.players['0'].resources[RESOURCE_IDS.HP];
                    s = exec(s, useChi ? 'USE_TOKEN' : 'SKIP_TOKEN_RESPONSE', '0', {
                        pendingDamageId: pending.id, ...(useChi ? { tokenId: useChi === 'evasive' ? TOKEN_IDS.EVASIVE : TOKEN_IDS.TAIJI, amount: 1 } : {}),
                    });
                    if (useChi === 'evasive') {
                        expect(s.core.currentRollContext?.kind).toBe('evasion');
                        expect(s.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(hp);
                    } else if (useChi) {
                        expect(s.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(chi - 1);
                        expect(s.core.pendingDamage?.currentDamage).toBe(pending.currentDamage - 1);
                        expect(s.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(hp);
                    } else {
                        expect(s.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(chi);
                        expect(s.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(hp - pending.currentDamage);
                    }
                    break;
                }
                case 'evasive-use':
                    s = exec(s, 'USE_TOKEN', '0', { pendingDamageId: s.core.pendingDamage!.id, tokenId: TOKEN_IDS.EVASIVE, amount: 1 });
                    expect(s.core.currentRollContext?.kind).toBe('evasion');
                    break;
                case 'evasive-confirm':
                    s = exec(s, 'SKIP_TOKEN_RESPONSE', '0', { pendingDamageId: s.core.pendingDamage!.id });
                    expect(s.core.pendingDamage).toBeUndefined();
                    break;
                case 'attack-token-pass': case 'token-response-pass': {
                    const pending = s.core.pendingDamage!;
                    const hp = s.core.players['0'].resources[RESOURCE_IDS.HP];
                    s = exec(s, 'SKIP_TOKEN_RESPONSE', '0', { pendingDamageId: pending.id });
                    expect(s.core.pendingDamage).toBeUndefined();
                    if (step.id === 'token-response-pass') expect(s.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(hp - pending.currentDamage);
                    break;
                }
                case 'purify-use':
                    s = exec(s, 'USE_PURIFY', '0', { statusId: 'knockdown' });
                    expect(s.core.players['0'].statusEffects.knockdown ?? 0).toBe(0);
                    expect(s.core.players['0'].tokens.purify).toBe(0);
                    break;
                default: throw Error('未覆盖正式动作: ' + step.id);
            }
        }
        const interaction = getCurrentInteractionSummary(s);
        throw Error(`教程未完成: step=${s.sys.tutorial.step?.id ?? 'none'} phase=${s.sys.phase} interaction=${interaction.kind ?? 'none'} visited=${Array.from(visited).join(',')}`);
    };

    it.each([true, false, 'evasive'] as const)('亲手防御、响应分支 %s、结算后保留费用并升级', (useChi) => {
        const { state, visited } = walk(useChi);
        for (const id of ['sell-card-intro', 'enlightenment-play', 'enlightenment-confirm', 'double-play', 'dice-lock', 'dice-reroll', 'defense-roll', 'defense-confirm', 'defense-resolve', 'opponent-defense-resolve', 'token-response-use', 'income-result', 'purify-use', 'meditation-2']) expect(visited.has(id), id).toBe(true);
        expect(state.core.activePlayerId).toBe('0');
        expect(state.sys.phase).toBe('main1');
        const finished = nextStep(state, 'finish');
        expect(finished.sys.tutorial.active).toBe(false);
    });

    it('回退净化恢复击倒与标记，重新执行后仍能继续', () => {
        let { state } = walk(true, 'purify-use');
        state = exec(state, 'USE_PURIFY', '0', { statusId: 'knockdown' });
        expect(state.sys.tutorial.step?.id).toBe('purify-result');
        state = exec(state, TUTORIAL_COMMANDS.PREVIOUS, '0');
        expect(state.sys.tutorial.step?.id).toBe('purify-use');
        expect(state.sys.phase).toBe('main1');
        expect(state.core.players['0'].statusEffects.knockdown).toBe(1);
        expect(state.core.players['0'].tokens.purify).toBe(1);
    });

    it('其它手牌可合法出售，亲手撤回后恢复完整局面继续预算决策', () => {
        let { state } = walk(true, 'sell-card-intro');
        const original = state.core;
        state = exec(state, 'SELL_CARD', '0', { cardId: 'card-meditation-2' });
        expect(state.sys.tutorial.step?.id).toBe('sell-card-intro');
        expect(state.core.players['0'].resources.cp).toBe(2);
        state = exec(state, 'UNDO_SELL_CARD', '0');
        expect(state.core.players['0'].hand.map(card => card.id)).toContain('card-meditation-2');
        expect(state.core.players['0'].resources.cp).toBe(1);
        expect(state.sys.tutorial.step?.id).toBe('sell-card-intro');
        expect(state.core.players['0'].hand.map(card => card.id).sort()).toEqual(original.players['0'].hand.map(card => card.id).sort());
        state = exec(state, 'SELL_CARD', '0', { cardId: 'card-palm-strike' });
        expect(state.sys.tutorial.step?.id).toBe('discard-rule');
    });

    it('连续出售造成前提缺失时恢复出售前完整检查点', () => {
        let { state } = walk(true, 'sell-card-intro');
        const original = state.core;
        state = exec(state, 'SELL_CARD', '0', { cardId: 'card-meditation-2' });
        state = exec(state, 'SELL_CARD', '0', { cardId: 'card-palm-strike' });
        expect(state.sys.tutorial.step?.id).toBe('sale-branch-recovery');
        const { command } = buildLocalDispatchCommand({ state, commandType: TUTORIAL_COMMANDS.PREVIOUS, payload: { __tutorialAiCommand: true, __tutorialPlayerId: '0' }, localPregameControlledPlayerId: null });
        const recovery = executePipeline(pipelineConfig, state, command as DiceThroneCommand, random, playerIds);
        expect(recovery.success).toBe(true);
        state = recovery.state as MatchState<DiceThroneCore>;
        expect(state.sys.tutorial.step?.id).toBe('sell-card-intro');
        expect(state.core).toEqual(original);
    });

    it('首次防御和响应不能被 AI 代操作或手动跳过', () => {
        for (const id of ['defense-roll', 'defense-confirm', 'defense-resolve', 'token-response-use']) {
            const step = manifest.steps.find(step => step.id === id)!;
            expect(step.aiActions).toBeUndefined();
            expect(step.allowManualSkip).toBe(false);
        }
        const { state } = walk(true, 'token-response-use');
        expect(tryExec(state, TUTORIAL_COMMANDS.NEXT, '0').success).toBe(false);
        expect(tryExec(state, 'ADVANCE_PHASE', '0').success).toBe(false);
    });

    it('可以合法不发动能力，恢复同一骰面后仍可亲手选择进攻', () => {
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
        state = exec(state, 'SELECT_ABILITY', '0', { abilityId: 'harmony' });
        expect(state.sys.tutorial.step?.id).toBe('attack-rule');
    });
});
