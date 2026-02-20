import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LoadingScreen } from '../../system/LoadingScreen';
import { preloadCriticalImages, preloadWarmImages, areAllCriticalImagesCached } from '../../../core';
import { resolveCriticalImages } from '../../../core/CriticalImageResolverRegistry';

export interface CriticalImageGateProps {
    gameId?: string;
    gameState?: unknown;
    locale?: string;
    playerID?: string | null;
    enabled?: boolean;
    loadingDescription?: string;
    /** 首次预加载完成后回调（每次 phaseKey 变化后重新触发） */
    onReady?: () => void;
    children: React.ReactNode;
}

/**
 * 关键图片预加载门禁
 * 在关键资源加载完成前，阻塞棋盘渲染。
 *
 * 通过 resolver 返回的 phaseKey 感知游戏阶段变化，
 * 阶段切换时会重新触发预加载（如 factionSelect → playing）。
 *
 * 关键设计：phaseKey 变化时同步立即阻塞（不等 useEffect），
 * 避免 Board 在资源未就绪时渲染一帧导致卡图不完整。
 */
export const CriticalImageGate: React.FC<CriticalImageGateProps> = ({
    gameId,
    gameState,
    locale,
    playerID,
    enabled = true,
    loadingDescription,
    onReady,
    children,
}) => {
    // E2E 测试可通过 window.__E2E_SKIP_IMAGE_GATE__ 跳过图片预加载门禁
    const skipGate = typeof window !== 'undefined'
        && (window as Window & { __E2E_SKIP_IMAGE_GATE__?: boolean }).__E2E_SKIP_IMAGE_GATE__ === true;
    const effectiveEnabled = enabled && !skipGate;

    const [ready, setReady] = useState(!effectiveEnabled);
    const inFlightRef = useRef(false);
    const lastReadyKeyRef = useRef<string | null>(null);
    const gameStateRef = useRef(gameState);
    const stateKey = gameState ? 'ready' : 'empty';

    const phaseKey = useMemo(() => {
        if (!effectiveEnabled || !gameId || !gameState) return '';
        const resolved = resolveCriticalImages(gameId, gameState, locale, playerID);
        return resolved.phaseKey ?? '';
    }, [effectiveEnabled, gameId, gameState, locale, playerID]);

    const runKey = `${gameId ?? ''}:${locale ?? ''}:${phaseKey}:${stateKey}`;

    // 同步判断：runKey 变了但还没完成预加载 → 立即阻塞
    // 这比 useEffect 里的 setReady(false) 更早生效，避免 children 渲染一帧
    const needsPreload = effectiveEnabled && !!gameId && stateKey === 'ready'
        && lastReadyKeyRef.current !== runKey;

    // 同步快速路径：如果所有关键图片已在缓存中，直接标记完成，跳过异步预加载。
    // 典型场景：页面刷新后浏览器磁盘缓存命中 → preloadedImages Map 已填充 →
    // 无需再走 useEffect 异步流程（至少 2-3 帧 LoadingScreen 闪烁）。
    if (needsPreload && gameId && gameState
        && areAllCriticalImagesCached(gameId, gameState, locale, playerID)) {
        lastReadyKeyRef.current = runKey;
    }

    // 重新计算：快速路径可能已更新 lastReadyKeyRef
    const effectiveNeedsPreload = effectiveEnabled && !!gameId && stateKey === 'ready'
        && lastReadyKeyRef.current !== runKey;

    // 记录 inFlight 期间是否有新的 runKey 到达，需要在当前预加载完成后重跑
    const pendingRunKeyRef = useRef<string | null>(null);
    // 强制触发 effect 重新执行的计数器
    const [retryTick, setRetryTick] = useState(0);

    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        if (!effectiveEnabled || !gameId) {
            setReady(true);
            inFlightRef.current = false;
            lastReadyKeyRef.current = null;
            pendingRunKeyRef.current = null;
            return;
        }
        if (stateKey !== 'ready') {
            return;
        }
        if (inFlightRef.current) {
            // 已有预加载进行中，但 runKey 变了 → 记录待处理
            if (lastReadyKeyRef.current !== runKey) {
                pendingRunKeyRef.current = runKey;
            }
            return;
        }

        if (lastReadyKeyRef.current === runKey) {
            // 同步快速路径已标记完成，确保 ready 状态同步
            if (!ready) setReady(true);
            onReady?.();
            return;
        }

        const currentState = gameStateRef.current;
        if (!currentState) {
            return;
        }

        pendingRunKeyRef.current = null;
        inFlightRef.current = true;
        setReady(false);
        preloadCriticalImages(gameId, currentState, locale, playerID)
            .then((warmPaths) => {
                lastReadyKeyRef.current = runKey;
                setReady(true);
                onReady?.();
                preloadWarmImages(warmPaths, locale);
            })
            .catch((err) => {
                console.error('[CriticalImageGate] 预加载失败:', err);
                lastReadyKeyRef.current = runKey;
                setReady(true);
                onReady?.();
            })
            .finally(() => {
                inFlightRef.current = false;
                // 预加载期间有新的 runKey 到达 → 触发 effect 重新执行
                if (pendingRunKeyRef.current) {
                    pendingRunKeyRef.current = null;
                    setRetryTick(t => t + 1);
                }
            });
     
    }, [effectiveEnabled, gameId, locale, phaseKey, playerID, runKey, stateKey, retryTick]);

    // 渲染判断：
    // 1. effectiveNeedsPreload=true → 需要预加载，显示 LoadingScreen
    // 2. effectiveNeedsPreload=false 且 ready=true → 正常渲染
    // 3. effectiveNeedsPreload=false 且 ready=false → 同步快速路径命中，
    //    useEffect 还没来得及 setReady(true)，但图片已全部缓存，直接渲染
    const shouldBlock = effectiveNeedsPreload || (!ready && lastReadyKeyRef.current !== runKey);
    if (shouldBlock) {
        return <LoadingScreen description={loadingDescription} />;
    }

    return <>{children}</>;
};
