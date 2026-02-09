/**
 * 大杀四方教学 manifest 结构验证
 *
 * 验证教学配置的完整性和正确性：
 * - 步骤 id 唯一性
 * - content 字段格式
 * - setup 步骤包含 aiActions
 * - randomPolicy 已设置
 */

import { describe, it, expect } from 'vitest';
import SMASH_UP_TUTORIAL from '../tutorial';

describe('SmashUp Tutorial Manifest 结构验证', () => {
    it('manifest id 已设置', () => {
        expect(SMASH_UP_TUTORIAL.id).toBe('smashup-basic');
    });

    it('randomPolicy 已设置为 fixed 模式', () => {
        expect(SMASH_UP_TUTORIAL.randomPolicy).toEqual({ mode: 'fixed', values: [1] });
    });

    it('所有步骤 id 唯一', () => {
        const ids = SMASH_UP_TUTORIAL.steps.map(s => s.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it('所有 content 字段匹配 game-smashup:tutorial.* 模式', () => {
        for (const step of SMASH_UP_TUTORIAL.steps) {
            expect(step.content).toMatch(/^game-smashup:tutorial\./);
        }
    });

    it('setup 步骤包含 aiActions', () => {
        const setup = SMASH_UP_TUTORIAL.steps.find(s => s.id === 'setup');
        expect(setup).toBeDefined();
        expect(setup!.aiActions).toBeDefined();
        expect(setup!.aiActions!.length).toBeGreaterThan(0);
    });

    it('至少包含 15 个教学步骤', () => {
        expect(SMASH_UP_TUTORIAL.steps.length).toBeGreaterThanOrEqual(15);
    });

    it('finish 步骤存在且为最后一步', () => {
        const last = SMASH_UP_TUTORIAL.steps[SMASH_UP_TUTORIAL.steps.length - 1];
        expect(last.id).toBe('finish');
    });
});
