/**
 * data-tutorial-id 存在性测试
 *
 * 通过源码扫描验证 Board.tsx 及子组件包含所有必需的 data-tutorial-id 属性。
 * 这种方式避免了渲染组件的复杂依赖，同时确保属性不会被意外删除。
 *
 * 注意：部分 tutorial-id 是动态生成的（如 sw-my-summoner 基于 unit.card.unitClass 判断），
 * 这些 ID 使用正则表达式匹配。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// 硬编码的 ID（直接字符串匹配）
const STATIC_IDS = [
    'sw-map-area',
    'sw-hand-area',
    'sw-player-bar',
    'sw-phase-tracker',
    'sw-action-banner',
    'sw-end-phase-btn',
    'sw-discard-pile',
    'sw-deck-draw',
];

// 动态生成的 ID（通过正则匹配源码中的条件表达式）
const DYNAMIC_ID_PATTERNS: { id: string; pattern: RegExp }[] = [
    { id: 'sw-my-summoner', pattern: /['"]sw-my-summoner['"]/ },
    { id: 'sw-enemy-summoner', pattern: /['"]sw-enemy-summoner['"]/ },
    { id: 'sw-my-gate', pattern: /['"]sw-my-gate['"]/ },
    { id: 'sw-start-archer', pattern: /['"]sw-start-archer['"]/ },
    { id: 'sw-first-hand-card', pattern: /['"]sw-first-hand-card['"]/ },
];

/** 读取源码文件内容 */
function readSource(relativePath: string): string {
    return readFileSync(resolve(__dirname, '..', relativePath), 'utf-8');
}

describe('SummonerWars Board data-tutorial-id 属性', () => {
    // 合并所有相关源码
    const boardSrc = readSource('Board.tsx');
    const boardGridSrc = readSource('ui/BoardGrid.tsx');
    const handAreaSrc = readSource('ui/HandArea.tsx');
    const phaseTrackerSrc = readSource('ui/PhaseTracker.tsx');
    const mapContainerSrc = readSource('ui/MapContainer.tsx');
    const allSrc = boardSrc + boardGridSrc + handAreaSrc + phaseTrackerSrc + mapContainerSrc;

    // 静态 ID 测试
    for (const id of STATIC_IDS) {
        it(`包含 data-tutorial-id="${id}"`, () => {
            expect(allSrc).toContain(`data-tutorial-id="${id}"`);
        });
    }

    // 动态 ID 测试（通过正则匹配）
    for (const { id, pattern } of DYNAMIC_ID_PATTERNS) {
        it(`包含动态生成的 ${id}`, () => {
            expect(allSrc).toMatch(pattern);
        });
    }
});
