import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const REQUIRED_IDS = [
    'fantasyrealms-live-deck',
    'fantasyrealms-live-center-row',
    'fantasyrealms-live-hand-zone',
];

describe('FantasyRealms Board data-tutorial-id 属性', () => {
    const boardSource = readFileSync(resolve(__dirname, '..', 'Board.tsx'), 'utf-8');

    for (const id of REQUIRED_IDS) {
        it(`包含 data-tutorial-id="${id}"`, () => {
            expect(boardSource).toContain(`data-tutorial-id="${id}"`);
        });
    }

    it('动作按钮通过 mode 派生教程锚点', () => {
        expect(boardSource).toContain("data-tutorial-id={button.mode === 'take-discard' ? 'fantasyrealms-live-action-take-discard' : `fantasyrealms-live-action-${button.mode}`}");
    });
});
