/**
 * Property 4: 投票逻辑零重复（静态验证）
 *
 * Feature: dicethrone-game-over-screen, Property 4: 投票逻辑零重复
 *
 * 扫描 DiceThroneEndgame.tsx 源码，确认不含投票状态判断逻辑
 * （myVote/ready/rematchState.votes 的 if-else/ternary 分支）。
 * 所有投票状态分支必须全部在框架层 RematchActions 内部。
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

// Feature: dicethrone-game-over-screen, Property 4: 投票逻辑零重复
describe('Property 4: 投票逻辑零重复（静态源码扫描）', () => {
    const sourcePath = resolve(__dirname, '../DiceThroneEndgame.tsx');
    const source = readFileSync(sourcePath, 'utf-8');

    // 移除注释内容，只检查实际代码
    const codeWithoutComments = source
        .replace(/\/\*[\s\S]*?\*\//g, '')  // 块注释
        .replace(/\/\/.*/g, '');            // 行注释

    it('不包含 myVote 条件判断', () => {
        // 检查是否有 myVote 变量的使用（不含类型定义和注释）
        expect(codeWithoutComments).not.toMatch(/\bmyVote\b/);
    });

    it('不包含 ready 投票状态判断', () => {
        // 检查是否有 rematch 相关的 ready 状态判断
        expect(codeWithoutComments).not.toMatch(/\brematchState\b/);
        expect(codeWithoutComments).not.toMatch(/\.ready\b/);
    });

    it('不包含 rematchState.votes 条件分支', () => {
        expect(codeWithoutComments).not.toMatch(/\.votes\b/);
    });

    it('不包含投票相关的 onVote 回调', () => {
        expect(codeWithoutComments).not.toMatch(/\bonVote\b/);
    });

    it('不 import RematchVoteState 类型', () => {
        expect(codeWithoutComments).not.toMatch(/RematchVoteState/);
    });
});
