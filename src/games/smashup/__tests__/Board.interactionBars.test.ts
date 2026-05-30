import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

function readBoardSource(): string {
    return readFileSync(resolve(__dirname, '..', 'Board.tsx'), 'utf-8');
}

describe('SmashUp 交互浮动操作栏源码约束', () => {
    it('浮动操作栏外层容器应保持 pointer-events-auto，避免真机触摸命中丢失', () => {
        const source = readBoardSource();
        expect(source).toContain("absolute inset-x-0 flex justify-center pointer-events-auto");
        expect(source).toContain("fixed inset-x-0 flex justify-center pointer-events-auto");
    });
});
