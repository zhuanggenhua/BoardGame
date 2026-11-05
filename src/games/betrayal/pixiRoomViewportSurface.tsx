import React from 'react';
import { useReducedMotionPreference } from '../../hooks/ui/useReducedMotionPreference';
import { BetrayalDiscoveryMist, type DiscoveryMistHandle } from './discoveryMistSurface';
import { BetrayalRoomLighting } from './roomLightingSurface';
import { BetrayalExplorerLight, type ExplorerLightHandle } from './explorerLightSurface';
import {
    PixiMapSceneHost,
    type MapScenePoint,
    type MapSceneSprite,
    type MapSceneSpriteMotionPhaseCallback,
    type MapSceneSpriteMotionFrameCallback,
    type MapViewportState,
} from '../../engine/mapRenderer';
import type { ZoomPanViewportFitInsets } from '../../components/game/framework/ZoomPanViewport';

const ORIGIN = { x: 0, y: 0 };

/** Pixi owns the camera; remaining accessible/decision overlays only consume its displayed pose. */
export const BetrayalPixiRoomViewport = React.forwardRef<HTMLDivElement, {
    sprites: readonly MapSceneSprite[];
    lightingRooms?: readonly MapSceneSprite[];
    activeExplorerId?: string;
    onMotionComplete?: (spriteId: string, motionId: string) => void;
    onMotionPhase?: MapSceneSpriteMotionPhaseCallback;
    onResourceError?: () => void;
    width: number;
    height: number;
    /** Preserved across floor-keyed remounts; each floor still starts centered on its own bounds. */
    initialZoom?: number;
    focusPoint: MapScenePoint | null;
    focusKey?: number;
    focusTarget?: string | null;
    focusMode?: 'automatic' | 'explicit';
    manualCameraOwned?: boolean;
    onZoomChange?: (zoom: number) => void;
    onManualCameraInteraction?: () => void;
    fitInsets?: ZoomPanViewportFitInsets;
    children: React.ReactNode;
    ariaLabel: string;
}>(({ sprites, lightingRooms, activeExplorerId, onMotionComplete, onMotionPhase, onResourceError, width, height, initialZoom, focusPoint, focusKey, focusTarget, focusMode = 'automatic', manualCameraOwned = false, onZoomChange, onManualCameraInteraction, fitInsets, children, ariaLabel }, forwardedRef) => {
    const mistHandles = React.useRef(new Map<string, DiscoveryMistHandle>());
    const explorerLight = React.useRef<ExplorerLightHandle>(null);
    const activeExplorer = sprites.find(sprite => sprite.id === activeExplorerId);
    const drawMotionFrame = React.useCallback<MapSceneSpriteMotionFrameCallback>((spriteId, motionId, progress) => {
        mistHandles.current.get(`${spriteId}:${motionId}`)?.renderFrame(progress);
        explorerLight.current?.presentMotion(spriteId, motionId, progress);
    }, []);
    const [host, setHost] = React.useState<HTMLDivElement | null>(null);
    const overlayRef = React.useRef<HTMLDivElement>(null);
    const poseRef = React.useRef<MapViewportState>({ zoom: 1, panX: 0, panY: 0 });
    const [viewport, setViewport] = React.useState<MapViewportState>({ zoom: 1, panX: 0, panY: 0 });
    const [size, setSize] = React.useState({ width: 0, height: 0 });
    const [mapReady, setMapReady] = React.useState(false);
    // Initial/floor entry starts only after actual scene readiness, not while atlases load.
    // Later discoveries keep the already presented map visible.
    const [sceneVisible, setSceneVisible] = React.useState(false);
    const reducedMotion = useReducedMotionPreference();
    const initialisedRef = React.useRef(false);
    const consumedFocus = React.useRef<{ key: number | undefined } | null>(null);
    const focusRef = React.useRef(focusPoint);
    React.useLayoutEffect(() => { focusRef.current = focusPoint; }, [focusPoint]);
    React.useImperativeHandle(forwardedRef, () => host!, [host]);

    React.useLayoutEffect(() => {
        if (!host) return;
        const resize = () => setSize({ width: host.clientWidth, height: host.clientHeight });
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        return () => observer.disconnect();
    }, [host]);

    const insets = React.useMemo(() => {
        // Insets are authored in shell units, just like the room scene. Keep a usable narrow viewport.
        const horizontalScale = Math.min(1, size.width / 1000);
        return {
            left: (fitInsets?.left ?? 0) * horizontalScale,
            right: (fitInsets?.right ?? 0) * horizontalScale,
            top: fitInsets?.top ?? 0,
            bottom: fitInsets?.bottom ?? 0,
        };
    }, [fitInsets, size.width]);

    React.useLayoutEffect(() => {
        if (initialisedRef.current || size.width <= 0 || size.height <= 0) return;
        initialisedRef.current = true;
        const availableWidth = Math.max(1, size.width - insets.left - insets.right);
        const availableHeight = Math.max(1, size.height - insets.top - insets.bottom);
        const fitZoom = Math.min(1, Math.max(0.55, Math.min(availableWidth / width, availableHeight / height)));
        const zoom = Math.min(2.4, Math.max(0.55, initialZoom ?? fitZoom));
        const initialViewport = {
            zoom,
            panX: insets.left + availableWidth / 2 - width * zoom / 2,
            panY: insets.top + availableHeight / 2 - height * zoom / 2,
        };
        poseRef.current = initialViewport;
        setViewport(initialViewport);
    }, [height, insets, initialZoom, size, width]);

    React.useEffect(() => {
        const point = focusRef.current;
        if (!point || !host || !initialisedRef.current || (consumedFocus.current && consumedFocus.current.key === focusKey)) return;
        consumedFocus.current = { key: focusKey };
        if (focusMode === 'automatic' && manualCameraOwned) return;
        const current = poseRef.current;
        const x = point.x * current.zoom + current.panX;
        const y = point.y * current.zoom + current.panY;
        const left = insets.left + 48;
        const right = size.width - insets.right - 48;
        const top = insets.top + 48;
        const bottom = size.height - insets.bottom - 48;
        if (focusMode === 'explicit') {
            setViewport({
                ...current,
                panX: (left + right) / 2 - point.x * current.zoom,
                panY: (top + bottom) / 2 - point.y * current.zoom,
            });
            return;
        }
        // Movement follow only repairs visibility. It never recenters a visible target or resets zoom.
        if (x >= left && x <= right && y >= top && y <= bottom) return;
        setViewport({
            ...current,
            panX: current.panX + Math.min(Math.max(x, left), Math.max(left, right)) - x,
            panY: current.panY + Math.min(Math.max(y, top), Math.max(top, bottom)) - y,
        });
    }, [focusKey, focusMode, focusPoint, host, insets, manualCameraOwned, size]);

    const handleViewportChange = React.useCallback((nextViewport: MapViewportState) => {
        setViewport(nextViewport);
        onZoomChange?.(nextViewport.zoom);
    }, [onZoomChange]);

    const projectOverlay = React.useCallback((pose: MapViewportState) => {
        poseRef.current = pose;
        if (overlayRef.current) {
            overlayRef.current.style.transform = `translate(${pose.panX}px, ${pose.panY}px) scale(${pose.zoom})`;
        }
        if (host) {
            host.setAttribute('data-zoom', String(pose.zoom));
            host.setAttribute('data-pan-x', String(pose.panX));
            host.setAttribute('data-pan-y', String(pose.panY));
        }
    }, [host]);

    return <div ref={setHost} data-testid="betrayal-room-grid" data-room-focus-pan-target={focusTarget ?? undefined} className="relative h-full min-h-0 w-full overflow-hidden" style={{ touchAction: 'none', opacity: sceneVisible ? 1 : 0, transition: reducedMotion ? 'none' : 'opacity 300ms ease-out' }}>
        <PixiMapSceneHost
            sprites={sprites}
            sceneForeground={<>
                {lightingRooms ? <BetrayalRoomLighting rooms={lightingRooms} width={width} height={height} ready={mapReady} reducedMotion={reducedMotion} /> : null}
                {activeExplorer ? <BetrayalExplorerLight ref={explorerLight} sprite={activeExplorer} ready={mapReady} reducedMotion={reducedMotion} /> : null}
                {sprites.filter(sprite => sprite.motion?.kind === 'reveal' && sprite.motion.durationMs > 0).map(sprite => (
                <BetrayalDiscoveryMist key={`${sprite.id}:${sprite.motion!.id}`} ref={handle => {
                    const key = `${sprite.id}:${sprite.motion!.id}`;
                    if (handle) mistHandles.current.set(key, handle);
                    else mistHandles.current.delete(key);
                }} sprite={sprite} mapWidth={width} mapHeight={height} />
            ))}
            </>}
            onSpriteMotionFrame={drawMotionFrame}
            onSpriteMotionComplete={onMotionComplete}
            onSpriteMotionPhase={onMotionPhase}
            onResourceStateChange={state => {
                setMapReady(state.status === 'ready');
                if (state.status === 'ready' || state.status === 'error') setSceneVisible(true);
                if (state.status === 'error') onResourceError?.();
            }}
            inputElement={host}
            mapWidth={width}
            mapHeight={height}
            viewport={viewport}
            onViewportChange={handleViewportChange}
            onManualCameraInteraction={onManualCameraInteraction}
            onDisplayViewportChange={projectOverlay}
            origin={ORIGIN}
            minimumZoom={0.55}
            maximumZoom={2.4}
            interactive
            regionSelectionEnabled={false}
            canvasTestId="betrayal-pixi-map-canvas"
            ariaLabel={ariaLabel}
        />
        <div ref={overlayRef} data-testid="betrayal-room-canvas" inert={!mapReady} aria-hidden={!mapReady} className="pointer-events-none absolute left-0 top-0" style={{ width, height, transformOrigin: '0 0', visibility: mapReady ? 'visible' : 'hidden' }}>
            {children}
        </div>
    </div>;
});
BetrayalPixiRoomViewport.displayName = 'BetrayalPixiRoomViewport';
