import type { ComponentType } from 'react';
import type { GameBoardProps } from '../engine/transport/protocol';
import { BoardBridge, LocalGameProvider } from '../engine/transport/react';
import type { GameEngineConfig } from '../engine/transport/server';
import { LoadingScreen } from '../components/system/LoadingScreen';
import { TutorialDispatchBridge } from './matchRoomBridges';

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
    return (
        <LocalGameProvider
            config={runtime.engineConfig}
            numPlayers={2}
            seed={`tutorial-${runtime.gameId}`}
            playerId="0"
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
}
