import type { ReactNode } from 'react';
import { getGameImplementation } from './registry';
import {
    defaultGameRuntimeAdapter,
    type GameHudForceDismissInput,
    type GameHudRuntimeMode,
    type GameHudRuntimeSuppressionInput,
    type GameRuntimeSettingsSectionProps,
} from './gameRuntimeAdapter';

type GameHudRuntimeSettingsSectionPublicProps = GameRuntimeSettingsSectionProps & {
    gameId?: string;
};

export type { GameHudRuntimeMode };

export function shouldSuppressGameHudFab(args: GameHudRuntimeSuppressionInput): boolean {
    void args;
    return false;
}

export function tryHandleGameHudForceDismiss(args: GameHudForceDismissInput): boolean {
    return getGameImplementation(args.gameId ?? '')?.runtimeAdapter?.forceDismissHud?.(args)
        ?? defaultGameRuntimeAdapter.forceDismissHud?.(args)
        ?? false;
}

export function GameHudRuntimeSettingsSection({
    gameId,
    t,
}: GameHudRuntimeSettingsSectionPublicProps): ReactNode {
    const SettingsSection = getGameImplementation(gameId ?? '')?.runtimeAdapter?.HudSettingsSection;
    if (!SettingsSection) {
        return null;
    }

    return <SettingsSection t={t} />;
}
