import type {
    GameManifestEntry,
    GameManifestMobileDelivery,
    GameMobileBattlefieldZoom,
    GameMobileBoardShellLayout,
    GameMobileLayoutPreset,
    GameMobileProfile,
    GameOrientationPreference,
    GameShellTarget,
} from './gameManifest.types';

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
    mobileBattlefieldZoom: GameMobileBattlefieldZoom;
    shellTargets: GameShellTarget[];
    mobileDelivery: GameManifestMobileDelivery;
    mobileBoardShellLayout?: GameMobileBoardShellLayout;
}

export interface RuntimeViewportSize {
    width: number;
    height: number;
}

export interface MobileLayoutEngineCapabilities {
    chromiumMajorVersion: number | null;
    layoutMode: 'legacy' | 'modern';
    supportsCalcDivision: boolean;
    supportsDynamicViewportUnits: boolean;
    requiresJsScaleFallback: boolean;
    requiresLegacyViewportFallback: boolean;
}

export interface RuntimeLayoutScaleMetrics {
    designWidth: number;
    scale: number;
    inverseScale: number;
    logicalHeight: number;
    inlineUnit: number;
    blockUnit: number;
}

const GAME_PAGE_DOCUMENT_ATTRIBUTE_KEYS = [
    'data-game-page',
    'data-game-id',
    'data-mobile-profile',
    'data-preferred-orientation',
    'data-mobile-layout-preset',
    'data-mobile-battlefield-zoom',
    'data-shell-targets',
    'data-mobile-board-shell-design-width',
    'data-mobile-board-shell-design-height',
    'data-mobile-board-shell-min-logical-height',
    'data-mobile-board-shell-min-readable-scale',
] as const;

type GamePageDocumentAttributeKey = typeof GAME_PAGE_DOCUMENT_ATTRIBUTE_KEYS[number];

const DEFAULT_SHELL_TARGETS: GameShellTarget[] = ['pwa'];
const DEFAULT_RUNTIME_CHANNEL = 'stable';

const isUsableViewportDimension = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

const stringifyPositiveNumber = (value: number | undefined) =>
    typeof value === 'number' && Number.isFinite(value) && value > 0
        ? String(value)
        : undefined;

export const isMobileViewport = (width: number) => width <= MOBILE_MAX_VIEWPORT_WIDTH;

export const isPortraitViewport = (width: number, height: number) => height > width;

export const extractGameIdFromPlayPath = (pathname: string) => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments[0] !== 'play') return undefined;
    return segments[1];
};

const DEFAULT_LAYOUT_SUPPORTS = (property: string, value: string) => {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
        return true;
    }
    return CSS.supports(property, value);
};

export const parseChromiumMajorVersion = (userAgent?: string | null) => {
    if (!userAgent) return null;
    const match = userAgent.match(/(?:Chrome|Chromium|CriOS)\/(\d+)/i);
    if (!match) return null;
    const major = Number.parseInt(match[1], 10);
    return Number.isFinite(major) ? major : null;
};

export const detectMobileLayoutEngineCapabilities = ({
    userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
    cssSupports = DEFAULT_LAYOUT_SUPPORTS,
}: {
    userAgent?: string | null;
    cssSupports?: (property: string, value: string) => boolean;
} = {}): MobileLayoutEngineCapabilities => {
    const chromiumMajorVersion = parseChromiumMajorVersion(userAgent);
    const supportsCalcDivision = cssSupports('transform', 'scale(calc(100px / 50px))');
    const supportsDynamicViewportUnits = cssSupports('height', '100dvh');
    const isLegacyChromium = chromiumMajorVersion !== null && chromiumMajorVersion < 100;
    const requiresJsScaleFallback = isLegacyChromium || !supportsCalcDivision;
    const requiresLegacyViewportFallback = isLegacyChromium || !supportsDynamicViewportUnits;

    return {
        chromiumMajorVersion,
        layoutMode: requiresJsScaleFallback || requiresLegacyViewportFallback ? 'legacy' : 'modern',
        supportsCalcDivision,
        supportsDynamicViewportUnits,
        requiresJsScaleFallback,
        requiresLegacyViewportFallback,
    };
};

export const resolveRuntimeLayoutScaleMetrics = (
    viewport: RuntimeViewportSize,
    designWidth: number,
): RuntimeLayoutScaleMetrics => {
    const safeDesignWidth = Math.max(1, designWidth);
    const scale = Math.max(0.01, viewport.width / safeDesignWidth);
    const inverseScale = 1 / scale;
    const logicalHeight = viewport.height * inverseScale;

    return {
        designWidth: safeDesignWidth,
        scale,
        inverseScale,
        logicalHeight,
        inlineUnit: safeDesignWidth / 100,
        blockUnit: logicalHeight / 100,
    };
};

