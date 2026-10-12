import React from 'react';
import { Application, extend, useApplication, useTick } from '@pixi/react';
import {
    Assets,
    Container,
    Graphics,
    Rectangle,
    Sprite,
    Texture,
    type FederatedPointerEvent,
} from 'pixi.js';
import type {
    MapInteractionIntent,
    MapScenePoint,
    MapSceneRegion,
    MapSceneRegionHitTest,
    MapSceneResourceStatus,
    MapViewportState,
} from './types';

extend({ Container, Graphics, Sprite });

export interface PixiMapSceneHostProps {
    backgroundUrl: string;
    mapWidth: number;
    mapHeight: number;
    viewport: MapViewportState;
    onViewportChange?: (viewport: MapViewportState) => void;
    minimumZoom?: number;
    maximumZoom?: number;
    wheelZoomFactor?: number;
    inertiaEnabled?: boolean;
    origin?: MapScenePoint;
    baseScale?: number;
    regions?: readonly MapSceneRegion[];
    selectedRegionId?: string | null;
    hoveredRegionId?: string | null;
    hitTestRegionAtPoint?: MapSceneRegionHitTest;
     onInteraction?: (intent: MapInteractionIntent) => void;
     onResourceStateChange?: (state: MapSceneResourceStatus) => void;
     interactive?: boolean;
     regionSelectionEnabled?: boolean;
     canvasTestId?: string;
    resourceErrorLabel?: string;
    className?: string;
    ariaLabel?: string;
}

const DRAG_THRESHOLD = 4;
const CAMERA_DAMPING = 6.2;
const INERTIA_DAMPING = 11;
const INERTIA_MIN_SPEED = 24;
const INERTIA_VELOCITY_SMOOTHING = 0.65;
const WHEEL_SENSITIVITY = 0.0012;
const PINCH_MIN_DISTANCE = 24;

type CameraPose = MapViewportState;
type CameraPoint = { x: number; y: number };

const clamp = (value: number, min: number, max: number): number => (
    Math.min(max, Math.max(min, value))
);

const copyPose = (pose: CameraPose): CameraPose => ({
    zoom: pose.zoom,
    panX: pose.panX,
    panY: pose.panY,
});

const poseDistance = (left: CameraPose, right: CameraPose): number => Math.max(
    Math.abs(left.zoom - right.zoom),
    Math.abs(left.panX - right.panX),
    Math.abs(left.panY - right.panY),
);

const isPointInPolygon = (point: MapScenePoint, polygon: readonly MapScenePoint[]): boolean => {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
        const currentPoint = polygon[index];
        const previousPoint = polygon[previous];
        const intersects = (
            (currentPoint.y > point.y) !== (previousPoint.y > point.y)
            && point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y))
                / (previousPoint.y - currentPoint.y)
                + currentPoint.x
        );
        if (intersects) inside = !inside;
    }
    return inside;
};

const resolveRegionFromPolygons = (
    point: MapScenePoint,
    regions: readonly MapSceneRegion[],
): string | null => {
    for (const region of regions) {
        if (region.polygon.length >= 3 && isPointInPolygon(point, region.polygon)) {
            return region.id;
        }
    }
    return null;
};

const mapPointAtScreen = (
    screen: CameraPoint,
    pose: CameraPose,
    origin: MapScenePoint,
    baseScale: number,
): MapScenePoint => {
    const scale = Math.max(0.0001, baseScale * pose.zoom);
    return {
        x: (screen.x - origin.x - pose.panX) / scale,
        y: (screen.y - origin.y - pose.panY) / scale,
    };
};

const poseForScreenAnchor = (
    screen: CameraPoint,
    mapPoint: MapScenePoint,
    zoom: number,
    origin: MapScenePoint,
    baseScale: number,
): CameraPose => ({
    zoom,
    panX: screen.x - origin.x - mapPoint.x * baseScale * zoom,
    panY: screen.y - origin.y - mapPoint.y * baseScale * zoom,
});

