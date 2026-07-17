/* @vitest-environment happy-dom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchRoomTutorialBoardRuntime, type MatchRoomTutorialBoardRuntimeModel } from '../matchRoomTutorialStageRuntime';
import { buildTutorialProgressSeed } from '../useMatchRoomTutorialLifecycle';
import { buildLocalMatchSnapshotKey, persistLocalMatchSnapshot } from '../../engine/transport/localSession';
import type { GameEngineConfig } from '../../engine/transport/server';
import type { MatchState, TutorialManifest } from '../../engine/types';

let latestModalEntry: null | {
    render: (args: { close: () => void; closeOnBackdrop?: boolean }) => React.ReactNode;
} = null;
let latestLocalProviderProps: null | {
    seed: string;
    persistSession?: boolean;
    persistGameId?: string;
    seatControllers?: MatchRoomTutorialBoardRuntimeModel['seatControllers'];
    followCurrentTurnPlayer?: boolean;
} = null;
const localProviderSeeds: string[] = [];
const localProviderLifecycle: string[] = [];

const modalClose = vi.fn();
const openModal = vi.fn((entry: NonNullable<typeof latestModalEntry>) => {
    latestModalEntry = entry;
    return 'resume-modal';
});
const closeModal = vi.fn();

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
        dispatch: vi.fn(),
        state: { sys: { tutorial: { active: true, stepIndex: 1, step: manifest.steps[1] } } },
    }),
    LocalGameProvider: (props: {
        seed: string;
        persistSession?: boolean;
        persistGameId?: string;
        seatControllers?: MatchRoomTutorialBoardRuntimeModel['seatControllers'];
        followCurrentTurnPlayer?: boolean;
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
            persistSession: props.persistSession,
            persistGameId: props.persistGameId,
            seatControllers: props.seatControllers,
            followCurrentTurnPlayer: props.followCurrentTurnPlayer,
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

function persistProgressSnapshot() {
    const seed = buildTutorialProgressSeed(runtime.gameId, runtime.tutorialId, manifest.id);
    if (!seed || !runtime.gameId) {
        throw new Error('expected seed and game id');
    }

    persistLocalMatchSnapshot({
        gameId: runtime.gameId,
        seed,
        numPlayers: 2,
        randomCursor: 0,
        state: {
            core: {},
            sys: {
                tutorial: {
                    active: true,
                    manifestId: manifest.id,
                    stepIndex: 1,
                    steps: manifest.steps,
                    step: manifest.steps[1] ?? null,
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
        expect(window.localStorage.getItem(buildLocalMatchSnapshotKey(runtime.gameId ?? '', seed))).not.toBeNull();
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

    it('同一教程页面切到隐藏续章时，会用新章节 seed 重新挂载本地教程局', async () => {
        const initialSeed = buildTutorialProgressSeed(runtime.gameId, runtime.tutorialId, runtime.tutorialManifest?.id);
        const reclaimRuntime: MatchRoomTutorialBoardRuntimeModel = {
            ...runtime,
            tutorialId: 'wheel-reclaim',
            tutorialManifest: reclaimManifest,
        };
        const reclaimSeed = buildTutorialProgressSeed(
            reclaimRuntime.gameId,
            reclaimRuntime.tutorialId,
            reclaimRuntime.tutorialManifest?.id,
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
});
