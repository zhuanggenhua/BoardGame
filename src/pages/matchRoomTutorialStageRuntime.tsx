import type { ComponentType } from 'react';
import type { GameBoardProps } from '../engine/transport/protocol';
import { BoardBridge, LocalGameProvider } from '../engine/transport/react';
import type { GameEngineConfig } from '../engine/transport/server';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { TutorialDispatchBridge } from './matchRoomBridges';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QidahenPregameScenarioGate } from '../games/qidahen/QidahenPregameScenarioGate';

type MatchRoomBoardComponent = ComponentType<GameBoardProps>;

export type MatchRoomTutorialBoardRuntimeModel = {
    gameId?: string;
    board: MatchRoomBoardComponent;
    engineConfig: GameEngineConfig;
    onCommandRejected: (type: string, error: string) => void;
    title: string;
    preparingDescription: string;
    loadingProgressText?: string;
};

export function MatchRoomTutorialBoardRuntime({ runtime }: { runtime: MatchRoomTutorialBoardRuntimeModel }) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const renderBoard = (numPlayers: number, setupData?: Record<string, unknown>) => (
        <LocalGameProvider
            config={runtime.engineConfig}
            numPlayers={numPlayers}
            seed={`tutorial-${runtime.gameId}`}
            playerId="0"
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

    return (
        renderBoard(2)
    );
}
