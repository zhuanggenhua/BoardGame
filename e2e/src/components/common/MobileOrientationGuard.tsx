import { startTransition, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { GAME_MANIFEST_BY_ID } from '../../games/manifest';
import type { GameManifestEntry } from '../../games/manifest';
import {
    extractGameIdFromPlayPath,
    getGameMobileBannerKind,
    resolveGameMobileSupport,
    type GameMobileBannerKind,
} from '../../games/mobileSupport';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';
import { isHomeV2PreviewRoute } from '../../lib/homeV2Routing';

type GameMobileEntry = Pick<
    GameManifestEntry,
    'mobileProfile' | 'preferredOrientation' | 'mobileLayoutPreset' | 'shellTargets' | 'mobileDelivery'
>;

const hasCapacitorRuntime = () => {
    if (typeof window === 'undefined') return false;
    const runtime = (window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return typeof runtime?.isNativePlatform === 'function';
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
    const orientationApi = window.screen?.orientation;
    if (!orientationApi?.lock) return false;
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

export function MobileOrientationGuard({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const viewport = useRuntimeViewport({ syncCssVars: true });
    const [dismissedBannerKey, setDismissedBannerKey] = useState<string | null>(null);
    const [nativeAppShell, setNativeAppShell] = useState(false);
    const [dynamicGameConfig, setDynamicGameConfig] = useState<GameMobileEntry | undefined>(undefined);

    const gameId = extractGameIdFromPlayPath(location.pathname);
    const isHomeV2Route = isHomeV2PreviewRoute(location.pathname);
    const builtInGameConfig = gameId ? GAME_MANIFEST_BY_ID[gameId] : undefined;
    const gameConfig = builtInGameConfig ?? dynamicGameConfig;
    const preferredOrientation = gameId
        ? resolveGameMobileSupport(gameConfig).preferredOrientation
        : undefined;
    const targetOrientation: 'landscape' | 'portrait' | null = gameId
        ? (preferredOrientation === 'landscape' ? 'landscape' : 'portrait')
        : isHomeV2Route
            ? 'landscape'
            : null;
    const bannerKind = getGameMobileBannerKind(gameConfig, viewport.width, viewport.height);
    const bannerKey = bannerKind ? `${location.pathname}:${bannerKind}` : null;
    const shouldSuppressBannerInAppShell = nativeAppShell && Boolean(gameId);
    const activeBannerKind = !shouldSuppressBannerInAppShell && bannerKey && dismissedBannerKey !== bannerKey
        ? bannerKind
        : null;

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
        let disposed = false;

        void isNativeAppShell().then((value) => {
            if (!disposed) {
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

        // 首屏进入时做多次重试，规避插件桥接尚未就绪导致的首次加锁失败
        for (const delay of [0, 150, 500, 1200]) {
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
