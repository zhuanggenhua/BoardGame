import type { ReactNode } from 'react';
import type { AiSeatController } from '../engine/ai';
import type { OnlineAiRecoveryEngineConfig } from '../engine/transport/onlineAiRecovery';

export type ManualSetupSeatDispatch = (playerId: string, type: string, payload: unknown) => boolean;

export type OnlineManualSetupSelectionBridgeProps = {
    children: ReactNode;
    seatControllers: Record<string, AiSeatController>;
    dispatchManualSetupCommand: ManualSetupSeatDispatch | null;
    engineConfig?: OnlineAiRecoveryEngineConfig | null;
};
