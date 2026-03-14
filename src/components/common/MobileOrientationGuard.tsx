import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { getGameById, subscribeGameRegistry } from '../../config/games.config';
import {
    extractGameIdFromPlayPath,
    getGameMobileBannerKind,
    type GameMobileBannerKind,
} from '../../games/mobileSupport';

const getViewport = () => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
});

const isNativeAppShell = () => Capacitor.isNativePlatform();

const lockScreenOrientationFallback = async (orientation: 'landscape' | 'portrait') => {
    if (typeof window === 'undefined') return;
    const orientationApi = window.screen?.orientation;
    if (!orientationApi?.lock) return;
    await orientationApi.lock(orientation).catch(() => undefined);
};

const lockScreenByRoute = async (isGameRoute: boolean) => {
    const targetOrientation = isGameRoute ? 'landscape' : 'portrait';

    try {
        await ScreenOrientation.lock({ orientation: targetOrientation });
        return;
    } catch {
        await lockScreenOrientationFallback(targetOrientation);
    }
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
    const [viewport, setViewport] = useState(getViewport);
    const [dismissedBannerKey, setDismissedBannerKey] = useState<string | null>(null);
    const [, forceRegistryVersion] = useState(0);
    const nativeAppShell = isNativeAppShell();

    const gameId = extractGameIdFromPlayPath(location.pathname);
    const gameConfig = gameId ? getGameById(gameId) : undefined;
    const bannerKind = getGameMobileBannerKind(gameConfig, viewport.width, viewport.height);
    const bannerKey = bannerKind ? `${location.pathname}:${bannerKind}` : null;
    const shouldSuppressBannerInAppShell = nativeAppShell && Boolean(gameId);
    const activeBannerKind = !shouldSuppressBannerInAppShell && bannerKey && dismissedBannerKey !== bannerKey
        ? bannerKind
        : null;

    useEffect(() => {
        const updateViewport = () => {
            setViewport(getViewport());
        };

        updateViewport();
        window.addEventListener('resize', updateViewport);
        window.addEventListener('orientationchange', updateViewport);

        return () => {
            window.removeEventListener('resize', updateViewport);
            window.removeEventListener('orientationchange', updateViewport);
        };
    }, []);

    useEffect(() => {
        return subscribeGameRegistry(() => {
            forceRegistryVersion((version) => version + 1);
        });
    }, []);

    useEffect(() => {
        if (!bannerKey) {
            setDismissedBannerKey(null);
        }
    }, [bannerKey]);

    useEffect(() => {
        if (!nativeAppShell) return;
        void lockScreenByRoute(Boolean(gameId));
    }, [nativeAppShell, gameId]);

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
