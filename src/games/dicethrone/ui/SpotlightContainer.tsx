/**
 * 统一特写容器组件
 *
 * 无遮罩、无虚化背景，支持自动关闭和点击确认。
 * 可用于卡牌特写、骰子特写，或两者同时显示。
 */

import React from 'react';
import type { MotionProps } from 'framer-motion';
import { motion, AnimatePresence } from 'framer-motion';
import { HudPortal, UI_Z_INDEX } from '../../../core';
import { OverlayLayerProvider } from '../../../components/common/overlays/OverlayLayerContext';
import { resolveOverlayTooltipZIndex } from '../../../components/common/overlays/overlayLayer';
import { createScopedLogger } from '../../../lib/logger';

const spotlightContainerLogger = createScopedLogger('DT_SPOTLIGHT_CONTAINER');

type SpotlightMotion = Pick<MotionProps, 'initial' | 'animate' | 'exit' | 'transition'>;

interface SpotlightContainerProps {
    /** 唯一标识 */
    id: string;
    /** 是否显示 */
    isVisible: boolean;
    /** 关闭回调 */
    onClose: () => void;
    /** 自动关闭延迟（毫秒），默认 3000 */
    autoCloseDelay?: number;
    /** 子内容 */
    children: React.ReactNode;
    /** z-index，默认 9999 */
    zIndex?: number;
    /** 内层内容动画（用于卡牌从对手悬浮窗飞入等自定义动画） */
    contentMotion?: SpotlightMotion;
    /** 点击内容是否关闭（默认 true） */
    closeOnContentClick?: boolean;
    /** 禁用自动关闭（用于交互模式） */
    disableAutoClose?: boolean;
    /** 禁用点击背景关闭（用于交互模式） */
    disableBackdropClose?: boolean;
    blockPointerEvents?: boolean;
    /** 非交互展示态下允许内容区域点击穿透 */
    allowContentPointerEvents?: boolean;
    /** 首次挂载后的点击关闭保护时长，避免触发它的同一次点击立刻把特写关掉 */
    closeClickGuardMs?: number;
    /** 已由上层 modal stack 接管层级/遮罩时，禁止再次 portal 到 hud-root */
    usePortal?: boolean;
}

const DEFAULT_CONTENT_MOTION: SpotlightMotion = {
    initial: { scale: 0.5, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.8, opacity: 0 },
    transition: {
        type: 'spring',
        stiffness: 200,
        damping: 25,
    },
};


