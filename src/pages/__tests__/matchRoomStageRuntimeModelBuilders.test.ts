import { describe, expect, it, vi } from 'vitest';
import { buildMatchRoomTutorialBoardRuntimeModel } from '../matchRoomStageRuntimeModelBuilders';

describe('buildMatchRoomTutorialBoardRuntimeModel', () => {
    const tLobby = vi.fn((key: string) => key);
    const board = (() => null) as unknown as NonNullable<ReturnType<typeof buildMatchRoomTutorialBoardRuntimeModel>>['board'];
    const engineConfig = {
        gameId: 'betrayal',
        domain: {} as never,
        systems: [],
        minPlayers: 3,
        maxPlayers: 6,
    } as NonNullable<ReturnType<typeof buildMatchRoomTutorialBoardRuntimeModel>>['engineConfig'];

    it('优先使用教程 manifest 声明的真实人数，而不是页面层硬编码', () => {
        const runtime = buildMatchRoomTutorialBoardRuntimeModel({
            gameId: 'betrayal',
            tLobby,
            stage: {
                tutorialId: 'haunt-actions-and-finish',
                tutorialManifest: {
                    id: 'haunt-actions-and-finish',
                    numPlayers: 3,
                    steps: [],
                },
                board,
                engineConfig,
                onCommandRejected: vi.fn(),
                loadingProgressText: undefined,
            },
        });

        expect(runtime?.numPlayers).toBe(3);
    });

    it('未声明教程人数时，回退到引擎最小人数', () => {
        const runtime = buildMatchRoomTutorialBoardRuntimeModel({
            gameId: 'cardia',
            tLobby,
            stage: {
                tutorialId: 'cardia-basic',
                tutorialManifest: {
                    id: 'cardia-basic',
                    steps: [],
                },
                board,
                engineConfig: {
                    ...engineConfig,
                    gameId: 'cardia',
                    minPlayers: 2,
                    maxPlayers: 2,
                },
                onCommandRejected: vi.fn(),
                loadingProgressText: undefined,
            },
        });

        expect(runtime?.numPlayers).toBe(2);
    });
});
