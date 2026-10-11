import React from 'react';
import { Application, extend } from '@pixi/react';
import {
    Assets,
    Container,
    Graphics,
    Polygon,
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
    origin?: MapScenePoint;
    baseScale?: number;
    regions?: readonly MapSceneRegion[];
    selectedRegionId?: string | null;
    hoveredRegionId?: string | null;
    hitTestRegionAtPoint?: MapSceneRegionHitTest;
    onInteraction?: (intent: MapInteractionIntent) => void;
    onResourceStateChange?: (state: MapSceneResourceStatus) => void;
    interactive?: boolean;
    canvasTestId?: string;
    resourceErrorLabel?: string;
    className?: string;
    ariaLabel?: string;
}

const clamp = (value: number, min: number, max: number): number => (
    Math.min(max, Math.max(min, value))
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
    origin = { x: 0, y: 0 },
    baseScale = 1,
    regions = [],
    selectedRegionId = null,
    hoveredRegionId = null,
    hitTestRegionAtPoint,
    onInteraction,
    onResourceStateChange,
    interactive = false,
    canvasTestId = 'pixi-map-scene-canvas',
    resourceErrorLabel = '地图资源加载失败',
    className = '',
    ariaLabel = 'Pixi 地图场景',
}) => {
    const hostRef = React.useRef<HTMLDivElement>(null);
    const worldRef = React.useRef<Container>(null);
    const onResourceStateChangeRef = React.useRef(onResourceStateChange);
    const lastHoveredRegionIdRef = React.useRef<string | null>(null);
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

    const getMapPoint = React.useCallback((event: FederatedPointerEvent): MapScenePoint | null => {
        const world = worldRef.current;
        if (!world) return null;
        const localPoint = event.getLocalPosition(world);
        return {
            x: clamp(localPoint.x, 0, mapWidth),
            y: clamp(localPoint.y, 0, mapHeight),
        };
    }, [mapHeight, mapWidth]);

    const handlePointerMove = React.useCallback((event: FederatedPointerEvent) => {
        if (!interactive) return;
        const point = getMapPoint(event);
        if (!point) return;
        const nextRegionId = resolveRegionId(point);
        if (nextRegionId === lastHoveredRegionIdRef.current) return;
        lastHoveredRegionIdRef.current = nextRegionId;
        onInteraction?.({ type: 'hover-region', regionId: nextRegionId });
    }, [getMapPoint, interactive, onInteraction, resolveRegionId]);

    const handlePointerOut = React.useCallback(() => {
        if (!interactive || lastHoveredRegionIdRef.current == null) return;
        lastHoveredRegionIdRef.current = null;
        onInteraction?.({ type: 'hover-region', regionId: null });
    }, [interactive, onInteraction]);

    const handleClick = React.useCallback((event: FederatedPointerEvent) => {
        if (!interactive) return;
        const point = getMapPoint(event);
        if (!point) return;
        const regionId = resolveRegionId(point);
        if (regionId) {
            onInteraction?.({ type: 'select-region', regionId });
        }
    }, [getMapPoint, interactive, onInteraction, resolveRegionId]);

    const drawSurface = React.useCallback((graphics: Graphics) => {
        graphics.clear();
        graphics.rect(0, 0, mapWidth, mapHeight);
        graphics.fill({ color: 0xffffff, alpha: 0.001 });
    }, [mapHeight, mapWidth]);

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
                onInit={handleInit}
            >
                <pixiContainer
                    ref={worldRef}
                    x={origin.x + viewport.panX}
                    y={origin.y + viewport.panY}
                    scale={baseScale * viewport.zoom}
                >
                    <pixiSprite texture={texture} width={mapWidth} height={mapHeight} />
                    {regions.map((region) => (
                        <RegionShape
                            key={region.id}
                            region={region}
                            selected={region.id === selectedRegionId}
                            hovered={region.id === hoveredRegionId}
                        />
                    ))}
                    <pixiGraphics
                        draw={drawSurface}
                        eventMode={interactive ? 'static' : 'none'}
                        cursor={interactive ? 'pointer' : 'default'}
                        onPointerMove={handlePointerMove}
                        onPointerOut={handlePointerOut}
                        onClick={handleClick}
                    />
                </pixiContainer>
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
