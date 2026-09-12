import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const GAME_DIR = resolve(__dirname, '..');

const readGameSource = (fileName: string) => readFileSync(resolve(GAME_DIR, fileName), 'utf-8');

const sourceByFile = {
    'Board.tsx': readGameSource('Board.tsx'),
    'actionDockSurface.tsx': readGameSource('actionDockSurface.tsx'),
    'characterSelectSurface.tsx': readGameSource('characterSelectSurface.tsx'),
    'deckStatusRailSurface.tsx': readGameSource('deckStatusRailSurface.tsx'),
    'endgameScreen.tsx': readGameSource('endgameScreen.tsx'),
    'inventoryRailSurface.tsx': readGameSource('inventoryRailSurface.tsx'),
    'latestDiscoverySurface.tsx': readGameSource('latestDiscoverySurface.tsx'),
    'playerStatusRailSurface.tsx': readGameSource('playerStatusRailSurface.tsx'),
    'referenceQuickActionsSurface.tsx': readGameSource('referenceQuickActionsSurface.tsx'),
    'roomMapSurface.tsx': readGameSource('roomMapSurface.tsx'),
} as const;

const REQUIRED_LITERAL_IDS = [
    ['betrayal-character-select-screen', 'characterSelectSurface.tsx'],
    ['betrayal-character-selection-grid', 'characterSelectSurface.tsx'],
    ['betrayal-character-confirm', 'characterSelectSurface.tsx'],
    ['betrayal-current-traits', 'playerStatusRailSurface.tsx'],
    ['betrayal-moves-remaining', 'Board.tsx'],
    ['betrayal-inventory-zone', 'inventoryRailSurface.tsx'],
    ['betrayal-room-board', 'Board.tsx'],
    ['betrayal-haunt-risk-status', 'deckStatusRailSurface.tsx'],
    ['betrayal-focus-self-room', 'referenceQuickActionsSurface.tsx'],
    ['betrayal-open-scenario', 'referenceQuickActionsSurface.tsx'],
    ['betrayal-reference-entry', 'referenceQuickActionsSurface.tsx'],
    ['betrayal-latest-discovery', 'latestDiscoverySurface.tsx'],
    ['betrayal-endgame-screen', 'endgameScreen.tsx'],
] as const;

describe('Betrayal data-tutorial-id 属性', () => {
    const boardSource = sourceByFile['Board.tsx'];

    for (const [id, fileName] of REQUIRED_LITERAL_IDS) {
        it(`${fileName} 包含 data-tutorial-id="${id}"`, () => {
            expect(sourceByFile[fileName]).toContain(`data-tutorial-id="${id}"`);
        });
    }

    it('底部动作区只保留不可见教程锚点，不再依赖整排动作栏容器', () => {
        expect(boardSource).not.toContain('data-tutorial-id="betrayal-actions-zone"');
        expect(boardSource).not.toContain("containerProps={{ 'data-tutorial-id': 'betrayal-actions-zone' }}");
        expect(boardSource).not.toContain('<ActionBarSkeleton');
    });

    it('底部动作按钮会把真实动作 id 暴露给教程系统', () => {
        expect(sourceByFile['actionDockSurface.tsx']).toContain('"data-tutorial-id": `betrayal-action-${action.id}`');
    });

    it('底部队友面板会把观察视角入口暴露给教程系统', () => {
        expect(sourceByFile['playerStatusRailSurface.tsx']).toContain('data-tutorial-id={`betrayal-bottom-teammate-${explorer.playerId}`}');
    });

    it('房间移动目标用整张房间牌暴露对应教程锚点', () => {
        expect(boardSource).toMatch(/target\.startsWith\(["']betrayal-room-["']\)/);
        expect(sourceByFile['roomMapSurface.tsx']).toMatch(
            /data-tutorial-id=\{\s*tutorialMapTargetRoomId === room\.id\s*\?\s*tutorialHighlightTarget\s*:\s*undefined\s*\}/,
        );
    });

    it('Board 已接入教程桥，而不是只留 tutorial manifest', () => {
        expect(boardSource).toMatch(/useTutorial,\s*useTutorialBridge,/);
        expect(boardSource).toContain('const runtimeDispatch = dispatch as unknown as (');
        expect(boardSource).toContain('const tutorialRuntimeSyncKey = React.useMemo(');
        expect(boardSource).toContain('useTutorialBridge(G?.sys?.tutorial, runtimeDispatch, tutorialRuntimeSyncKey);');
    });
});
