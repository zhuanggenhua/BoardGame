/**
 * 召唤师战争教学 — 属性测试
 *
 * 验证教学 manifest 的正确性属性。
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import SUMMONER_WARS_TUTORIAL from '../tutorial';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// Property 1: UI 介绍步骤使用 infoStep 阻止所有命令
// ============================================================================

describe('Property 1: UI introduction steps use infoStep to block all commands', () => {
    /**
     * 对于所有 requireAction: false 且非 setup/finish 的步骤，
     * 必须设置 infoStep: true 来阻止所有游戏命令。
     */
    it('所有 UI 介绍步骤设置了 infoStep: true', () => {
        // 筛选出 UI 介绍步骤：requireAction=false 且非 setup/finish
        const uiSteps = SUMMONER_WARS_TUTORIAL.steps.filter(s =>
            !s.requireAction &&
            s.id !== 'setup' &&
            s.id !== 'finish' &&
            s.id !== 'victory-condition' &&
            s.id !== 'inaction-penalty' &&
            !s.aiActions // 有 aiActions 的步骤（如 opponentTurn）不能设 infoStep
        );

        // 确保至少有一些 UI 介绍步骤
        expect(uiSteps.length).toBeGreaterThan(0);

        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: uiSteps.length - 1 }),
                (idx) => {
                    const step = uiSteps[idx];
                    expect(step.infoStep).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ============================================================================
// Property 2: 操作步骤必须有 allowedCommands
// ============================================================================

describe('Property 2: Action steps must have allowedCommands', () => {
    it('所有 requireAction: true 的步骤设置了 allowedCommands', () => {
        const actionSteps = SUMMONER_WARS_TUTORIAL.steps.filter(s => s.requireAction);

        expect(actionSteps.length).toBeGreaterThan(0);

        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: actionSteps.length - 1 }),
                (idx) => {
                    const step = actionSteps[idx];
                    expect(step.allowedCommands).toBeDefined();
                    expect(Array.isArray(step.allowedCommands)).toBe(true);
                    expect(step.allowedCommands!.length).toBeGreaterThan(0);
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
        readFileSync(resolve(__dirname, '../../../../public/locales/zh-CN/game-summonerwars.json'), 'utf-8')
    );
    const en = JSON.parse(
        readFileSync(resolve(__dirname, '../../../../public/locales/en/game-summonerwars.json'), 'utf-8')
    );

    /**
     * 所有教学步骤的 content 字段匹配 i18n key 模式，
     * 且在 zh-CN 和 en locale 文件中都存在对应翻译。
     */
    it('所有步骤的 content key 在两个 locale 中都有翻译', () => {
        const steps = SUMMONER_WARS_TUTORIAL.steps;

        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: steps.length - 1 }),
                (idx) => {
                    const step = steps[idx];
                    // content 格式：game-summonerwars:tutorial.steps.<key>
                    expect(step.content).toMatch(/^game-summonerwars:tutorial\.steps\.\w+$/);

                    // 提取 key 路径：tutorial.steps.<key>
                    const keyPath = step.content.replace('game-summonerwars:', '');
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

// ============================================================================
// Property 4: highlightTarget 引用的 ID 必须在源码中存在
// ============================================================================

describe('Property 4: highlightTarget references must exist', () => {
    const boardSrc = readFileSync(resolve(__dirname, '../Board.tsx'), 'utf-8');
    const boardGridSrc = readFileSync(resolve(__dirname, '../ui/BoardGrid.tsx'), 'utf-8');
    const handAreaSrc = readFileSync(resolve(__dirname, '../ui/HandArea.tsx'), 'utf-8');
    const phaseTrackerSrc = readFileSync(resolve(__dirname, '../ui/PhaseTracker.tsx'), 'utf-8');
    const mapContainerSrc = readFileSync(resolve(__dirname, '../ui/MapContainer.tsx'), 'utf-8');
    const allSrc = boardSrc + boardGridSrc + handAreaSrc + phaseTrackerSrc + mapContainerSrc;

    it('所有 highlightTarget 在源码中有对应 data-tutorial-id', () => {
        const stepsWithHighlight = SUMMONER_WARS_TUTORIAL.steps.filter(s => s.highlightTarget);

        // 收集所有 highlightTarget
        const targets = new Set(stepsWithHighlight.map(s => s.highlightTarget));

        for (const target of targets) {
            // 动态生成的 ID 使用正则匹配，静态 ID 使用字符串匹配
            const pattern = new RegExp(`['"]${target}['"]`);
            expect(allSrc, `缺少 tutorial-id: ${target}`).toMatch(pattern);
        }
    });
});
