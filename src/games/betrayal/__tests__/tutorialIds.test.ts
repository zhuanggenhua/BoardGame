import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_LITERAL_IDS = [
    'betrayal-character-select-screen',
    'betrayal-character-selection-grid',
    'betrayal-character-confirm',
    'betrayal-current-traits',
    'betrayal-moves-remaining',
    'betrayal-inventory-zone',
    'betrayal-room-board',
    'betrayal-reference-entry',
    'betrayal-latest-discovery',
    'betrayal-endgame-screen',
];

describe('Betrayal Board data-tutorial-id 属性', () => {
    const boardSource = readFileSync(resolve(__dirname, '..', 'Board.tsx'), 'utf-8');

    for (const id of REQUIRED_LITERAL_IDS) {
        it(`包含 data-tutorial-id="${id}"`, () => {
            expect(boardSource).toContain(`data-tutorial-id="${id}"`);
        });
    }

    it('底部动作栏容器会把 betrayal-actions-zone 暴露给教程系统', () => {
        expect(boardSource).toContain("containerProps={{ 'data-tutorial-id': 'betrayal-actions-zone' }}");
    });

    it('底部动作按钮会把真实动作 id 暴露给教程系统', () => {
        expect(boardSource).toContain('data-tutorial-id={`betrayal-action-${action.id}`}');
    });

    it('房间移动目标只在当前教程步骤点名时暴露对应锚点', () => {
        expect(boardSource).toContain("target.startsWith('betrayal-room-move-target-')");
        expect(boardSource).toContain("data-tutorial-id={tutorialMapTargetRoomId === room.id ? tutorialStep?.highlightTarget : undefined}");
    });

    it('Board 已接入教程桥，而不是只留 tutorial manifest', () => {
        expect(boardSource).toContain("import { useTutorial, useTutorialBridge } from '../../contexts/TutorialContext';");
        expect(boardSource).toContain('useTutorialBridge(G?.sys?.tutorial, dispatch as (type: string, payload?: unknown) => void);');
    });
});