export const resolveGameMobileSupport = (
    entry?: Pick<
        GameManifestEntry,
        'mobileProfile'
        | 'preferredOrientation'
        | 'mobileLayoutPreset'
        | 'mobileBattlefieldZoom'
        | 'shellTargets'
        | 'mobileDelivery'
        | 'mobileBoardShellLayout'
    > | null,
): ResolvedGameMobileSupport => {
    const mobileProfile = entry?.mobileProfile ?? 'none';
    const preferredOrientation = entry?.preferredOrientation
        ?? (mobileProfile === 'landscape-adapted'
            ? 'landscape'
            : mobileProfile === 'portrait-adapted'
                ? 'portrait'
                : 'landscape');
    const mobileLayoutPreset = entry?.mobileLayoutPreset
        ?? (mobileProfile === 'landscape-adapted'
            ? 'board-shell'
            : mobileProfile === 'portrait-adapted'
                ? 'portrait-simple'
                : undefined);
    const mobileBattlefieldZoom = entry?.mobileBattlefieldZoom ?? 'none';
    const shellTargets = entry?.shellTargets?.length
        ? [...entry.shellTargets]
        : [...DEFAULT_SHELL_TARGETS];
    const canUsePackageManagedDelivery = shellTargets.includes('app-webview');
    const requestedDeliveryMode = entry?.mobileDelivery?.mode ?? 'builtin';
    const deliveryMode = requestedDeliveryMode === 'package-managed' && canUsePackageManagedDelivery
        ? 'package-managed'
        : 'builtin';
    const requiredAppVersion = entry?.mobileDelivery?.requiredAppVersion?.trim();
    const mobileDelivery = deliveryMode === 'package-managed'
        ? {
            mode: 'package-managed' as const,
            runtimeChannel: entry?.mobileDelivery?.runtimeChannel?.trim() || DEFAULT_RUNTIME_CHANNEL,
            modulePackId: entry?.mobileDelivery?.modulePackId?.trim(),
            assetPackId: entry?.mobileDelivery?.assetPackId?.trim(),
            ...(entry?.mobileDelivery?.requiresAppUpdate === true ? { requiresAppUpdate: true } : {}),
            ...(requiredAppVersion ? { requiredAppVersion } : {}),
        }
        : {
            mode: 'builtin' as const,
        };

    return {
        mobileProfile,
        preferredOrientation,
        mobileLayoutPreset,
        mobileBattlefieldZoom,
        shellTargets,
        mobileDelivery,
        ...(entry?.mobileBoardShellLayout ? { mobileBoardShellLayout: { ...entry.mobileBoardShellLayout } } : {}),
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
        'mobileProfile'
        | 'preferredOrientation'
        | 'mobileLayoutPreset'
        | 'mobileBattlefieldZoom'
        | 'shellTargets'
        | 'mobileDelivery'
        | 'mobileBoardShellLayout'
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
    if (support.mobileBattlefieldZoom) {
        attributes['data-mobile-battlefield-zoom'] = support.mobileBattlefieldZoom;
    }

    const boardShellLayout = support.mobileBoardShellLayout;
    const designWidth = stringifyPositiveNumber(boardShellLayout?.designWidth);
    const designHeight = stringifyPositiveNumber(boardShellLayout?.designHeight);
    const minLogicalHeight = stringifyPositiveNumber(boardShellLayout?.minLogicalHeight);
    const minReadableScale = stringifyPositiveNumber(boardShellLayout?.minReadableScale);
    if (designWidth) {
        attributes['data-mobile-board-shell-design-width'] = designWidth;
    }
    if (designHeight) {
        attributes['data-mobile-board-shell-design-height'] = designHeight;
    }
    if (minLogicalHeight) {
        attributes['data-mobile-board-shell-min-logical-height'] = minLogicalHeight;
    }
    if (minReadableScale) {
        attributes['data-mobile-board-shell-min-readable-scale'] = minReadableScale;
    }

    return attributes;
};

export const syncGamePageDocumentAttributes = (
    attributes: Partial<Record<GamePageDocumentAttributeKey, string>>,
) => {
    if (typeof document === 'undefined') {
        return () => {};
    }

    const targets = [document.documentElement, document.body];
    const snapshots = targets.map((target) =>
        Object.fromEntries(
            GAME_PAGE_DOCUMENT_ATTRIBUTE_KEYS.map((key) => [key, target.getAttribute(key)]),
        ) as Record<GamePageDocumentAttributeKey, string | null>,
    );

    targets.forEach((target) => {
        GAME_PAGE_DOCUMENT_ATTRIBUTE_KEYS.forEach((key) => {
            const value = attributes[key];
            if (value) {
                target.setAttribute(key, value);
                return;
            }

            target.removeAttribute(key);
        });
    });

    return () => {
        targets.forEach((target, index) => {
            const snapshot = snapshots[index];
            GAME_PAGE_DOCUMENT_ATTRIBUTE_KEYS.forEach((key) => {
                const value = snapshot[key];
                if (value === null) {
                    target.removeAttribute(key);
                    return;
                }

                target.setAttribute(key, value);
            });
        });
    };
};

export const getGameMobileBannerKind = (
    entry?: Pick<
        GameManifestEntry,
        'mobileProfile' | 'preferredOrientation' | 'mobileLayoutPreset' | 'shellTargets'
        | 'mobileDelivery'
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
        'mobileProfile' | 'preferredOrientation' | 'mobileLayoutPreset' | 'shellTargets' | 'mobileDelivery'
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

export const resolveStableViewportSize = (
    previous: RuntimeViewportSize,
    ...candidates: Array<Partial<RuntimeViewportSize> | null | undefined>
): RuntimeViewportSize => {
    const pickDimension = (key: keyof RuntimeViewportSize) => {
        for (const candidate of candidates) {
            const value = candidate?.[key];
            if (isUsableViewportDimension(value)) {
                return value;
            }
        }
        return previous[key];
    };

    return {
        width: pickDimension('width'),
        height: pickDimension('height'),
    };
};
