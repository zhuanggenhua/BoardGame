/**
 * UGC Builder 测试
 * 
 * 测试 AI 辅助生成模板和工厂函数
 */

import { describe, it, expect } from 'vitest';
import {
    PromptGenerator,
    createEmptyContext,
} from '../builder/ai';

describe('UGC Builder', () => {
    describe('提示词生成', () => {
        it('应生成完整提示词', () => {
            const ctx = createEmptyContext();
            ctx.name = '测试游戏';
            ctx.description = '测试描述';
            const generator = new PromptGenerator(ctx);
            const prompt = generator.generateFullPrompt();
            expect(prompt).toContain('测试游戏');
            expect(prompt).toContain('测试描述');
        });
    });
});
