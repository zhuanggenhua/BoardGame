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
import { HudPortal } from '../../../core/ui/portal';
import { warmPreloadScheduler } from './warmPreloadScheduler';
import { AudioManager } from '../../../lib/audio/AudioManager';
import type { SoundKey } from '../../../lib/audio/types';
import { COMMON_AUDIO_BASE_PATH, loadCommonAudioRegistry } from '../../../lib/audio/commonRegistry';
import { criticalImageGateReadyRunKeys } from './CriticalImageGateCache';

export interface CriticalImageGateProps {
    gameId?: string;
    gameState?: unknown;
    locale?: string;
    playerID?: string | null;
    enabled?: boolean;
    /** 为 false 时只在后台预加载，不阻塞 Board 首次渲染。 */
    blockRendering?: boolean;
    loadingDescription?: string;
    blockingAudioKeys?: SoundKey[];
    /** 每次 phaseKey 变化后，首次就绪时触发。 */
    onReady?: () => void;
    /** 阻塞式加载屏显示/隐藏时通知外层壳层。 */
    onBlockingChange?: (blocking: boolean) => void;
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
    blockingAudioKeys,
    onReady,
    onBlockingChange,
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
    const inFlightRunKeyRef = useRef<string | null>(null);
    const preloadRequestIdRef = useRef(0);
    const lastReadyKeyRef = useRef<string | null>(null);
    const lastWarmRunKeyRef = useRef<string | null>(null);
    const latestRunKeyRef = useRef('');
    const onReadyRef = useRef(onReady);
    const onBlockingChangeRef = useRef(onBlockingChange);
    const blockingAudioSignature = useMemo(
        () => Array.from(new Set((blockingAudioKeys ?? []).filter(Boolean))).sort().join('|'),
        [blockingAudioKeys],
    );
    const normalizedBlockingAudioKeys = useMemo(
        () => Array.from(new Set((blockingAudioKeys ?? []).filter(Boolean))),
        [blockingAudioKeys],
    );

    const stateKey = gameState ? 'ready' : 'empty';

    const phaseKey = useMemo(() => {
        if (!effectiveEnabled || !gameId || !gameState) return '';
        const resolved = resolveCriticalImages(gameId, gameState, locale, playerID);
        return resolved.phaseKey ?? '';
    }, [effectiveEnabled, gameId, gameState, locale, playerID]);

    const runKey = `${gameId ?? ''}:${locale ?? ''}:${phaseKey}:${stateKey}`;
    // eslint-disable-next-line react-hooks/refs
    latestRunKeyRef.current = runKey;

    const needsPreload = effectiveEnabled
        && !!gameId
        && stateKey === 'ready'
        // eslint-disable-next-line react-hooks/refs
        && lastReadyKeyRef.current !== runKey;

    if (needsPreload && gameId && gameState && criticalImageGateReadyRunKeys.has(runKey)) {
        // eslint-disable-next-line react-hooks/refs
        lastReadyKeyRef.current = runKey;
        const resolved = resolveCriticalImages(gameId, gameState, locale, playerID);
        if ((resolved.critical?.length ?? 0) > 0) {
            signalCriticalImagesReady();
        }
    } else if (
        needsPreload
        && gameId
        && gameState
        && !blockingAudioSignature
        && areAllCriticalImagesCached(gameId, gameState, locale, playerID)
    ) {
        // eslint-disable-next-line react-hooks/refs
        lastReadyKeyRef.current = runKey;
        criticalImageGateReadyRunKeys.add(runKey);
        const resolved = resolveCriticalImages(gameId, gameState, locale, playerID);
        if ((resolved.critical?.length ?? 0) > 0) {
            signalCriticalImagesReady();
        }
    }

