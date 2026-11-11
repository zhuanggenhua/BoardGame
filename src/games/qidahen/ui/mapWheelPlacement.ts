/** 原图印刷轮盘的中心与外缘（地图原始像素坐标）。 */
const PRINTED_WHEEL = { x: 242, y: 214, radius: 140 } as const;

export function getQidahenMapWheelPlacement(options: {
    origin: { x: number; y: number }; mapScale: number;
    viewport: { zoom: number; panX: number; panY: number };
    stage: { width: number; height: number };
}) {
    const scale = options.mapScale * options.viewport.zoom;
    // SVG 圆半径184、居中描边宽6，外缘为187；与原印刷外缘对齐。
    const size = PRINTED_WHEEL.radius * 2 * (384 / 374) * scale;
    const centerX = options.origin.x + options.viewport.panX + PRINTED_WHEEL.x * scale;
    const centerY = options.origin.y + options.viewport.panY + PRINTED_WHEEL.y * scale;
    const left = centerX - size / 2;
    const top = centerY - size / 2;
    return { left, top, size, fullyVisible: left >= 0 && top >= 0
        && left + size <= options.stage.width && top + size <= options.stage.height };
}

/** 把地图移动到轮盘完整可用的位置，不复制轮盘。 */
export function getQidahenMapViewportForWheel(options: { origin: { x: number; y: number }; mapScale: number }) {
    return { zoom: 1, panX: 355 - options.origin.x - PRINTED_WHEEL.x * options.mapScale,
        panY: 227 - options.origin.y - PRINTED_WHEEL.y * options.mapScale };
}
