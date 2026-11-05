import { startTransition, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import type { GameManifestEntry } from '../../shared/gameManifest.types';
import {
    extractGameIdFromPlayPath,
    getGameMobileBannerKind,
    isMobileViewport,
    resolveGameMobileSupport,
    type GameMobileBannerKind,
} from '../../shared/mobileSupport';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';
import {
    unlockScreenOrientation,
    tryLockScreenOrientation,
} from '../../lib/webFullscreen';
import { detectNativeMobileRuntime } from '../../lib/mobile/mobileRuntime';
import { isHomeEntryRoute } from '../../lib/homeV2Routing';

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
        unlock(): Promise<void>;
    };
};

let screenOrientationPluginLoader: Promise<ScreenOrientationPlugin | null> | null = null;
const ORIENTATION_SETTLE_TIMEOUT_MS = 1500;

const loadNativeScreenOrientationPlugin = async () => {
    if (!screenOrientationPluginLoader) {
        screenOrientationPluginLoader = import('@capacitor/screen-orientation')
            .then((module) => module as ScreenOrientationPlugin)
            .catch(() => null);
    }

    return screenOrientationPluginLoader;
};

const lockScreenByRoute = async (targetOrientation: 'landscape' | 'portrait', signal: AbortSignal): Promise<boolean> => {
    if (hasNativeMobileRuntime()) {
        const plugin = await loadNativeScreenOrientationPlugin();
        if (signal.aborted) return false;
        try {
            await plugin?.ScreenOrientation.lock({ orientation: targetOrientation });
            if (plugin) {
                return true;
            }
        } catch {
            // ignore and fallback below
        }
    }

    return signal.aborted ? false : tryLockScreenOrientation(targetOrientation);
};

const unlockScreenByRoute = async () => {
    unlockScreenOrientation();
    if (!hasNativeMobileRuntime()) return;
    const plugin = await loadNativeScreenOrientationPlugin();
    try { await plugin?.ScreenOrientation.unlock(); }
    catch { /* 释放失败不阻止离开游戏。 */ }
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
            return 'mobileOrientation.banner.unlockPortrait';
        case 'rotate-to-portrait':
            return 'mobileOrientation.banner.unlockPortrait';
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
    const [dynamicGameConfig, setDynamicGameConfig] = useState<{ gameId: string; entry: GameMobileEntry | undefined }>();
    const [lockResult, setLockResult] = useState<{ key: string; status: 'requesting' | 'accepted' | 'failed' } | null>(null);
    const gameId = extractGameIdFromPlayPath(location.pathname);
    const resolvedGameConfig = gameId ? resolveGameMobileEntry(gameId) : undefined;
    const gameConfig = resolvedGameConfig ?? (dynamicGameConfig && dynamicGameConfig.gameId === gameId ? dynamicGameConfig.entry : undefined);
    const targetOrientation = viewport.width > 0 && (isMobileViewport(viewport.width) || hasNativeMobileRuntime())
        ? isHomeEntryRoute(location.pathname) ? 'portrait'
            : gameId && gameConfig ? resolveGameMobileSupport(gameConfig).preferredOrientation ?? null : null
        : null;
    const attemptKey = targetOrientation ? `${location.pathname}:${targetOrientation}` : null;
    const bannerKind = gameId ? getGameMobileBannerKind(gameConfig, viewport.width, viewport.height) : null;
    const rotationHint = bannerKind === 'rotate-to-landscape' || bannerKind === 'rotate-to-portrait';
    const bannerKey = bannerKind ? `${location.pathname}:${bannerKind}` : null;
    const activeBannerKind = bannerKey && dismissedBannerKey !== bannerKey
        && (!rotationHint || (lockResult?.key === attemptKey && lockResult.status === 'failed')) ? bannerKind : null;

    useEffect(() => {
        if (!gameId || resolvedGameConfig || !loadGameMobileEntry) {
            setDynamicGameConfig(undefined);
            return;
        }
        let disposed = false;
        void loadGameMobileEntry(gameId).then(entry => {
            if (!disposed) startTransition(() => setDynamicGameConfig({ gameId, entry }));
        }).catch(() => { if (!disposed) setDynamicGameConfig(undefined); });
        return () => { disposed = true; };
    }, [gameId, loadGameMobileEntry, resolvedGameConfig]);

    useEffect(() => {
        if (!bannerKey) setDismissedBannerKey(null);
    }, [bannerKey]);

    // 首页保持竖屏，游戏遵循各自配置；只有游戏切换失败才显示方向提示。
    useEffect(() => {
        if (!targetOrientation || !attemptKey) return;
        const controller = new AbortController();
        let request = 0;
        const attempt = async () => {
            const currentRequest = ++request;
            setLockResult({ key: attemptKey, status: 'requesting' });
            const success = await lockScreenByRoute(targetOrientation, controller.signal);
            if (!controller.signal.aborted && request === currentRequest) setLockResult({ key: attemptKey, status: success ? 'accepted' : 'failed' });
        };
        const retry = () => { if (!document.hidden) void attempt(); };
        void attempt();
        document.addEventListener('visibilitychange', retry);
        window.addEventListener('focus', retry);
        window.addEventListener('orientationchange', retry);
        return () => {
            controller.abort();
            document.removeEventListener('visibilitychange', retry);
            window.removeEventListener('focus', retry);
            window.removeEventListener('orientationchange', retry);
            void unlockScreenByRoute();
        };
    }, [attemptKey, targetOrientation]);

    // 部分系统会接受锁定请求但不旋转；等待系统布局稳定后，以真实视口方向判断。
    useEffect(() => {
        if (!rotationHint || !attemptKey || lockResult?.key !== attemptKey || lockResult.status !== 'accepted') return;
        const timer = window.setTimeout(() => {
            setLockResult(current => current?.key === attemptKey && current.status === 'accepted'
                ? { key: attemptKey, status: 'failed' } : current);
        }, ORIENTATION_SETTLE_TIMEOUT_MS);
        return () => window.clearTimeout(timer);
    }, [attemptKey, rotationHint, lockResult?.key, lockResult?.status]);

    return (
        <>
            {activeBannerKind ? (
                <div
                    data-testid="mobile-orientation-game-banner"
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
