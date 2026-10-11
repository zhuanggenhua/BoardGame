import React, {
    forwardRef,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { logMobileRuntimeCritical } from '../../../lib/mobile/mobileRuntimeDebug';

const DRAG_THRESHOLD = 5;
const SCALE_EPSILON = 0.02;
const SCALE_BADGE_HIDE_DELAY_MS = 1200;
const INERTIA_DAMPING = 11;
const INERTIA_MIN_SPEED = 24;
const INERTIA_MAX_FRAME_MS = 64;
const INERTIA_VELOCITY_SMOOTHING = 0.65;

export const ZOOM_PAN_CANCEL_INERTIA_EVENT = 'zoompan:cancel-inertia';
export const ZOOM_PAN_RESET_CENTER_EVENT = 'zoompan:reset-center';

interface TouchPoint {
    clientX: number;
    clientY: number;
}

interface ElementSize {
    width: number;
    height: number;
}

export interface ZoomPanViewportFitInsets {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
}

export interface ZoomPanViewportPosition {
    x: number;
    y: number;
}

export interface ZoomPanViewportState {
    zoomLevel: number;
    position: ZoomPanViewportPosition;
}

export interface ZoomPanViewportZoomAnchorArgs {
    position: ZoomPanViewportPosition;
    zoomLevel: number;
    nextZoomLevel: number;
    pointer: TouchPoint;
    containerRect: DOMRect;
    coordinateSize?: ElementSize;
}

type ZoomPanViewportContainerProps = React.HTMLAttributes<HTMLDivElement> & {
    [key: `data-${string}`]: string | number | boolean | undefined;
};

const getTouchDistance = (touchA: TouchPoint, touchB: TouchPoint) => {
    const dx = touchA.clientX - touchB.clientX;
    const dy = touchA.clientY - touchB.clientY;
    return Math.sqrt(dx * dx + dy * dy);
};

const getTouchCenter = (touchA: TouchPoint, touchB: TouchPoint): TouchPoint => ({
    clientX: (touchA.clientX + touchB.clientX) / 2,
    clientY: (touchA.clientY + touchB.clientY) / 2,
});

const measureElementSize = (element: HTMLElement | null): ElementSize => {
    if (!element) {
        return { width: 0, height: 0 };
    }

    const width = element.offsetWidth || element.clientWidth || element.getBoundingClientRect().width || 0;
    const height = element.offsetHeight || element.clientHeight || element.getBoundingClientRect().height || 0;

    return { width, height };
};

const summarizeRect = (rect: DOMRect) => ({
    left: Number(rect.left.toFixed(2)),
    top: Number(rect.top.toFixed(2)),
    width: Number(rect.width.toFixed(2)),
    height: Number(rect.height.toFixed(2)),
    right: Number(rect.right.toFixed(2)),
    bottom: Number(rect.bottom.toFixed(2)),
});

const updateSizeState = (
    setSize: React.Dispatch<React.SetStateAction<ElementSize>>,
    nextSize: ElementSize,
) => {
    setSize((currentSize) => (
        currentSize.width === nextSize.width && currentSize.height === nextSize.height
            ? currentSize
            : nextSize
    ));
};

export interface ZoomPanViewportProps {
    children: ReactNode;
    initialScale?: number;
    minScale?: number;
    maxScale?: number;
    baseScaleMode?: 'contain' | 'cover';
    fitInsets?: ZoomPanViewportFitInsets;
    dragBoundsPaddingRatioY?: number;
    panBoundsMode?: 'content' | 'free';
    /** 只挡住拖拽 / 缩放输入，不得把镜头写回初始机位。回中只走 zoompan:reset-center 或 panToTarget。 */
    interactionDisabled?: boolean;
    panToTarget?: string | null;
    panToTargetKey?: string | number | null;
    panToScale?: number;
    controlledViewport?: ZoomPanViewportState;
    onControlledViewportChange?: (viewport: ZoomPanViewportState) => void;
    controlledViewportSchedule?: 'sync' | 'animation-frame';
    onUserViewportChange?: () => void;
    inertiaEnabled?: boolean;
    /**
     * Keep high-frequency drag/inertia transforms on the DOM node instead of
     * committing React state for every pointer sample. Controlled viewports
     * intentionally stay on the semantic React path.
     */
    imperativeRender?: boolean;
    coordinateSize?: ElementSize;
    clampViewport?: (viewport: ZoomPanViewportState) => ZoomPanViewportState;
    getZoomAnchorPosition?: (args: ZoomPanViewportZoomAnchorArgs) => ZoomPanViewportPosition;
    wheelZoomFactor?: number;
    renderContentTransform?: boolean;
    containerProps?: ZoomPanViewportContainerProps;
    containerTestId?: string;
    contentTestId?: string;
    scaleTestId?: string;
    className?: string;
    style?: React.CSSProperties;
    contentClassName?: string;
    contentStyle?: React.CSSProperties;
    scaleBadgeClassName?: string;
    scaleBadgeStyle?: React.CSSProperties;
    scaleBadgeVisibility?: 'while-zoomed' | 'interaction';
    formatScaleBadge?: (zoomLevel: number) => ReactNode;
    scaleBadgeAddon?: ReactNode;
    ariaLabel?: string;
}

export const ZoomPanViewport = forwardRef<HTMLDivElement, ZoomPanViewportProps>(({
    children,
    initialScale = 0.6,
    minScale = 0.5,
    maxScale = 3,
    baseScaleMode = 'contain',
    fitInsets,
    dragBoundsPaddingRatioY = 0,
    panBoundsMode = 'content',
    interactionDisabled = false,
    panToTarget,
    panToTargetKey,
    panToScale,
    controlledViewport,
    onControlledViewportChange,
    controlledViewportSchedule = 'sync',
    onUserViewportChange,
    inertiaEnabled = true,
    imperativeRender = false,
    coordinateSize,
    clampViewport,
    getZoomAnchorPosition,
    wheelZoomFactor,
    renderContentTransform = true,
    containerProps,
    containerTestId,
    contentTestId,
    scaleTestId,
    className = '',
    style,
    contentClassName = '',
    contentStyle,
    scaleBadgeClassName = '',
    scaleBadgeStyle,
    scaleBadgeVisibility = 'while-zoomed',
    formatScaleBadge,
    scaleBadgeAddon,
    ariaLabel,
}, forwardedRef) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const pointerStartRef = useRef({ x: 0, y: 0 });
    const positionStartRef = useRef({ x: 0, y: 0 });
    const lastPointerSampleRef = useRef({
        clientX: 0,
        clientY: 0,
        timestamp: 0,
        position: { x: 0, y: 0 },
    });
    const dragStartedRef = useRef(false);
    const velocityRef = useRef({ x: 0, y: 0 });
    const inertiaFrameRef = useRef<number | null>(null);
    const isPointerDownRef = useRef(false);
    const pinchStartDistanceRef = useRef<number | null>(null);
    const pinchStartZoomRef = useRef<number | null>(null);
    const scaleBadgeTimerRef = useRef<number | null>(null);
    const animationTimerRef = useRef<number | null>(null);
    const suppressNextClickRef = useRef(false);
    const suppressClickResetTimerRef = useRef<number | null>(null);
    const handledPanInstructionRef = useRef<string | null>(null);
    const [settledPanInstructionKey, setSettledPanInstructionKey] = useState<string | null>(null);

    const [zoomLevel, setZoomLevel] = useState(initialScale);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isScaleBadgeVisible, setIsScaleBadgeVisible] = useState(false);

    const isControlled = controlledViewport != null && onControlledViewportChange != null;
    const activeZoomLevel = controlledViewport?.zoomLevel ?? zoomLevel;
    const activePosition = controlledViewport?.position ?? position;
    const prefersReducedMotion = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fitInsetTop = Math.max(0, fitInsets?.top ?? 0);
    const fitInsetRight = Math.max(0, fitInsets?.right ?? 0);
    const fitInsetBottom = Math.max(0, fitInsets?.bottom ?? 0);
    const fitInsetLeft = Math.max(0, fitInsets?.left ?? 0);
    const fitAvailableWidth = Math.max(1, containerSize.width - fitInsetLeft - fitInsetRight);
    const fitAvailableHeight = Math.max(1, containerSize.height - fitInsetTop - fitInsetBottom);
    const fitCenterOffset = {
        x: (fitInsetLeft - fitInsetRight) / 2,
        y: (fitInsetTop - fitInsetBottom) / 2,
    };

    const setContainerNode = useCallback((node: HTMLDivElement | null) => {
        containerRef.current = node;
        if (typeof forwardedRef === 'function') {
            forwardedRef(node);
            return;
        }
        if (forwardedRef) {
            forwardedRef.current = node;
        }
    }, [forwardedRef]);

    const syncContainerSize = useCallback(() => {
        updateSizeState(setContainerSize, measureElementSize(containerRef.current));
    }, []);

    const syncContentSize = useCallback(() => {
        updateSizeState(setContentSize, measureElementSize(contentRef.current));
    }, []);

    const baseScale = containerSize.width > 0
        && containerSize.height > 0
        && contentSize.width > 0
        && contentSize.height > 0
        ? baseScaleMode === 'cover'
            ? Math.max(
                fitAvailableWidth / contentSize.width,
                fitAvailableHeight / contentSize.height,
            )
            : Math.min(
                1,
                Math.min(
                    fitAvailableWidth / contentSize.width,
                    fitAvailableHeight / contentSize.height,
                ),
            )
        : 1;
    const scale = baseScale * activeZoomLevel;
    const isAtDefaultZoom = Math.abs(activeZoomLevel - initialScale) <= SCALE_EPSILON;
    const shouldShowScaleBadge = scaleBadgeVisibility === 'interaction'
        ? isScaleBadgeVisible
        : isScaleBadgeVisible || !isAtDefaultZoom || scaleBadgeAddon != null;
    const panInstructionKey = panToTarget
        ? `${panToTargetKey ?? panToTarget}:${panToScale ?? 'current'}`
        : null;
    const panTargetState = panToTarget
        ? settledPanInstructionKey === panInstructionKey && !isAnimating
            ? 'settled'
            : 'panning'
        : undefined;

    const clearScaleBadgeTimer = useCallback(() => {
        if (scaleBadgeTimerRef.current !== null) {
            window.clearTimeout(scaleBadgeTimerRef.current);
            scaleBadgeTimerRef.current = null;
        }
    }, []);

    const clearAnimationTimer = useCallback(() => {
        if (animationTimerRef.current !== null) {
            window.clearTimeout(animationTimerRef.current);
            animationTimerRef.current = null;
        }
    }, []);

    const cancelInertia = useCallback(() => {
        if (inertiaFrameRef.current !== null) {
            window.cancelAnimationFrame(inertiaFrameRef.current);
            inertiaFrameRef.current = null;
        }
        velocityRef.current = { x: 0, y: 0 };
    }, []);

    const clearSuppressClickResetTimer = useCallback(() => {
        if (suppressClickResetTimerRef.current !== null) {
            window.clearTimeout(suppressClickResetTimerRef.current);
            suppressClickResetTimerRef.current = null;
        }
    }, []);

    const armSuppressNextClickReset = useCallback(() => {
        if (!suppressNextClickRef.current) return;
        clearSuppressClickResetTimer();
        suppressClickResetTimerRef.current = window.setTimeout(() => {
            suppressNextClickRef.current = false;
            suppressClickResetTimerRef.current = null;
        }, 180);
    }, [clearSuppressClickResetTimer]);

    const clampZoomLevel = useCallback((nextZoomLevel: number) => (
        Math.max(minScale, Math.min(maxScale, nextZoomLevel))
    ), [maxScale, minScale]);

    const revealScaleBadge = useCallback((nextZoomLevel: number) => {
        clearScaleBadgeTimer();
        setIsScaleBadgeVisible(true);
        if (
            scaleBadgeVisibility === 'interaction'
            || Math.abs(nextZoomLevel - initialScale) <= SCALE_EPSILON
        ) {
            scaleBadgeTimerRef.current = window.setTimeout(() => {
                setIsScaleBadgeVisible(false);
                scaleBadgeTimerRef.current = null;
            }, SCALE_BADGE_HIDE_DELAY_MS);
        }
    }, [clearScaleBadgeTimer, initialScale, scaleBadgeVisibility]);

    const hideScaleBadge = useCallback(() => {
        clearScaleBadgeTimer();
        setIsScaleBadgeVisible(false);
    }, [clearScaleBadgeTimer]);

    const markUserViewportChanged = useCallback(() => {
        onUserViewportChange?.();
    }, [onUserViewportChange]);

    useEffect(() => {
        return () => {
            clearScaleBadgeTimer();
            clearAnimationTimer();
            clearSuppressClickResetTimer();
            cancelInertia();
        };
    }, [cancelInertia, clearAnimationTimer, clearScaleBadgeTimer, clearSuppressClickResetTimer]);

    const clampPosition = useCallback((x: number, y: number, nextScale = scale) => {
        if (panBoundsMode === 'free') {
            return { x, y };
        }
        if (!containerSize.width || !containerSize.height || !contentSize.width || !contentSize.height) {
            return { x, y };
        }

        const scaledWidth = contentSize.width * nextScale;
        const scaledHeight = contentSize.height * nextScale;
        const maxOffsetX = Math.max(0, (scaledWidth - fitAvailableWidth) / 2);
        const extraPaddingY = fitAvailableHeight * dragBoundsPaddingRatioY;
        const maxOffsetY = Math.max(0, (scaledHeight - fitAvailableHeight) / 2 + extraPaddingY);

        return {
            x: fitCenterOffset.x + Math.min(maxOffsetX, Math.max(-maxOffsetX, x - fitCenterOffset.x)),
            y: fitCenterOffset.y + Math.min(maxOffsetY, Math.max(-maxOffsetY, y - fitCenterOffset.y)),
        };
    }, [containerSize.height, containerSize.width, contentSize.height, contentSize.width, dragBoundsPaddingRatioY, fitAvailableHeight, fitAvailableWidth, fitCenterOffset.x, fitCenterOffset.y, panBoundsMode, scale]);

    const clampViewportState = useCallback((nextViewport: ZoomPanViewportState): ZoomPanViewportState => {
        const nextZoomLevel = clampZoomLevel(nextViewport.zoomLevel);
        const rawViewport = {
            zoomLevel: nextZoomLevel,
            position: nextViewport.position,
        };
        if (clampViewport) {
            return clampViewport(rawViewport);
        }
        return {
            zoomLevel: nextZoomLevel,
            position: clampPosition(
                rawViewport.position.x,
                rawViewport.position.y,
                baseScale * nextZoomLevel,
            ),
        };
    }, [baseScale, clampPosition, clampViewport, clampZoomLevel]);

    const latestViewportRef = useRef<ZoomPanViewportState>({
        zoomLevel: activeZoomLevel,
        position: activePosition,
    });
    const renderedViewportRef = useRef<ZoomPanViewportState>({
        zoomLevel: activeZoomLevel,
        position: activePosition,
    });
    const useImperativeRender = imperativeRender && renderContentTransform && !isControlled;
    const useLatestViewportForInteraction = useImperativeRender
        || (isControlled && controlledViewportSchedule === 'animation-frame');
    const controlledViewportFrameRef = useRef<number | null>(null);
    const pendingControlledViewportRef = useRef<ZoomPanViewportState | null>(null);

    const scheduleControlledViewportChange = useCallback((nextViewport: ZoomPanViewportState) => {
        if (!onControlledViewportChange) return;
        if (controlledViewportSchedule === 'sync') {
            onControlledViewportChange(nextViewport);
            return;
        }

        pendingControlledViewportRef.current = nextViewport;
        if (controlledViewportFrameRef.current !== null) return;
        controlledViewportFrameRef.current = window.requestAnimationFrame(() => {
            controlledViewportFrameRef.current = null;
            const pendingViewport = pendingControlledViewportRef.current;
            pendingControlledViewportRef.current = null;
            if (pendingViewport) {
                onControlledViewportChange(pendingViewport);
            }
        });
    }, [controlledViewportSchedule, onControlledViewportChange]);

    useEffect(() => () => {
        if (controlledViewportFrameRef.current !== null) {
            window.cancelAnimationFrame(controlledViewportFrameRef.current);
        }
        controlledViewportFrameRef.current = null;
        pendingControlledViewportRef.current = null;
    }, []);

    const renderViewportImperatively = useCallback((
        nextViewport: ZoomPanViewportState,
        options?: { transition?: string; willChange?: React.CSSProperties['willChange'] },
    ) => {
        renderedViewportRef.current = nextViewport;
        if (!useImperativeRender) return;

        const content = contentRef.current;
        if (!content) return;

        const renderedPosition = panBoundsMode === 'free'
            ? {
                x: nextViewport.position.x + fitCenterOffset.x,
                y: nextViewport.position.y + fitCenterOffset.y,
            }
            : nextViewport.position;
        const renderedScale = baseScale * nextViewport.zoomLevel;
        content.style.transition = options?.transition ?? 'none';
        content.style.willChange = options?.willChange ?? 'transform';
        content.style.transform = `translate(${renderedPosition.x}px, ${renderedPosition.y}px) scale(${renderedScale})`;
    }, [baseScale, fitCenterOffset.x, fitCenterOffset.y, panBoundsMode, useImperativeRender]);

    const applyViewport = useCallback((nextViewport: ZoomPanViewportState) => {
        const clampedViewport = clampViewportState(nextViewport);
        latestViewportRef.current = clampedViewport;
        renderedViewportRef.current = clampedViewport;
        if (isControlled) {
            scheduleControlledViewportChange(clampedViewport);
            return clampedViewport;
        }
        setZoomLevel(clampedViewport.zoomLevel);
        setPosition(clampedViewport.position);
        return clampedViewport;
    }, [clampViewportState, isControlled, scheduleControlledViewportChange]);

    const clampedPosition = clampViewport ? activePosition : clampPosition(activePosition.x, activePosition.y, scale);
    const clampedPositionX = clampedPosition.x;
    const clampedPositionY = clampedPosition.y;
    const latestApplyViewportRef = useRef<typeof applyViewport | null>(null);

    useEffect(() => {
        if (!isPointerDownRef.current && inertiaFrameRef.current === null) {
            const nextViewport = {
                zoomLevel: activeZoomLevel,
                position: { x: clampedPositionX, y: clampedPositionY },
            };
            latestViewportRef.current = nextViewport;
            renderedViewportRef.current = nextViewport;
        }
        latestApplyViewportRef.current = applyViewport;
    }, [activeZoomLevel, applyViewport, clampedPositionX, clampedPositionY, isControlled]);

    const convertDeltaToViewportUnits = useCallback((deltaX: number, deltaY: number) => {
        if (!coordinateSize) {
            return { x: deltaX, y: deltaY };
        }
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) {
            return { x: deltaX, y: deltaY };
        }
        return {
            x: (deltaX / rect.width) * coordinateSize.width,
            y: (deltaY / rect.height) * coordinateSize.height,
        };
    }, [coordinateSize]);

    const resolveZoomPosition = useCallback((nextZoomLevel: number, pointer?: TouchPoint) => {
        const currentViewport = latestViewportRef.current;
        const currentPosition = useLatestViewportForInteraction
            ? currentViewport.position
            : clampedPosition;
        const currentZoomLevel = useLatestViewportForInteraction
            ? currentViewport.zoomLevel
            : activeZoomLevel;
        if (!pointer || !getZoomAnchorPosition) {
            return currentPosition;
        }
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect || containerRect.width <= 0 || containerRect.height <= 0) {
            return clampedPosition;
        }
        return getZoomAnchorPosition({
            position: currentPosition,
            zoomLevel: currentZoomLevel,
            nextZoomLevel,
            pointer,
            containerRect,
            coordinateSize,
        });
    }, [activeZoomLevel, clampedPosition, coordinateSize, getZoomAnchorPosition, useLatestViewportForInteraction]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        syncContainerSize();

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver === 'function') {
            observer = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (!entry) return;
                updateSizeState(setContainerSize, {
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            });
            observer.observe(container);
        }

        window.addEventListener('resize', syncContainerSize);
        window.addEventListener('orientationchange', syncContainerSize);

        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', syncContainerSize);
            window.removeEventListener('orientationchange', syncContainerSize);
        };
    }, [syncContainerSize]);

    useEffect(() => {
        const content = contentRef.current;
        if (!content) return undefined;

        syncContentSize();

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver === 'function') {
            observer = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (!entry) return;
                updateSizeState(setContentSize, {
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            });
            observer.observe(content);
        }

        const images = Array.from(content.querySelectorAll('img'));
        images.forEach((image) => {
            image.addEventListener('load', syncContentSize);
            image.addEventListener('error', syncContentSize);
        });

        const frameId = window.requestAnimationFrame(syncContentSize);
        window.addEventListener('resize', syncContentSize);
        window.addEventListener('orientationchange', syncContentSize);

        return () => {
            observer?.disconnect();
            window.cancelAnimationFrame(frameId);
            window.removeEventListener('resize', syncContentSize);
            window.removeEventListener('orientationchange', syncContentSize);
            images.forEach((image) => {
                image.removeEventListener('load', syncContentSize);
                image.removeEventListener('error', syncContentSize);
            });
        };
    }, [syncContentSize]);

    const startPointerInteraction = useCallback((clientX: number, clientY: number) => {
        cancelInertia();
        clearAnimationTimer();
        setIsAnimating(false);
        dragStartedRef.current = false;
        isPointerDownRef.current = true;
        const currentPosition = latestViewportRef.current.position;
        pointerStartRef.current = { x: clientX, y: clientY };
        positionStartRef.current = { x: currentPosition.x, y: currentPosition.y };
        lastPointerSampleRef.current = {
            clientX,
            clientY,
            timestamp: Date.now(),
            position: { x: currentPosition.x, y: currentPosition.y },
        };
    }, [cancelInertia, clearAnimationTimer]);

    const handleMouseDown = useCallback((event: React.MouseEvent) => {
        if (event.button !== 0 || interactionDisabled) return;

        startPointerInteraction(event.clientX, event.clientY);
    }, [interactionDisabled, startPointerInteraction]);

    const handleTouchStart = useCallback((event: React.TouchEvent) => {
        if (interactionDisabled) return;

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            pinchStartDistanceRef.current = null;
            pinchStartZoomRef.current = null;
            startPointerInteraction(touch.clientX, touch.clientY);
            return;
        }

        if (event.touches.length === 2) {
            cancelInertia();
            clearAnimationTimer();
            isPointerDownRef.current = false;
            dragStartedRef.current = false;
            setIsDragging(false);
            pinchStartDistanceRef.current = getTouchDistance(event.touches[0], event.touches[1]);
            pinchStartZoomRef.current = useLatestViewportForInteraction
                ? latestViewportRef.current.zoomLevel
                : activeZoomLevel;
        }
    }, [activeZoomLevel, cancelInertia, clearAnimationTimer, interactionDisabled, startPointerInteraction, useLatestViewportForInteraction]);

    const applyDragPosition = useCallback((clientX: number, clientY: number) => {
        if (!isPointerDownRef.current) return false;

        const dx = clientX - pointerStartRef.current.x;
        const dy = clientY - pointerStartRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= DRAG_THRESHOLD) return false;

        clearAnimationTimer();
        suppressNextClickRef.current = true;
        setIsDragging(true);
        setIsAnimating(false);

        const viewportDelta = convertDeltaToViewportUnits(dx, dy);
        markUserViewportChanged();
        const currentZoomLevel = useLatestViewportForInteraction
            ? latestViewportRef.current.zoomLevel
            : activeZoomLevel;
        const nextViewport = clampViewportState({
            zoomLevel: currentZoomLevel,
            position: {
                x: positionStartRef.current.x + viewportDelta.x,
                y: positionStartRef.current.y + viewportDelta.y,
            },
        });
        latestViewportRef.current = nextViewport;
        if (useImperativeRender) {
            renderViewportImperatively(nextViewport);
        } else {
            applyViewport(nextViewport);
        }
        const now = Date.now();
        if (!dragStartedRef.current) {
            dragStartedRef.current = true;
            velocityRef.current = { x: 0, y: 0 };
        } else {
            const previousSample = lastPointerSampleRef.current;
            const elapsedMs = Math.max(1, now - previousSample.timestamp);
            const sampleVelocity = elapsedMs <= 160
                ? {
                    x: ((nextViewport.position.x - previousSample.position.x) / elapsedMs) * 1000,
                    y: ((nextViewport.position.y - previousSample.position.y) / elapsedMs) * 1000,
                }
                : { x: 0, y: 0 };
            velocityRef.current = {
                x: sampleVelocity.x * INERTIA_VELOCITY_SMOOTHING
                    + velocityRef.current.x * (1 - INERTIA_VELOCITY_SMOOTHING),
                y: sampleVelocity.y * INERTIA_VELOCITY_SMOOTHING
                    + velocityRef.current.y * (1 - INERTIA_VELOCITY_SMOOTHING),
            };
        }
        lastPointerSampleRef.current = {
            clientX,
            clientY,
            timestamp: now,
            position: nextViewport.position,
        };
        return true;
    }, [activeZoomLevel, applyViewport, clampViewportState, clearAnimationTimer, convertDeltaToViewportUnits, markUserViewportChanged, renderViewportImperatively, useImperativeRender, useLatestViewportForInteraction]);

    const startInertia = useCallback(() => {
        if (!inertiaEnabled || prefersReducedMotion) return false;

        const initialVelocity = velocityRef.current;
        if (Math.hypot(initialVelocity.x, initialVelocity.y) < INERTIA_MIN_SPEED) return false;

        let previousTimestamp: number | null = null;
        const advanceInertia = (timestamp: number) => {
            const currentVelocity = velocityRef.current;
            const speed = Math.hypot(currentVelocity.x, currentVelocity.y);
            if (speed < INERTIA_MIN_SPEED) {
                inertiaFrameRef.current = null;
                velocityRef.current = { x: 0, y: 0 };
                if (useImperativeRender) {
                    applyViewport(latestViewportRef.current);
                }
                return;
            }

            const elapsedMs = previousTimestamp === null
                ? 16.67
                : Math.min(INERTIA_MAX_FRAME_MS, Math.max(1, timestamp - previousTimestamp));
            previousTimestamp = timestamp;

            const currentViewport = latestViewportRef.current;
            const nextViewport = clampViewportState({
                zoomLevel: currentViewport.zoomLevel,
                position: {
                    x: currentViewport.position.x + currentVelocity.x * elapsedMs / 1000,
                    y: currentViewport.position.y + currentVelocity.y * elapsedMs / 1000,
                },
            });

            latestViewportRef.current = nextViewport;
            if (useImperativeRender) {
                renderViewportImperatively(nextViewport);
            } else {
                latestApplyViewportRef.current?.(nextViewport);
            }
            const decay = Math.exp(-INERTIA_DAMPING * elapsedMs / 1000);
            velocityRef.current = {
                x: currentVelocity.x * decay,
                y: currentVelocity.y * decay,
            };

            if (
                Math.abs(nextViewport.position.x - currentViewport.position.x) < 0.01
                && Math.abs(nextViewport.position.y - currentViewport.position.y) < 0.01
            ) {
                inertiaFrameRef.current = null;
                velocityRef.current = { x: 0, y: 0 };
                if (useImperativeRender) {
                    applyViewport(nextViewport);
                }
                return;
            }

            inertiaFrameRef.current = window.requestAnimationFrame(advanceInertia);
        };

        inertiaFrameRef.current = window.requestAnimationFrame(advanceInertia);
        return true;
    }, [applyViewport, clampViewportState, inertiaEnabled, prefersReducedMotion, renderViewportImperatively, useImperativeRender]);

    const finishPointerInteraction = useCallback(() => {
        isPointerDownRef.current = false;
        pinchStartDistanceRef.current = null;
        pinchStartZoomRef.current = null;
        armSuppressNextClickReset();
        setIsDragging(false);
        const shouldStartInertia = dragStartedRef.current;
        dragStartedRef.current = false;
        if (shouldStartInertia) {
            if (!startInertia()) {
                if (useImperativeRender) {
                    applyViewport(latestViewportRef.current);
                }
            }
        }
    }, [applyViewport, armSuppressNextClickReset, startInertia, useImperativeRender]);

    const handleTouchMove = useCallback((event: React.TouchEvent) => {
        if (interactionDisabled) return;

        if (event.touches.length === 2) {
            const startDistance = pinchStartDistanceRef.current;
            const startZoomLevel = pinchStartZoomRef.current;
            if (!startDistance || !startZoomLevel) return;

            event.preventDefault();
            clearAnimationTimer();
            setIsAnimating(false);

            const distance = getTouchDistance(event.touches[0], event.touches[1]);
            const nextZoomLevel = clampZoomLevel(startZoomLevel * (distance / startDistance));
            const nextPosition = resolveZoomPosition(nextZoomLevel, getTouchCenter(event.touches[0], event.touches[1]));
            revealScaleBadge(nextZoomLevel);
            markUserViewportChanged();
            applyViewport({
                zoomLevel: nextZoomLevel,
                position: nextPosition,
            });
            return;
        }

        if (event.touches.length !== 1 || !isPointerDownRef.current) return;
        if (applyDragPosition(event.touches[0].clientX, event.touches[0].clientY)) {
            event.preventDefault();
        }
    }, [
        applyViewport,
        applyDragPosition,
        clampZoomLevel,
        clearAnimationTimer,
        interactionDisabled,
        markUserViewportChanged,
        resolveZoomPosition,
        revealScaleBadge,
    ]);

    const handleTouchEnd = useCallback((event: React.TouchEvent) => {
        if (event.touches.length >= 2) return;

        if (event.touches.length === 1) {
            const touch = event.touches[0];
            dragStartedRef.current = false;
            startPointerInteraction(touch.clientX, touch.clientY);
            pinchStartDistanceRef.current = null;
            pinchStartZoomRef.current = null;
            return;
        }

        finishPointerInteraction();
    }, [finishPointerInteraction, startPointerInteraction]);

    useEffect(() => {
        const handleGlobalMouseMove = (event: MouseEvent) => {
            if (!isPointerDownRef.current) return;

            applyDragPosition(event.clientX, event.clientY);
        };

        const handleGlobalMouseUp = () => {
            finishPointerInteraction();
        };

        window.addEventListener('mousemove', handleGlobalMouseMove);
        window.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [applyDragPosition, finishPointerInteraction]);

    const handleWheel = useCallback((event: WheelEvent) => {
        if (interactionDisabled) return;

        event.preventDefault();
        cancelInertia();
        clearAnimationTimer();
        setIsAnimating(false);

        const currentZoomLevel = useLatestViewportForInteraction
            ? latestViewportRef.current.zoomLevel
            : activeZoomLevel;
        const nextZoomLevel = clampZoomLevel(
            wheelZoomFactor
                ? currentZoomLevel * (event.deltaY < 0 ? wheelZoomFactor : 1 / wheelZoomFactor)
                : currentZoomLevel + (event.deltaY > 0 ? -0.1 : 0.1),
        );
        if (Math.abs(nextZoomLevel - currentZoomLevel) < 0.001) return;

        const nextPosition = resolveZoomPosition(nextZoomLevel, {
            clientX: event.clientX,
            clientY: event.clientY,
        });
        revealScaleBadge(nextZoomLevel);
        markUserViewportChanged();
        applyViewport({
            zoomLevel: nextZoomLevel,
            position: nextPosition,
        });
    }, [
        activeZoomLevel,
        applyViewport,
        cancelInertia,
        clampZoomLevel,
        clearAnimationTimer,
        interactionDisabled,
        markUserViewportChanged,
        resolveZoomPosition,
        revealScaleBadge,
        useLatestViewportForInteraction,
        wheelZoomFactor,
    ]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;

        const handleCancelInertia = () => {
            cancelInertia();
        };
        const handleResetCenter = () => {
            cancelInertia();
            clearAnimationTimer();
            hideScaleBadge();
            setIsAnimating(false);
            const nextViewport = applyViewport({
                zoomLevel: initialScale,
                position: { x: 0, y: 0 },
            });
            // Mage Wars 用 imperativeRender：transform 不走 React style。
            // 只 setState 不会重跑 layout effect，镜头会停在拖拽后的偏移上。
            if (useImperativeRender && nextViewport) {
                renderViewportImperatively(nextViewport);
            }
        };

        container.addEventListener(ZOOM_PAN_CANCEL_INERTIA_EVENT, handleCancelInertia);
        container.addEventListener(ZOOM_PAN_RESET_CENTER_EVENT, handleResetCenter);
        return () => {
            container.removeEventListener(ZOOM_PAN_CANCEL_INERTIA_EVENT, handleCancelInertia);
            container.removeEventListener(ZOOM_PAN_RESET_CENTER_EVENT, handleResetCenter);
        };
    }, [
        applyViewport,
        cancelInertia,
        clearAnimationTimer,
        hideScaleBadge,
        initialScale,
        renderViewportImperatively,
        useImperativeRender,
    ]);

    useEffect(() => {
        if (!panToTarget) {
            handledPanInstructionRef.current = null;
            const clearFrameId = window.requestAnimationFrame(() => {
                setSettledPanInstructionKey(null);
            });
            return () => window.cancelAnimationFrame(clearFrameId);
        }
        if (!contentRef.current || !containerRef.current) return undefined;
        if (!containerSize.width || !containerSize.height || !contentSize.width || !contentSize.height) return undefined;

        if (handledPanInstructionRef.current === panInstructionKey) return undefined;

        let cancelled = false;
        let retryFrameId: number | null = null;
        let retryCount = 0;

        const resolveTargetAndPan = () => {
            if (cancelled) return;
            const contentEl = contentRef.current;
            const containerEl = containerRef.current;
            const targetEl = contentEl?.querySelector(
                `[data-zoom-pan-target="${panToTarget}"], [data-tutorial-id="${panToTarget}"]`,
            ) as HTMLElement | null;
            if (!contentEl || !containerEl || !targetEl) {
                if (retryCount < 60) {
                    retryCount += 1;
                    retryFrameId = requestAnimationFrame(resolveTargetAndPan);
                }
                return;
            }

            const contentWidth = contentEl.offsetWidth;
            const contentHeight = contentEl.offsetHeight;
            const targetRect = targetEl.getBoundingClientRect();
            if (!contentWidth || !contentHeight || targetRect.width <= 0 || targetRect.height <= 0) {
                if (retryCount < 60) {
                    retryCount += 1;
                    retryFrameId = requestAnimationFrame(resolveTargetAndPan);
                }
                return;
            }

            const currentZoomLevel = activeZoomLevel;
            const targetZoomLevel = panToScale != null
                ? clampZoomLevel(panToScale)
                : currentZoomLevel;
            const containerRect = containerEl.getBoundingClientRect();
            const elementRect = targetRect;
            // `containerSize` / `fitCenterOffset` are measured in the viewport's
            // layout coordinate system. On mobile the whole board shell can be
            // transformed, so focus math must first convert them to the current
            // screen coordinate system represented by `getBoundingClientRect()`.
            const shellScaleX = containerSize.width > 0
                ? containerRect.width / containerSize.width
                : 1;
            const shellScaleY = containerSize.height > 0
                ? containerRect.height / containerSize.height
                : shellScaleX;
            const viewportCenterX = containerRect.width / 2 + fitCenterOffset.x * shellScaleX;
            const viewportCenterY = containerRect.height / 2 + fitCenterOffset.y * shellScaleY;
            const targetCenterScreen = {
                x: (elementRect.left + elementRect.right) / 2,
                y: (elementRect.top + elementRect.bottom) / 2,
            };
            const viewportCenterScreen = {
                x: containerRect.left + viewportCenterX,
                y: containerRect.top + viewportCenterY,
            };
            const screenDelta = {
                x: viewportCenterScreen.x - targetCenterScreen.x,
                y: viewportCenterScreen.y - targetCenterScreen.y,
            };

            let targetPosition;
            if (panToScale == null) {
                // The target is already rendered at the user's current zoom and pan.
                // Move by the observed screen-space center delta so nested transforms
                // and portal/layout offsets cannot be counted twice.
                const targetCenterX = (elementRect.left + elementRect.right) / 2 - containerRect.left;
                const targetCenterY = (elementRect.top + elementRect.bottom) / 2 - containerRect.top;
                const deltaX = viewportCenterX - targetCenterX;
                const deltaY = viewportCenterY - targetCenterY;
                const renderedScale = Math.max(
                    0.01,
                    baseScale * currentZoomLevel * Math.max(0.01, shellScaleX),
                );
                const renderedTranslateMatch = contentEl.style.transform.match(
                    /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/,
                );
                const currentRenderPosition = renderedTranslateMatch
                    ? {
                        x: Number.parseFloat(renderedTranslateMatch[1] ?? '0'),
                        y: Number.parseFloat(renderedTranslateMatch[2] ?? '0'),
                    }
                    : {
                        x: activePosition.x + (panBoundsMode === 'free' ? fitCenterOffset.x : 0),
                        y: activePosition.y + (panBoundsMode === 'free' ? fitCenterOffset.y : 0),
                    };
                const currentPosition = panBoundsMode === 'free'
                    ? {
                        x: currentRenderPosition.x - fitCenterOffset.x,
                        y: currentRenderPosition.y - fitCenterOffset.y,
                    }
                    : currentRenderPosition;
                targetPosition = {
                    // position is applied before scale(); convert the observed
                    // screen-space correction back into pre-scale coordinates.
                    x: currentPosition.x + deltaX / renderedScale,
                    y: currentPosition.y + deltaY / renderedScale,
                };
            } else {
                const savedTransform = contentEl.style.transform;
                const savedTransition = contentEl.style.transition;
                contentEl.style.transition = 'none';
                contentEl.style.transform = 'translate(0px, 0px) scale(1)';
                contentEl.getBoundingClientRect();

                const contentRect = contentEl.getBoundingClientRect();
                const resetElementRect = targetEl.getBoundingClientRect();
                const targetCenterX = (resetElementRect.left + resetElementRect.right) / 2 - contentRect.left;
                const targetCenterY = (resetElementRect.top + resetElementRect.bottom) / 2 - contentRect.top;
                const contentOffsetX = contentRect.left - containerRect.left;
                const contentOffsetY = contentRect.top - containerRect.top;

                contentEl.style.transform = savedTransform;
                contentEl.getBoundingClientRect();
                contentEl.style.transition = savedTransition;

                const contentCenterX = contentWidth / 2;
                const contentCenterY = contentHeight / 2;
                const targetTx =
                    viewportCenterX -
                    (contentOffsetX +
                        contentCenterX +
                        (targetCenterX - contentCenterX) * (baseScale * targetZoomLevel));
                const targetTy =
                    viewportCenterY -
                    (contentOffsetY +
                        contentCenterY +
                        (targetCenterY - contentCenterY) * (baseScale * targetZoomLevel));
                targetPosition = panBoundsMode === 'free'
                    ? {
                        x: targetTx - fitCenterOffset.x,
                        y: targetTy - fitCenterOffset.y,
                    }
                    : {
                        x: targetTx,
                        y: targetTy,
                    };
            }
            const nextViewport = clampViewportState({
                zoomLevel: targetZoomLevel,
                position: targetPosition,
            });

            logMobileRuntimeCritical('ZoomPanViewport', 'focus-apply', {
                panToTarget,
                panInstructionKey,
                panToScale: panToScale ?? null,
                panBoundsMode,
                targetTestId: targetEl.dataset.testid ?? null,
                activeZoomLevel,
                targetZoomLevel,
                baseScale,
                shellScaleX,
                shellScaleY,
                containerSize: {
                    width: containerSize.width,
                    height: containerSize.height,
                },
                contentSize: {
                    width: contentSize.width,
                    height: contentSize.height,
                },
                containerRect: summarizeRect(containerRect),
                targetRect: summarizeRect(elementRect),
                contentTransformBefore: contentEl.style.transform,
                activePosition: {
                    x: activePosition.x,
                    y: activePosition.y,
                },
                fitCenterOffset: {
                    x: fitCenterOffset.x,
                    y: fitCenterOffset.y,
                },
                viewportCenterScreen,
                targetCenterScreen,
                screenDelta,
                targetPosition,
                nextViewport,
            });

            clearAnimationTimer();
            setIsAnimating(true);
            if (targetZoomLevel !== currentZoomLevel) {
                revealScaleBadge(nextViewport.zoomLevel);
            }
            handledPanInstructionRef.current = panInstructionKey;
            applyViewport(nextViewport);
            animationTimerRef.current = window.setTimeout(() => {
                setIsAnimating(false);
                setSettledPanInstructionKey(panInstructionKey);
                animationTimerRef.current = null;
                if (!cancelled) {
                    const settledContainerRect = containerEl.getBoundingClientRect();
                    const settledTargetRect = targetEl.getBoundingClientRect();
                    const settledViewportCenter = {
                        x: settledContainerRect.left
                            + settledContainerRect.width / 2
                            + fitCenterOffset.x * shellScaleX,
                        y: settledContainerRect.top
                            + settledContainerRect.height / 2
                            + fitCenterOffset.y * shellScaleY,
                    };
                    const settledTargetCenter = {
                        x: (settledTargetRect.left + settledTargetRect.right) / 2,
                        y: (settledTargetRect.top + settledTargetRect.bottom) / 2,
                    };
                    logMobileRuntimeCritical('ZoomPanViewport', 'focus-settled', {
                        panToTarget,
                        panInstructionKey,
                        targetTestId: targetEl.dataset.testid ?? null,
                        settledContainerRect: summarizeRect(settledContainerRect),
                        settledTargetRect: summarizeRect(settledTargetRect),
                        settledViewportCenter,
                        settledTargetCenter,
                        settledResidual: {
                            x: settledTargetCenter.x - settledViewportCenter.x,
                            y: settledTargetCenter.y - settledViewportCenter.y,
                        },
                        contentTransformAfter: contentEl.style.transform,
                        activePositionAfter: nextViewport.position,
                        activeZoomLevelAfter: nextViewport.zoomLevel,
                    });
                }
            }, 400);
        };

        retryFrameId = requestAnimationFrame(resolveTargetAndPan);

        return () => {
            cancelled = true;
            if (retryFrameId !== null) {
                cancelAnimationFrame(retryFrameId);
            }
        };
    }, [
        activeZoomLevel,
        activePosition.x,
        activePosition.y,
        applyViewport,
        baseScale,
        clampViewportState,
        clampZoomLevel,
        clearAnimationTimer,
        containerSize.height,
        containerSize.width,
        contentSize.height,
        contentSize.width,
        fitCenterOffset.x,
        fitCenterOffset.y,
        panBoundsMode,
        panInstructionKey,
        panToScale,
        panToTarget,
        panToTargetKey,
        revealScaleBadge,
    ]);

    const renderedViewport = {
        zoomLevel: activeZoomLevel,
        position: clampedPosition,
    };
    const contentRenderPosition = panBoundsMode === 'free'
        ? {
            x: renderedViewport.position.x + fitCenterOffset.x,
            y: renderedViewport.position.y + fitCenterOffset.y,
        }
        : renderedViewport.position;
    const renderedScale = baseScale * renderedViewport.zoomLevel;

    useLayoutEffect(() => {
        if (!useImperativeRender) return;
        const transition = prefersReducedMotion
            ? 'none'
            : inertiaFrameRef.current !== null || isDragging
                ? 'none'
                : isAnimating
                    ? 'transform 350ms ease-out'
                    : 'transform 75ms';
        renderViewportImperatively(latestViewportRef.current, {
            transition,
            willChange: isDragging || isAnimating || inertiaFrameRef.current !== null
                ? 'transform'
                : 'auto',
        });
    }, [activeZoomLevel, baseScale, clampedPositionX, clampedPositionY, fitCenterOffset.x, fitCenterOffset.y, isAnimating, isDragging, panBoundsMode, prefersReducedMotion, renderViewportImperatively, useImperativeRender]);

    const contentTransformStyle: React.CSSProperties = renderContentTransform
        ? {
            ...(useImperativeRender
                ? {}
                : {
                    transform: `translate(${contentRenderPosition.x}px, ${contentRenderPosition.y}px) scale(${renderedScale})`,
                    transition: prefersReducedMotion
                        ? 'none'
                        : isDragging ? 'none' : isAnimating ? 'transform 350ms ease-out' : 'transform 75ms',
                    willChange: isDragging || isAnimating ? 'transform' : 'auto',
                }),
        }
        : {};

    return (
        <div
            {...containerProps}
            ref={setContainerNode}
            className={`relative overflow-hidden select-none ${containerProps?.className ?? ''} ${className}`}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onPointerUpCapture={(event) => {
                if (!suppressNextClickRef.current) return;
                event.preventDefault();
                event.stopPropagation();
            }}
            onClickCapture={(event) => {
                if (!suppressNextClickRef.current) return;
                clearSuppressClickResetTimer();
                suppressNextClickRef.current = false;
                event.preventDefault();
                event.stopPropagation();
            }}
            onDragStart={(event) => event.preventDefault()}
            aria-label={ariaLabel ?? containerProps?.['aria-label']}
            data-testid={containerTestId ?? containerProps?.['data-testid']}
            data-zoom-pan-active-target={panToTarget ?? undefined}
            data-zoom-pan-target-state={panTargetState}
            data-zoom-pan-target-settled={panTargetState === 'settled' ? 'true' : undefined}
            style={{
                ...containerProps?.style,
                ...style,
                cursor: interactionDisabled ? 'default' : isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: interactionDisabled ? 'auto' : 'none',
            }}
        >
            {scaleBadgeAddon ? (
                <div className="absolute top-3 left-3 z-40 flex items-center gap-2 pointer-events-none">
                    <div
                        className={`rounded-lg border border-white/20 bg-black/70 px-3 py-1.5 text-sm font-bold text-white shadow-lg pointer-events-none transition-opacity duration-200 ${scaleBadgeClassName} ${shouldShowScaleBadge ? 'opacity-100' : 'opacity-0'}`}
                        style={scaleBadgeStyle}
                        data-testid={scaleTestId}
                        aria-hidden={!shouldShowScaleBadge}
                    >
                        {formatScaleBadge ? formatScaleBadge(activeZoomLevel) : `${Math.round(activeZoomLevel * 100)}%`}
                    </div>
                    <div className="pointer-events-auto">
                        {scaleBadgeAddon}
                    </div>
                </div>
            ) : (
                <div
                    className={`absolute top-3 left-3 z-20 rounded-lg border border-white/20 bg-black/70 px-3 py-1.5 text-sm font-bold text-white shadow-lg pointer-events-none transition-opacity duration-200 ${scaleBadgeClassName} ${shouldShowScaleBadge ? 'opacity-100' : 'opacity-0'}`}
                    style={scaleBadgeStyle}
                    data-testid={scaleTestId}
                    aria-hidden={!shouldShowScaleBadge}
                >
                    {formatScaleBadge ? formatScaleBadge(activeZoomLevel) : `${Math.round(activeZoomLevel * 100)}%`}
                </div>
            )}

            <div
                ref={contentRef}
                className={`origin-center ${contentClassName}`}
                data-testid={contentTestId}
                style={{
                    ...contentStyle,
                    ...contentTransformStyle,
                    pointerEvents: isDragging ? 'none' : contentStyle?.pointerEvents ?? 'auto',
                }}
            >
                {children}
            </div>
        </div>
    );
});

ZoomPanViewport.displayName = 'ZoomPanViewport';
