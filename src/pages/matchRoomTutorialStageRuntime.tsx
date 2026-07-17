import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameBoardProps } from '../engine/transport/protocol';
import { BoardBridge, LocalGameProvider } from '../engine/transport/react';
import type { GameEngineConfig } from '../engine/transport/server';
import type { AiSeatController } from '../engine/ai/types';
import { ConfirmModal } from '../components/common/overlays/ConfirmModal';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { useModalStack } from '../contexts/ModalStackContext';
import { TutorialDispatchBridge } from './matchRoomBridges';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QidahenPregameScenarioGate } from '../games/qidahen/QidahenPregameScenarioGate';
import { useDebug } from '../contexts/DebugContext';
import type { TutorialManifest } from '../engine/types';
import {
    buildTutorialProgressSeed,
    clearTutorialProgress,
    notifyTutorialProgressStorageChanged,
    readRestorableTutorialProgress,
} from './useMatchRoomTutorialLifecycle';

type MatchRoomBoardComponent = ComponentType<GameBoardProps>;

export type MatchRoomTutorialBoardRuntimeModel = {
    gameId?: string;
    tutorialId?: string;
    tutorialManifest: TutorialManifest | null;
    board: MatchRoomBoardComponent;
    engineConfig: GameEngineConfig;
    numPlayers?: number;
    seatControllers?: Record<string, AiSeatController>;
    onCommandRejected: (type: string, error: string) => void;
    title: string;
    preparingDescription: string;
    loadingProgressText?: string;
};

