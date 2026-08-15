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
        expect(runtime?.tutorialManifest?.id).toBe('haunt-actions-and-finish');
    });

    it('教程运行时所有座位都由当前用户操作，不得启用本地 AI 代选', () => {
        const runtime = buildMatchRoomTutorialBoardRuntimeModel({
            gameId: 'the-gang',
            tLobby,
            stage: {
                tutorialId: 'basic',
                tutorialManifest: {
                    id: 'basic',
                    numPlayers: 3,
                    steps: [],
                },
                board,
                engineConfig: {
                    ...engineConfig,
                    gameId: 'the-gang',
                    minPlayers: 3,
                    maxPlayers: 6,
                },
                aiSupport: {
                    capture: true,
                    localAi: true,
                    remoteAi: false,
                    defaultLocalAiSeats: 'all-opponents',
                },
                onCommandRejected: vi.fn(),
                loadingProgressText: undefined,
            },
        });

        expect(runtime?.seatControllers).toEqual({
            '0': { type: 'human' },
            '1': { type: 'human' },
            '2': { type: 'human' },
        });
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

    it('游戏 runtime adapter 的本地 setup resolver 会透传到教程运行时模型', () => {
        const resolveLocalSetup = vi.fn(() => ({
            numPlayers: 3,
            setupData: { fromAdapter: true },
        }));
        const runtime = buildMatchRoomTutorialBoardRuntimeModel({
            gameId: 'qidahen',
            tLobby,
            stage: {
                tutorialId: 'basic-opening',
                tutorialManifest: {
                    id: 'basic-opening',
                    steps: [],
                },
                board,
                engineConfig,
                onCommandRejected: vi.fn(),
                resolveLocalSetup,
                loadingProgressText: undefined,
            },
        });

        expect(runtime?.resolveLocalSetup).toBe(resolveLocalSetup);
    });

    it('目录页接管前，教程运行时模型仍可由页面层按需构建', () => {
        const runtime = buildMatchRoomTutorialBoardRuntimeModel({
            gameId: 'qidahen',
            tLobby,
            stage: {
                tutorialId: undefined,
                tutorialCatalog: {
                    defaultTutorialId: 'basic-opening',
                    tutorials: {
                        'basic-opening': {
                            manifest: { id: 'basic-opening', steps: [] },
                        },
                        'attack-and-battle': {
                            manifest: { id: 'attack-and-battle', steps: [] },
                        },
                    },
                },
                tutorialManifest: null,
                board,
                engineConfig,
                onCommandRejected: vi.fn(),
                loadingProgressText: undefined,
            },
        });

        expect(runtime?.tutorialId).toBeUndefined();
        expect(runtime?.numPlayers).toBe(3);
    });
});
