import { MathUtils, OrthographicCamera, Vector2, Vector3 } from 'three';
import type { ZoomPanViewportFitInsets } from '../../components/game/framework/ZoomPanViewport';
import type { MapScenePoint } from '../../engine/mapRenderer/types';

const MIN_ZOOM = .55;
const MAX_ZOOM = 2.4;
const DRAG_THRESHOLD = 6;
const INITIAL_BEARING = MathUtils.degToRad(9);
const INITIAL_TILT = MathUtils.degToRad(32);
const DISTANCE = 1800;

export function createBetrayalRoomCamera(
    host: HTMLDivElement,
    overlay: HTMLDivElement,
    options: {
        initialZoom: () => number | undefined;
        onManualInteraction: () => void;
        onZoomChange: (zoom: number) => void;
        onChange: (width: number, height: number) => void;
        onTapFigure: (point: Vector2, target: EventTarget | null) => boolean;
    },
) {
    const camera = new OrthographicCamera(-1, 1, 1, -1, .1, 8000);
    const center = new Vector3();
    const pointers = new Map<number, { start: Vector2; screen: Vector2; point: Vector2 }>();
    let viewport = { width: 0, height: 0 };
    let insets = { left: 0, right: 0, top: 0, bottom: 0 };
    let bearing = INITIAL_BEARING;
    let tilt = INITIAL_TILT;
    let dragging = false;
    let rotating = false;
    let suppressClick = false;

    function syncCamera() {
        const altitude = Math.cos(tilt) * DISTANCE;
        const radius = Math.sin(tilt) * DISTANCE;
        camera.position.set(center.x + Math.sin(bearing) * radius, altitude, center.z + Math.cos(bearing) * radius);
        camera.lookAt(center);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
    }

    function toScreen(x: number, z: number) {
        const point = new Vector3(x, 0, z).project(camera);
        return new Vector2((point.x + 1) * viewport.width / 2, (1 - point.y) * viewport.height / 2);
    }

    function toNdc(point: Vector2) {
        return new Vector2(2 * point.x / viewport.width - 1, 1 - 2 * point.y / viewport.height);
    }

    function toGround(point: Vector2) {
        const ndc = toNdc(point);
        const start = new Vector3(ndc.x, ndc.y, -1).unproject(camera);
        const direction = camera.getWorldDirection(new Vector3());
        return start.addScaledVector(direction, -start.y / direction.y);
    }

    function show() {
        syncCamera();
        const origin = toScreen(0, 0);
        const east = toScreen(1, 0).sub(origin);
        const south = toScreen(0, 1).sub(origin);
        overlay.style.transform = `matrix(${east.x},${east.y},${south.x},${south.y},${origin.x},${origin.y})`;
        host.dataset.zoom = String(camera.zoom);
        host.dataset.panX = String(origin.x);
        host.dataset.panY = String(origin.y);
        host.dataset.cameraBearing = String(bearing);
        options.onChange(viewport.width, viewport.height);
    }

    function useBounds(mapWidth: number, mapHeight: number, fitInsets?: ZoomPanViewportFitInsets) {
        const width = host.clientWidth;
        const height = host.clientHeight;
        if (!width || !height) return;
        const firstSize = viewport.width === 0;
        viewport = { width, height };
        const horizontal = Math.min(1, width / 1000);
        insets = {
            left: (fitInsets?.left ?? 0) * horizontal, right: (fitInsets?.right ?? 0) * horizontal,
            top: fitInsets?.top ?? 0, bottom: fitInsets?.bottom ?? 0,
        };
        camera.left = -width / 2;
        camera.right = width / 2;
        camera.top = height / 2;
        camera.bottom = -height / 2;
        if (firstSize) {
            const availableWidth = Math.max(1, width - insets.left - insets.right);
            const availableHeight = Math.max(1, height - insets.top - insets.bottom);
            const fit = Math.min(1, availableWidth / mapWidth, availableHeight / (mapHeight * .85));
            camera.zoom = MathUtils.clamp(options.initialZoom() ?? fit, MIN_ZOOM, MAX_ZOOM);
            center.set(mapWidth / 2, 0, mapHeight / 2);
            syncCamera();
            pan(new Vector2(width / 2, height / 2),
                new Vector2(insets.left + availableWidth / 2, insets.top + availableHeight / 2));
        }
        show();
    }

    function focus(point: MapScenePoint, explicit: boolean) {
        if (!viewport.width) return;
        const current = toScreen(point.x, point.y);
        const left = insets.left + 48;
        const top = insets.top + 48;
        const right = Math.max(left, viewport.width - insets.right - 48);
        const bottom = Math.max(top, viewport.height - insets.bottom - 48);
        const destination = explicit
            ? new Vector2((left + right) / 2, (top + bottom) / 2)
            : new Vector2(MathUtils.clamp(current.x, left, right), MathUtils.clamp(current.y, top, bottom));
        if (!current.equals(destination)) {
            pan(current, destination);
            show();
        }
    }

    function localPoint(event: MouseEvent) {
        const rect = host.getBoundingClientRect();
        // The landscape shell can scale a fixed-size board to the physical viewport.
        return new Vector2(
            (event.clientX - rect.left) * viewport.width / rect.width,
            (event.clientY - rect.top) * viewport.height / rect.height,
        );
    }

    function pan(from: Vector2, to: Vector2) {
        center.add(toGround(from).sub(toGround(to)));
    }

    function zoomAt(from: Vector2, to: Vector2, ratio: number, turn = 0) {
        const anchor = toGround(from);
        camera.zoom = MathUtils.clamp(camera.zoom * ratio, MIN_ZOOM, MAX_ZOOM);
        bearing += turn;
        syncCamera();
        center.add(anchor.sub(toGround(to)));
        options.onZoomChange(camera.zoom);
    }

    function pointerDown(event: PointerEvent) {
        if (!viewport.width || (event.button !== 0 && event.button !== 2)) return;
        const point = localPoint(event);
        const screen = new Vector2(event.clientX, event.clientY);
        if (!pointers.size) {
            suppressClick = false;
            dragging = false;
            rotating = event.button === 2;
        }
        pointers.set(event.pointerId, { start: screen, screen, point });
    }

    function pointerMove(event: PointerEvent) {
        const pointer = pointers.get(event.pointerId);
        if (!pointer || !viewport.width) return;
        const next = localPoint(event);
        const screen = new Vector2(event.clientX, event.clientY);
        const previous = pointer.point;
        const screenDelta = screen.clone().sub(pointer.screen);
        if (!dragging && (screen.distanceTo(pointer.start) >= DRAG_THRESHOLD || pointers.size > 1)) {
            dragging = true;
            suppressClick = true;
            options.onManualInteraction();
        }
        if (dragging && !host.hasPointerCapture(event.pointerId)) host.setPointerCapture(event.pointerId);
        pointer.point = next;
        pointer.screen = screen;
        if (!dragging) return;
        const other = [...pointers.values()].find(candidate => candidate !== pointer);
        if (other) {
            const from = previous.clone().lerp(other.point, .5);
            const to = next.clone().lerp(other.point, .5);
            const before = previous.clone().sub(other.point);
            const after = next.clone().sub(other.point);
            const angle = before.length() > 20 && after.length() > 20
                ? Math.atan2(before.cross(after), before.dot(after))
                : 0;
            zoomAt(from, to, Math.max(8, after.length()) / Math.max(8, before.length()), angle);
        } else if (rotating) {
            bearing -= screenDelta.x * .007;
            tilt = MathUtils.clamp(tilt + screenDelta.y * .004, .12, .94);
        } else {
            pan(previous, next);
        }
        show();
    }

    function pointerEnd(event: PointerEvent) {
        pointers.delete(event.pointerId);
    }

    function pointerLeave(event: PointerEvent) {
        if (!host.hasPointerCapture(event.pointerId)) pointerEnd(event);
    }

    function wheel(event: WheelEvent) {
        if (!viewport.width || event.deltaY === 0) return;
        event.preventDefault();
        options.onManualInteraction();
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.height : 1);
        const point = localPoint(event);
        zoomAt(point, point, Math.exp(-delta * .0017));
        show();
    }

    function click(event: MouseEvent) {
        if (!event.detail) return;
        if (suppressClick || options.onTapFigure(toNdc(localPoint(event)), event.target)) {
            suppressClick = false;
            event.preventDefault();
            event.stopPropagation();
        }
    }

    const preventMenu = (event: MouseEvent) => {
        event.preventDefault();
        if (dragging) event.stopPropagation();
    };
    host.addEventListener('pointerdown', pointerDown);
    host.addEventListener('pointermove', pointerMove);
    host.addEventListener('pointerup', pointerEnd);
    host.addEventListener('pointercancel', pointerEnd);
    host.addEventListener('pointerleave', pointerLeave);
    host.addEventListener('wheel', wheel, { passive: false });
    host.addEventListener('contextmenu', preventMenu, true);
    host.addEventListener('click', click, true);

    return {
        camera, useBounds, focus,
        dispose() {
            host.removeEventListener('pointerdown', pointerDown);
            host.removeEventListener('pointermove', pointerMove);
            host.removeEventListener('pointerup', pointerEnd);
            host.removeEventListener('pointercancel', pointerEnd);
            host.removeEventListener('pointerleave', pointerLeave);
            host.removeEventListener('wheel', wheel);
            host.removeEventListener('contextmenu', preventMenu, true);
            host.removeEventListener('click', click, true);
        },
    };
}
