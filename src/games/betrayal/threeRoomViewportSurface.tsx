import React from 'react';
import { SRGBColorSpace, WebGLRenderer } from 'three';
import { BetrayalPixiRoomViewport } from './pixiRoomViewportSurface';
import { createBetrayalRoomCamera } from './threeRoomCamera';
import { createBetrayalThreeScene, type SceneFigureAsset } from './threeRoomScene';

type Props = React.ComponentPropsWithoutRef<typeof BetrayalPixiRoomViewport> & {
    figures: ReadonlyMap<string, SceneFigureAsset>;
};

export const BetrayalRoomViewport = React.forwardRef<HTMLDivElement, Props>((props, forwardedRef) => {
    const { figures, ...shared } = props;
    const {
        sprites, lightingRooms, activeExplorerId, width, height, initialZoom, fitInsets, focusPoint, focusKey,
        focusTarget, focusMode, manualCameraOwned, onZoomChange, onManualCameraInteraction,
        onMotionComplete, onMotionPhase, children, ariaLabel,
    } = shared;
    const [fallback, setFallback] = React.useState(() => typeof WebGL2RenderingContext === 'undefined');
    const [ready, setReady] = React.useState(false);
    const hostRef = React.useRef<HTMLDivElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const overlayRef = React.useRef<HTMLDivElement>(null);
    const rendererOwner = React.useRef<{
        scene: ReturnType<typeof createBetrayalThreeScene>;
        camera: ReturnType<typeof createBetrayalRoomCamera>;
    } | null>(null);
    const callbacks = React.useRef({ onZoomChange, onManualCameraInteraction });
    React.useLayoutEffect(() => {
        callbacks.current = { onZoomChange, onManualCameraInteraction };
    }, [onZoomChange, onManualCameraInteraction]);
    const consumedFocus = React.useRef<{ key?: number } | null>(null);
    const setHost = React.useCallback((host: HTMLDivElement | null) => {
        hostRef.current = host;
        if (typeof forwardedRef === 'function') forwardedRef(host);
        else if (forwardedRef) forwardedRef.current = host;
    }, [forwardedRef]);

    React.useLayoutEffect(() => {
        const host = hostRef.current;
        const canvas = canvasRef.current;
        const overlay = overlayRef.current;
        if (fallback || !host || !canvas || !overlay) return;
        let renderer: WebGLRenderer;
        try {
            renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
        } catch (error) {
            console.warn('Betrayal 3D renderer unavailable', error);
            setFallback(true);
            return;
        }
        renderer.outputColorSpace = SRGBColorSpace;
        const onContextLost = () => {
            console.warn('Betrayal 3D context lost');
            setFallback(true);
        };
        canvas.addEventListener('webglcontextlost', onContextLost);
        let displayWidth = 0;
        let displayHeight = 0;
        let displayRatio = 0;
        const camera = createBetrayalRoomCamera(host, overlay, {
            initialZoom: () => initialZoom?.(),
            onZoomChange: zoom => callbacks.current.onZoomChange?.(zoom),
            onManualInteraction: () => callbacks.current.onManualCameraInteraction?.(),
            onChange: (width, height) => {
                const ratio = Math.min(1.6, (window.devicePixelRatio || 1) * host.getBoundingClientRect().width / width);
                if (width !== displayWidth || height !== displayHeight || ratio !== displayRatio) {
                    displayWidth = width;
                    displayHeight = height;
                    displayRatio = ratio;
                    renderer.setPixelRatio(ratio);
                    renderer.setSize(width, height, false);
                }
                scene.renderSoon();
            },
            onTapFigure: (point, target) => {
                const control = target instanceof Element ? target.closest('button, [role="button"], a') : null;
                if (control && !control.hasAttribute('data-room-state')) return false;
                const figureId = scene.pickFigure(point);
                if (!figureId) return false;
                const candidates = host.querySelectorAll<HTMLButtonElement>('[data-scene-figure-id]');
                const button = [...candidates].find(candidate => candidate.dataset.sceneFigureId === figureId);
                if (!button || button.disabled || button.tabIndex < 0 || getComputedStyle(button).visibility !== 'visible') return false;
                button.click();
                return true;
            },
        });
        const scene = createBetrayalThreeScene(renderer, camera.camera, (status, models) => {
            host.dataset.mapResourceStatus = status;
            host.dataset.visibleExplorerModels = String(models.explorers);
            host.dataset.visibleMonsterModels = String(models.monsters);
            if (status === 'ready') setReady(true);
            if (status === 'error') setFallback(true);
        });
        rendererOwner.current = { camera, scene };
        return () => {
            rendererOwner.current = null;
            canvas.removeEventListener('webglcontextlost', onContextLost);
            camera.dispose();
            scene.dispose();
            renderer.dispose();
        };
    }, [fallback, initialZoom]);

    React.useLayoutEffect(() => {
        const host = hostRef.current;
        const owner = rendererOwner.current;
        if (!host || !owner) return;
        const resize = () => owner.camera.useBounds(width, height, fitInsets);
        resize();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        window.addEventListener('resize', resize);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', resize);
        };
    }, [width, height, fitInsets, fallback]);

    React.useLayoutEffect(() => {
        rendererOwner.current?.scene.update({
            sprites, figures, activeExplorerId,
            discoveredRoomIds: new Set(lightingRooms?.map(room => room.id)),
            onMotionComplete, onMotionPhase,
        });
    }, [sprites, figures, activeExplorerId, lightingRooms, onMotionComplete, onMotionPhase, fallback]);

    React.useLayoutEffect(() => {
        const camera = rendererOwner.current?.camera;
        if (!ready || !camera || !focusPoint || (consumedFocus.current && consumedFocus.current.key === focusKey)) return;
        consumedFocus.current = { key: focusKey };
        if (focusMode !== 'explicit' && manualCameraOwned) return;
        camera.focus(focusPoint, focusMode === 'explicit');
    }, [ready, focusKey, focusPoint, focusMode, manualCameraOwned]);

    if (fallback) return <BetrayalPixiRoomViewport ref={forwardedRef} {...shared} />;

    return <div ref={setHost}
        data-testid="betrayal-room-grid"
        data-map-renderer="three"
        data-map-resource-status="loading"
        data-room-focus-pan-target={focusTarget ?? undefined}
        className="relative h-full min-h-0 w-full overflow-hidden"
        style={{ touchAction: 'none' }}
    >
        <canvas ref={canvasRef} data-testid="betrayal-three-map-canvas" role="img" aria-label={ariaLabel}
            className="pointer-events-none absolute inset-0 h-full w-full"
            style={{ visibility: ready ? 'visible' : 'hidden' }} />
        <div ref={overlayRef} data-testid="betrayal-room-canvas" inert={!ready} aria-hidden={!ready}
            className="pointer-events-none absolute left-0 top-0"
            style={{ width, height, transformOrigin: '0 0', visibility: ready ? 'visible' : 'hidden' }}
        >{children}</div>
    </div>;
});
BetrayalRoomViewport.displayName = 'BetrayalRoomViewport';
