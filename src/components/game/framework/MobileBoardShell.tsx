import React, {
    cloneElement,
    isValidElement,
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    type ReactElement,
    type TouchEvent as ReactTouchEvent,
    type ReactNode,
} from 'react';
import type { GameMobileBattlefieldZoom } from '../../../shared/gameManifest.types';
import { isNativeAndroidRuntime } from '../../../lib/mobile/androidRuntime';
import { logMobileRuntimeCritical } from '../../../lib/mobile/mobileRuntimeDebug';
import { shouldReserveSystemBackGesture } from '../../../lib/mobile/systemBackGesture';

interface MobileBoardShellProps {
    children: ReactNode;
    topRail?: ReactNode;
    sideDock?: ReactNode;
    bottomRail?: ReactNode;
    battlefieldZoomMode?: GameMobileBattlefieldZoom;
}

interface MobileBattlefieldViewportProps {
    children: ReactNode;
    zoomMode?: GameMobileBattlefieldZoom;
    transformTarget?: 'surface' | 'content';
    visibleInsets?: Partial<ViewportInsets>;
    className?: string;
    style?: CSSProperties;
    testId?: string;
}

type ViewportInsets = {
    top: number;
    right: number;
    bottom: number;
    left: number;
};

type ZoomTargetElementProps = {
    className?: string;
    style?: CSSProperties;
    onTouchStart?: (event: ReactTouchEvent<HTMLElement>) => void;
    onTouchMove?: (event: ReactTouchEvent<HTMLElement>) => void;
    onTouchEnd?: (event: ReactTouchEvent<HTMLElement>) => void;
    onTouchCancel?: (event: ReactTouchEvent<HTMLElement>) => void;
    onPointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove?: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp?: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel?: (event: ReactPointerEvent<HTMLElement>) => void;
    onPointerLeave?: (event: ReactPointerEvent<HTMLElement>) => void;
    onClickCapture?: (event: ReactMouseEvent<HTMLElement>) => void;
    ['data-testid']?: string;
    ['data-battlefield-zoom-enabled']?: string;
    ['data-battlefield-zoom-scale']?: string;
    ['data-battlefield-touch-mode']?: string;
    ['data-battlefield-zoom-target-mode']?: string;
};

type Point = { clientX: number; clientY: number };
type TransformState = { scale: number; x: number; y: number };
type TransformMetrics = {
    width: number;
    height: number;
    left: number;
    top: number;
    visibleLeft: number;
    visibleTop: number;
    visibleRight: number;
    visibleBottom: number;
};
type PinchState = {
    startDistance: number;
    startScale: number;
    targetLeft: number;
    targetTop: number;
    startCenterTargetLocal: { x: number; y: number };
    startCenterSurfaceLocal: { x: number; y: number };
    activated: boolean;
};
type PanState = {
    pointerId: number;
    startPointerLocal: { x: number; y: number };
    startX: number;
    startY: number;
    moved: boolean;
};

const MIN_SCALE = 1;
const MAX_SCALE = 2.5;
const PINCH_ACTIVATION_DISTANCE_PX = 12;
const PAN_THRESHOLD_LOCAL_PX = 10;
const CLICK_SUPPRESS_MS = 320;
const ZOOM_TARGET_SELECTOR = '[data-mobile-battlefield-zoom-target="true"]';
const PINCH_DEBUG_LOG_LIMIT = 12;

type BattlefieldTargetStyle = CSSProperties & {
    '--mobile-battlefield-target-translate-x'?: string;
    '--mobile-battlefield-target-translate-y'?: string;
    '--mobile-battlefield-target-scale'?: string;
};

const getDistance = (a: Point, b: Point) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

const getLocalPoint = (surface: HTMLElement, clientX: number, clientY: number) => {
    const rect = surface.getBoundingClientRect();
    const safeWidth = Math.max(rect.width, 1);
    const safeHeight = Math.max(rect.height, 1);
    const localWidth = Math.max(surface.clientWidth, 1);
    const localHeight = Math.max(surface.clientHeight, 1);

    return {
        x: ((clientX - rect.left) / safeWidth) * localWidth,
        y: ((clientY - rect.top) / safeHeight) * localHeight,
    };
};

