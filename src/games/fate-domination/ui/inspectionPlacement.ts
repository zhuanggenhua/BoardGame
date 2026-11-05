export type InspectionRect = { left: number; top: number; width: number; height: number };
/** Prefer the free side of the table, never a hard-coded off-screen slot. */
export function placeFateInspection(viewport: { width: number; height: number }, obstacles: readonly InspectionRect[]) {
    const margin = 16;
    const width = Math.max(1, Math.min(310, viewport.width * .34, (viewport.height - 96) * 5 / 7));
    const height = width * 7 / 5 + 16;
    const top = Math.max(margin, Math.min(90, viewport.height - height - margin));
    const maxLeft = Math.max(margin, viewport.width - width - margin);
    const candidates = [margin, maxLeft, ...obstacles.flatMap(rect => [rect.left - width - margin, rect.left + rect.width + margin])]
        .map(left => Math.max(margin, Math.min(maxLeft, left)));
    const overlap = (left: number) => obstacles.reduce((sum, rect) => sum
        + Math.max(0, Math.min(left + width, rect.left + rect.width) - Math.max(left, rect.left))
        * Math.max(0, Math.min(top + height, rect.top + rect.height) - Math.max(top, rect.top)), 0);
    return { left: candidates.reduce((best, next) => overlap(next) < overlap(best) ? next : best, candidates[0]), top, width };
}
