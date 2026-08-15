import { startTransition, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import type { GameManifestEntry } from '../../shared/gameManifest.types';
import {
    extractGameIdFromPlayPath,
    getGameMobileBannerKind,
    isMobileViewport,
    isPortraitViewport,
    resolveGameMobileSupport,
    type GameMobileBannerKind,
} from '../../shared/mobileSupport';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';
import {
    isBookHomeRoute,
    isHomeEntryRoute,
    subscribeHomeEntryStyleChange,
} from '../../lib/homeV2Routing';
import {
    isStandaloneWebApp,
    tryLockScreenOrientation,
} from '../../lib/webFullscreen';
import { detectNativeMobileRuntime } from '../../lib/mobile/mobileRuntime';

export type GameMobileEntry = Pick<
    GameManifestEntry,
    'mobileProfile' | 'preferredOrientation' | 'mobileLayoutPreset' | 'shellTargets' | 'mobileDelivery'
>;

interface MobileOrientationGuardProps {
    children: React.ReactNode;
    resolveGameMobileEntry: (gameId: string) => GameMobileEntry | undefined;
    loadGameMobileEntry?: (gameId: string) => Promise<GameMobileEntry | undefined>;
}

const hasNativeMobileRuntime = () => detectNativeMobileRuntime();

type ScreenOrientationPlugin = {
    ScreenOrientation: {
        lock(options: { orientation: 'landscape' | 'portrait' }): Promise<void>;
    };
};

let screenOrientationPluginLoader: Promise<ScreenOrientationPlugin | null> | null = null;

const loadNativeScreenOrientationPlugin = async () => {
    if (!screenOrientationPluginLoader) {
        screenOrientationPluginLoader = import('@capacitor/screen-orientation')
            .then((module) => module as ScreenOrientationPlugin)
            .catch(() => null);
    }

    return screenOrientationPluginLoader;
};

const lockScreenByRoute = async (targetOrientation: 'landscape' | 'portrait'): Promise<boolean> => {
    if (hasNativeMobileRuntime()) {
        const plugin = await loadNativeScreenOrientationPlugin();
        try {
            await plugin?.ScreenOrientation.lock({ orientation: targetOrientation });
            if (plugin) {
                return true;
            }
        } catch {
            // ignore and fallback below
        }
    }

    return tryLockScreenOrientation(targetOrientation);
};

const renderBannerVisual = (bannerKind: GameMobileBannerKind) => {
    if (bannerKind === 'rotate-to-landscape' || bannerKind === 'rotate-to-portrait') {
        const showPortraitFirst = bannerKind === 'rotate-to-landscape';
        return (
            <>
                {showPortraitFirst ? (
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="7" y="2" width="10" height="20" rx="2" />
                        <line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="7" width="20" height="10" rx="2" />
                        <line x1="18" y1="12" x2="18" y2="12" strokeLinecap="round" />
                    </svg>
                )}
                <svg className="w-4 h-4 flex-shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 7h10v10" />
                    <path d="M7 17 17 7" />
                </svg>
                {showPortraitFirst ? (
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="7" width="20" height="10" rx="2" />
                        <line x1="18" y1="12" x2="18" y2="12" strokeLinecap="round" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="7" y="2" width="10" height="20" rx="2" />
                        <line x1="12" y1="18" x2="12" y2="18" strokeLinecap="round" />
                    </svg>
                )}
            </>
        );
    }

    return (
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8" />
            <path d="M12 16v4" />
        </svg>
    );
};

const getBannerMessageKey = (bannerKind: GameMobileBannerKind) => {
    switch (bannerKind) {
        case 'rotate-to-landscape':
            return 'mobileOrientation.banner.rotateToLandscape';
        case 'rotate-to-portrait':
            return 'mobileOrientation.banner.rotateToPortrait';
        case 'tablet-only':
            return 'mobileOrientation.banner.tabletOnly';
        case 'not-supported':
            return 'mobileOrientation.banner.notSupported';
    }
};

export function MobileOrientationGuard({
    children,
    resolveGameMobileEntry,
    loadGameMobileEntry,
}: MobileOrientationGuardProps) {
    const { t } = useTranslation('common');
    const location = useLocation();
    const viewport = useRuntimeViewport({ syncCssVars: true });
    const [dismissedBannerKey, setDismissedBannerKey] = useState<string | null>(null);
    const [nativeAppShell, setNativeAppShell] = useState(() => hasNativeMobileRuntime());
    const nativeAppShellRef = useRef(nativeAppShell);
    const standaloneWebApp = isStandaloneWebApp();
    const [dynamicGameConfig, setDynamicGameConfig] = useState<GameMobileEntry | undefined>(undefined);
    const [homeEntryStyleRevision, setHomeEntryStyleRevision] = useState(0);
    nativeAppShellRef.current = nativeAppShell;

    const gameId = extractGameIdFromPlayPath(location.pathname);
    const isHomeRoute = isHomeEntryRoute(location.pathname);
    void homeEntryStyleRevision;
    const isBookHomeEntry = isBookHomeRoute(location.pathname, location.search);
    const isHomeV2Route = isBookHomeEntry;
    const resolvedGameConfig = gameId ? resolveGameMobileEntry(gameId) : undefined;
    const gameConfig = resolvedGameConfig ?? dynamicGameConfig;
    const preferredOrientation = gameId
        ? resolveGameMobileSupport(gameConfig).preferredOrientation
        : undefined;
    const targetOrientation: 'landscape' | 'portrait' | null = gameId
        ? (preferredOrientation === 'landscape' ? 'landscape' : 'portrait')
        : isHomeV2Route
            ? 'landscape'
            : isHomeRoute
                ? 'portrait'
                : null;
    const homeBannerKind: GameMobileBannerKind | null = isHomeRoute && isMobileViewport(viewport.width)
        ? (
            isBookHomeEntry
                ? (isPortraitViewport(viewport.width, viewport.height) ? 'rotate-to-landscape' : null)
                : (!isPortraitViewport(viewport.width, viewport.height) ? 'rotate-to-portrait' : null)
        )
        : null;
    const bannerKind = homeBannerKind ?? getGameMobileBannerKind(gameConfig, viewport.width, viewport.height);
    const bannerKey = bannerKind ? `${location.pathname}:${bannerKind}` : null;
    const shouldSuppressBannerInAppShell = nativeAppShell && (Boolean(gameId) || isHomeRoute);
    const activeBannerKind = !shouldSuppressBannerInAppShell && bannerKey && dismissedBannerKey !== bannerKey
        ? bannerKind
        : null;

    useEffect(() => {
        return subscribeHomeEntryStyleChange(() => {
            setHomeEntryStyleRevision((value) => value + 1);
        });
    }, []);
    useEffect(() => {
        if (!gameId || resolvedGameConfig || !loadGameMobileEntry) {
            setDynamicGameConfig(undefined);
            return;
        }

        let disposed = false;

        void loadGameMobileEntry(gameId)
            .then((nextGameConfig) => {
                if (!disposed) {
                    startTransition(() => {
                        setDynamicGameConfig(nextGameConfig);
                    });
                }
            })
            .catch(() => {
                if (!disposed) {
                    setDynamicGameConfig(undefined);
                }
            });

        return () => {
            disposed = true;
        };
    }, [gameId, loadGameMobileEntry, resolvedGameConfig]);

    useEffect(() => {
        if (nativeAppShellRef.current) return;

        let disposed = false;

        const value = hasNativeMobileRuntime();
        if (!disposed && nativeAppShellRef.current !== value) {
            setNativeAppShell(value);
        }

        return () => {
            disposed = true;
        };
    }, []);

    useEffect(() => {
        if (!bannerKey) {
            setDismissedBannerKey(null);
        }
    }, [bannerKey]);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const offsetValue = activeBannerKind
            ? 'calc(env(safe-area-inset-top) + 3.75rem)'
            : '0px';
        const rootStyle = document.documentElement.style;
        const bodyStyle = document.body?.style;

        rootStyle.setProperty('--mobile-orientation-banner-offset', offsetValue);
        bodyStyle?.setProperty('--mobile-orientation-banner-offset', offsetValue);

        return () => {
            rootStyle.setProperty('--mobile-orientation-banner-offset', '0px');
            bodyStyle?.setProperty('--mobile-orientation-banner-offset', '0px');
        };
    }, [activeBannerKind]);

    useEffect(() => {
        if ((!nativeAppShell && !standaloneWebApp) || !targetOrientation) return;

        let disposed = false;
        const timeoutIds: number[] = [];

        const lockNow = () => {
            if (disposed) return;
            void lockScreenByRoute(targetOrientation);
        };

        lockNow();

        // 首屏进入时做多次重试，规避插件桥接尚未就绪导致的首次加锁失败
        for (const delay of [150, 500, 1200]) {
            const id = window.setTimeout(() => {
                lockNow();
            }, delay);
            timeoutIds.push(id);
        }

        const handleVisibilityChange = () => {
            if (document.hidden) return;
            lockNow();
        };

        const handleFocus = () => {
            lockNow();
        };

        const handleOrientationChange = () => {
            lockNow();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('orientationchange', handleOrientationChange);

        return () => {
            disposed = true;
            for (const timeoutId of timeoutIds) {
                window.clearTimeout(timeoutId);
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('orientationchange', handleOrientationChange);
        };
    }, [nativeAppShell, standaloneWebApp, targetOrientation, location.pathname]);

    return (
        <>
            {activeBannerKind ? (
                <div
                    data-testid={gameId ? 'mobile-orientation-game-banner' : 'mobile-orientation-home-banner'}
                    className="fixed top-0 left-0 right-0 bg-parchment-brown/95 backdrop-blur-sm text-parchment-cream pb-3 z-[9999] shadow-lg border-b-2 border-parchment-gold/30"
                    style={{
                        paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
                        paddingLeft: 'calc(env(safe-area-inset-left) + 1rem)',
                        paddingRight: 'calc(env(safe-area-inset-right) + 1rem)',
                    }}
                >
                    <div className="flex items-center justify-between gap-3 max-w-4xl mx-auto">
                        <div className="flex items-center gap-3 text-sm font-serif">
                            {renderBannerVisual(activeBannerKind)}
                            <span>{t(getBannerMessageKey(activeBannerKind))}</span>
                        </div>
                        <button
                            onClick={() => setDismissedBannerKey(bannerKey)}
                            className="flex-shrink-0 p-1 hover:bg-parchment-gold/20 rounded transition-colors"
                            aria-label={t('mobileOrientation.closeHint')}
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>
            ) : null}
            {children}
        </>
    );
}
