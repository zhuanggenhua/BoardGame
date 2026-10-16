/**
 * 教程端到端测试（含 TutorialSystem 活跃状态）
 *
 * 通过 SYS_TUTORIAL_START 启动教程，TutorialSystem 全程参与命令拦截和步骤推进。
 * 模拟客户端 TutorialContext 的行为：执行 AI 操作 → consumeAi → 手动推进。
 *
 * 教程流程（与 tutorial.ts 步骤顺序一致）：
 *   setup → intro系列 → 弃牌教学 → 首次攻击 → 对手防御
 *   → main2阶段（顿悟+静心）→ AI回合（掌击+攻击）
 *   → 击倒说明 → 净化移除击倒 → 清修升级 → 结束
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DiceThroneDomain } from '../domain';
import { testSystems, createQueuedRandom } from './test-utils';
import { executePipeline, createInitialSystemState } from '../../../engine/pipeline';
import type { DiceThroneCore, DiceThroneCommand } from '../domain/types';
import type { MatchState, PlayerId, TutorialAiAction } from '../../../engine/types';
import { TOKEN_IDS, STATUS_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { INITIAL_CP } from '../domain/types';
import { DiceThroneTutorial } from '../tutorial';
import { TUTORIAL_COMMANDS } from '../../../engine/systems/TutorialSystem';
import { injectTutorialInteractionId } from '../../../engine/transport/tutorialAiCommand';

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
            const desc = label ? ` [${label}]` : '';
            throw new Error(
                `Command ${type} (p${playerId})${desc} failed: ${result.error}\n` +
                `  phase=${state.sys.phase} active=${state.core.activePlayerId}\n` +
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
                expect(s.core.pendingDamage?.id, `${label}: AI action[${i}] should have live pendingDamage`).toBeTypeOf('string');
                expect(payload).toMatchObject({ pendingDamageId: s.core.pendingDamage?.id });
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
    const walk = (useChi: boolean, stopAt = 'finish') => {
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
                case 'sell-card-intro': {
                    s = exec(s, 'SELL_CARD', '0', { cardId: 'card-deep-thought' });
                    expect(s.core.players['0'].hand).toHaveLength(3);
                    expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(3);
                    break;
                }
                case 'undo-sell':
                    s = exec(s, 'UNDO_SELL_CARD', '0');
                    expect(s.core.players['0'].hand).toHaveLength(4);
                    expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(2);
                    break;
                case 'advance': case 'resolve-attack': case 'end-turn': case 'discard-finish': case 'defense-resolve':
                    s = exec(s, 'ADVANCE_PHASE', '0');
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
                    break;
                }
                case 'play-six': case 'enlightenment-play': case 'inner-peace': case 'meditation-2': {
                    const cardId = ({ 'play-six': 'card-play-six', 'enlightenment-play': 'card-enlightenment', 'inner-peace': 'card-inner-peace', 'meditation-2': 'card-meditation-2' } as Record<string,string>)[step.id];
                    const cp = s.core.players['0'].resources[RESOURCE_IDS.CP];
                    s = exec(s, 'PLAY_CARD', '0', { cardId });
                    if (step.id === 'meditation-2') {
                        expect(s.core.players['0'].abilityLevels?.meditation).toBe(2);
                        expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(cp - 2);
                    }
                    break;
                }
                case 'play-six-modify':
                    s = exec(s, 'MODIFY_DIE', '0', { dieId: 0, newValue: 6 });
                    s = exec(s, 'SYS_INTERACTION_CONFIRM', '0');
                    break;
                case 'dice-confirm': case 'defense-confirm': case 'enlightenment-confirm':
                    s = exec(s, 'CONFIRM_ROLL', '0');
                    break;
                case 'abilities':
                    s = exec(s, 'SELECT_ABILITY', '0', { abilityId: 'fist-technique-4' });
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
                        pendingDamageId: pending.id, ...(useChi ? { tokenId: TOKEN_IDS.TAIJI, amount: 1 } : {}),
                    });
                    if (useChi) {
                        expect(s.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(chi - 1);
                        expect(s.core.pendingDamage?.currentDamage).toBe(pending.currentDamage - 1);
                        expect(s.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(hp);
                    } else {
                        expect(s.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBe(chi);
                        expect(s.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(hp - pending.currentDamage);
                    }
                    break;
                }
                case 'token-response-pass': {
                    const pending = s.core.pendingDamage!;
                    const hp = s.core.players['0'].resources[RESOURCE_IDS.HP];
                    s = exec(s, 'SKIP_TOKEN_RESPONSE', '0', { pendingDamageId: pending.id });
                    expect(s.core.pendingDamage).toBeUndefined();
                    expect(s.core.players['0'].resources[RESOURCE_IDS.HP]).toBe(hp - pending.currentDamage);
                    break;
                }
                case 'purify-use':
                    s = exec(s, 'USE_PURIFY', '0', { statusId: STATUS_IDS.KNOCKDOWN });
                    expect(s.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0).toBe(0);
                    expect(s.core.players['0'].tokens[TOKEN_IDS.PURIFY]).toBe(0);
                    break;
                default: throw Error('未覆盖正式动作: ' + step.id);
            }
        }
        throw Error('教程未完成');
    };

    it.each([true, false])('亲手防御、%s 使用太极、结算后继续收入净化升级', (useChi) => {
        const { state, visited } = walk(useChi);
        for (const id of ['dice-lock', 'dice-reroll', 'defense-roll', 'defense-confirm', 'defense-resolve', 'token-response-use', 'damage-result', 'income-result', 'purify-use', 'meditation-2']) expect(visited.has(id), id).toBe(true);
        expect(state.core.activePlayerId).toBe('0');
        expect(state.sys.phase).toBe('main1');
        const finished = nextStep(state, 'finish');
        expect(finished.sys.tutorial.active).toBe(false);
    });

    it('回退净化同时恢复状态与标记，重新执行后仍能继续', () => {
        let { state } = walk(true, 'purify-use');
        state = exec(state, 'USE_PURIFY', '0', { statusId: STATUS_IDS.KNOCKDOWN });
        expect(state.sys.tutorial.step?.id).toBe('purify-result');
        state = exec(state, TUTORIAL_COMMANDS.PREVIOUS, '0');
        expect(state.sys.tutorial.step?.id).toBe('purify-use');
        expect(state.core.players['0'].tokens[TOKEN_IDS.PURIFY]).toBe(1);
        expect(state.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN]).toBe(1);
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
});
