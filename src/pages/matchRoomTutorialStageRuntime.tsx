import type { ComponentType } from 'react';
import type { GameBoardProps } from '../engine/transport/protocol';
import { BoardBridge, LocalGameProvider } from '../engine/transport/react';
import type { GameEngineConfig } from '../engine/transport/server';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { TutorialDispatchBridge } from './matchRoomBridges';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QidahenPregameScenarioGate } from '../games/qidahen/QidahenPregameScenarioGate';
import { useDebug } from '../contexts/DebugContext';

type MatchRoomBoardComponent = ComponentType<GameBoardProps>;

export type MatchRoomTutorialBoardRuntimeModel = {
    gameId?: string;
    tutorialId?: string;
    board: MatchRoomBoardComponent;
    engineConfig: GameEngineConfig;
    numPlayers?: number;
    onCommandRejected: (type: string, error: string) => void;
    title: string;
    preparingDescription: string;
    loadingProgressText?: string;
};

export function MatchRoomTutorialBoardRuntime({ runtime }: { runtime: MatchRoomTutorialBoardRuntimeModel }) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { playerID } = useDebug();

    const renderBoard = (numPlayers: number, setupData?: Record<string, unknown>) => (
        <LocalGameProvider
            config={runtime.engineConfig}
            numPlayers={numPlayers}
            seed={`tutorial-${runtime.gameId}`}
            playerId={playerID ?? '0'}
            setupData={setupData}
            onCommandRejected={runtime.onCommandRejected}
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
