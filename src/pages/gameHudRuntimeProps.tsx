import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import {
    getAvailableGameEmotes,
    getGameEmoteById,
} from '../games/emotes';
import { GameHudRuntimeSettingsSection } from '../games/gameHudRuntimeAdapter';
import { resolveGameMobileSupport } from '../shared/mobileSupport';
import type { GameManifestEntry } from '../shared/gameManifest.types';
import type { EmoteDefinition } from '../shared/emotes';
import { resolveGameHudLayout } from '../games/gameHudLayout';
import type { GameHudLayoutResolver } from '../components/game/framework/widgets/gameHudLayout';

type GameHudRuntimeGameConfig = Pick<
    GameManifestEntry,
    'mobileProfile'
    | 'preferredOrientation'
    | 'mobileLayoutPreset'
    | 'mobileBattlefieldZoom'
    | 'mobileHudPlacement'
    | 'shellTargets'
    | 'mobileDelivery'
> | null | undefined;

export type GameHudPlacement = 'in-shell' | 'portal';

export function resolveGameHudPlacement(
    gameConfig?: GameHudRuntimeGameConfig,
): GameHudPlacement {
    if (gameConfig?.mobileHudPlacement) {
        return gameConfig.mobileHudPlacement;
    }
    return resolveGameMobileSupport(gameConfig).mobileLayoutPreset === 'board-shell'
        ? 'in-shell'
        : 'portal';
}

export function buildGameHudRuntimeProps(args: {
    gameId?: string | null;
    gameConfig?: GameHudRuntimeGameConfig;
    resolveHudLayout?: GameHudLayoutResolver;
}): {
    preferredFullscreenOrientation?: GameManifestEntry['preferredOrientation'];
    renderRuntimeSettings?: (t: TFunction) => ReactNode;
    availableEmotes: readonly EmoteDefinition[];
    resolveEmote: (emoteId: string) => EmoteDefinition | undefined;
    resolveHudLayout?: GameHudLayoutResolver;
} {
    return {
        preferredFullscreenOrientation: args.gameConfig
            ? resolveGameMobileSupport(args.gameConfig).preferredOrientation
            : undefined,
        renderRuntimeSettings: (t) => (
            <GameHudRuntimeSettingsSection gameId={args.gameId ?? undefined} t={t} />
        ),
        availableEmotes: getAvailableGameEmotes(args.gameId),
        resolveEmote: getGameEmoteById,
        resolveHudLayout: resolveGameHudLayout(args.gameId, args.resolveHudLayout),
    };
}
