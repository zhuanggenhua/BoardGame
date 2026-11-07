import type { QidahenRuntimeRegionPoint as Point } from './runtimeRegionOwnership';

/** 人口与兵牌共用正式内部候选；窄区空位不足时用短引线表达归属。 */
export function placeQidahenMapObject(
    site: { anchor: Point; candidates: readonly Point[] }, preferred: Point,
    free: (point: Point) => boolean, minimumAnchorDistance: number,
): { point: Point; anchor: Point; callout: boolean } | null {
    let point: Point | undefined;
    let best = Infinity;
    for (const candidate of site.candidates) {
        const score = (candidate.x - preferred.x) ** 2 + (candidate.y - preferred.y) ** 2;
        if (score < best && free(candidate)) { point = candidate; best = score; }
    }
    const callout = !point;
    if (!point) {
        best = Infinity;
        for (let dy = -160; dy <= 160; dy += 2) {
            for (let dx = -160; dx <= 160; dx += 2) {
                const score = dx ** 2 + dy ** 2;
                if (score < minimumAnchorDistance ** 2 || score >= best) continue;
                const candidate = { x: site.anchor.x + dx, y: site.anchor.y + dy };
                if (free(candidate)) { point = candidate; best = score; }
            }
        }
    }
    return point ? { point, anchor: site.anchor, callout } : null;
}
