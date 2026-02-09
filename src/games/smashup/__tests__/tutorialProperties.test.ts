/**
 * 大杀四方教学 — 属性测试
 *
 * 使用 fast-check 验证教学 manifest 的正确性属性。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import SMASH_UP_TUTORIAL from '../tutorial';
import { smashUpCheatModifier } from '../cheatModifier';
import { FLOW_COMMANDS } from '../../../engine/systems/FlowSystem';
import type { SmashUpCore, CardInstance } from '../domain/types';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { resetUidCounter, arbMinimalGameState } from './properties/arbitraries';

// ============================================================================
// Property 1: UI 介绍步骤阻止阶段推进
// ============================================================================

describe('Property 1: UI introduction steps block phase advancement', () => {
    /**
     * **Validates: Requirements 2.6**
     *
     * 对于所有 requireAction: false 且非 setup/finish 的步骤，
     * blockedCommands 必须包含 ADVANCE_PHASE。
     */
    it('所有 UI 介绍步骤的 blockedCommands 包含 ADVANCE_PHASE', () => {
        // 筛选出 UI 介绍步骤：requireAction=false 且非 setup/finish/scoringPhase(有 aiActions)
        const uiSteps = SMASH_UP_TUTORIAL.steps.filter(s =>
            s.requireAction === false &&
            s.id !== 'setup' &&
            s.id !== 'finish' &&
            s.id !== 'summary' &&
            s.id !== 'talentIntro' &&
            s.id !== 'turnCycle' &&
            !s.aiActions // 有 aiActions 的步骤（如 scoringPhase/opponentTurn）不需要 blockedCommands
        );

        // 确保至少有一些 UI 介绍步骤
        expect(uiSteps.length).toBeGreaterThan(0);

        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: uiSteps.length - 1 }),
                (idx) => {
                    const step = uiSteps[idx];
                    expect(step.blockedCommands).toBeDefined();
                    expect(step.blockedCommands).toContain(FLOW_COMMANDS.ADVANCE_PHASE);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================================================
// Property 2: Cheat dealCardByIndex 保持牌库完整性
// ============================================================================

describe('Property 2: Cheat dealCardByIndex preserves deck integrity', () => {
    beforeEach(() => resetUidCounter());

    /**
     * **Validates: Requirements 10.3**
     *
     * 对于任意有效的 SmashUpCore 状态和有效 deck index，
     * dealCardByIndex 后 deck.length 减 1、hand.length 加 1，
     * 且移动的卡牌正确。
     */
    it('dealCardByIndex 正确移动卡牌且保持总数不变', () => {
        fc.assert(
            fc.property(
                arbMinimalGameState(),
                fc.constantFrom('0', '1'),
                (core, playerId) => {
                    const player = core.players[playerId];
                    if (!player || player.deck.length === 0) return; // 跳过空牌库

                    const deckIndex = Math.floor(Math.random() * player.deck.length);
                    const expectedCard = player.deck[deckIndex];
                    const origDeckLen = player.deck.length;
                    const origHandLen = player.hand.length;

                    const next = smashUpCheatModifier.dealCardByIndex(core, playerId, deckIndex);
                    const nextPlayer = next.players[playerId];

                    // 牌库减少 1
                    expect(nextPlayer.deck.length).toBe(origDeckLen - 1);
                    // 手牌增加 1
                    expect(nextPlayer.hand.length).toBe(origHandLen + 1);
                    // 移动的卡牌在手牌末尾
                    expect(nextPlayer.hand[nextPlayer.hand.length - 1].uid).toBe(expectedCard.uid);
                    // 牌库中不再包含该卡
                    expect(nextPlayer.deck.find(c => c.uid === expectedCard.uid)).toBeUndefined();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('无效索引返回原状态', () => {
        fc.assert(
            fc.property(
                arbMinimalGameState(),
                fc.constantFrom('0', '1'),
                fc.constantFrom(-1, -100, 999),
                (core, playerId, badIndex) => {
                    const result = smashUpCheatModifier.dealCardByIndex(core, playerId, badIndex);
                    expect(result).toBe(core);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================================================
// Property 3: 教学 i18n 完整性
// ============================================================================

describe('Property 3: Tutorial i18n completeness', () => {
    // 加载 locale 文件
    const zhCN = JSON.parse(
        readFileSync(resolve(__dirname, '../../../../public/locales/zh-CN/game-smashup.json'), 'utf-8')
    );
    const en = JSON.parse(
        readFileSync(resolve(__dirname, '../../../../public/locales/en/game-smashup.json'), 'utf-8')
    );

    /**
     * **Validates: Requirements 11.1, 11.2**
     *
     * 所有教学步骤的 content 字段匹配 i18n key 模式，
     * 且在 zh-CN 和 en locale 文件中都存在对应翻译。
     */
    it('所有步骤的 content key 在两个 locale 中都有翻译', () => {
        const steps = SMASH_UP_TUTORIAL.steps;

        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: steps.length - 1 }),
                (idx) => {
                    const step = steps[idx];
                    // content 格式：game-smashup:tutorial.steps.<key>
                    expect(step.content).toMatch(/^game-smashup:tutorial\.steps\.\w+$/);

                    // 提取 key 路径：tutorial.steps.<key>
                    const keyPath = step.content.replace('game-smashup:', '');
                    const parts = keyPath.split('.');

                    // 在 locale 对象中查找
                    let zhVal: unknown = zhCN;
                    let enVal: unknown = en;
                    for (const part of parts) {
                        zhVal = (zhVal as Record<string, unknown>)?.[part];
                        enVal = (enVal as Record<string, unknown>)?.[part];
                    }

                    expect(zhVal, `zh-CN 缺少 key: ${step.content}`).toBeDefined();
                    expect(typeof zhVal, `zh-CN key ${step.content} 不是字符串`).toBe('string');
                    expect(enVal, `en 缺少 key: ${step.content}`).toBeDefined();
                    expect(typeof enVal, `en key ${step.content} 不是字符串`).toBe('string');
                }
            ),
            { numRuns: 100 }
        );
    });
});
