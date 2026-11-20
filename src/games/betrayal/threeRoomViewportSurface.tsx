import React from 'react';
import { SRGBColorSpace, Vector2, WebGLRenderer } from 'three';
import { BetrayalPixiRoomViewport } from './pixiRoomViewportSurface';
import { createBetrayalRoomCamera } from './threeRoomCamera';
import { createBetrayalThreeScene, type GirlMarkerTransfer, type SceneFigureAsset, type SceneMarker, type ScenePath } from './threeRoomScene';
import type { SceneHighlight } from './threeRoomOutline';
import './threeRoomInteraction.css';

type Props = React.ComponentPropsWithoutRef<typeof BetrayalPixiRoomViewport> & {
    figures: ReadonlyMap<string, SceneFigureAsset>;
    paths: readonly ScenePath[];
    markers: readonly SceneMarker[];
    girlTransfer?: GirlMarkerTransfer;
    hauntFocusRoomId?: string;
    interactionBlocked: boolean;
};

export const BetrayalRoomViewport = React.forwardRef<HTMLDivElement, Props>((props, forwardedRef) => {
    const { figures, paths, markers, girlTransfer, hauntFocusRoomId, interactionBlocked, ...shared } = props;
    const {
        sprites, lightingRooms, width, height, initialZoom, fitInsets, focusPoint, focusKey,
        focusTarget, focusMode, manualCameraOwned, onZoomChange, onManualCameraInteraction,
        onMotionComplete, onMotionPhase, children, ariaLabel,
    } = shared;
    const [fallback, setFallback] = React.useState(() => typeof WebGL2RenderingContext === 'undefined');
    const [ready, setReady] = React.useState(false);
    React.useLayoutEffect(() => {
        if (fallback && girlTransfer) girlTransfer.onComplete(girlTransfer.id);
    }, [fallback, girlTransfer]);
    const hostRef = React.useRef<HTMLDivElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const overlayRef = React.useRef<HTMLDivElement>(null);
    const rendererOwner = React.useRef<{
        scene: ReturnType<typeof createBetrayalThreeScene>;
        camera: ReturnType<typeof createBetrayalRoomCamera>;
    } | null>(null);
    const callbacks = React.useRef({ onZoomChange, onManualCameraInteraction });
    const interactionBlockedRef = React.useRef(interactionBlocked);
    React.useLayoutEffect(() => { interactionBlockedRef.current = interactionBlocked; }, [interactionBlocked]);
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
            scene.completePendingGirlTransfer();
            setFallback(true);
        };
        canvas.addEventListener('webglcontextlost', onContextLost);
        let displayWidth = 0;
        let displayHeight = 0;
        let displayRatio = 0;
        let diagnosticsFrame = 0;
        let pickSequence = 0;
        const controls = new Map<string, HTMLButtonElement>();
        const sceneHighlights = new Map<string, SceneHighlight>();
        const publishHitPoints = () => {
            if (diagnosticsFrame) return;
            diagnosticsFrame = requestAnimationFrame(() => {
                diagnosticsFrame = 0;
                const hostBounds = host.getBoundingClientRect();
                const writeScreenBounds = (element: HTMLElement, bounds?: ReturnType<typeof scene.getFigureScreenBounds>) => {
                    if (!bounds) {
                        delete element.dataset.tutorialScreenBounds;
                        delete element.dataset.screenFeedbackAnchorY;
                        return;
                    }
                    if (element.dataset.sceneFigureId) {
                        element.dataset.screenFeedbackAnchorY = (hostBounds.top + bounds.headY * hostBounds.height).toFixed(1);
                    }
                    element.dataset.tutorialScreenBounds = [
                        hostBounds.left + bounds.min.x * hostBounds.width,
                        hostBounds.top + bounds.min.y * hostBounds.height,
                        hostBounds.left + bounds.max.x * hostBounds.width,
                        hostBounds.top + bounds.max.y * hostBounds.height,
                    ].map(value => value.toFixed(1)).join(',');
                };
                for (const marker of host.querySelectorAll<HTMLElement>('[data-scene-marker-visual]')) {
                    const bounds = scene.getMarkerScreenBounds(marker.dataset.sceneMarkerVisual!);
                    marker.toggleAttribute('data-three-marker-ready', Boolean(bounds));
                    writeScreenBounds(marker, bounds);
                }
                for (const [id, button] of controls) {
                    if (!button.dataset.sceneFigureId) continue;
                    writeScreenBounds(button, scene.getFigureScreenBounds(id));
                    if (import.meta.env.VITE_E2E_LOCAL_ASSETS_ONLY !== 'true') continue;
                    const point = scene.getFigureHitPoint(id);
                    if (point) button.dataset.threeHitPoint = JSON.stringify([(point.x + 1) / 2, (1 - point.y) / 2]);
                    else delete button.dataset.threeHitPoint;
                }
            });
        };
        const refreshTargets = () => {
            controls.clear();
            sceneHighlights.clear();
            const renderedFigures: Record<string, SceneHighlight> = {};
            const renderedRooms: Record<string, SceneHighlight> = {};
            for (const button of host.querySelectorAll<HTMLButtonElement>('button[data-scene-figure-id], button[data-scene-room-id], button[data-scene-marker-id]')) {
                const { sceneFigureId, sceneRoomId } = button.dataset;
                const id = sceneFigureId ?? sceneRoomId ?? button.dataset.sceneMarkerId!;
                if (sceneFigureId) button.toggleAttribute('data-three-model', scene.hasFigure(id));
                if (button.disabled || button.hasAttribute('data-visual-transition-anchor-hidden')) continue;
                controls.set(id, button);
                if (button.tabIndex < 0) continue;
                const state = (sceneRoomId ? button.dataset.sceneHighlight
                    : button.querySelector<HTMLElement>('[data-scene-highlight]')?.dataset.sceneHighlight) as SceneHighlight | undefined;
                if (!state) continue;
                sceneHighlights.set(id, state);
                if (sceneRoomId) renderedRooms[id] = state;
                else if (scene.hasFigure(id)) renderedFigures[id] = state;
            }
            scene.setHighlights(new Map(sceneHighlights));
            host.dataset.mapFigureHighlights = JSON.stringify(renderedFigures);
            host.dataset.mapRoomHighlights = JSON.stringify(renderedRooms);
            publishHitPoints();
        };
        const canPickFrom = (target: EventTarget | null | undefined) => {
            if (interactionBlockedRef.current) return false;
            const control = target instanceof Element ? target.closest('button, [role="button"], a') : null;
            return !control || control.hasAttribute('data-scene-room-id') || control.hasAttribute('data-three-model') ||
                control.hasAttribute('data-scene-room-inspect') ||
                Boolean(control.querySelector('[data-three-marker-ready]'));
        };
        const pickControl = (point: Vector2) => {
            const id = scene.pickObject(point);
            const button = id && controls.get(id);
            if (!button || getComputedStyle(button).visibility !== 'visible') return undefined;
            if (button.hasAttribute('data-scene-action-blocked')) return undefined;
            if (button.tabIndex >= 0) return { id, button };
            // A passive figure inside the chosen room does not steal the room action.
            const roomId = scene.pickObject(point, 'room');
            const room = button.closest('[data-scene-room-shell]')?.querySelector<HTMLButtonElement>('button[data-scene-room-id]');
            if (roomId && room?.dataset.sceneRoomId === roomId && room.dataset.sceneHighlight &&
                room.dataset.sceneHighlight !== 'passive') return { id: roomId, button: room };
            return undefined;
        };
        const roomPreviewButton = (id: string) => controls.get(id)?.closest('[data-scene-room-shell]')
            ?.querySelector<HTMLButtonElement>('[data-scene-room-inspect]');
        const publishPick = (id: string, kind: 'activate' | 'inspect') => {
            if (import.meta.env.VITE_E2E_LOCAL_ASSETS_ONLY !== 'true') return;
            host.dataset.lastScenePick = id;
            host.dataset.lastSceneInput = kind;
            host.dataset.scenePickSequence = String(++pickSequence);
        };
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
                publishHitPoints();
            },
            onTapObject: (point, target) => {
                const preview = target instanceof Element && target.closest<HTMLButtonElement>('[data-scene-room-inspect]');
                if (preview) {
                    const room = canPickFrom(target) && scene.pickObject(point, 'room');
                    if (room && room === preview.dataset.sceneRoomInspect && !preview.disabled) {
                        publishPick(room, 'inspect');
                        preview.click();
                    }
                    return true;
                }
                if (!canPickFrom(target)) return false;
                const hit = pickControl(point);
                if (!hit) return target instanceof Element && Boolean(target.closest('[data-scene-room-id], [data-three-model]'));
                publishPick(hit.id, 'activate');
                hit.button.click();
                return true;
            },
            onHoverObject: (point, target) => {
                const hit = point && canPickFrom(target) ? pickControl(point) : undefined;
                scene.setHovered(hit?.id);
                host.style.cursor = hit ? 'pointer' : '';
            },
            onInspectObject: (point, target) => {
                if (!canPickFrom(target)) return false;
                const id = scene.pickObject(point);
                const control = id && controls.get(id);
                if (!id || !control || getComputedStyle(control).visibility !== 'visible') return false;
                if (control.hasAttribute('data-scene-room-id')) {
                    const preview = roomPreviewButton(id);
                    if (!preview || preview.disabled) return false;
                    publishPick(id, 'inspect');
                    preview.click();
                } else {
                    if (!control.hasAttribute('data-scene-inspect')) return false;
                    publishPick(id, 'inspect');
                    control.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
                }
                return true;
            },
        });
        const scene = createBetrayalThreeScene(renderer, camera.camera, (status, models) => {
            host.dataset.mapResourceStatus = status;
            host.dataset.visibleExplorerModels = String(models.explorers);
            host.dataset.visibleMonsterModels = String(models.monsters);
            host.dataset.detailedFigureModels = String(models.detail);
            host.dataset.renderedFigureTriangles = String(models.triangles);
            if (status === 'ready') refreshTargets();
            if (status === 'ready') setReady(true);
            if (status === 'error') {
                scene.completePendingGirlTransfer();
                setFallback(true);
            }
        }, import.meta.env.VITE_E2E_LOCAL_ASSETS_ONLY === 'true' ? publishHitPoints : undefined);
        const observer = new MutationObserver(refreshTargets);
        observer.observe(overlay, { subtree: true, childList: true, attributes: true,
            attributeFilter: ['data-scene-highlight', 'data-scene-figure-id', 'data-scene-room-id', 'data-visual-transition-anchor-hidden', 'tabindex', 'disabled'] });
        const highlightFocusedControl = (event: FocusEvent) => {
            if (!(event.target instanceof HTMLButtonElement)) return;
            scene.setHovered(event.target.dataset.sceneFigureId ?? event.target.dataset.sceneRoomId);
        };
        const clearFocus = () => scene.setHovered(undefined);
        overlay.addEventListener('focusin', highlightFocusedControl);
        overlay.addEventListener('focusout', clearFocus);
        refreshTargets();
        rendererOwner.current = { camera, scene };
        return () => {
            rendererOwner.current = null;
            observer.disconnect();
            cancelAnimationFrame(diagnosticsFrame);
            overlay.removeEventListener('focusin', highlightFocusedControl);
            overlay.removeEventListener('focusout', clearFocus);
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
            sprites, figures, paths, markers, girlTransfer, hauntFocusRoomId, interactionBlocked,
            discoveredRoomIds: new Set(lightingRooms?.map(room => room.id)),
            onMotionComplete, onMotionPhase,
        });
    }, [sprites, figures, paths, markers, girlTransfer, hauntFocusRoomId, interactionBlocked, lightingRooms, onMotionComplete, onMotionPhase, fallback]);

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
        data-map-outline-renderer="mesh-depth-shader"
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
        <div data-betrayal-screen-feedback="" className="pointer-events-none absolute inset-0 z-20" />
    </div>;
});
BetrayalRoomViewport.displayName = 'BetrayalRoomViewport';
