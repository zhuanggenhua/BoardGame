import { QIDAHEN_RUNTIME_REGION_DEFINITIONS } from './mapGraph';

/** 土地由正式mask命中；城镇只在原图城名本体范围命中，不再占据一片土地。 */
export function resolveQidahenMapRegionAtPoint(
    ownership: readonly (string | null)[], width: number, height: number,
    point: { x: number; y: number }, candidateIds: readonly string[] = [],
): string | null {
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    for (const region of QIDAHEN_RUNTIME_REGION_DEFINITIONS) {
        const bounds = region.markerBounds;
        if (region.mapRole !== 'city' || !bounds || (candidateIds.length > 0 && !candidateIds.includes(region.id))) continue;
        if (x >= bounds.left && y >= bounds.top && x < bounds.left + bounds.width && y < bounds.top + bounds.height) {
            return region.id;
        }
    }
    return ownership[y * width + x] ?? null;
}

export function renderQidahenCitySelectionFeedback(
    canvas: HTMLCanvasElement, candidateIds: readonly string[], selectedId: string | null,
): void {
    const context = canvas.getContext('2d');
    if (!context) return;
    for (const region of QIDAHEN_RUNTIME_REGION_DEFINITIONS) {
        if (region.mapRole !== 'city' || !region.markerBounds) continue;
        const { left, top, width, height } = region.markerBounds;
        // 原图城名位于土地之上；地域填色/描线不穿过城名本体。
        context.clearRect(left, top, width, height);
        if (!candidateIds.includes(region.id) && selectedId !== region.id) continue;
        context.lineWidth = selectedId === region.id ? 2 : 1;
        context.strokeStyle = selectedId === region.id ? '#fff5cf' : '#6dd78b';
        context.strokeRect(left - 1, top - 1, width + 2, height + 2);
    }
}