const normalizeInsets = (insets?: Partial<ViewportInsets>): ViewportInsets => ({
    top: Math.max(0, insets?.top ?? 0),
    right: Math.max(0, insets?.right ?? 0),
    bottom: Math.max(0, insets?.bottom ?? 0),
    left: Math.max(0, insets?.left ?? 0),
});

const getOffsetWithinSurface = (
    node: HTMLElement,
    surface: HTMLElement,
) => {
    if (node === surface) {
        return { left: 0, top: 0 };
    }

    const surfaceRect = surface.getBoundingClientRect();
    const offsetParent = node.offsetParent instanceof HTMLElement ? node.offsetParent : surface;
    const offsetParentRect = offsetParent.getBoundingClientRect();
    const anchorLeft = offsetParent === surface ? 0 : offsetParentRect.left - surfaceRect.left;
    const anchorTop = offsetParent === surface ? 0 : offsetParentRect.top - surfaceRect.top;

    return {
        left: anchorLeft + node.offsetLeft - offsetParent.scrollLeft,
        top: anchorTop + node.offsetTop - offsetParent.scrollTop,
    };
};

const getLogicalBoundsWithinTarget = (target: HTMLElement, currentTransform: TransformState) => {
    const directChildren = Array.from(target.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
    if (directChildren.length === 0) {
        return null;
    }

    const safeScale = Math.max(currentTransform.scale, MIN_SCALE);
    const targetRect = target.getBoundingClientRect();
    let minLeft = Number.POSITIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    for (const child of directChildren) {
        const childRect = child.getBoundingClientRect();
        const leftFromRenderedBounds = (childRect.left - targetRect.left) / safeScale;
        const topFromRenderedBounds = (childRect.top - targetRect.top) / safeScale;
        const offset = getOffsetWithinSurface(child, target);
        const width = Math.max(child.scrollWidth, child.offsetWidth, child.clientWidth, childRect.width / safeScale, 1);
        const height = Math.max(child.scrollHeight, child.offsetHeight, child.clientHeight, childRect.height / safeScale, 1);
        const left = Number.isFinite(leftFromRenderedBounds) ? leftFromRenderedBounds : offset.left;
        const top = Number.isFinite(topFromRenderedBounds) ? topFromRenderedBounds : offset.top;

        minLeft = Math.min(minLeft, left);
        minTop = Math.min(minTop, top);
        maxRight = Math.max(maxRight, left + width);
        maxBottom = Math.max(maxBottom, top + height);
    }

    if (!Number.isFinite(minLeft) || !Number.isFinite(minTop) || !Number.isFinite(maxRight) || !Number.isFinite(maxBottom)) {
        return null;
    }

    return {
        left: minLeft,
        top: minTop,
        width: Math.max(maxRight - minLeft, 1),
        height: Math.max(maxBottom - minTop, 1),
    };
};

const clampAxis = (min: number, max: number, nextValue: number) => {
    if (min > max) {
        return (min + max) / 2;
    }

    return Math.min(max, Math.max(min, nextValue));
};

const resolveTransformMetrics = (
    surface: HTMLElement | null,
    target: HTMLElement | null,
    currentTransform: TransformState,
    insets?: Partial<ViewportInsets>,
): TransformMetrics | null => {
    if (!surface || !target) {
        return null;
    }

    const normalizedInsets = normalizeInsets(insets);
    const offsetWithinSurface = getOffsetWithinSurface(target, surface);
    const logicalBoundsWithinTarget = getLogicalBoundsWithinTarget(target, currentTransform);
    const logicalWidthAnchor = target.offsetParent instanceof HTMLElement ? target.offsetParent : surface;
    const width = logicalBoundsWithinTarget?.width
        ?? Math.max(
            target.scrollWidth,
            target.offsetWidth,
            target.clientWidth,
            logicalWidthAnchor.scrollWidth,
            logicalWidthAnchor.clientWidth,
            1,
        );
    const height = logicalBoundsWithinTarget?.height
        ?? Math.max(target.scrollHeight, target.offsetHeight, target.clientHeight, 1);
    const visibleLeft = normalizedInsets.left;
    const visibleTop = normalizedInsets.top;
    const visibleRight = Math.max(visibleLeft + 1, surface.clientWidth - normalizedInsets.right);
    const visibleBottom = Math.max(visibleTop + 1, surface.clientHeight - normalizedInsets.bottom);

    return {
        width,
        height,
        left: offsetWithinSurface.left + (logicalBoundsWithinTarget?.left ?? 0),
        top: offsetWithinSurface.top + (logicalBoundsWithinTarget?.top ?? 0),
        visibleLeft,
        visibleTop,
        visibleRight,
        visibleBottom,
    };
};

const clampTransform = (
    surface: HTMLElement | null,
    target: HTMLElement | null,
    next: TransformState,
    currentTransform: TransformState,
    insets?: Partial<ViewportInsets>,
): TransformState => {
    const normalizedScale = next.scale <= 1.001 ? MIN_SCALE : next.scale;
    if (!surface || !target || normalizedScale === MIN_SCALE) {
        return { scale: MIN_SCALE, x: 0, y: 0 };
    }

    const metrics = resolveTransformMetrics(surface, target, currentTransform, insets);
    if (!metrics) {
        return { scale: MIN_SCALE, x: 0, y: 0 };
    }

    const minX = metrics.visibleRight - metrics.left - (metrics.width * normalizedScale);
    const maxX = metrics.visibleLeft - metrics.left;
    const minY = metrics.visibleBottom - metrics.top - (metrics.height * normalizedScale);
    const maxY = metrics.visibleTop - metrics.top;

    return {
        scale: normalizedScale,
        x: clampAxis(minX, maxX, next.x),
        y: clampAxis(minY, maxY, next.y),
    };
};

const getTargetLocalPoint = (surface: HTMLElement, target: HTMLElement, transform: TransformState, clientX: number, clientY: number) => {
    const surfacePoint = getLocalPoint(surface, clientX, clientY);
    const { left, top } = getOffsetWithinSurface(target, surface);
    const safeScale = Math.max(transform.scale, MIN_SCALE);

    return {
        x: (surfacePoint.x - left - transform.x) / safeScale,
        y: (surfacePoint.y - top - transform.y) / safeScale,
        left,
        top,
        surfacePoint,
    };
};

const joinClassNames = (...values: Array<string | undefined | false | null>) => values.filter(Boolean).join(' ');

const toDebugNumber = (value: number) => Number(value.toFixed(3));

const useLandscapeMobileViewport = () => {
    const [isLandscapeMobileViewport, setIsLandscapeMobileViewport] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth <= 1023 && window.innerWidth > window.innerHeight;
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const updateViewportState = () => {
            setIsLandscapeMobileViewport(window.innerWidth <= 1023 && window.innerWidth > window.innerHeight);
        };

        updateViewportState();
        window.addEventListener('resize', updateViewportState);
        window.addEventListener('orientationchange', updateViewportState);

        return () => {
            window.removeEventListener('resize', updateViewportState);
            window.removeEventListener('orientationchange', updateViewportState);
        };
    }, []);

    return isLandscapeMobileViewport;
};

