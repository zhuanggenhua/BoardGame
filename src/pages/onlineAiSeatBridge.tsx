import { useRef } from 'react';
import { useGameClient } from '../engine/transport/react';
import type { GameEngineConfig } from '../engine/transport/server';
import type { MatchState } from '../engine/types';
import type { AiSeatController } from '../engine/ai';
import type { ManualSetupSeatDispatch } from './onlineManualSetup.types';
import { useOnlineAiSeatAutoDispatch } from './useOnlineAiSeatAutoDispatch';
import { useOnlineAiSeatAutoRecovery } from './useOnlineAiSeatAutoRecovery';
import { useOnlineAiSeatManualRecovery } from './useOnlineAiSeatManualRecovery';
import { useOnlineAiSeatTransportRuntime } from './useOnlineAiSeatTransportRuntime';

type OnlineAiSeatBridgeProps = {
    server: string;
    matchId: string;
    engineConfig: GameEngineConfig;
    seatControllers: Record<string, AiSeatController>;
    seatCredentials: Record<string, string>;
    onForceEndAiPhaseReady?: (handler: (() => Promise<boolean>) | null) => void;
    onManualSetupDispatchReady?: (handler: ManualSetupSeatDispatch | null) => void;
};

export const OnlineAiSeatBridge = ({
    server,
    matchId,
    engineConfig,
    seatControllers,
    seatCredentials,
    onForceEndAiPhaseReady,
    onManualSetupDispatchReady,
}: OnlineAiSeatBridgeProps) => {
    const { state } = useGameClient();
    const sharedState = state && typeof state === 'object'
        ? state as MatchState<unknown>
        : null;
    const lastAiAttemptKeyRef = useRef<string | null>(null);
    const runtime = useOnlineAiSeatTransportRuntime({
        server,
        matchId,
        engineConfig,
        seatControllers,
        seatCredentials,
        onManualSetupDispatchReady,
        state: sharedState,
    });

    useOnlineAiSeatAutoDispatch({
        matchId,
        engineConfig,
        state: sharedState,
        seatControllers,
        seatCredentials,
        lastAiAttemptKeyRef,
        runtime,
    });

    useOnlineAiSeatAutoRecovery({
        state: sharedState,
        engineConfig,
        lastAiAttemptKeyRef,
        seatControllers,
        runtime,
    });

    useOnlineAiSeatManualRecovery({
        state: sharedState,
        engineConfig,
        matchId,
        seatControllers,
        lastAiAttemptKeyRef,
        runtime,
        onForceEndAiPhaseReady,
    });

    return null;
};
