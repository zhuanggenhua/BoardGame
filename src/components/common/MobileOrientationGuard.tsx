import { startTransition, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { UI_Z_INDEX } from '../../core';
import { GAME_MANIFEST_BY_ID } from '../../games/manifest';
import type { GameManifestEntry } from '../../games/manifest';
import {
    extractGameIdFromPlayPath,
    getGameMobileBannerKind,
    isMobileViewport,
    isPortraitViewport,
    resolveGameMobileSupport,
    type GameMobileBannerKind,
} from '../../games/mobileSupport';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';
import {
    isBookHomeRoute,
    isHomeEntryRoute,
    subscribeHomeEntryStyleChange,
} from '../../lib/homeV2Routing';

type GameMobileEntry = Pick<
    GameManifestEntry,
    'mobileProfile' | 'preferredOrientation' | 'mobileLayoutPreset' | 'shellTargets' | 'mobileDelivery'
>;

const hasCapacitorRuntime = () => {
    if (typeof window === 'undefined') return false;
    const runtime = (window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (typeof runtime?.isNativePlatform !== 'function') return false;
    try {
        return runtime.isNativePlatform();
    } catch {
        return false;
    }
};

type CapacitorCoreModule = {
    Capacitor: {
        isNativePlatform(): boolean;
    };
};

type ScreenOrientationModule = {
    ScreenOrientation: {
        lock(options: { orientation: 'landscape' | 'portrait' }): Promise<void>;
    };
};

let capacitorCoreLoader: Promise<CapacitorCoreModule | null> | null = null;
let screenOrientationLoader: Promise<ScreenOrientationModule | null> | null = null;

const runtimeImport = async <TModule,>(specifier: string): Promise<TModule> => {
    const importer = new Function('s', 'return import(s)') as (value: string) => Promise<TModule>;
    return importer(specifier);
};

const loadCapacitorCore = async (): Promise<CapacitorCoreModule | null> => {
    if (!capacitorCoreLoader) {
        capacitorCoreLoader = runtimeImport<CapacitorCoreModule>('@capacitor/core')
            .then(module => module as CapacitorCoreModule)
            .catch(() => null);
    }

    return capacitorCoreLoader;
};

const loadScreenOrientation = async (): Promise<ScreenOrientationModule | null> => {
    if (!screenOrientationLoader) {
        screenOrientationLoader = runtimeImport<ScreenOrientationModule>('@capacitor/screen-orientation')
            .then(module => module as ScreenOrientationModule)
            .catch(() => null);
    }

    return screenOrientationLoader;
};

const isNativeAppShell = async () => {
    if (!hasCapacitorRuntime()) {
        return false;
    }
    const capacitorCore = await loadCapacitorCore();
    return capacitorCore?.Capacitor.isNativePlatform() ?? false;
};

const lockScreenOrientationFallback = async (orientation: 'landscape' | 'portrait'): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    const orientationApi = window.screen?.orientation as (ScreenOrientation & {
        lock?: (orientation: 'landscape' | 'portrait') => Promise<void>;
    }) | undefined;
    if (typeof orientationApi?.lock !== 'function') return false;
    try {
        await orientationApi.lock(orientation);
        return true;
    } catch {
        return false;
    }
};

const lockScreenByRoute = async (targetOrientation: 'landscape' | 'portrait'): Promise<boolean> => {
    try {
        const screenOrientation = await loadScreenOrientation();
        if (screenOrientation) {
            await screenOrientation.ScreenOrientation.lock({ orientation: targetOrientation });
            return true;
        }
    } catch {
        // ignore and fallback below
    }

    return lockScreenOrientationFallback(targetOrientation);
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

const getBannerMessage = (bannerKind: GameMobileBannerKind) => {
    switch (bannerKind) {
        case 'rotate-to-landscape':
            return '建议旋转至横屏以获得更佳体验';
        case 'rotate-to-portrait':
            return '建议切换为竖屏以获得更佳体验';
        case 'tablet-only':
            return '该游戏当前优先支持平板或 PC 端';
        case 'not-supported':
            return '该游戏暂未完成手机适配，建议使用 PC 端';
    }
};

const getHomeOrientationGateCopy = (bookStyle: boolean) => ({
    title: bookStyle ? '书本主页需要横屏' : '经典主页需要竖屏',
    description: bookStyle
        ? '当前主页样式按横屏构图验收，切到横屏后再继续。'
        : '当前主页样式按竖屏信息流验收，切回竖屏后再继续。',
});

export function MobileOrientationGuard({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const viewport = useRuntimeViewport({ syncCssVars: true });
    const [dismissedBannerKey, setDismissedBannerKey] = useState<string | null>(null);
    const [nativeAppShell, setNativeAppShell] = useState(() => hasCapacitorRuntime());
    const nativeAppShellRef = useRef(nativeAppShell);
    const [dynamicGameConfig, setDynamicGameConfig] = useState<GameMobileEntry | undefined>(undefined);
    const [homeEntryStyleRevision, setHomeEntryStyleRevision] = useState(0);
    nativeAppShellRef.current = nativeAppShell;

    const gameId = extractGameIdFromPlayPath(location.pathname);
    const isHomeRoute = isHomeEntryRoute(location.pathname);
    void homeEntryStyleRevision;
    const isBookHomeEntry = isBookHomeRoute(location.pathname, location.search);
    const isHomeV2Route = isBookHomeEntry;
    const builtInGameConfig = gameId ? GAME_MANIFEST_BY_ID[gameId] : undefined;
    const gameConfig = builtInGameConfig ?? dynamicGameConfig;
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
    const shouldShowForcedHomeOrientationGate = isHomeRoute && homeBannerKind !== null && !nativeAppShell;
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
        if (!gameId || builtInGameConfig) {
            setDynamicGameConfig(undefined);
            return;
        }

        let disposed = false;
        let unsubscribe: (() => void) | undefined;

        const syncRegistryGameConfig = (getGameById: (id: string) => GameMobileEntry | undefined) => {
            const nextGameConfig = getGameById(gameId);
            startTransition(() => {
                setDynamicGameConfig(nextGameConfig);
            });
        };

        void import('../../config/games.config')
            .then(({ getGameById, subscribeGameRegistry }) => {
                if (disposed) {
                    return;
                }

                syncRegistryGameConfig(getGameById);
                unsubscribe = subscribeGameRegistry(() => {
                    syncRegistryGameConfig(getGameById);
                });
            })
            .catch(() => {
                if (!disposed) {
                    setDynamicGameConfig(undefined);
                }
            });

        return () => {
            disposed = true;
            unsubscribe?.();
        };
    }, [builtInGameConfig, gameId]);

    useEffect(() => {
        if (nativeAppShellRef.current) return;

        let disposed = false;

        void isNativeAppShell().then((value) => {
            if (!disposed && nativeAppShellRef.current !== value) {
                setNativeAppShell(value);
            }
        });

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
        if (!nativeAppShell || !targetOrientation) return;

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
    }, [nativeAppShell, targetOrientation, location.pathname]);

    return (
        <>
            {shouldShowForcedHomeOrientationGate ? (
                <div
                    data-testid="mobile-orientation-home-gate"
                    className="fixed inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(61,44,30,0.96)_0%,rgba(23,17,12,0.985)_58%,rgba(10,8,6,1)_100%)] px-6 py-8 text-[#f4e7cb]"
                    style={{
                        zIndex: UI_Z_INDEX.hud - 1,
                        paddingTop: 'calc(env(safe-area-inset-top) + 1.5rem)',
                        paddingRight: 'calc(env(safe-area-inset-right) + 1.5rem)',
                        paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)',
                        paddingLeft: 'calc(env(safe-area-inset-left) + 1.5rem)',
                    }}
                >
                    <div className="flex w-full max-w-[22rem] flex-col items-center text-center">
                        <div className="mb-5 flex items-center justify-center gap-3 text-[#e7d0a0]">
                            {renderBannerVisual(homeBannerKind)}
                        </div>
                        <div className="font-serif text-[1.45rem] font-semibold leading-tight text-[#f7ead1]">
                            {getHomeOrientationGateCopy(isBookHomeEntry).title}
                        </div>
                        <div className="mt-3 max-w-[18rem] text-[0.95rem] leading-6 text-[#dbc8a8]">
                            {getHomeOrientationGateCopy(isBookHomeEntry).description}
                        </div>
                    </div>
                </div>
            ) : null}
            {activeBannerKind ? (
                <div
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
                            <span>{getBannerMessage(activeBannerKind)}</span>
                        </div>
                        <button
                            onClick={() => setDismissedBannerKey(bannerKey)}
                            className="flex-shrink-0 p-1 hover:bg-parchment-gold/20 rounded transition-colors"
                            aria-label="关闭提示"
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
