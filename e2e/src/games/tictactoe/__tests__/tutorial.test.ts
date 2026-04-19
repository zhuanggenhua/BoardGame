import { describe, it, expect } from 'vitest';
import { TicTacToeTutorial } from '../tutorial';

describe('井字棋教程配置', () => {
    it('需要操作的步骤必须配置推进事件', () => {
        const requireActionSteps = TicTacToeTutorial.steps.filter((step) => step.requireAction);
        expect(requireActionSteps.length).toBeGreaterThan(0);

        requireActionSteps.forEach((step) => {
            expect(step.advanceOnEvents && step.advanceOnEvents.length > 0).toBe(true);
        });
    });

    it('中心策略步骤使用 CELL_OCCUPIED 推进', () => {
        const step = TicTacToeTutorial.steps.find((item) => item.id === 'center-strategy');
        expect(step).toBeTruthy();
        expect(step?.advanceOnEvents).toContainEqual({
            type: 'CELL_OCCUPIED',
            match: { cellId: 4 },
        });
    });

    it('AI 回合步骤使用 CELL_OCCUPIED 推进', () => {
        const step = TicTacToeTutorial.steps.find((item) => item.id === 'opponent-turn');
        expect(step).toBeTruthy();
        expect(step?.advanceOnEvents).toContainEqual({
            type: 'CELL_OCCUPIED',
            match: { cellId: 0 },
        });
    });
});
