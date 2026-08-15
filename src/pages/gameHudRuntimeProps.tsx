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

type GameHudRuntimeGameConfig = Pick<
    GameManifestEntry,
    'mobileProfile'
    | 'preferredOrientation'
    | 'mobileLayoutPreset'
    | 'mobileBattlefieldZoom'
    | 'shellTargets'
    | 'mobileDelivery'
> | null | undefined;

export function buildGameHudRuntimeProps(args: {
    gameId?: string | null;
    gameConfig?: GameHudRuntimeGameConfig;
}): {
    preferredFullscreenOrientation?: GameManifestEntry['preferredOrientation'];
    renderRuntimeSettings?: (t: TFunction) => ReactNode;
    availableEmotes: readonly EmoteDefinition[];
    resolveEmote: (emoteId: string) => EmoteDefinition | undefined;
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
    };
}
