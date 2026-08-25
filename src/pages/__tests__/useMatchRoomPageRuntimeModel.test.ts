import { describe, expect, it } from 'vitest';
import { resolveMatchRoomTutorialProgressNumPlayers } from '../useMatchRoomPageRuntimeModel';
import { qidahenGameRuntimeAdapter } from '../../games/qidahen/runtimeAdapter';

describe('resolveMatchRoomTutorialProgressNumPlayers', () => {
    it('七大恨教程恢复进度人数优先使用 runtime adapter 的教程本地 setup', () => {
        const searchParams = new URLSearchParams('players=2');

        expect(resolveMatchRoomTutorialProgressNumPlayers({
            searchParams,
            tutorialId: 'basic-opening',
            runtimeAdapter: qidahenGameRuntimeAdapter,
            resolvedTutorialManifest: { id: 'basic-opening', steps: [] },
            engineConfig: {
                gameId: 'qidahen',
                minPlayers: 2,
            } as never,
        })).toBe(3);
    });

    it('没有 adapter 教程 setup 时回退到 manifest 人数，再回退到引擎最小人数', () => {
        expect(resolveMatchRoomTutorialProgressNumPlayers({
            searchParams: new URLSearchParams(),
            tutorialId: 'basic',
            runtimeAdapter: null,
            resolvedTutorialManifest: { id: 'basic', numPlayers: 4, steps: [] },
            engineConfig: {
                gameId: 'example',
                minPlayers: 2,
            } as never,
        })).toBe(4);

        expect(resolveMatchRoomTutorialProgressNumPlayers({
            searchParams: new URLSearchParams(),
            tutorialId: 'basic',
            runtimeAdapter: null,
            resolvedTutorialManifest: { id: 'basic', steps: [] },
            engineConfig: {
                gameId: 'example',
                minPlayers: 2,
            } as never,
        })).toBe(2);
    });
});