export const SpotlightContainer: React.FC<SpotlightContainerProps> = ({
    id,
    isVisible,
    onClose,
    autoCloseDelay = 3000,
    children,
    zIndex = UI_Z_INDEX.overlayRaised,
    contentMotion,
    closeOnContentClick = true,
    disableAutoClose = false,
    disableBackdropClose = false,
    blockPointerEvents = false,
    allowContentPointerEvents = true,
    closeClickGuardMs = 180,
    usePortal = true,
}) => {
    const visibleSinceRef = React.useRef<number>(0);
    const onCloseRef = React.useRef(onClose);
    const isVisibleRef = React.useRef(isVisible);
    const queuedCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastBackdropPointerDownAtRef = React.useRef<number | null>(null);
    const lastContentPointerDownAtRef = React.useRef<number | null>(null);
    const shouldCaptureBackdropClick = !disableBackdropClose;
    const [portalReady, setPortalReady] = React.useState(false);

    React.useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    React.useEffect(() => {
        setPortalReady(true);
    }, []);

    const clearQueuedCloseTimer = React.useCallback(() => {
        if (!queuedCloseTimerRef.current) return;
        clearTimeout(queuedCloseTimerRef.current);
        queuedCloseTimerRef.current = null;
    }, []);

    React.useEffect(() => {
        isVisibleRef.current = isVisible;
        if (!isVisible) {
            clearQueuedCloseTimer();
        }
    }, [clearQueuedCloseTimer, isVisible]);

    React.useEffect(() => {
        return () => {
            clearQueuedCloseTimer();
        };
    }, [clearQueuedCloseTimer]);

    React.useEffect(() => {
        if (isVisible) {
            const now = Date.now();
            visibleSinceRef.current = now;
            lastBackdropPointerDownAtRef.current = null;
            lastContentPointerDownAtRef.current = null;
            spotlightContainerLogger.info('visible', {
                id,
                visibleSince: now,
                closeClickGuardMs,
            });
        }
    }, [closeClickGuardMs, id, isVisible]);

    const isCloseClickGuardActive = React.useCallback(() => {
        if (closeClickGuardMs <= 0) return false;
        const elapsed = Date.now() - visibleSinceRef.current;
        const isActive = elapsed < closeClickGuardMs;
        spotlightContainerLogger.info('guard-check', {
            id,
            elapsed,
            closeClickGuardMs,
            isActive,
        });
        return isActive;
    }, [closeClickGuardMs, id]);

    const queueCloseAfterGuard = React.useCallback((
        source: 'backdrop' | 'content',
        pointerDownAt: number | null,
    ) => {
        if (closeClickGuardMs <= 0) return false;
        if (pointerDownAt === null || pointerDownAt < visibleSinceRef.current) return false;
        const now = Date.now();
        const pointerAge = now - pointerDownAt;
        if (pointerAge < 0 || pointerAge > 1200) return false;

        const elapsed = now - visibleSinceRef.current;
        const remaining = Math.max(0, closeClickGuardMs - elapsed);
        if (remaining <= 0) {
            clearQueuedCloseTimer();
            spotlightContainerLogger.info('close', { id, source, mode: 'guard-expired' });
            onCloseRef.current();
            return true;
        }

        if (queuedCloseTimerRef.current) {
            spotlightContainerLogger.info('close-queued', {
                id,
                source,
                mode: 'already-queued',
                remaining,
            });
            return true;
        }

        spotlightContainerLogger.info('close-queued', {
            id,
            source,
            mode: 'delay-until-guard-end',
            remaining,
        });
        queuedCloseTimerRef.current = setTimeout(() => {
            queuedCloseTimerRef.current = null;
            if (!isVisibleRef.current) return;
            spotlightContainerLogger.info('close', { id, source, mode: 'guard-queue-flush' });
            onCloseRef.current();
        }, remaining);
        return true;
    }, [clearQueuedCloseTimer, closeClickGuardMs, id]);

    // 自动关闭计时器
    React.useEffect(() => {
        if (!isVisible || disableAutoClose) return;

        const closeTimer = setTimeout(() => {
            onCloseRef.current();
        }, autoCloseDelay);


        return () => {
            clearTimeout(closeTimer);
        };
    }, [id, isVisible, autoCloseDelay, disableAutoClose]);

    if (!isVisible) {
        return null;
    }

    const m = contentMotion ?? DEFAULT_CONTENT_MOTION;

    const content = (
        <AnimatePresence mode="wait">
            <motion.div
                key={id}
                className={`fixed inset-0 flex items-center justify-center ${(blockPointerEvents || shouldCaptureBackdropClick) ? 'pointer-events-auto' : 'pointer-events-none'}`}
                style={{ zIndex }}
                data-testid="spotlight-container-root"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onPointerDown={shouldCaptureBackdropClick
                    ? () => {
                        lastBackdropPointerDownAtRef.current = Date.now();
                    }
                    : undefined}
                onClick={!shouldCaptureBackdropClick
                    ? undefined
                    : () => {
                        const guardActive = isCloseClickGuardActive();
                        spotlightContainerLogger.info('backdrop-click', {
                            id,
                            guardActive,
                        });
                        if (guardActive) {
                            const queued = queueCloseAfterGuard('backdrop', lastBackdropPointerDownAtRef.current);
                            spotlightContainerLogger.info('close-skipped', {
                                reason: queued ? 'guard-active-queued' : 'guard-active',
                                id,
                                source: 'backdrop',
                            });
                            return;
                        }
                        clearQueuedCloseTimer();
                        spotlightContainerLogger.info('close', { id, source: 'backdrop' });
                        onClose();
                    }}
            >
                {/* 内容容器 */}
                <motion.div
                    className={`relative ${allowContentPointerEvents ? 'pointer-events-auto' : 'pointer-events-none'}`}
                    initial={m.initial}
                    animate={m.animate}
                    exit={m.exit}
                    transition={m.transition}
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        lastContentPointerDownAtRef.current = Date.now();
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        const guardActive = isCloseClickGuardActive();
                        spotlightContainerLogger.info('content-click', {
                            id,
                            closeOnContentClick,
                            guardActive,
                        });
                        if (!closeOnContentClick) {
                            spotlightContainerLogger.info('close-skipped', { reason: 'content-click-disabled', id, source: 'content' });
                            return;
                        }
                        if (guardActive) {
                            const queued = queueCloseAfterGuard('content', lastContentPointerDownAtRef.current);
                            spotlightContainerLogger.info('close-skipped', {
                                reason: queued ? 'guard-active-queued' : 'guard-active',
                                id,
                                source: 'content',
                            });
                            return;
                        }
                        clearQueuedCloseTimer();
                        spotlightContainerLogger.info('close', { id, source: 'content' });
                        onClose();
                    }}
                >
                    <OverlayLayerProvider tooltipZIndex={resolveOverlayTooltipZIndex(zIndex)}>
                        {children}
                    </OverlayLayerProvider>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );

    const canUsePortal = portalReady && typeof document !== 'undefined';

    return canUsePortal && usePortal ? (
        <HudPortal>
            {content}
        </HudPortal>
    ) : (
        content
    );
};

export default SpotlightContainer;
