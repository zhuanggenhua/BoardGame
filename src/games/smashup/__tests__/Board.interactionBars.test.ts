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

    it('普通 hand prompt 仍由手牌直选承接，响应交互不应复用这条分流', () => {
        const source = readBoardSource();
        expect(source).toContain('isDirectHandSelectPrompt && handSelectExtraOptions.length > 0');
        expect(source).toContain('const shouldRender = !isReactionChoicePrompt');
        expect(source).toContain('isDiscardMode={needDiscard || isDirectHandSelectPrompt}');
        expect(source).not.toContain('isHandDrivenPrompt');
        expect(source).not.toContain('isReactionDirectHandPrompt');
    });

    it('弃牌横条保留赛博守护者的弃牌堆持续行动入口，并在点中随从时发出 fromDiscard 行动命令', () => {
        const source = readBoardSource();
        expect(source).toContain("mode: 'play_action_minion' as const");
        expect(source).toContain("dispatch(SU_COMMANDS.PLAY_ACTION, {");
        expect(source).toContain('targetMinionUid: minionUid');
        expect(source).toContain('fromDiscard: true');
    });
});