export const MobileBoardShell = ({
    children,
    topRail,
    sideDock,
    bottomRail,
    battlefieldZoomMode = 'none',
}: MobileBoardShellProps) => (
    <div
        className="mobile-board-shell"
        data-battlefield-zoom-mode={battlefieldZoomMode}
    >
        {topRail ? (
            <div className="mobile-board-shell__top-rail">
                {topRail}
            </div>
        ) : null}

        <div className="mobile-board-shell__canvas">
            <div className="mobile-board-shell__content">
                {children}
            </div>
        </div>

        {sideDock ? (
            <div className="mobile-board-shell__side-dock">
                {sideDock}
            </div>
        ) : null}

        {bottomRail ? (
            <div className="mobile-board-shell__bottom-rail">
                {bottomRail}
            </div>
        ) : null}
    </div>
);

export const MobileBattlefieldViewport = ({
    children,
    zoomMode = 'none',
    transformTarget = 'surface',
    visibleInsets,
    className = '',
    style,
    testId = 'mobile-battlefield-viewport',
}: MobileBattlefieldViewportProps) => {
    const surfaceRef = useRef<HTMLElement | null>(null);
    const contentTargetRef = useRef<HTMLElement | null>(null);
    const pointersRef = useRef(new Map<number, Point>());
    const pinchRef = useRef<PinchState | null>(null);
    const panRef = useRef<PanState | null>(null);
    const suppressClickUntilRef = useRef(0);
    const initialTransform: TransformState = { scale: MIN_SCALE, x: 0, y: 0 };
    const transformRef = useRef<TransformState>(initialTransform);
    const hasDedicatedZoomTargetRef = useRef(false);
    const visibleInsetsRef = useRef<Partial<ViewportInsets> | undefined>(visibleInsets);
    const pinchDebugCountRef = useRef(0);

    const [transform, setTransform] = useState<TransformState>(initialTransform);
    const isLandscapeMobileViewport = useLandscapeMobileViewport();
    const isEnabled = zoomMode === 'shell-pinch-pan' && isLandscapeMobileViewport;
    const shouldLockTouchGestures = isEnabled && transform.scale > MIN_SCALE;
    const supportsTouchPointerEvents = typeof window !== 'undefined' && typeof window.PointerEvent !== 'undefined';
    const shouldUseTouchFallback = isEnabled && !supportsTouchPointerEvents;
    const shouldReserveNativeBackGesture = isEnabled && isNativeAndroidRuntime();
    const childCount = React.Children.count(children);
    const singleChild = childCount === 1 ? React.Children.only(children) : null;
    const hasDedicatedZoomTarget = transformTarget === 'content' && isValidElement<ZoomTargetElementProps>(singleChild);

    useEffect(() => {
        hasDedicatedZoomTargetRef.current = hasDedicatedZoomTarget;
        visibleInsetsRef.current = visibleInsets;
    }, [hasDedicatedZoomTarget, visibleInsets]);

    useEffect(() => {
        if (isEnabled) {
            return;
        }

        pointersRef.current.clear();
        pinchRef.current = null;
        panRef.current = null;
        suppressClickUntilRef.current = 0;
        transformRef.current = { scale: MIN_SCALE, x: 0, y: 0 };
        pinchDebugCountRef.current = 0;
        setTransform(transformRef.current);
    }, [isEnabled]);

    useEffect(() => {
        if (!hasDedicatedZoomTarget) {
            contentTargetRef.current = null;
            return;
        }

        const surface = surfaceRef.current;
        if (!surface) {
            contentTargetRef.current = null;
            return;
        }

        contentTargetRef.current = surface.querySelector<HTMLElement>(ZOOM_TARGET_SELECTOR) ?? surface;
    }, [children, hasDedicatedZoomTarget]);

    const beginPanFromPointer = useCallback((pointerId: number, point: Point) => {
        if (!surfaceRef.current || transformRef.current.scale <= MIN_SCALE) {
            panRef.current = null;
            return;
        }

        panRef.current = {
            pointerId,
            startPointerLocal: getLocalPoint(surfaceRef.current, point.clientX, point.clientY),
            startX: transformRef.current.x,
            startY: transformRef.current.y,
            moved: false,
        };
    }, []);

    const logPinchDebug = useCallback((stage: string, payload: Record<string, unknown>) => {
        if (!import.meta.env.DEV && !isNativeAndroidRuntime()) {
            return;
        }

        if (pinchDebugCountRef.current >= PINCH_DEBUG_LOG_LIMIT) {
            return;
        }

        pinchDebugCountRef.current += 1;
        logMobileRuntimeCritical('BattlefieldPinch', stage, payload);
    }, []);

    const beginTrackedPoint = useCallback((pointerId: number, point: Point) => {
        pointersRef.current.set(pointerId, point);

        if (pointersRef.current.size >= 2 && surfaceRef.current) {
            const [first, second] = Array.from(pointersRef.current.values());
            const activeTarget = hasDedicatedZoomTargetRef.current ? contentTargetRef.current : surfaceRef.current;
            if (!activeTarget) {
                return false;
            }
            const center = getTargetLocalPoint(
                surfaceRef.current,
                activeTarget,
                transformRef.current,
                (first.clientX + second.clientX) / 2,
                (first.clientY + second.clientY) / 2,
            );
            pinchRef.current = {
                startDistance: Math.max(getDistance(first, second), 1),
                startScale: transformRef.current.scale,
                targetLeft: center.left,
                targetTop: center.top,
                startCenterTargetLocal: { x: center.x, y: center.y },
                startCenterSurfaceLocal: { x: center.surfacePoint.x, y: center.surfacePoint.y },
                activated: false,
            };
            pinchDebugCountRef.current = 0;
            logPinchDebug('begin', {
                pointerId,
                startDistance: toDebugNumber(pinchRef.current.startDistance),
                startScale: toDebugNumber(pinchRef.current.startScale),
                targetLeft: toDebugNumber(pinchRef.current.targetLeft),
                targetTop: toDebugNumber(pinchRef.current.targetTop),
                startCenterTargetLocalX: toDebugNumber(pinchRef.current.startCenterTargetLocal.x),
                startCenterTargetLocalY: toDebugNumber(pinchRef.current.startCenterTargetLocal.y),
                startCenterSurfaceLocalX: toDebugNumber(pinchRef.current.startCenterSurfaceLocal.x),
                startCenterSurfaceLocalY: toDebugNumber(pinchRef.current.startCenterSurfaceLocal.y),
            });
            panRef.current = null;
            return true;
        }

        if (pointersRef.current.size === 1 && transformRef.current.scale > MIN_SCALE) {
            beginPanFromPointer(pointerId, point);
            return true;
        }

        return false;
    }, [beginPanFromPointer, logPinchDebug]);

    const updateTrackedPoint = useCallback((pointerId: number, point: Point) => {
        if (!surfaceRef.current || !pointersRef.current.has(pointerId)) {
            return false;
        }

        pointersRef.current.set(pointerId, point);

        if (pointersRef.current.size >= 2) {
            const [first, second] = Array.from(pointersRef.current.values());
            const activeTarget = hasDedicatedZoomTargetRef.current ? contentTargetRef.current : surfaceRef.current;
            if (!activeTarget) {
                return false;
            }

            const pinch = pinchRef.current ?? (() => {
                const center = getTargetLocalPoint(
                    surfaceRef.current,
                    activeTarget,
                    transformRef.current,
                    (first.clientX + second.clientX) / 2,
                    (first.clientY + second.clientY) / 2,
                );
                return {
                    startDistance: Math.max(getDistance(first, second), 1),
                    startScale: transformRef.current.scale,
                    targetLeft: center.left,
                    targetTop: center.top,
                    startCenterTargetLocal: { x: center.x, y: center.y },
                    startCenterSurfaceLocal: { x: center.surfacePoint.x, y: center.surfacePoint.y },
                    activated: false,
                } satisfies PinchState;
            })();
            pinchRef.current = pinch;

            const currentDistance = Math.max(getDistance(first, second), 1);

            if (!pinch.activated) {
                const center = getTargetLocalPoint(
                    surfaceRef.current,
                    activeTarget,
                    transformRef.current,
                    (first.clientX + second.clientX) / 2,
                    (first.clientY + second.clientY) / 2,
                );
                if (Math.abs(currentDistance - pinch.startDistance) < PINCH_ACTIVATION_DISTANCE_PX) {
                    const settledPinch: PinchState = {
                        ...pinch,
                        targetLeft: center.left,
                        targetTop: center.top,
                        startCenterTargetLocal: { x: center.x, y: center.y },
                        startCenterSurfaceLocal: { x: center.surfacePoint.x, y: center.surfacePoint.y },
                    };
                    pinchRef.current = settledPinch;
                    logPinchDebug('pre-activate', {
                        pointerId,
                        currentDistance: toDebugNumber(currentDistance),
                        startDistance: toDebugNumber(pinch.startDistance),
                        deltaDistance: toDebugNumber(currentDistance - pinch.startDistance),
                        settledTargetLeft: toDebugNumber(settledPinch.targetLeft),
                        settledTargetTop: toDebugNumber(settledPinch.targetTop),
                        settledCenterTargetLocalX: toDebugNumber(settledPinch.startCenterTargetLocal.x),
                        settledCenterTargetLocalY: toDebugNumber(settledPinch.startCenterTargetLocal.y),
                        settledCenterSurfaceLocalX: toDebugNumber(settledPinch.startCenterSurfaceLocal.x),
                        settledCenterSurfaceLocalY: toDebugNumber(settledPinch.startCenterSurfaceLocal.y),
                    });
                    suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
                    return true;
                }

                const activatedPinch: PinchState = {
                    ...(pinchRef.current ?? pinch),
                    startDistance: currentDistance,
                    startScale: transformRef.current.scale,
                    activated: true,
                };
                pinchRef.current = activatedPinch;
                logPinchDebug('activate', {
                    pointerId,
                    currentDistance: toDebugNumber(currentDistance),
                    startScale: toDebugNumber(activatedPinch.startScale),
                    thresholdCenterTargetLocalX: toDebugNumber(center.x),
                    thresholdCenterTargetLocalY: toDebugNumber(center.y),
                    thresholdCenterSurfaceLocalX: toDebugNumber(center.surfacePoint.x),
                    thresholdCenterSurfaceLocalY: toDebugNumber(center.surfacePoint.y),
                    anchorTargetLeft: toDebugNumber(activatedPinch.targetLeft),
                    anchorTargetTop: toDebugNumber(activatedPinch.targetTop),
                    anchorCenterTargetLocalX: toDebugNumber(activatedPinch.startCenterTargetLocal.x),
                    anchorCenterTargetLocalY: toDebugNumber(activatedPinch.startCenterTargetLocal.y),
                    anchorCenterSurfaceLocalX: toDebugNumber(activatedPinch.startCenterSurfaceLocal.x),
                    anchorCenterSurfaceLocalY: toDebugNumber(activatedPinch.startCenterSurfaceLocal.y),
                });
                suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
                return true;
            }

            const nextScale = clampScale(pinch.startScale * (currentDistance / pinch.startDistance));

            setTransform(() => {
                const clamped = clampTransform(surfaceRef.current, activeTarget, {
                    scale: nextScale,
                    x: pinch.startCenterSurfaceLocal.x - pinch.targetLeft - pinch.startCenterTargetLocal.x * nextScale,
                    y: pinch.startCenterSurfaceLocal.y - pinch.targetTop - pinch.startCenterTargetLocal.y * nextScale,
                }, transformRef.current, visibleInsetsRef.current);
                logPinchDebug('apply', {
                    pointerId,
                    currentDistance: toDebugNumber(currentDistance),
                    startDistance: toDebugNumber(pinch.startDistance),
                    nextScale: toDebugNumber(nextScale),
                    appliedScale: toDebugNumber(clamped.scale),
                    appliedX: toDebugNumber(clamped.x),
                    appliedY: toDebugNumber(clamped.y),
                });
                transformRef.current = clamped;
                return clamped;
            });

            suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
            return true;
        }

        const pan = panRef.current;
        if (!pan || pan.pointerId !== pointerId || transformRef.current.scale <= MIN_SCALE) {
            return false;
        }

        const currentLocal = getLocalPoint(surfaceRef.current, point.clientX, point.clientY);
        const deltaX = currentLocal.x - pan.startPointerLocal.x;
        const deltaY = currentLocal.y - pan.startPointerLocal.y;
        const distance = Math.hypot(deltaX, deltaY);

        if (!pan.moved && distance < PAN_THRESHOLD_LOCAL_PX) {
            return false;
        }

        pan.moved = true;
        suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
        setTransform(() => {
            const activeTarget = hasDedicatedZoomTargetRef.current ? contentTargetRef.current : surfaceRef.current;
            const clamped = clampTransform(surfaceRef.current, activeTarget, {
                scale: transformRef.current.scale,
                x: pan.startX + deltaX,
                y: pan.startY + deltaY,
            }, transformRef.current, visibleInsetsRef.current);
            transformRef.current = clamped;
            return clamped;
        });
        return true;
    }, [logPinchDebug]);

    const finishPointer = useCallback((pointerId: number) => {
        const point = pointersRef.current.get(pointerId);
        pointersRef.current.delete(pointerId);

        const pan = panRef.current;
        if (pan?.pointerId === pointerId && pan.moved) {
            suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
        }

        if (pointersRef.current.size >= 2) {
            if (!surfaceRef.current) {
                return;
            }
            const [first, second] = Array.from(pointersRef.current.values());
            const activeTarget = hasDedicatedZoomTargetRef.current ? contentTargetRef.current : surfaceRef.current;
            if (!activeTarget) {
                return;
            }
            const center = getTargetLocalPoint(
                surfaceRef.current,
                activeTarget,
                transformRef.current,
                (first.clientX + second.clientX) / 2,
                (first.clientY + second.clientY) / 2,
            );
            pinchRef.current = {
                startDistance: Math.max(getDistance(first, second), 1),
                startScale: transformRef.current.scale,
                targetLeft: center.left,
                targetTop: center.top,
                startCenterTargetLocal: { x: center.x, y: center.y },
                startCenterSurfaceLocal: { x: center.surfacePoint.x, y: center.surfacePoint.y },
                activated: false,
            };
            panRef.current = null;
            return;
        }

        pinchRef.current = null;

        if (pointersRef.current.size === 1) {
            const [remainingPointerId, remainingPoint] = Array.from(pointersRef.current.entries())[0];
            logPinchDebug('finish', {
                pointerId,
                remainingPointers: pointersRef.current.size,
                scale: toDebugNumber(transformRef.current.scale),
                x: toDebugNumber(transformRef.current.x),
                y: toDebugNumber(transformRef.current.y),
            });
            beginPanFromPointer(remainingPointerId, remainingPoint);
            return;
        }

        if (point) {
            logPinchDebug('finish', {
                pointerId,
                remainingPointers: pointersRef.current.size,
                scale: toDebugNumber(transformRef.current.scale),
                x: toDebugNumber(transformRef.current.x),
                y: toDebugNumber(transformRef.current.y),
            });
            panRef.current = null;
        }
    }, [beginPanFromPointer, logPinchDebug]);

    const onTouchStart = useCallback((event: ReactTouchEvent<HTMLElement>) => {
        if (!shouldUseTouchFallback) {
            return;
        }

        if (
            Array.from(event.changedTouches).some((touch) => shouldReserveSystemBackGesture({
                enabled: shouldReserveNativeBackGesture,
                clientX: touch.clientX,
                viewportWidth: window.innerWidth,
            }))
        ) {
            return;
        }

        let handled = false;
        for (const touch of Array.from(event.changedTouches)) {
            handled = beginTrackedPoint(touch.identifier, { clientX: touch.clientX, clientY: touch.clientY }) || handled;
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, [beginTrackedPoint, shouldReserveNativeBackGesture, shouldUseTouchFallback]);

    const onTouchMove = useCallback((event: ReactTouchEvent<HTMLElement>) => {
        if (!shouldUseTouchFallback) {
            return;
        }

        let handled = false;
        for (const touch of Array.from(event.changedTouches)) {
            handled = updateTrackedPoint(touch.identifier, { clientX: touch.clientX, clientY: touch.clientY }) || handled;
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, [shouldUseTouchFallback, updateTrackedPoint]);

    const onTouchEnd = useCallback((event: ReactTouchEvent<HTMLElement>) => {
        if (!shouldUseTouchFallback) {
            return;
        }

        for (const touch of Array.from(event.changedTouches)) {
            finishPointer(touch.identifier);
        }
    }, [finishPointer, shouldUseTouchFallback]);

    const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (!isEnabled || event.pointerType !== 'touch') {
            return;
        }

        if (shouldReserveSystemBackGesture({
            enabled: shouldReserveNativeBackGesture,
            clientX: event.clientX,
            viewportWidth: window.innerWidth,
        })) {
            return;
        }

        const point = { clientX: event.clientX, clientY: event.clientY };
        if (beginTrackedPoint(event.pointerId, point)) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, [beginTrackedPoint, isEnabled, shouldReserveNativeBackGesture]);

    const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (!isEnabled || event.pointerType !== 'touch' || !surfaceRef.current) {
            return;
        }

        if (updateTrackedPoint(event.pointerId, { clientX: event.clientX, clientY: event.clientY })) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, [isEnabled, updateTrackedPoint]);

    const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (!isEnabled || event.pointerType !== 'touch') {
            return;
        }
        finishPointer(event.pointerId);
    }, [finishPointer, isEnabled]);

    const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
        if (!isEnabled || event.pointerType !== 'touch') {
            return;
        }
        finishPointer(event.pointerId);
    }, [finishPointer, isEnabled]);

    const onClickCapture = useCallback((event: ReactMouseEvent<HTMLElement>) => {
        if (Date.now() < suppressClickUntilRef.current) {
            event.preventDefault();
            event.stopPropagation();
        }
    }, []);

    const hasActiveTransform = transform.scale > MIN_SCALE || Math.abs(transform.x) > 0.001 || Math.abs(transform.y) > 0.001;
    const targetStyle: BattlefieldTargetStyle = {
        ...(hasDedicatedZoomTarget ? {
            '--mobile-battlefield-target-translate-x': `${transform.x}px`,
            '--mobile-battlefield-target-translate-y': `${transform.y}px`,
            '--mobile-battlefield-target-scale': `${transform.scale}`,
        } : {}),
        willChange: hasDedicatedZoomTarget && hasActiveTransform ? 'transform' : undefined,
    };

    const stageStyle: CSSProperties = {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
        transformOrigin: '0 0',
        willChange: transform.scale > MIN_SCALE ? 'transform' : undefined,
    };

    if (hasDedicatedZoomTarget && singleChild && isValidElement<ZoomTargetElementProps>(singleChild)) {
        const child = singleChild as ReactElement<ZoomTargetElementProps>;
        const childProps = child.props;

        const targetElement = cloneElement(child, {
            className: joinClassNames(childProps.className, 'mobile-battlefield-viewport__content-root'),
            style: {
                ...childProps.style,
                ...targetStyle,
            },
        });

        return (
            <div
                ref={(node) => {
                    surfaceRef.current = node;
                }}
                className={joinClassNames(
                    'mobile-battlefield-viewport',
                    'mobile-battlefield-viewport--content-proxy',
                    isEnabled && 'mobile-battlefield-viewport--zoom-enabled',
                    shouldLockTouchGestures && 'mobile-battlefield-viewport--gesture-lock',
                    className,
                )}
                style={style}
                data-testid={testId}
                data-battlefield-zoom-enabled={isEnabled ? 'true' : 'false'}
                data-battlefield-zoom-scale={transform.scale.toFixed(3)}
                data-battlefield-translate-x={transform.x.toFixed(3)}
                data-battlefield-translate-y={transform.y.toFixed(3)}
                data-battlefield-touch-mode={shouldLockTouchGestures ? 'gesture-lock' : 'native-pan'}
                data-battlefield-zoom-target-mode="content"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onTouchCancel={onTouchEnd}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onPointerLeave={onPointerCancel}
                onClickCapture={onClickCapture}
            >
                {targetElement}
            </div>
        );
    }

    return (
        <div
            ref={(node) => {
                surfaceRef.current = node;
            }}
            className={joinClassNames(
                'mobile-battlefield-viewport',
                isEnabled && 'mobile-battlefield-viewport--zoom-enabled',
                shouldLockTouchGestures && 'mobile-battlefield-viewport--gesture-lock',
                className,
            )}
            style={style}
            data-testid={testId}
            data-battlefield-zoom-enabled={isEnabled ? 'true' : 'false'}
            data-battlefield-zoom-scale={transform.scale.toFixed(3)}
            data-battlefield-translate-x={transform.x.toFixed(3)}
            data-battlefield-translate-y={transform.y.toFixed(3)}
            data-battlefield-touch-mode={shouldLockTouchGestures ? 'gesture-lock' : 'native-pan'}
            data-battlefield-zoom-target-mode="surface"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={onPointerCancel}
            onClickCapture={onClickCapture}
        >
            <div
                className="mobile-battlefield-viewport__stage"
                data-testid={`${testId}-stage`}
                style={stageStyle}
            >
                {children}
            </div>
        </div>
    );
};

export type { MobileBattlefieldViewportProps, MobileBoardShellProps };
