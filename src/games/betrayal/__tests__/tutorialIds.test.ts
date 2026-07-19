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

    it('底部动作区只保留不可见教程锚点，不再依赖整排动作栏容器', () => {
        expect(boardSource).not.toContain('data-tutorial-id="betrayal-actions-zone"');
        expect(boardSource).not.toContain("containerProps={{ 'data-tutorial-id': 'betrayal-actions-zone' }}");
        expect(boardSource).not.toContain('<ActionBarSkeleton');
    });

    it('底部动作按钮会把真实动作 id 暴露给教程系统', () => {
        expect(boardSource).toContain('data-tutorial-id={`betrayal-action-${action.id}`}');
    });

    it('房间移动目标用整张房间牌暴露对应教程锚点', () => {
        expect(boardSource).toMatch(/target\.startsWith\(["']betrayal-room-["']\)/);
        expect(boardSource).toMatch(
            /data-tutorial-id=\{\s*tutorialMapTargetRoomId === room\.id\s*\?\s*tutorialStep\?\.highlightTarget\s*:\s*undefined\s*\}/,
        );
    });

    it('Board 已接入教程桥，而不是只留 tutorial manifest', () => {
        expect(boardSource).toMatch(/import \{ useTutorial, useTutorialBridge \} from ["']\.\.\/\.\.\/contexts\/TutorialContext["'];/);
        expect(boardSource).toMatch(/useTutorialBridge\(\s*G\?\.sys\?\.tutorial,\s*dispatch as \(type: string, payload\?: unknown\) => void,?\s*\);/);
    });
});
