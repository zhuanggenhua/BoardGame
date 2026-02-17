/**
 * 教程端到端测试（含 TutorialSystem 活跃状态）
 *
 * 通过 SYS_TUTORIAL_START 启动教程，TutorialSystem 全程参与命令拦截和步骤推进。
 * 模拟客户端 TutorialContext 的行为：执行 AI 操作 → consumeAi → 手动推进。
 *
 * 教程流程：
 *   setup → intro系列 → 首次攻击 → 对手防御 → 卡牌介绍 → AI回合（掌击+攻击）
 *   → 击倒说明 → 悟道（获取净化）→ 净化移除击倒 → 静心 → 清修升级 → 结束
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

describe('教程端到端测试（TutorialSystem 活跃）', () => {
    const playerIds: PlayerId[] = ['0', '1'];
    const manifest = DiceThroneTutorial;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
        (globalThis as any).__BG_GAME_MODE__ = 'tutorial';
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
            const result = tryExec(s, action.commandType, pid as PlayerId, action.payload as Record<string, unknown>);
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

    const random = createQueuedRandom(manifest.randomPolicy!.values!);

    // TODO: 更新教程测试以适配新的交互系统 - 已完成
    // 旧系统使用 MODIFY_DIE + CONFIRM_INTERACTION，新系统使用 SYS_INTERACTION_RESPOND
    it('完整教程流程', () => {
        let s: MatchState<DiceThroneCore> = {
            core: DiceThroneDomain.setup(playerIds, random),
            sys: createInitialSystemState(playerIds, testSystems, undefined),
        };

        // 启动教程
        s = exec(s, TUTORIAL_COMMANDS.START, '0', { manifest }, 'tutorial start');
        expect(s.sys.tutorial.active).toBe(true);
        expect(s.sys.tutorial.step?.id).toBe('setup');

        // ============================================================
        // 段 A — 初始化 + UI 介绍
        // ============================================================
        const setupStep = manifest.steps[0];
        s = consumeAiActions(s, 'setup', setupStep.aiActions!, 'A: setup');
        expect(s.sys.phase).toBe('main1');
        expect(s.core.activePlayerId).toBe('0');

        // 介绍步骤：手动跳过
        const introSteps = ['intro', 'stats', 'phases', 'player-board', 'tip-board', 'hand', 'discard', 'status-tokens'];
        for (const expectedId of introSteps) {
            expect(s.sys.tutorial.step?.id).toBe(expectedId);
            s = nextStep(s, `A: skip ${expectedId}`);
        }
        expect(s.sys.tutorial.step?.id).toBe('advance');

        // ============================================================
        // 段 B — 首次攻击 (Turn 1, P0)
        // ============================================================
        // 验证初始 CP（首回合先手跳过 income，CP = INITIAL_CP）
        const cpBefore = s.core.players['0'].resources[RESOURCE_IDS.CP] ?? 0;
        expect(cpBefore).toBe(INITIAL_CP);

        s = exec(s, 'ADVANCE_PHASE', '0', {}, 'B: main1→offensive');
        expect(s.sys.phase).toBe('offensiveRoll');
        expect(s.sys.tutorial.step?.id).toBe('dice-tray');

        s = nextStep(s, 'B: skip dice-tray');
        expect(s.sys.tutorial.step?.id).toBe('dice-roll');

        s = exec(s, 'ROLL_DICE', '0', {}, 'B: roll');
        expect(s.sys.tutorial.step?.id).toBe('play-six');

        s = exec(s, 'PLAY_CARD', '0', { cardId: 'card-play-six' }, 'B: play-six');
        // card-play-six cpCost=1 → CP 应从 INITIAL_CP 减到 INITIAL_CP-1
        expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(INITIAL_CP - 1);
        
        // 新交互系统：card-play-six 创建 simple-choice 交互（选择骰子值）
        const sysCurrentInteraction = s.sys.interaction.current;
        expect(sysCurrentInteraction).toBeDefined();
        expect(sysCurrentInteraction?.kind).toBe('simple-choice');
        
        // 使用 SYS_INTERACTION_RESPOND 响应交互
        // card-play-six 允许将1颗骰子改为6，只有一个选项（值=6）
        s = exec(s, 'SYS_INTERACTION_RESPOND', '0', { optionId: 'option-0' }, 'B: modify-die-to-6');
        expect(s.sys.tutorial.step?.id).toBe('dice-confirm');

        s = exec(s, 'CONFIRM_ROLL', '0', {}, 'B: confirm');
        expect(s.sys.tutorial.step?.id).toBe('abilities');

        s = exec(s, 'SELECT_ABILITY', '0', { abilityId: 'fist-technique-4' }, 'B: select-ability');
        expect(s.sys.tutorial.step?.id).toBe('resolve-attack');

        s = exec(s, 'ADVANCE_PHASE', '0', {}, 'B: offensive→defensive');
        expect(s.sys.phase).toBe('defensiveRoll');
        expect(s.sys.tutorial.step?.id).toBe('opponent-defense');

        // opponent-defense: AI 防御掷骰
        const opponentDefenseStep = s.sys.tutorial.step!;
        s = consumeAiActions(s, 'opponent-defense', opponentDefenseStep.aiActions!, 'B: opponent-defense');
        expect(s.sys.phase).toBe('main2');
        expect(s.sys.tutorial.step?.id).toBe('card-enlightenment');

        // ============================================================
        // 段 C — 卡牌介绍 + AI 回合
        // ============================================================
        s = nextStep(s, 'C: skip card-enlightenment');
        expect(s.sys.tutorial.step?.id).toBe('ai-turn');

        // AI 完整回合：结束P0回合 → AI打掌击+攻击 → AI结束 → P0 main1
        const aiTurnStep = s.sys.tutorial.step!;
        s = consumeAiActions(s, 'ai-turn', aiTurnStep.aiActions!, 'C: ai-turn');
        expect(s.sys.phase).toBe('main1');
        expect(s.core.activePlayerId).toBe('0');
        expect(s.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN]).toBe(1);
        expect(s.sys.tutorial.step?.id).toBe('knockdown-explain');

        // ============================================================
        // 段 D — 净化教程（自然游戏流）
        // ============================================================
        s = nextStep(s, 'D: skip knockdown-explain');
        expect(s.sys.tutorial.step?.id).toBe('enlightenment-play');

        // 玩家打出悟道（random=6 → 莲花 → 获得太极+闪避+净化）
        s = exec(s, 'PLAY_CARD', '0', { cardId: 'card-enlightenment' }, 'D: play-enlightenment');
        expect(s.core.players['0'].tokens[TOKEN_IDS.PURIFY]).toBeGreaterThanOrEqual(1);
        expect(s.sys.tutorial.step?.id).toBe('purify-use');

        // 玩家使用净化移除击倒
        s = exec(s, 'USE_PURIFY', '0', { statusId: STATUS_IDS.KNOCKDOWN }, 'D: use-purify');
        expect(s.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0).toBe(0);
        expect(s.core.players['0'].tokens[TOKEN_IDS.PURIFY]).toBe(0);

        // ============================================================
        // 段 E — 补充卡牌教学
        // ============================================================
        expect(s.sys.tutorial.step?.id).toBe('inner-peace');

        s = exec(s, 'PLAY_CARD', '0', { cardId: 'card-inner-peace' }, 'E: play-inner-peace');
        expect(s.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBeGreaterThanOrEqual(2);
        expect(s.sys.tutorial.step?.id).toBe('meditation-2');

        // 验证段 D/E 开始时 CP（经过 income 阶段应有 CP 恢复）
        const cpBeforeMeditation = s.core.players['0'].resources[RESOURCE_IDS.CP] ?? 0;

        s = exec(s, 'PLAY_CARD', '0', { cardId: 'card-meditation-2' }, 'E: play-meditation-2');
        // card-meditation-2 cpCost=2 → CP 应减少 2
        expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(cpBeforeMeditation - 2);
        expect(s.core.players['0'].abilityLevels?.['meditation']).toBe(2);
        expect(s.sys.tutorial.step?.id).toBe('finish');

        // 教程完成
        s = nextStep(s, 'E: finish');
        expect(s.sys.tutorial.active).toBe(false);
    });
});
