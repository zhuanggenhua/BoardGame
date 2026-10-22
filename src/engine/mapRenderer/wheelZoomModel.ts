const DEFAULT_WHEEL_SENSITIVITY = 0.0012;
const PIXELS_PER_NOTCH = 120;

/** Normalize wheel units once and keep trackpad scaling continuous. */
export function resolveWheelZoom({ currentZoom, deltaY, deltaMode, pageHeight, minimumZoom, maximumZoom, wheelZoomFactor }: {
    currentZoom: number;
    deltaY: number;
    deltaMode: number;
    pageHeight: number;
    minimumZoom: number;
    maximumZoom: number;
    /** Zoom-in multiplier for one 120px notch; omitted preserves the legacy sensitivity. */
    wheelZoomFactor?: number;
}): number {
    const delta = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(1, pageHeight) : 1);
    const sensitivity = wheelZoomFactor !== undefined && Number.isFinite(wheelZoomFactor) && wheelZoomFactor > 0
        ? Math.log(wheelZoomFactor) / PIXELS_PER_NOTCH
        : DEFAULT_WHEEL_SENSITIVITY;
    return Math.min(maximumZoom, Math.max(minimumZoom, currentZoom * Math.exp(-delta * sensitivity)));
}
