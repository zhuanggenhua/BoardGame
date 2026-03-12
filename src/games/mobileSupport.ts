import type {
    GameManifestEntry,
    GameMobileLayoutPreset,
    GameMobileProfile,
    GameOrientationPreference,
    GameShellTarget,
} from './manifest.types';

export const MOBILE_MAX_VIEWPORT_WIDTH = 1023;

export type GameMobileBannerKind =
    | 'rotate-to-landscape'
    | 'rotate-to-portrait'
    | 'tablet-only'
    | 'not-supported';

export interface ResolvedGameMobileSupport {
    mobileProfile: GameMobileProfile;
    preferredOrientation?: GameOrientationPreference;
    mobileLayoutPreset?: GameMobileLayoutPreset;
    shellTargets: GameShellTarget[];
}

const DEFAULT_SHELL_TARGETS: GameShellTarget[] = ['pwa'];

export const isMobileViewport = (width: number) => width <= MOBILE_MAX_VIEWPORT_WIDTH;

export const isPortraitViewport = (width: number, height: number) => height > width;

export const extractGameIdFromPlayPath = (pathname: string) => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] !== 'play') return undefined;
    return segments[1];
};

export const resolveGameMobileSupport = (
    entry?: Pick<
        GameManifestEntry,
        'mobileProfile' | 'preferredOrientation' | 'mobileLayoutPreset' | 'shellTargets'
    > | null,
): ResolvedGameMobileSupport => {
    const mobileProfile = entry?.mobileProfile ?? 'none';
    const preferredOrientation = entry?.preferredOrientation
        ?? (mobileProfile === 'landscape-adapted'
            ? 'landscape'
            : mobileProfile === 'portrait-adapted'
                ? 'portrait'
                : undefined);
    const mobileLayoutPreset = entry?.mobileLayoutPreset
        ?? (mobileProfile === 'landscape-adapted'
            ? 'board-shell'
            : mobileProfile === 'portrait-adapted'
                ? 'portrait-simple'
                : undefined);
    const shellTargets = entry?.shellTargets?.length
        ? [...entry.shellTargets]
        : [...DEFAULT_SHELL_TARGETS];

    return {
        mobileProfile,
        preferredOrientation,
        mobileLayoutPreset,
        shellTargets,
    };
};

export const resolveGameManifestEntry = <T extends GameManifestEntry>(entry: T): T => {
    const support = resolveGameMobileSupport(entry);
    return {
        ...entry,
        ...support,
    };
};

export const getGamePageDataAttributes = (
    gameId?: string,
    entry?: Pick<
        GameManifestEntry,
        'mobileProfile' | 'preferredOrientation' | 'mobileLayoutPreset' | 'shellTargets'
    > | null,
) => {
    const attributes: Record<string, string> = {
        'data-game-page': 'true',
    };

    if (gameId) {
        attributes['data-game-id'] = gameId;
    }
    if (!entry) {
        return attributes;
    }

    const support = resolveGameMobileSupport(entry);
    attributes['data-mobile-profile'] = support.mobileProfile;
    attributes['data-shell-targets'] = support.shellTargets.join(',');
    if (support.preferredOrientation) {
        attributes['data-preferred-orientation'] = support.preferredOrientation;
    }
    if (support.mobileLayoutPreset) {
        attributes['data-mobile-layout-preset'] = support.mobileLayoutPreset;
    }

    return attributes;
};

export const getGameMobileBannerKind = (
    entry?: Pick<
        GameManifestEntry,
        'mobileProfile' | 'preferredOrientation' | 'mobileLayoutPreset' | 'shellTargets'
    > | null,
    width = 0,
    height = 0,
): GameMobileBannerKind | null => {
    if (!entry) return null;
    if (!isMobileViewport(width)) return null;

    const support = resolveGameMobileSupport(entry);
    const isPortrait = isPortraitViewport(width, height);

    if (support.mobileProfile === 'tablet-only') return 'tablet-only';
    if (support.mobileProfile === 'none') return 'not-supported';

    if (support.preferredOrientation === 'landscape' && isPortrait) {
        return 'rotate-to-landscape';
    }
    if (support.preferredOrientation === 'portrait' && !isPortrait) {
        return 'rotate-to-portrait';
    }

    return null;
};

export const shouldUseBoardShellScale = (
    entry?: Pick<
        GameManifestEntry,
        'mobileProfile' | 'preferredOrientation' | 'mobileLayoutPreset' | 'shellTargets'
    > | null,
    width = 0,
    height = 0,
) => {
    const support = resolveGameMobileSupport(entry);
    return isMobileViewport(width)
        && !isPortraitViewport(width, height)
        && support.mobileProfile === 'landscape-adapted'
        && support.mobileLayoutPreset === 'board-shell';
};
