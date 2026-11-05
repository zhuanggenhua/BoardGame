import type { FabMenuPosition } from '../../../system/FabMenu';

export type GameHudLayoutInput = {
    viewportWidth: number;
    viewportHeight: number;
    isSetupPhase: boolean;
    state: unknown;
};

export type GameHudFabLayout = {
    position?: FabMenuPosition;
    storageKey?: string;
    legacyOffsetStorageKey?: string;
    initialOffset?: { left?: number; top?: number };
};

export type GameHudLayoutResolver = (input: GameHudLayoutInput) => GameHudFabLayout;
