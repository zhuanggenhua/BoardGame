/**
 * data-tutorial-id 存在性测试
 *
 * 通过源码扫描验证 Board.tsx 及子组件包含所有必需的 data-tutorial-id 属性。
 * 这种方式避免了渲染组件的复杂依赖，同时确保属性不会被意外删除。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_IDS = [
    'su-base-area',
    'su-scoreboard',
    'su-turn-tracker',
    'su-hand-area',
    'su-end-turn-btn',
    'su-deck-discard',
    'su-deck-stack',
    'su-discard-stack',
    'su-opponent-view-toggle',
    'su-back-to-self',
    'su-faction-select',
    'su-hand-prompt-skip-option',
];

/** 读取源码文件内容 */
function readSource(relativePath: string): string {
    return readFileSync(resolve(__dirname, '..', relativePath), 'utf-8');
}

describe('SmashUp Board data-tutorial-id 属性', () => {
    // 合并所有相关源码
    const boardSrc = readSource('Board.tsx');
    const handSrc = readSource('ui/HandArea.tsx');
    const deckSrc = readSource('ui/DeckDiscardZone.tsx');
    const factionSrc = readSource('ui/FactionSelection.tsx');
    const allSrc = boardSrc + handSrc + deckSrc + factionSrc;

    const hasTutorialId = (id: string): boolean => allSrc.includes(`data-tutorial-id="${id}"`)
        || allSrc.includes(`'${id}'`);

    for (const id of REQUIRED_IDS) {
        it(`包含 data-tutorial-id="${id}"`, () => {
            expect(hasTutorialId(id)).toBe(true);
        });
    }

    it('派系详情源码包含机制教程入口测试标识', () => {
        expect(factionSrc).toContain('data-testid="faction-mechanic-tutorial-entry"');
    });
});
