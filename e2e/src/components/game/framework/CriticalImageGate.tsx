import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingScreen } from '../../system/LoadingScreen';
import {
    areAllCriticalImagesCached,
    cancelWarmPreload,
    getCriticalImagesEpoch,
    preloadCriticalImages,
    preloadWarmImages,
    signalCriticalImagesReady,
} from '../../../core';
import { resolveCriticalImages } from '../../../core/CriticalImageResolverRegistry';
import { warmPreloadScheduler } from './warmPreloadScheduler';

const criticalImageGateWindow = typeof window !== 'undefined'
    ? window as Window & {
        __BG_CRITICAL_IMAGE_GATE_READY_RUN_KEYS__?: Set<string>;
    }
    : undefined;

if (criticalImageGateWindow && !criticalImageGateWindow.__BG_CRITICAL_IMAGE_GATE_READY_RUN_KEYS__) {
    criticalImageGateWindow.__BG_CRITICAL_IMAGE_GATE_READY_RUN_KEYS__ = new Set<string>();
}

const readyRunKeys = criticalImageGateWindow?.__BG_CRITICAL_IMAGE_GATE_READY_RUN_KEYS__
    ?? new Set<string>();

export function __resetCriticalImageGateCacheForTests(): void {
    readyRunKeys.clear();
}

export interface CriticalImageGateProps {
    gameId?: string;
    gameState?: unknown;
    locale?: string;
    playerID?: string | null;
    enabled?: boolean;
    /** 为 false 时只在后台预加载，不阻塞 Board 首次渲染。 */
    blockRendering?: boolean;
    loadingDescription?: string;
    /** 每次 phaseKey 变化后，首次就绪时触发。 */
    onReady?: () => void;
    children: React.ReactNode;
}

/**
 * 关键图片预加载门禁。
 *
 * 只在当前阶段所需的关键图片未就绪时阻塞 Board。
 * 当 phaseKey 变化但关键图已经命中缓存时，仍会重排 warm 队列，
 * 避免上一阶段的低优先级暖加载继续抢占连接池。
 */