const CameraWorld: React.FC<{
    texture: Texture;
    mapWidth: number;
    mapHeight: number;
    viewport: MapViewportState;
    onViewportChange?: (viewport: MapViewportState) => void;
    minimumZoom: number;
    maximumZoom: number;
    inertiaEnabled: boolean;
    origin: MapScenePoint;
    baseScale: number;
    regions: readonly MapSceneRegion[];
    selectedRegionId: string | null;
    hoveredRegionId: string | null;
    resolveRegionId: (point: MapScenePoint) => string | null;
     onInteraction?: (intent: MapInteractionIntent) => void;
     interactive: boolean;
     regionSelectionEnabled: boolean;
 }> = ({
    texture,
    mapWidth,
    mapHeight,
    viewport,
    onViewportChange,
    minimumZoom,
    maximumZoom,
    inertiaEnabled,
    origin,
    baseScale,
    regions,
    selectedRegionId,
    hoveredRegionId,
    resolveRegionId,
     onInteraction,
     interactive,
     regionSelectionEnabled,
 }) => {
    const { app, isInitialised } = useApplication();
    const worldRef = React.useRef<Container>(null);
    const hitAreaRef = React.useRef(new Rectangle(0, 0, 1, 1));
    const desiredPoseRef = React.useRef<CameraPose>(copyPose(viewport));
    const renderedPoseRef = React.useRef<CameraPose>(copyPose(viewport));
    const lastEmittedPoseRef = React.useRef<CameraPose>(copyPose(viewport));
    const activePointersRef = React.useRef(new Map<number, CameraPoint>());
    const dragPointerIdRef = React.useRef<number | null>(null);
    const dragStartRef = React.useRef<CameraPoint>({ x: 0, y: 0 });
    const lastPointerRef = React.useRef({ point: { x: 0, y: 0 }, timestamp: 0 });
    const dragStartedRef = React.useRef(false);
    const pinchRef = React.useRef<{
        ids: [number, number];
        startDistance: number;
        startPose: CameraPose;
        anchorMapPoint: MapScenePoint;
    } | null>(null);
    const velocityRef = React.useRef({ x: 0, y: 0 });
    const inertiaActiveRef = React.useRef(false);
    const cameraActiveRef = React.useRef(false);
    const suppressTapRef = React.useRef(false);
    const pendingEmitRef = React.useRef<CameraPose | null>(null);
    const emitFrameRef = React.useRef<number | null>(null);
    const lastHoveredRegionIdRef = React.useRef<string | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const prefersReducedMotion = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const onInteractionRef = React.useRef(onInteraction);
    const onViewportChangeRef = React.useRef(onViewportChange);
    onInteractionRef.current = onInteraction;
    onViewportChangeRef.current = onViewportChange;

    const emitViewport = React.useCallback((nextPose: CameraPose) => {
        pendingEmitRef.current = copyPose(nextPose);
        if (emitFrameRef.current !== null || typeof window === 'undefined') return;
        emitFrameRef.current = window.requestAnimationFrame(() => {
            emitFrameRef.current = null;
            const pendingPose = pendingEmitRef.current;
            pendingEmitRef.current = null;
            if (!pendingPose) return;
            lastEmittedPoseRef.current = copyPose(pendingPose);
            onViewportChangeRef.current?.(pendingPose);
        });
    }, []);

    React.useEffect(() => () => {
        if (emitFrameRef.current !== null) {
            window.cancelAnimationFrame(emitFrameRef.current);
        }
        emitFrameRef.current = null;
        pendingEmitRef.current = null;
    }, []);

    React.useEffect(() => {
        const nextPose = copyPose(viewport);
        const isOwnUpdate = poseDistance(nextPose, lastEmittedPoseRef.current) < 0.001;
        if (!cameraActiveRef.current || !isOwnUpdate) {
            desiredPoseRef.current = nextPose;
            if (prefersReducedMotion || !cameraActiveRef.current) {
                renderedPoseRef.current = copyPose(nextPose);
            }
        }
    }, [prefersReducedMotion, viewport.panX, viewport.panY, viewport.zoom]);

    const getMapPoint = React.useCallback((screen: CameraPoint): MapScenePoint => {
        const point = mapPointAtScreen(screen, renderedPoseRef.current, origin, baseScale);
        return {
            x: clamp(point.x, 0, mapWidth),
            y: clamp(point.y, 0, mapHeight),
        };
    }, [baseScale, mapHeight, mapWidth, origin]);

     const updateHoveredRegion = React.useCallback((screen: CameraPoint) => {
        if (!interactive || !regionSelectionEnabled) return;
        const nextRegionId = resolveRegionId(getMapPoint(screen));
        if (nextRegionId === lastHoveredRegionIdRef.current) return;
        lastHoveredRegionIdRef.current = nextRegionId;
        onInteractionRef.current?.({ type: 'hover-region', regionId: nextRegionId });
    }, [getMapPoint, interactive, regionSelectionEnabled, resolveRegionId]);

    const setDesiredPose = React.useCallback((nextPose: CameraPose) => {
        const clampedPose = {
            zoom: clamp(nextPose.zoom, minimumZoom, maximumZoom),
            panX: nextPose.panX,
            panY: nextPose.panY,
        };
        desiredPoseRef.current = clampedPose;
        cameraActiveRef.current = true;
        emitViewport(clampedPose);
    }, [emitViewport, maximumZoom, minimumZoom]);

    const beginDrag = React.useCallback((pointerId: number, point: CameraPoint) => {
        dragPointerIdRef.current = pointerId;
        dragStartRef.current = point;
        lastPointerRef.current = { point, timestamp: performance.now() };
        dragStartedRef.current = false;
        suppressTapRef.current = false;
        velocityRef.current = { x: 0, y: 0 };
        inertiaActiveRef.current = false;
        cameraActiveRef.current = true;
    }, []);

    const beginPinch = React.useCallback(() => {
        const entries = Array.from(activePointersRef.current.entries()).slice(0, 2);
        if (entries.length < 2) return;
        const [first, second] = entries.map(([, point]) => point);
        const startDistance = Math.hypot(second.x - first.x, second.y - first.y);
        if (startDistance < PINCH_MIN_DISTANCE) return;
        const startCenter = {
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
        };
        const startPose = copyPose(desiredPoseRef.current);
        pinchRef.current = {
            ids: [entries[0][0], entries[1][0]],
            startDistance,
            startPose,
            anchorMapPoint: mapPointAtScreen(startCenter, startPose, origin, baseScale),
        };
        dragPointerIdRef.current = null;
        dragStartedRef.current = false;
        suppressTapRef.current = true;
        velocityRef.current = { x: 0, y: 0 };
        inertiaActiveRef.current = false;
        cameraActiveRef.current = true;
        setIsDragging(false);
    }, [baseScale, origin]);

    const handlePointerDown = React.useCallback((event: FederatedPointerEvent) => {
        if (!interactive) return;
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        const nativeTarget = event.nativeEvent.currentTarget;
        if (nativeTarget && typeof (nativeTarget as HTMLCanvasElement).setPointerCapture === 'function') {
            (nativeTarget as HTMLCanvasElement).setPointerCapture(event.pointerId);
        }
        const point = { x: event.global.x, y: event.global.y };
        activePointersRef.current.set(event.pointerId, point);
        if (activePointersRef.current.size >= 2) {
            beginPinch();
            return;
        }
        beginDrag(event.pointerId, point);
    }, [beginDrag, beginPinch, interactive]);

    const handleGlobalPointerMove = React.useCallback((event: FederatedPointerEvent) => {
        if (!interactive) return;
        const point = { x: event.global.x, y: event.global.y };
        if (activePointersRef.current.has(event.pointerId)) {
            activePointersRef.current.set(event.pointerId, point);
        }
        updateHoveredRegion(point);

        const pinch = pinchRef.current;
        if (pinch && pinch.ids.includes(event.pointerId)) {
            const first = activePointersRef.current.get(pinch.ids[0]);
            const second = activePointersRef.current.get(pinch.ids[1]);
            if (!first || !second) return;
            const center = {
                x: (first.x + second.x) / 2,
                y: (first.y + second.y) / 2,
            };
            const distance = Math.hypot(second.x - first.x, second.y - first.y);
            if (distance < PINCH_MIN_DISTANCE) return;
            const nextZoom = clamp(
                pinch.startPose.zoom * (distance / pinch.startDistance),
                minimumZoom,
                maximumZoom,
            );
            setDesiredPose(poseForScreenAnchor(
                center,
                pinch.anchorMapPoint,
                nextZoom,
                origin,
                baseScale,
            ));
            return;
        }

        if (dragPointerIdRef.current !== event.pointerId) return;
        const last = lastPointerRef.current;
        const deltaX = point.x - last.point.x;
        const deltaY = point.y - last.point.y;
        const totalDistance = Math.hypot(
            point.x - dragStartRef.current.x,
            point.y - dragStartRef.current.y,
        );
        if (!dragStartedRef.current && totalDistance <= DRAG_THRESHOLD) return;

        const now = performance.now();
        const elapsedMs = Math.max(1, now - last.timestamp);
        const pose = desiredPoseRef.current;
        const nextPose = {
            ...pose,
            panX: pose.panX + deltaX,
            panY: pose.panY + deltaY,
        };
        const sampleVelocity = {
            x: (deltaX / elapsedMs) * 1000,
            y: (deltaY / elapsedMs) * 1000,
        };
        velocityRef.current = {
            x: sampleVelocity.x * INERTIA_VELOCITY_SMOOTHING
                + velocityRef.current.x * (1 - INERTIA_VELOCITY_SMOOTHING),
            y: sampleVelocity.y * INERTIA_VELOCITY_SMOOTHING
                + velocityRef.current.y * (1 - INERTIA_VELOCITY_SMOOTHING),
        };
        dragStartedRef.current = true;
        suppressTapRef.current = true;
        cameraActiveRef.current = true;
        setIsDragging(true);
        desiredPoseRef.current = nextPose;
        emitViewport(nextPose);
        lastPointerRef.current = { point, timestamp: now };
    }, [baseScale, emitViewport, interactive, maximumZoom, minimumZoom, origin, setDesiredPose, updateHoveredRegion]);

    const handlePointerUp = React.useCallback((event: FederatedPointerEvent) => {
        if (!interactive) return;
        activePointersRef.current.delete(event.pointerId);

        if (pinchRef.current?.ids.includes(event.pointerId)) {
            pinchRef.current = null;
            const remaining = Array.from(activePointersRef.current.entries())[0];
            if (remaining) {
                beginDrag(remaining[0], remaining[1]);
            } else {
                dragPointerIdRef.current = null;
                cameraActiveRef.current = false;
            }
            return;
        }

        if (dragPointerIdRef.current !== event.pointerId) return;
        dragPointerIdRef.current = null;
        setIsDragging(false);
        if (
            dragStartedRef.current
            && inertiaEnabled
            && !prefersReducedMotion
            && Math.hypot(velocityRef.current.x, velocityRef.current.y) >= INERTIA_MIN_SPEED
        ) {
            inertiaActiveRef.current = true;
            cameraActiveRef.current = true;
        } else {
            velocityRef.current = { x: 0, y: 0 };
            inertiaActiveRef.current = false;
            cameraActiveRef.current = false;
        }
        dragStartedRef.current = false;
    }, [beginDrag, inertiaEnabled, interactive, prefersReducedMotion]);

    const handlePointerCancel = React.useCallback((event: FederatedPointerEvent) => {
        activePointersRef.current.delete(event.pointerId);
        pinchRef.current = null;
        dragPointerIdRef.current = null;
        velocityRef.current = { x: 0, y: 0 };
        inertiaActiveRef.current = false;
        cameraActiveRef.current = false;
        setIsDragging(false);
    }, []);

    const handlePointerTap = React.useCallback((event: FederatedPointerEvent) => {
        if (!interactive) return;
        if (!regionSelectionEnabled) {
            suppressTapRef.current = false;
            return;
        }
        if (suppressTapRef.current) {
            suppressTapRef.current = false;
            return;
        }
        const regionId = resolveRegionId(getMapPoint({ x: event.global.x, y: event.global.y }));
        if (regionId) {
            onInteractionRef.current?.({ type: 'select-region', regionId });
        }
    }, [getMapPoint, interactive, regionSelectionEnabled, resolveRegionId]);

    const handlePointerOut = React.useCallback(() => {
        if (!interactive || activePointersRef.current.size > 0) return;
        if (lastHoveredRegionIdRef.current === null) return;
        lastHoveredRegionIdRef.current = null;
        onInteractionRef.current?.({ type: 'hover-region', regionId: null });
    }, [interactive]);

    const applyWheel = React.useCallback((
        deltaY: number,
        deltaMode: number,
        pointer: CameraPoint,
    ) => {
        const pageHeight = Math.max(1, isInitialised ? app.screen.height : 1);
        let delta = deltaY;
        if (deltaMode === 1) delta *= 16;
        if (deltaMode === 2) delta *= pageHeight;
        const currentPose = desiredPoseRef.current;
        const nextZoom = clamp(
            currentPose.zoom * Math.exp(-delta * WHEEL_SENSITIVITY),
            minimumZoom,
            maximumZoom,
        );
        if (Math.abs(nextZoom - currentPose.zoom) < 0.0001) return;
        const anchorMapPoint = mapPointAtScreen(pointer, currentPose, origin, baseScale);
        setDesiredPose(poseForScreenAnchor(
            pointer,
            anchorMapPoint,
            nextZoom,
            origin,
            baseScale,
        ));
    }, [app, baseScale, isInitialised, maximumZoom, minimumZoom, origin, setDesiredPose]);

    const handleNativeWheel = React.useCallback((event: WheelEvent) => {
        if (!interactive || !isInitialised) return;
        if (!app.canvas.contains(event.target as Node)) return;
        event.stopPropagation();
        event.preventDefault();
        const rect = app.canvas.getBoundingClientRect();
        const screen = {
            x: (event.clientX - rect.left) * app.screen.width / Math.max(1, rect.width),
            y: (event.clientY - rect.top) * app.screen.height / Math.max(1, rect.height),
        };
        applyWheel(event.deltaY, event.deltaMode, screen);
    }, [app, applyWheel, interactive, isInitialised]);

    React.useEffect(() => {
        if (!isInitialised) return undefined;
        window.addEventListener('wheel', handleNativeWheel, { passive: false, capture: true });
        return () => window.removeEventListener('wheel', handleNativeWheel, true);
    }, [app, handleNativeWheel, isInitialised]);

    useTick((ticker) => {
        if (!isInitialised) return;
        hitAreaRef.current.width = app.screen.width;
        hitAreaRef.current.height = app.screen.height;

        const world = worldRef.current;
        if (!world) return;
        const dt = Math.min(0.25, Math.max(0, ticker.deltaMS / 1000));
        const desiredPose = desiredPoseRef.current;

        if (
            inertiaActiveRef.current
            && dragPointerIdRef.current === null
            && pinchRef.current === null
        ) {
            desiredPose.panX += velocityRef.current.x * dt;
            desiredPose.panY += velocityRef.current.y * dt;
            const decay = Math.exp(-INERTIA_DAMPING * dt);
            velocityRef.current.x *= decay;
            velocityRef.current.y *= decay;
            if (Math.hypot(velocityRef.current.x, velocityRef.current.y) < INERTIA_MIN_SPEED) {
                velocityRef.current = { x: 0, y: 0 };
                inertiaActiveRef.current = false;
                cameraActiveRef.current = false;
            }
            emitViewport(desiredPose);
        }

        const renderedPose = renderedPoseRef.current;
        const alpha = prefersReducedMotion
            ? 1
            : 1 - Math.exp(-CAMERA_DAMPING * dt);
        renderedPose.panX += (desiredPose.panX - renderedPose.panX) * alpha;
        renderedPose.panY += (desiredPose.panY - renderedPose.panY) * alpha;
        renderedPose.zoom += (desiredPose.zoom - renderedPose.zoom) * alpha;
        if (prefersReducedMotion || poseDistance(renderedPose, desiredPose) < 0.001) {
            renderedPose.panX = desiredPose.panX;
            renderedPose.panY = desiredPose.panY;
            renderedPose.zoom = desiredPose.zoom;
        }
        world.position.set(origin.x + renderedPose.panX, origin.y + renderedPose.panY);
        world.scale.set(baseScale * renderedPose.zoom);
    });

    return (
        <>
            <pixiContainer
                label="camera-input"
                eventMode={interactive ? 'static' : 'none'}
                hitArea={hitAreaRef.current}
                cursor={interactive ? (isDragging ? 'grabbing' : 'grab') : 'default'}
                onPointerDown={handlePointerDown}
                onGlobalPointerMove={handleGlobalPointerMove}
                onPointerUp={handlePointerUp}
                onPointerUpOutside={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onPointerTap={handlePointerTap}
                onPointerOut={handlePointerOut}
            />
            <pixiContainer ref={worldRef} label="map-world" eventMode="none">
                <pixiSprite texture={texture} width={mapWidth} height={mapHeight} eventMode="none" />
                {regions.map((region) => (
                    <RegionShape
                        key={region.id}
                        region={region}
                        selected={region.id === selectedRegionId}
                        hovered={region.id === hoveredRegionId}
                    />
                ))}
            </pixiContainer>
        </>
    );
};

const RegionShape: React.FC<{
    region: MapSceneRegion;
    selected: boolean;
    hovered: boolean;
}> = ({ region, selected, hovered }) => {
    const points = React.useMemo(
        () => region.polygon.flatMap(({ x, y }) => [x, y]),
        [region.polygon],
    );
    const draw = React.useCallback((graphics: Graphics) => {
        graphics.clear();
        graphics.poly(points, true);
        graphics.fill({
            color: selected ? 0xffefb0 : hovered ? 0xffd77a : 0xffefb0,
            alpha: selected ? 0.18 : hovered ? 0.12 : 0.025,
        });
        graphics.stroke({
            color: selected ? 0xfff8d479 : 0xf3dfab,
            alpha: selected ? 0.92 : hovered ? 0.72 : 0.24,
            width: selected ? 3 : hovered ? 2.5 : 1.25,
        });
    }, [hovered, points, selected]);

    return <pixiGraphics draw={draw} eventMode="none" />;
};

export const PixiMapSceneHost: React.FC<PixiMapSceneHostProps> = ({
    backgroundUrl,
    mapWidth,
    mapHeight,
    viewport,
    onViewportChange,
    minimumZoom = 0.5,
    maximumZoom = 5,
    wheelZoomFactor: _wheelZoomFactor = 1.14,
    inertiaEnabled = true,
    origin = { x: 0, y: 0 },
    baseScale = 1,
    regions = [],
    selectedRegionId = null,
    hoveredRegionId = null,
    hitTestRegionAtPoint,
    onInteraction,
    onResourceStateChange,
    interactive = false,
    regionSelectionEnabled = true,
    canvasTestId = 'pixi-map-scene-canvas',
    resourceErrorLabel = '地图资源加载失败',
    className = '',
    ariaLabel = 'Pixi 地图场景',
}) => {
    const hostRef = React.useRef<HTMLDivElement>(null);
    const onResourceStateChangeRef = React.useRef(onResourceStateChange);
    const [texture, setTexture] = React.useState(Texture.EMPTY);
    const [resourceState, setResourceState] = React.useState<MapSceneResourceStatus>({
        status: 'loading',
        resourceUrl: backgroundUrl,
    });

    onResourceStateChangeRef.current = onResourceStateChange;

    React.useEffect(() => {
        let cancelled = false;
        const loadingState: MapSceneResourceStatus = { status: 'loading', resourceUrl: backgroundUrl };
        setTexture(Texture.EMPTY);
        setResourceState(loadingState);
        onResourceStateChangeRef.current?.(loadingState);

        Assets.load(backgroundUrl)
            .then((nextTexture) => {
                if (cancelled) return;
                setTexture(nextTexture);
                const readyState: MapSceneResourceStatus = { status: 'ready', resourceUrl: backgroundUrl };
                setResourceState(readyState);
                onResourceStateChangeRef.current?.(readyState);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                const errorState: MapSceneResourceStatus = { status: 'error', resourceUrl: backgroundUrl, error };
                setResourceState(errorState);
                onResourceStateChangeRef.current?.(errorState);
            });

        return () => {
            cancelled = true;
        };
    }, [backgroundUrl]);

    const resolveRegionId = React.useCallback((point: MapScenePoint): string | null => (
        hitTestRegionAtPoint?.(point)
        ?? resolveRegionFromPolygons(point, regions)
    ), [hitTestRegionAtPoint, regions]);

    const handleInit = React.useCallback((app: { canvas?: unknown }) => {
        const canvas = app.canvas;
        if (canvas && typeof (canvas as { setAttribute?: unknown }).setAttribute === 'function') {
            (canvas as HTMLCanvasElement).setAttribute('data-testid', canvasTestId);
            (canvas as HTMLCanvasElement).setAttribute('aria-label', ariaLabel);
        }
    }, [ariaLabel, canvasTestId]);

    return (
        <div
            ref={hostRef}
            className={`absolute inset-0 overflow-hidden ${className}`}
            data-testid={`${canvasTestId}-host`}
            data-map-renderer="pixi"
            data-map-resource-status={resourceState.status}
            style={{ pointerEvents: interactive ? 'auto' : 'none' }}
        >
            <Application
                autoStart
                resizeTo={hostRef}
                backgroundAlpha={0}
                antialias
                eventFeatures={{ wheel: false }}
                onInit={handleInit}
            >
                <CameraWorld
                    texture={texture}
                    mapWidth={mapWidth}
                    mapHeight={mapHeight}
                    viewport={viewport}
                    onViewportChange={onViewportChange}
                    minimumZoom={minimumZoom}
                    maximumZoom={maximumZoom}
                    inertiaEnabled={inertiaEnabled}
                    origin={origin}
                    baseScale={baseScale}
                    regions={regions}
                    selectedRegionId={selectedRegionId}
                    hoveredRegionId={hoveredRegionId}
                    resolveRegionId={resolveRegionId}
                     onInteraction={onInteraction}
                     interactive={interactive}
                     regionSelectionEnabled={regionSelectionEnabled}
                 />
            </Application>
            {resourceState.status === 'error' ? (
                <div
                    data-testid={`${canvasTestId}-resource-error`}
                    className="pointer-events-none absolute inset-0 grid place-items-center bg-[rgba(32,18,7,0.72)] px-6 text-center text-sm font-bold text-[#fff4c9]"
                >
                    {resourceErrorLabel}
                </div>
            ) : null}
        </div>
    );
};