const TutorialLocalGameRuntime = ({
    runtime,
    numPlayers,
    setupData,
}: {
    runtime: MatchRoomTutorialBoardRuntimeModel;
    numPlayers: number;
    setupData?: Record<string, unknown>;
}) => {
    const { playerID } = useDebug();
    const { t: tLobby } = useTranslation('lobby');
    const { openModal, closeModal } = useModalStack();
    const resumeModalIdRef = useRef<string | null>(null);
    const [restartVersion, setRestartVersion] = useState(0);
    const [handledProgressKey, setHandledProgressKey] = useState<string | null>(null);
    const progressSeed = buildTutorialProgressSeed(
        runtime.gameId,
        runtime.tutorialId,
        runtime.tutorialManifest?.id,
    ) ?? `tutorial-${runtime.gameId ?? 'unknown'}`;
    const restorableProgress = useMemo(() => readRestorableTutorialProgress({
        gameId: runtime.gameId,
        tutorialId: runtime.tutorialId,
        manifest: runtime.tutorialManifest,
        numPlayers,
    }), [
        numPlayers,
        runtime.gameId,
        runtime.tutorialId,
        runtime.tutorialManifest,
    ]);
    const progressKey = restorableProgress
        ? `${restorableProgress.seed}:${restorableProgress.stepIndex}:${restorableProgress.stepId}`
        : null;
    const shouldAskResume = Boolean(restorableProgress && progressKey !== handledProgressKey);

    useEffect(() => {
        if (!restorableProgress || !shouldAskResume) {
            return;
        }
        if (resumeModalIdRef.current) {
            return;
        }

        const modalId = openModal({
            closeOnBackdrop: false,
            closeOnEsc: false,
            lockScroll: true,
            allowSystemBackNavigation: true,
            onClose: () => {
                resumeModalIdRef.current = null;
            },
            render: ({ close, closeOnBackdrop }) => (
                <ConfirmModal
                    title={tLobby('matchRoom.tutorialProgress.title')}
                    description={tLobby('matchRoom.tutorialProgress.description', {
                        current: restorableProgress.stepIndex + 1,
                        total: restorableProgress.totalSteps,
                    })}
                    confirmText={tLobby('matchRoom.tutorialProgress.continue')}
                    cancelText={tLobby('matchRoom.tutorialProgress.restart')}
                    onConfirm={() => {
                        close();
                        setHandledProgressKey(progressKey);
                    }}
                    onCancel={() => {
                        clearTutorialProgress({
                            gameId: runtime.gameId,
                            tutorialId: runtime.tutorialId,
                            manifestId: runtime.tutorialManifest?.id,
                        });
                        notifyTutorialProgressStorageChanged();
                        close();
                        setRestartVersion((version) => version + 1);
                        setHandledProgressKey(progressKey);
                    }}
                    closeOnBackdrop={closeOnBackdrop}
                    tone="cool"
                    panelClassName="rounded-[22px] border border-[#6c5736] bg-[linear-gradient(180deg,rgba(35,28,20,0.98),rgba(14,17,25,0.98))] p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
                    titleClassName="text-sm font-bold tracking-[0.22em] text-[#f2d49b]"
                    descriptionClassName="text-sm leading-6 text-[#f4ead4]"
                    confirmClassName="rounded-full bg-[#d9b36d] px-5 py-2 text-xs font-bold tracking-[0.14em] text-[#1e160d] hover:bg-[#f0ce88]"
                    cancelClassName="rounded-full border border-[#6f7f9a] bg-slate-900/40 px-5 py-2 text-xs font-bold tracking-[0.14em] text-[#dbe7ff] hover:bg-slate-800/70"
                />
            ),
        });
        resumeModalIdRef.current = modalId;

        return () => {
            if (resumeModalIdRef.current) {
                closeModal(resumeModalIdRef.current);
                resumeModalIdRef.current = null;
            }
        };
    }, [
        closeModal,
        openModal,
        progressKey,
        restorableProgress,
        shouldAskResume,
        runtime.gameId,
        runtime.tutorialId,
        runtime.tutorialManifest?.id,
        tLobby,
    ]);

    if (shouldAskResume) {
        return (
            <LoadingScreen
                anchor="container"
                title={runtime.title}
                description={tLobby('matchRoom.tutorialProgress.waitingChoice')}
                progressText={runtime.loadingProgressText}
            />
        );
    }

    return (
        <LocalGameProvider
            key={`${progressSeed}:${numPlayers}:${restartVersion}`}
            config={runtime.engineConfig}
            numPlayers={numPlayers}
            seed={progressSeed}
            playerId={playerID ?? '0'}
            setupData={setupData}
            onCommandRejected={runtime.onCommandRejected}
            seatControllers={runtime.seatControllers}
            followCurrentTurnPlayer={false}
            persistSession={Boolean(runtime.gameId)}
            persistGameId={runtime.gameId}
        >
            <TutorialDispatchBridge>
                <BoardBridge
                    board={runtime.board}
                    loading={(
                        <LoadingScreen
                            anchor="container"
                            title={runtime.title}
                            description={runtime.preparingDescription}
                            progressText={runtime.loadingProgressText}
                        />
                    )}
                />
            </TutorialDispatchBridge>
        </LocalGameProvider>
    );
};

export function MatchRoomTutorialBoardRuntime({ runtime }: { runtime: MatchRoomTutorialBoardRuntimeModel }) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const renderBoard = (numPlayers: number, setupData?: Record<string, unknown>) => (
        <TutorialLocalGameRuntime
            runtime={runtime}
            numPlayers={numPlayers}
            setupData={setupData}
        />
    );

    if (runtime.gameId === 'qidahen') {
        return (
            <QidahenPregameScenarioGate
                searchParams={searchParams}
                tutorialId={runtime.tutorialId}
                tutorialMode
                onSearchParamsChange={(nextSearchParams) => {
                    navigate(
                        {
                            search: `?${nextSearchParams.toString()}`,
                        },
                        { replace: true },
                    );
                }}
            >
                {({ numPlayers, setupData }) => renderBoard(numPlayers, setupData)}
            </QidahenPregameScenarioGate>
        );
    }

    return renderBoard(runtime.numPlayers ?? 2);
}