export const CriticalImageGate: React.FC<CriticalImageGateProps> = ({
    gameId,
    gameState,
    locale,
    playerID,
    enabled = true,
    blockRendering = true,
    loadingDescription,
    onReady,
    children,
}) => {
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                warmPreloadScheduler.pause();
            } else {
                warmPreloadScheduler.resume();
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        onVisibilityChange();
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    // E2E 测试可通过 window.__E2E_SKIP_IMAGE_GATE__ 跳过图片预加载门禁
    const skipGate = typeof window !== 'undefined'
        && (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ === true;
    const effectiveEnabled = enabled && !skipGate;

    const { t } = useTranslation('lobby');
    const [ready, setReady] = useState(!effectiveEnabled);
    const [loadingProgress, setLoadingProgress] = useState<{ loaded: number; total: number } | undefined>(undefined);

    const gameStateRef = useRef(gameState);
    const inFlightRef = useRef(false);
    const lastReadyKeyRef = useRef<string | null>(null);
    const lastWarmRunKeyRef = useRef<string | null>(null);
    const pendingRunKeyRef = useRef<string | null>(null);
    const [retryTick, setRetryTick] = useState(0);

    const stateKey = gameState ? 'ready' : 'empty';

    const phaseKey = useMemo(() => {
        if (!effectiveEnabled || !gameId || !gameState) return '';
        const resolved = resolveCriticalImages(gameId, gameState, locale, playerID);
        return resolved.phaseKey ?? '';
    }, [effectiveEnabled, gameId, gameState, locale, playerID]);

    const runKey = `${gameId ?? ''}:${locale ?? ''}:${phaseKey}:${stateKey}`;
    const latestRunKeyRef = useRef(runKey);
    latestRunKeyRef.current = runKey;

    const needsPreload = effectiveEnabled
        && !!gameId
        && stateKey === 'ready'
        && lastReadyKeyRef.current !== runKey;

    if (needsPreload && gameId && gameState && readyRunKeys.has(runKey)) {
        lastReadyKeyRef.current = runKey;
        const resolved = resolveCriticalImages(gameId, gameState, locale, playerID);
        if ((resolved.critical?.length ?? 0) > 0) {
            signalCriticalImagesReady();
        }
    } else if (
        needsPreload
        && gameId
        && gameState
        && areAllCriticalImagesCached(gameId, gameState, locale, playerID)
    ) {
        lastReadyKeyRef.current = runKey;
        readyRunKeys.add(runKey);
        const resolved = resolveCriticalImages(gameId, gameState, locale, playerID);
        if ((resolved.critical?.length ?? 0) > 0) {
            signalCriticalImagesReady();
        }
    }

    const effectiveNeedsPreload = effectiveEnabled
        && !!gameId
        && stateKey === 'ready'
        && lastReadyKeyRef.current !== runKey;

    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        // 教程启动常通过 useLayoutEffect 同步推进 state。
        // 当前 render 对应的 passive effect 真正执行时，组件可能已经带着新的 runKey 重渲染过。
        // 这里必须跳过旧 render 遗留的 preload，避免“教程前状态”和“教程后状态”各跑一轮。
        if (runKey !== latestRunKeyRef.current) {
            return;
        }

        if (!effectiveEnabled || !gameId) {
            setReady(true);
            inFlightRef.current = false;
            lastReadyKeyRef.current = null;
            lastWarmRunKeyRef.current = null;
            pendingRunKeyRef.current = null;
            signalCriticalImagesReady();
            return;
        }

        if (stateKey !== 'ready') {
            return;
        }

        if (inFlightRef.current) {
            if (lastReadyKeyRef.current !== runKey) {
                pendingRunKeyRef.current = runKey;
            }
            return;
        }

        const currentState = gameStateRef.current;
        if (!currentState) {
            return;
        }

        if (lastReadyKeyRef.current === runKey) {
            if (lastWarmRunKeyRef.current !== runKey) {
                const resolved = resolveCriticalImages(gameId, currentState, locale, playerID);
                cancelWarmPreload();
                preloadWarmImages(resolved.warm, locale, gameId);
                lastWarmRunKeyRef.current = runKey;
            }
            if (!ready) setReady(true);
            onReady?.();
            return;
        }

        pendingRunKeyRef.current = null;
        inFlightRef.current = true;
        setReady(false);
        setLoadingProgress(undefined);

        const resolved = resolveCriticalImages(gameId, currentState, locale, playerID);
        const hasCriticalImages = (resolved.critical?.length ?? 0) > 0;

        // 空 critical 阶段（如教程 setup）应快速放行：
        // 不阻塞 Board，也不放行音频，等待后续真正有关键图的阶段再 signal。
        if (!hasCriticalImages) {
            lastReadyKeyRef.current = runKey;
            lastWarmRunKeyRef.current = runKey;
            inFlightRef.current = false;
            setLoadingProgress(undefined);
            setReady(true);
            onReady?.();
            return;
        }

        const preloadPromise = preloadCriticalImages(
            gameId,
            currentState,
            locale,
            playerID,
            (loaded, total) => {
                setLoadingProgress({ loaded, total });
            },
        );
        const epoch = getCriticalImagesEpoch();

        preloadPromise
            .then((warmPaths) => {
                if (runKey !== latestRunKeyRef.current) {
                    return;
                }
                lastReadyKeyRef.current = runKey;
                readyRunKeys.add(runKey);
                setReady(true);
                onReady?.();
                warmPreloadScheduler.enqueue(warmPaths, locale, gameId);
                lastWarmRunKeyRef.current = runKey;
                if (hasCriticalImages) {
                    signalCriticalImagesReady(epoch);
                }
            })
            .catch((err) => {
                if (runKey !== latestRunKeyRef.current) {
                    return;
                }
                console.error('[CriticalImageGate] 预加载失败', err);
                lastReadyKeyRef.current = runKey;
                readyRunKeys.add(runKey);
                setReady(true);
                onReady?.();
                signalCriticalImagesReady(epoch);
            })
            .finally(() => {
                inFlightRef.current = false;
                if (runKey !== latestRunKeyRef.current && !pendingRunKeyRef.current) {
                    pendingRunKeyRef.current = latestRunKeyRef.current;
                }
                if (pendingRunKeyRef.current) {
                    pendingRunKeyRef.current = null;
                    setRetryTick((tick) => tick + 1);
                }
            });
    }, [effectiveEnabled, gameId, locale, playerID, ready, retryTick, runKey, stateKey]);

    const shouldBlock = blockRendering && (
        effectiveNeedsPreload || (!ready && lastReadyKeyRef.current !== runKey)
    );
    if (shouldBlock) {
        const useViewportAnchor = typeof document !== 'undefined'
            && document.documentElement.getAttribute('data-mobile-layout-preset') === 'board-shell';
        const loadingAnchor = useViewportAnchor ? 'viewport' : 'container';
        const progressText = loadingProgress
            ? t('matchRoom.loadingProgress.loadingAssets', { loaded: loadingProgress.loaded, total: loadingProgress.total })
            : undefined;
        return <LoadingScreen anchor={loadingAnchor} description={loadingDescription} progressText={progressText} />;
    }

    return <>{children}</>;
};
