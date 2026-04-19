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

    /**
     * 公共流程：从初始状态走到 AI 回合完成
     * 返回状态处于 knockdown-explain 步骤
     *
     * 流程：setup → intro系列 → 弃牌(sell deep-thought) → 撤回弃牌(undo)
     *       → 首次攻击 → 对手防御 → main2介绍 → 顿悟(main2) → 静心(main2)
     *       → AI回合介绍 → AI回合（掌击+攻击）→ knockdown-explain
     */
    const runToKnockdownExplain = (): MatchState<DiceThroneCore> => {
        let s: MatchState<DiceThroneCore> = {
            core: DiceThroneDomain.setup(playerIds, random),
            sys: createInitialSystemState(playerIds, testSystems, undefined),
        };

        // 启动教程
        s = exec(s, TUTORIAL_COMMANDS.START, '0', { manifest }, 'tutorial start');
        expect(s.sys.tutorial.active).toBe(true);
        expect(s.sys.tutorial.step?.id).toBe('setup');

        // 段 A：setup + 介绍步骤
        const setupStep = manifest.steps[0];
        s = consumeAiActions(s, 'setup', setupStep.aiActions!, 'A: setup');
        expect(s.sys.phase).toBe('main1');
        expect(s.core.activePlayerId).toBe('0');

        const introSteps = ['intro', 'stats', 'phases', 'player-board', 'tip-board', 'hand', 'discard', 'status-tokens'];
        for (const id of introSteps) {
            expect(s.sys.tutorial.step?.id).toBe(id);
            s = nextStep(s, `A: skip ${id}`);
        }

        // 弃牌+撤回教学：卖掉 deep-thought → 撤回，教会玩家弃牌和撤回操作
        expect(s.sys.tutorial.step?.id).toBe('sell-card-intro');
        expect(s.sys.tutorial.step?.allowedCommands).toContain('SELL_CARD');
        const handBeforeSell = s.core.players['0'].hand;
        expect(handBeforeSell.length).toBe(4);
        const cpBeforeSell = s.core.players['0'].resources[RESOURCE_IDS.CP] ?? 0;
        expect(cpBeforeSell).toBe(INITIAL_CP);
        s = exec(s, 'SELL_CARD', '0', { cardId: 'card-deep-thought' }, 'A: sell-deep-thought');
        expect(s.core.players['0'].hand.length).toBe(3);
        expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(INITIAL_CP + 1);

        // 撤回弃牌教学
        expect(s.sys.tutorial.step?.id).toBe('undo-sell-intro');
        s = nextStep(s, 'A: skip undo-sell-intro');

        expect(s.sys.tutorial.step?.id).toBe('undo-sell');
        s = exec(s, 'UNDO_SELL_CARD', '0', {}, 'A: undo-sell');
        expect(s.core.players['0'].hand.length).toBe(4);
        expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(INITIAL_CP);

        // 段 B：首次攻击（CP = INITIAL_CP = 2，未卖牌）
        expect(s.sys.tutorial.step?.id).toBe('advance');
        s = exec(s, 'ADVANCE_PHASE', '0', {}, 'B: main1→offensive');
        expect(s.sys.phase).toBe('offensiveRoll');
        expect(s.sys.tutorial.step?.id).toBe('dice-tray');

        s = nextStep(s, 'B: skip dice-tray');
        expect(s.sys.tutorial.step?.id).toBe('dice-roll');

        s = exec(s, 'ROLL_DICE', '0', {}, 'B: roll');
        expect(s.sys.tutorial.step?.id).toBe('play-six');

        // play-six 花费 1 CP（CP: 2→1）
        s = exec(s, 'PLAY_CARD', '0', { cardId: 'card-play-six' }, 'B: play-six');
        expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(INITIAL_CP - 1);
        expect(s.sys.interaction.current).toBeDefined();
        expect(s.sys.interaction.current?.kind).toBe('multistep-choice');

        s = exec(s, 'MODIFY_DIE', '0', { dieId: 0, newValue: 6 }, 'B: modify-die-to-6');
        expect(s.sys.tutorial.step?.id).toBe('dice-confirm');

        s = exec(s, 'CONFIRM_ROLL', '0', {}, 'B: confirm');
        expect(s.sys.tutorial.step?.id).toBe('abilities');

        s = exec(s, 'SELECT_ABILITY', '0', { abilityId: 'fist-technique-4' }, 'B: select-ability');
        expect(s.sys.tutorial.step?.id).toBe('resolve-attack');

        s = exec(s, 'ADVANCE_PHASE', '0', {}, 'B: offensive→defensive');
        expect(s.sys.phase).toBe('defensiveRoll');
        expect(s.sys.tutorial.step?.id).toBe('opponent-defense');

        // opponent-defense: AI 防御掷骰 → 进入 main2
        const opponentDefenseStep = s.sys.tutorial.step!;
        s = consumeAiActions(s, 'opponent-defense', opponentDefenseStep.aiActions!, 'B: opponent-defense');
        expect(s.sys.phase).toBe('main2');

        // 段 C：main2 阶段打出顿悟和静心
        expect(s.sys.tutorial.step?.id).toBe('main2-intro');
        s = nextStep(s, 'C: skip main2-intro');

        expect(s.sys.tutorial.step?.id).toBe('enlightenment-play');
        s = exec(s, 'PLAY_CARD', '0', { cardId: 'card-enlightenment' }, 'C: play-enlightenment');
        expect(s.core.players['0'].tokens[TOKEN_IDS.PURIFY]).toBeGreaterThanOrEqual(1);
        expect(s.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBeGreaterThanOrEqual(2);

        expect(s.sys.tutorial.step?.id).toBe('inner-peace');
        s = exec(s, 'PLAY_CARD', '0', { cardId: 'card-inner-peace' }, 'C: play-inner-peace');
        expect(s.core.players['0'].tokens[TOKEN_IDS.TAIJI]).toBeGreaterThanOrEqual(4);

        // 段 D：AI 回合
        expect(s.sys.tutorial.step?.id).toBe('ai-turn-intro');
        s = nextStep(s, 'D: skip ai-turn-intro');
        expect(s.sys.tutorial.step?.id).toBe('ai-turn');

        const aiTurnStep = s.sys.tutorial.step!;
        s = consumeAiActions(s, 'ai-turn', aiTurnStep.aiActions!, 'D: ai-turn');
        expect(s.sys.phase).toBe('main1');
        expect(s.core.activePlayerId).toBe('0');
        expect(s.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN]).toBe(1);

        expect(s.sys.tutorial.step?.id).toBe('knockdown-explain');
        return s;
    };

    it('完整教程流程', () => {
        let s = runToKnockdownExplain();

        // 段 E — 净化 + 升级（Turn 2 P0 main1，手牌: meditation-2）
        // 顿悟和静心已在 main2 打出，净化标记已获得
        s = nextStep(s, 'E: skip knockdown-explain');
        expect(s.sys.tutorial.step?.id).toBe('purify-use');

        s = exec(s, 'USE_PURIFY', '0', { statusId: STATUS_IDS.KNOCKDOWN }, 'E: use-purify');
        expect(s.core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0).toBe(0);
        expect(s.core.players['0'].tokens[TOKEN_IDS.PURIFY]).toBe(0);

        expect(s.sys.tutorial.step?.id).toBe('meditation-2');

        const cpBeforeMeditation = s.core.players['0'].resources[RESOURCE_IDS.CP] ?? 0;
        expect(cpBeforeMeditation).toBeGreaterThanOrEqual(2);

        s = exec(s, 'PLAY_CARD', '0', { cardId: 'card-meditation-2' }, 'E: play-meditation-2');
        expect(s.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(cpBeforeMeditation - 2);
        expect(s.core.players['0'].abilityLevels?.['meditation']).toBe(2);
        expect(s.sys.tutorial.step?.id).toBe('finish');

        s = nextStep(s, 'E: finish');
        expect(s.sys.tutorial.active).toBe(false);
    });

    it('CP 不足时无法打出 meditation-2（防止教程卡主）', () => {
        let s = runToKnockdownExplain();

        s = nextStep(s, 'skip knockdown-explain');
        s = exec(s, 'USE_PURIFY', '0', { statusId: STATUS_IDS.KNOCKDOWN }, 'use-purify');

        expect(s.sys.tutorial.step?.id).toBe('meditation-2');
        const cpBeforeMeditation2 = s.core.players['0'].resources[RESOURCE_IDS.CP] ?? 0;
        expect(cpBeforeMeditation2).toBeGreaterThanOrEqual(2);

        const result = tryExec(s, 'PLAY_CARD', '0', { cardId: 'card-meditation-2' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.state.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(cpBeforeMeditation2 - 2);
        }
    });

    it('meditation-2 步骤白名单约束下 CP 不足时必须能通过卖牌自救', () => {
        let s = runToKnockdownExplain();

        s = nextStep(s, 'skip knockdown-explain');
        s = exec(s, 'USE_PURIFY', '0', { statusId: STATUS_IDS.KNOCKDOWN }, 'use-purify');

        // 注入额外手牌 + 强制 CP=1，模拟 CP 不足但有牌可卖的场景
        const dummyCard = { ...s.core.players['0'].hand[0], id: 'card-dummy-for-sell' };
        s = {
            ...s,
            core: {
                ...s.core,
                players: {
                    ...s.core.players,
                    '0': {
                        ...s.core.players['0'],
                        hand: [...s.core.players['0'].hand, dummyCard],
                        resources: { ...s.core.players['0'].resources, [RESOURCE_IDS.CP]: 1 },
                    },
                },
            },
        };

        expect(s.sys.tutorial.step?.id).toBe('meditation-2');
        expect(s.sys.tutorial.step?.allowedCommands).toContain('SELL_CARD');
        expect(s.sys.tutorial.step?.allowedCommands).toContain('PLAY_CARD');

        // CP=1 时 meditation-2（cost=2）应失败
        const failResult = tryExec(s, 'PLAY_CARD', '0', { cardId: 'card-meditation-2' });
        expect(failResult.success).toBe(false);

        // 卖牌获得 1 CP（CP: 1→2）
        const sellResult = tryExec(s, 'SELL_CARD', '0', { cardId: 'card-dummy-for-sell' });
        expect(sellResult.success).toBe(true);
        if (sellResult.success) {
            const cpAfterSell = sellResult.state.core.players['0'].resources[RESOURCE_IDS.CP] ?? 0;
            expect(cpAfterSell).toBe(2);

            const playResult = tryExec(sellResult.state, 'PLAY_CARD', '0', { cardId: 'card-meditation-2' });
            expect(playResult.success).toBe(true);
        }
    });
});
