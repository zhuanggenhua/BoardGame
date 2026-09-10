/* @vitest-environment happy-dom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchRoomTutorialBoardRuntime, type MatchRoomTutorialBoardRuntimeModel } from '../matchRoomTutorialStageRuntime';
import { buildTutorialProgressSeed } from '../useMatchRoomTutorialLifecycle';
import { buildLocalMatchSnapshotKey, persistLocalMatchSnapshot, type LocalMatchSnapshot } from '../../engine/transport/localSession';
import { TUTORIAL_COMMANDS } from '../../engine/systems/TutorialSystem';
import type { GameEngineConfig } from '../../engine/transport/engineConfig';
import type { MatchState, TutorialManifest } from '../../engine/types';

let latestModalEntry: null | {
    render: (args: { close: () => void; closeOnBackdrop?: boolean }) => React.ReactNode;
} = null;
let latestLocalProviderProps: null | {
    seed: string;
    numPlayers: number;
    setupData?: Record<string, unknown>;
    persistSession?: boolean;
    persistGameId?: string;
    seatControllers?: MatchRoomTutorialBoardRuntimeModel['seatControllers'];
    followCurrentTurnPlayer?: boolean;
    shouldRestorePersistedSession?: (snapshot: LocalMatchSnapshot) => boolean;
} = null;
const localProviderSeeds: string[] = [];
const localProviderLifecycle: string[] = [];

const modalClose = vi.fn();
const openModal = vi.fn((entry: NonNullable<typeof latestModalEntry>) => {
    latestModalEntry = entry;
    return 'resume-modal';
});
const closeModal = vi.fn();
const gameClientDispatch = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>();
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, options?: Record<string, unknown>) => {
                if (key === 'matchRoom.tutorialProgress.title') return '继续上次教程？';
                if (key === 'matchRoom.tutorialProgress.description') return `第 ${options?.current} / ${options?.total} 步`;
                if (key === 'matchRoom.tutorialProgress.continue') return '从上次继续';
                if (key === 'matchRoom.tutorialProgress.restart') return '重头开始';
                if (key === 'matchRoom.tutorialProgress.waitingChoice') return '等待选择教程进度';
                return key;
            },
            i18n: { language: 'zh-CN' },
        }),
    };
});

vi.mock('../../contexts/DebugContext', () => ({
    useDebug: () => ({ playerID: null }),
}));

vi.mock('../../contexts/ModalStackContext', () => ({
    useModalStack: () => ({
        openModal,
        closeModal,
    }),
}));

vi.mock('../../contexts/TutorialContext', () => ({
    useTutorial: () => ({
        tutorial: {
            active: false,
            manifestId: null,
            stepIndex: 0,
            steps: [],
            step: null,
        },
        bindDispatch: vi.fn(),
        unbindDispatch: vi.fn(),
        syncTutorialState: vi.fn(),
    }),
}));

vi.mock('../../contexts/GameModeContext', () => ({
    useGameMode: () => ({ mode: 'tutorial' }),
}));

vi.mock('../../components/common/overlays/ConfirmModal', () => ({
    ConfirmModal: ({
        title,
        description,
        confirmText,
        cancelText,
        onConfirm,
        onCancel,
    }: {
        title: string;
        description: string;
        confirmText: string;
        cancelText: string;
        onConfirm: () => void;
        onCancel: () => void;
    }) => (
        <section data-testid="tutorial-progress-modal">
            <h1>{title}</h1>
            <p>{description}</p>
            <button type="button" onClick={onConfirm}>{confirmText}</button>
            <button type="button" onClick={onCancel}>{cancelText}</button>
        </section>
    ),
}));

vi.mock('../../engine/transport/react', () => ({
    useGameClient: () => ({
        dispatch: gameClientDispatch,
        state: {
            sys: {
                tutorial: {
                    active: true,
                    manifestId: manifest.id,
                    stepIndex: 1,
                    step: manifest.steps[1],
                },
            },
        },
    }),
    LocalGameProvider: (props: {
        seed: string;
        numPlayers: number;
        setupData?: Record<string, unknown>;
        persistSession?: boolean;
        persistGameId?: string;
        seatControllers?: MatchRoomTutorialBoardRuntimeModel['seatControllers'];
        followCurrentTurnPlayer?: boolean;
        shouldRestorePersistedSession?: (snapshot: LocalMatchSnapshot) => boolean;
        children?: React.ReactNode;
    }) => {
        const mountedSeed = useRef(props.seed).current;
        useEffect(() => {
            localProviderLifecycle.push(`mount:${mountedSeed}`);
            return () => {
                localProviderLifecycle.push(`unmount:${mountedSeed}`);
            };
        }, [mountedSeed]);
        latestLocalProviderProps = {
            seed: props.seed,
            numPlayers: props.numPlayers,
            setupData: props.setupData,
            persistSession: props.persistSession,
            persistGameId: props.persistGameId,
            seatControllers: props.seatControllers,
            followCurrentTurnPlayer: props.followCurrentTurnPlayer,
            shouldRestorePersistedSession: props.shouldRestorePersistedSession,
        };
        localProviderSeeds.push(props.seed);
        return <div data-testid="local-game-provider">{props.children}</div>;
    },
    BoardBridge: () => <div data-testid="board-bridge" />,
}));

const manifest: TutorialManifest = {
    id: 'basic-opening',
    steps: [
        { id: 'intro', content: 'intro' },
        { id: 'play-card', content: 'play-card' },
    ],
};

const reclaimManifest: TutorialManifest = {
    id: 'wheel-reclaim',
    steps: [
        { id: 'overview', content: 'overview' },
        { id: 'choose-move', content: 'choose-move' },
    ],
};

const engineConfig = {
    gameId: 'qidahen',
    domain: {} as never,
    systems: [],
    minPlayers: 2,
    maxPlayers: 2,
} as GameEngineConfig;

const runtime: MatchRoomTutorialBoardRuntimeModel = {
    gameId: 'qidahen-test',
    tutorialId: 'basic-opening',
    tutorialManifest: manifest,
    board: () => null,
    engineConfig,
    numPlayers: 2,
    onCommandRejected: vi.fn(),
    title: '学习模式',
    preparingDescription: '正在准备',
    seatControllers: {
        '0': { type: 'human' },
        '1': { type: 'local-ai', difficulty: 'normal' },
    },
};

function persistProgressSnapshot(args: {
    targetRuntime?: MatchRoomTutorialBoardRuntimeModel;
    targetManifest?: TutorialManifest;
    legacySeed?: boolean;
    includeManifestRevision?: boolean;
    active?: boolean;
} = {}) {
    const targetRuntime = args.targetRuntime ?? runtime;
    const targetManifest = args.targetManifest ?? targetRuntime.tutorialManifest ?? manifest;
    const seed = buildTutorialProgressSeed(
        targetRuntime.gameId,
        targetRuntime.tutorialId,
        targetManifest.id,
        args.legacySeed ? undefined : targetManifest.revision,
    );
    if (!seed || !targetRuntime.gameId) {
        throw new Error('expected seed and game id');
    }

    persistLocalMatchSnapshot({
        gameId: targetRuntime.gameId,
        seed,
        numPlayers: 2,
        randomCursor: 0,
        state: {
            core: {},
            sys: {
                tutorial: {
                    active: args.active ?? true,
                    manifestId: targetManifest.id,
                    ...(args.includeManifestRevision ?? !args.legacySeed) && Number.isInteger(targetManifest.revision)
                        ? { manifestRevision: targetManifest.revision }
                        : undefined,
                    stepIndex: 1,
                    steps: targetManifest.steps,
                    step: targetManifest.steps[1] ?? null,
                },
            },
        } as MatchState<unknown>,
    });

    return seed;
}

describe('MatchRoomTutorialBoardRuntime 教程进度恢复', () => {
    beforeEach(() => {
        window.localStorage.clear();
        latestModalEntry = null;
        latestLocalProviderProps = null;
        localProviderSeeds.length = 0;
        localProviderLifecycle.length = 0;
        modalClose.mockReset();
        openModal.mockClear();
        closeModal.mockClear();
        gameClientDispatch.mockClear();
    });

    it('挂载教程局时把当前教程清单传给桥接层，供恢复态重新绑定白名单', async () => {
        render(
            <MemoryRouter>
                <MatchRoomTutorialBoardRuntime runtime={runtime} />
            </MemoryRouter>,
        );

        await waitFor(() => expect(latestLocalProviderProps?.seed).toBe(
            buildTutorialProgressSeed(
                runtime.gameId,
                runtime.tutorialId,
                runtime.tutorialManifest?.id,
                runtime.tutorialManifest?.revision,
            ),
        ));
        await waitFor(() => expect(gameClientDispatch).toHaveBeenCalledWith(
            TUTORIAL_COMMANDS.BIND_MANIFEST,
            { manifest },
        ));
    });

    it('有可恢复进度时先弹窗，选择继续后用章节 seed 恢复本地教程', async () => {
        const seed = persistProgressSnapshot();

        render(
            <MemoryRouter>
                <MatchRoomTutorialBoardRuntime runtime={runtime} />
            </MemoryRouter>,
        );

        expect(screen.getByText('等待选择教程进度')).toBeInTheDocument();
        await waitFor(() => expect(openModal).toHaveBeenCalledTimes(1));
        expect(latestLocalProviderProps).toBeNull();

        if (!latestModalEntry) {
            throw new Error('expected resume modal entry');
        }
        render(<>{latestModalEntry.render({ close: modalClose, closeOnBackdrop: false })}</>);

        expect(screen.getByTestId('tutorial-progress-modal')).toHaveTextContent('第 2 / 2 步');
        fireEvent.click(screen.getByText('从上次继续'));

        await waitFor(() => expect(latestLocalProviderProps?.seed).toBe(seed));
        expect(latestLocalProviderProps?.persistSession).toBe(true);
        expect(latestLocalProviderProps?.persistGameId).toBe(runtime.gameId);
        expect(latestLocalProviderProps?.seatControllers).toEqual(runtime.seatControllers);
        expect(latestLocalProviderProps?.followCurrentTurnPlayer).toBe(false);
        const rawSnapshot = window.localStorage.getItem(buildLocalMatchSnapshotKey(runtime.gameId ?? '', seed));
        expect(rawSnapshot).not.toBeNull();
        expect(latestLocalProviderProps?.shouldRestorePersistedSession?.(JSON.parse(rawSnapshot ?? '') as LocalMatchSnapshot)).toBe(true);
    });

    it('非激活的同章节旧快照不会作为教程进度恢复，避免教程入口落到普通牌桌', async () => {
        const seed = persistProgressSnapshot({ active: false });

        render(
            <MemoryRouter>
                <MatchRoomTutorialBoardRuntime runtime={runtime} />
            </MemoryRouter>,
        );

        expect(openModal).not.toHaveBeenCalled();
        await waitFor(() => expect(latestLocalProviderProps?.seed).toBe(seed));
        const rawSnapshot = window.localStorage.getItem(buildLocalMatchSnapshotKey(runtime.gameId ?? '', seed));
        expect(rawSnapshot).not.toBeNull();
        expect(latestLocalProviderProps?.shouldRestorePersistedSession?.(JSON.parse(rawSnapshot ?? '') as LocalMatchSnapshot)).toBe(false);
    });

    it('选择重头开始会清掉当前章节快照并重新挂载教程 provider', async () => {
        const seed = persistProgressSnapshot();

        render(
            <MemoryRouter>
                <MatchRoomTutorialBoardRuntime runtime={runtime} />
            </MemoryRouter>,
        );

        await waitFor(() => expect(openModal).toHaveBeenCalledTimes(1));
        if (!latestModalEntry) {
            throw new Error('expected resume modal entry');
        }
        render(<>{latestModalEntry.render({ close: modalClose, closeOnBackdrop: false })}</>);

        fireEvent.click(screen.getByText('重头开始'));

        await waitFor(() => expect(latestLocalProviderProps?.seed).toBe(seed));
        expect(window.localStorage.getItem(buildLocalMatchSnapshotKey(runtime.gameId ?? '', seed))).toBeNull();
    });

    it('manifest revision 变化后不会让真实教程页挂载旧章节 seed', async () => {
        const revisedManifest: TutorialManifest = { ...manifest, revision: 2 };
        const revisedRuntime: MatchRoomTutorialBoardRuntimeModel = {
            ...runtime,
            tutorialManifest: revisedManifest,
        };
        const legacySeed = persistProgressSnapshot({
            targetRuntime: revisedRuntime,
            targetManifest: revisedManifest,
            legacySeed: true,
        });
        const revisedSeed = buildTutorialProgressSeed(
            revisedRuntime.gameId,
            revisedRuntime.tutorialId,
            revisedManifest.id,
            revisedManifest.revision,
        );

        render(
            <MemoryRouter>
                <MatchRoomTutorialBoardRuntime runtime={revisedRuntime} />
            </MemoryRouter>,
        );

        expect(openModal).not.toHaveBeenCalled();
        await waitFor(() => expect(latestLocalProviderProps?.seed).toBe(revisedSeed));
        expect(latestLocalProviderProps?.seed).not.toBe(legacySeed);
        expect(window.localStorage.getItem(buildLocalMatchSnapshotKey(revisedRuntime.gameId ?? '', legacySeed))).not.toBeNull();
    });

    it('同一教程页面切到隐藏续章时，会用新章节 seed 重新挂载本地教程局', async () => {
        const initialSeed = buildTutorialProgressSeed(
            runtime.gameId,
            runtime.tutorialId,
            runtime.tutorialManifest?.id,
            runtime.tutorialManifest?.revision,
        );
        const reclaimRuntime: MatchRoomTutorialBoardRuntimeModel = {
            ...runtime,
            tutorialId: 'wheel-reclaim',
            tutorialManifest: reclaimManifest,
        };
        const reclaimSeed = buildTutorialProgressSeed(
            reclaimRuntime.gameId,
            reclaimRuntime.tutorialId,
            reclaimRuntime.tutorialManifest?.id,
            reclaimRuntime.tutorialManifest?.revision,
        );

        const { rerender } = render(
            <MemoryRouter>
                <MatchRoomTutorialBoardRuntime runtime={runtime} />
            </MemoryRouter>,
        );
        await waitFor(() => expect(latestLocalProviderProps?.seed).toBe(initialSeed));
        expect(localProviderLifecycle).toEqual([`mount:${initialSeed}`]);

        rerender(
            <MemoryRouter>
                <MatchRoomTutorialBoardRuntime runtime={reclaimRuntime} />
            </MemoryRouter>,
        );

        await waitFor(() => expect(latestLocalProviderProps?.seed).toBe(reclaimSeed));
        expect(localProviderSeeds).toContain(initialSeed as string);
        expect(localProviderSeeds).toContain(reclaimSeed as string);
        expect(localProviderLifecycle).toEqual([
            `mount:${initialSeed}`,
            `unmount:${initialSeed}`,
            `mount:${reclaimSeed}`,
        ]);
    });

    it('教程本地开局可由游戏 runtime adapter 覆盖人数和 setupData', async () => {
        const resolveLocalSetup = vi.fn(() => ({
            numPlayers: 3,
            setupData: {
                adapterSetup: true,
                setupSelections: { scenario: 'tutorial-adapter' },
            },
        }));
        const adapterRuntime: MatchRoomTutorialBoardRuntimeModel = {
            ...runtime,
            seatControllers: undefined,
            resolveLocalSetup,
        };

        render(
            <MemoryRouter initialEntries={['/?tutorialSetup=adapter']}>
                <MatchRoomTutorialBoardRuntime runtime={adapterRuntime} />
            </MemoryRouter>,
        );

        await waitFor(() => expect(latestLocalProviderProps?.numPlayers).toBe(3));
        expect(resolveLocalSetup).toHaveBeenCalledWith({
            searchParams: expect.any(URLSearchParams),
            tutorialId: 'basic-opening',
            tutorialMode: true,
        });
        expect(latestLocalProviderProps?.setupData).toEqual({
            adapterSetup: true,
            setupSelections: { scenario: 'tutorial-adapter' },
        });
        expect(latestLocalProviderProps?.seatControllers).toEqual({
            '0': { type: 'human' },
            '1': { type: 'human' },
            '2': { type: 'human' },
        });
    });
});
