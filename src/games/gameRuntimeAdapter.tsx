import type { ComponentType, ReactNode } from 'react';
import type { MatchState } from '../engine/types';

export type GameHudRuntimeMode = 'local' | 'online' | 'tutorial' | 'test';

export type GameHudRuntimeSuppressionInput = {
    gameId?: string;
    mode?: GameHudRuntimeMode;
    state?: MatchState<unknown> | null;
    playerId?: string | null;
};

export type GameHudForceDismissInput = {
    gameId?: string;
    state?: MatchState<unknown> | null;
    playerId?: string | null;
    dispatch: (type: string, payload?: Record<string, unknown>) => void;
};

export type GameRuntimeSettingsSectionProps = {
    t: (key: string) => string;
};

export type GameRuntimePageProviderProps = {
    children: ReactNode;
};

export type GameRuntimeSeatSwapMode = 'request' | 'instant';

export type GameRuntimeSeatSwapConfig = {
    mode: GameRuntimeSeatSwapMode;
    requestCommandType: string;
    respondCommandType?: string | null;
    cancelCommandType?: string | null;
};

export type GameRuntimeAdapter = {
    PageProvider?: ComponentType<GameRuntimePageProviderProps>;
    dismissTransientUi?: () => boolean;
    shouldSuppressHudFab?: (args: GameHudRuntimeSuppressionInput) => boolean;
    forceDismissHud?: (args: GameHudForceDismissInput) => boolean;
    HudSettingsSection?: ComponentType<GameRuntimeSettingsSectionProps>;
    seatSwap?: GameRuntimeSeatSwapConfig;
};

function DefaultGamePageRuntimeProvider({ children }: GameRuntimePageProviderProps) {
    return <>{children}</>;
}

export const defaultGameRuntimeAdapter: GameRuntimeAdapter = {
    PageProvider: DefaultGamePageRuntimeProvider,
    dismissTransientUi: () => false,
    shouldSuppressHudFab: () => false,
    forceDismissHud: () => false,
};
