import type { ComponentType } from 'react';
import type {
    GameRuntimeAdapter,
    GameRuntimeLocalSetupGateProps,
    GameRuntimeLocalSetupResult,
} from '../../games/gameRuntimeAdapter';
import type { GameSetupSelections } from '../../shared/gameSetupOptions';
import type { RoomConfig } from './CreateRoomModal';

type CreateRoomSetupGateComponent = ComponentType<GameRuntimeLocalSetupGateProps>;

export type PendingCreateRoomSetupGate = {
    Gate: CreateRoomSetupGateComponent;
    config: RoomConfig;
    initialSetup: GameRuntimeLocalSetupResult;
    searchParams: URLSearchParams;
};

function cloneUnknownValue<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item) => cloneUnknownValue(item)) as T;
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .map(([key, entry]) => [key, cloneUnknownValue(entry)]),
        ) as T;
    }
    return value;
}

function cloneSetupSelections(selections: GameSetupSelections | undefined): GameSetupSelections {
    if (!selections) return {};
    return Object.fromEntries(
        Object.entries(selections).map(([key, value]) => [key, cloneUnknownValue(value)]),
    ) as GameSetupSelections;
}

function cloneSetupData(setupData: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!setupData) return {};
    return cloneUnknownValue(setupData);
}

export function resolveCreateRoomSetupGateState(args: {
    runtimeAdapter?: GameRuntimeAdapter | null;
    config: RoomConfig;
}): PendingCreateRoomSetupGate | null {
    const Gate = args.runtimeAdapter?.CreateRoomSetupGate;
    if (!Gate) {
        return null;
    }

    const initialSetup = args.runtimeAdapter.resolveCreateRoomSetup?.({
        numPlayers: args.config.numPlayers,
        setupSelections: args.config.setupSelections,
        setupData: args.config.setupData,
    }) ?? {
        numPlayers: args.config.numPlayers,
        setupSelections: cloneSetupSelections(args.config.setupSelections),
        setupData: args.config.setupData ? cloneSetupData(args.config.setupData) : undefined,
    };

    return {
        Gate,
        config: args.config,
        initialSetup,
        searchParams: new URLSearchParams(),
    };
}

export function mergeRoomConfigWithSetupResult(
    config: RoomConfig,
    setup: GameRuntimeLocalSetupResult,
): RoomConfig {
    const setupSelections = {
        ...cloneSetupSelections(config.setupSelections),
        ...cloneSetupSelections(setup.setupSelections),
    };
    const setupData = {
        ...cloneSetupData(config.setupData),
        ...cloneSetupData(setup.setupData),
        ...(Object.keys(setupSelections).length > 0 ? { setupSelections } : {}),
    };

    return {
        ...config,
        numPlayers: setup.numPlayers,
        setupSelections,
        setupData: Object.keys(setupData).length > 0 ? setupData : undefined,
    };
}