    const effectiveNeedsPreload = effectiveEnabled
        && !!gameId
        && stateKey === 'ready'
        // eslint-disable-next-line react-hooks/refs
        && lastReadyKeyRef.current !== runKey;

    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        onReadyRef.current = onReady;
    }, [onReady]);

    useEffect(() => {
        onBlockingChangeRef.current = onBlockingChange;
    }, [onBlockingChange]);

    useEffect(() => {
        // 教程启动常通过 useLayoutEffect 同步推进 state。
        // 当前 render 对应的 passive effect 真正执行时，组件可能已经带着新的 runKey 重渲染过。
        // 这里必须跳过旧 render 遗留的 preload，避免“教程前状态”和“教程后状态”各跑一轮。
        if (runKey !== latestRunKeyRef.current) {
            return;
        }

        if (!effectiveEnabled || !gameId) {
            const shouldNotifyReady = lastReadyKeyRef.current !== runKey;
            setReady(true);
            inFlightRunKeyRef.current = null;
            preloadRequestIdRef.current += 1;
            lastReadyKeyRef.current = runKey;
            lastWarmRunKeyRef.current = null;
            signalCriticalImagesReady();
            if (shouldNotifyReady) {
                onReadyRef.current?.();
            }
            return;
        }

        if (stateKey !== 'ready') {
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
            if (!ready) {
                queueMicrotask(() => setReady(true));
            }
            onReadyRef.current?.();
            return;
        }

        const resolved = resolveCriticalImages(gameId, currentState, locale, playerID);
        const hasCriticalImages = (resolved.critical?.length ?? 0) > 0;

        // 空 critical 阶段（如教程 setup）应快速放行：
        // 不阻塞 Board，也不放行音频，等待后续真正有关键图的阶段再 signal。
        if (!hasCriticalImages) {
            lastReadyKeyRef.current = runKey;
            lastWarmRunKeyRef.current = runKey;
            inFlightRunKeyRef.current = null;
            setLoadingProgress(undefined);
            queueMicrotask(() => setReady(true));
            onReadyRef.current?.();
            return;
        }

        if (!blockingAudioSignature && areAllCriticalImagesCached(gameId, currentState, locale, playerID)) {
            lastReadyKeyRef.current = runKey;
            criticalImageGateReadyRunKeys.add(runKey);
            cancelWarmPreload();
            preloadWarmImages(resolved.warm, locale, gameId);
            lastWarmRunKeyRef.current = runKey;
            queueMicrotask(() => setReady(true));
            signalCriticalImagesReady();
            onReadyRef.current?.();
            return;
        }

        if (inFlightRunKeyRef.current === runKey) {
            return;
        }

        const requestId = preloadRequestIdRef.current + 1;
        preloadRequestIdRef.current = requestId;
        inFlightRunKeyRef.current = runKey;
        setReady(false);
        setLoadingProgress(undefined);

        const criticalImageTotal = resolved.critical?.length ?? 0;
        const blockingAudioTotal = normalizedBlockingAudioKeys.length;
        const totalAssets = criticalImageTotal + blockingAudioTotal;
        let imageLoadedCount = 0;
        let audioLoadedCount = 0;
        const updateCombinedProgress = () => {
            if (totalAssets <= 0) {
                setLoadingProgress(undefined);
                return;
            }
            setLoadingProgress({
                loaded: imageLoadedCount + audioLoadedCount,
                total: totalAssets,
            });
        };

        updateCombinedProgress();

        const preloadPromise = preloadCriticalImages(
            gameId,
            currentState,
            locale,
            playerID,
            (loaded, total) => {
                imageLoadedCount = total > 0 ? loaded : 0;
                updateCombinedProgress();
            },
        );
        const blockingAudioPromise = normalizedBlockingAudioKeys.length > 0
            ? loadCommonAudioRegistry()
                .then((registry) => {
                    AudioManager.registerRegistryEntries(registry.entries, COMMON_AUDIO_BASE_PATH);
                    return AudioManager.preloadBlockingKeys(
                        normalizedBlockingAudioKeys,
                        (loaded, total) => {
                            audioLoadedCount = total > 0 ? loaded : 0;
                            updateCombinedProgress();
                        },
                    );
                })
            : Promise.resolve();
        const epoch = getCriticalImagesEpoch();

        Promise.all([preloadPromise, blockingAudioPromise])
            .then(([warmPaths]) => {
                if (requestId !== preloadRequestIdRef.current || runKey !== latestRunKeyRef.current) {
                    return;
                }
                lastReadyKeyRef.current = runKey;
                criticalImageGateReadyRunKeys.add(runKey);
                setReady(true);
                onReadyRef.current?.();
                warmPreloadScheduler.enqueue(warmPaths, locale, gameId);
                lastWarmRunKeyRef.current = runKey;
                if (hasCriticalImages) {
                    signalCriticalImagesReady(epoch);
                }
            })
            .catch((err) => {
                if (requestId !== preloadRequestIdRef.current || runKey !== latestRunKeyRef.current) {
                    return;
                }
                console.error('[CriticalImageGate] 预加载失败', err);
                lastReadyKeyRef.current = runKey;
                criticalImageGateReadyRunKeys.add(runKey);
                setReady(true);
                onReadyRef.current?.();
                signalCriticalImagesReady(epoch);
            })
            .finally(() => {
                if (requestId === preloadRequestIdRef.current && inFlightRunKeyRef.current === runKey) {
                    inFlightRunKeyRef.current = null;
                }
            });
    }, [blockingAudioSignature, effectiveEnabled, gameId, locale, normalizedBlockingAudioKeys, playerID, ready, runKey, stateKey]);

    const shouldBlock = blockRendering && (
        effectiveNeedsPreload
        // eslint-disable-next-line react-hooks/refs
        || (!ready && lastReadyKeyRef.current !== runKey)
    );

    useEffect(() => {
        onBlockingChangeRef.current?.(shouldBlock);
    }, [shouldBlock]);

    useEffect(() => () => {
        onBlockingChangeRef.current?.(false);
    }, []);

    if (shouldBlock) {
        const useViewportAnchor = typeof document !== 'undefined'
            && document.documentElement.getAttribute('data-mobile-layout-preset') === 'board-shell';
        const loadingAnchor = useViewportAnchor ? 'viewport' : 'container';
        const progressText = loadingProgress
            ? t('matchRoom.loadingProgress.loadingAssets', { loaded: loadingProgress.loaded, total: loadingProgress.total })
            : undefined;
        const loadingScreen = (
            <LoadingScreen anchor={loadingAnchor} description={loadingDescription} progressText={progressText} />
        );
        if (loadingAnchor === 'viewport') {
            return <HudPortal>{loadingScreen}</HudPortal>;
        }
        return loadingScreen;
    }

    return <>{children}</>;
};
