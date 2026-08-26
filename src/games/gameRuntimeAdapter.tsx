import type { ComponentType, ReactNode } from 'react';
import type { MatchState } from '../engine/types';
import type { MatchSeatSwapConfig } from '../components/game/framework/matchSeatSwap';
import type { GameSetupSelections } from '../shared/gameSetupOptions';

export type GameHudRuntimeMode = 'local' | 'online' | 'tutorial' | 'test';

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

export type GameRuntimeSeatSwapMode = MatchSeatSwapConfig['mode'];
export type GameRuntimeSeatSwapConfig = MatchSeatSwapConfig;

export type GameRuntimeLocalSetupContext = {
    searchParams: URLSearchParams;
    tutorialId?: string;
    tutorialMode?: boolean;
};

export type GameRuntimeLocalSetupResult = {
    numPlayers: number;
    setupSelections?: GameSetupSelections;
    setupData?: Record<string, unknown>;
};

export type GameRuntimeLocalSetupGateProps = {
    mode: 'local';
    searchParams: URLSearchParams;
    initialSetup: GameRuntimeLocalSetupResult;
    onConfirm: (setup: GameRuntimeLocalSetupResult) => void;
};

export type GameRuntimeAdapter = {
    PageProvider?: ComponentType<GameRuntimePageProviderProps>;
    dismissTransientUi?: () => boolean;
    forceDismissHud?: (args: GameHudForceDismissInput) => boolean;
    HudSettingsSection?: ComponentType<GameRuntimeSettingsSectionProps>;
    seatSwap?: GameRuntimeSeatSwapConfig;
    resolveLocalSetup?: (context: GameRuntimeLocalSetupContext) => GameRuntimeLocalSetupResult | null;
    LocalSetupGate?: ComponentType<GameRuntimeLocalSetupGateProps>;
};

function DefaultGamePageRuntimeProvider({ children }: GameRuntimePageProviderProps) {
    return <>{children}</>;
}

export const defaultGameRuntimeAdapter: GameRuntimeAdapter = {
    PageProvider: DefaultGamePageRuntimeProvider,
    dismissTransientUi: () => false,
    forceDismissHud: () => false,
};
