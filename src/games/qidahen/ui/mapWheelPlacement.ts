/** 原图印刷轮盘的中心与外缘（地图原始像素坐标）。 */
export const QIDAHEN_PRINTED_WHEEL = { x: 242, y: 214, radius: 140 } as const;

export function getQidahenMapWheelPlacement(options: {
    origin: { x: number; y: number }; mapScale: number;
    initialView: { zoom: number; panX: number; panY: number };
}) {
    const scale = options.mapScale * options.initialView.zoom;
    // SVG 圆半径184、居中描边宽6，外缘为187；与原印刷外缘对齐。
    const size = QIDAHEN_PRINTED_WHEEL.radius * 2 * (384 / 374) * scale;
    const centerX = options.origin.x + options.initialView.panX + QIDAHEN_PRINTED_WHEEL.x * scale;
    const centerY = options.origin.y + options.initialView.panY + QIDAHEN_PRINTED_WHEEL.y * scale;
    return { left: centerX - size / 2, top: centerY - size / 2, size };
}
