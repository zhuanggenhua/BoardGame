type Point = { x: number; y: number };
export type ConnectorObstacle = { left: number; top: number; width: number; height: number };

/** 连到控制标记时绕开沿途的兵牌和地名，避免遮罩把归属线截成两段。 */
export function routeArmyGroupConnector(start: Point, end: Point, obstacles: readonly ConnectorObstacle[]): Point[] | null {
    const margin = 6;
    const bounds = obstacles.map(rect => ({ left: rect.left - margin, top: rect.top - margin,
        right: rect.left + rect.width + margin, bottom: rect.top + rect.height + margin }))
        .filter(rect => rect.right >= Math.min(start.x, end.x) - 32 && rect.left <= Math.max(start.x, end.x) + 32
            && rect.bottom >= Math.min(start.y, end.y) - 32 && rect.top <= Math.max(start.y, end.y) + 32);
    const points = [start, end, ...bounds.flatMap(rect => [
        { x: rect.left - 1, y: rect.top - 1 }, { x: rect.right + 1, y: rect.top - 1 },
        { x: rect.left - 1, y: rect.bottom + 1 }, { x: rect.right + 1, y: rect.bottom + 1 },
    ])];
    const clear = (a: Point, b: Point) => !bounds.some(rect => {
        let lo = 0, hi = 1;
        for (const [origin, delta, min, max] of [[a.x, b.x - a.x, rect.left, rect.right], [a.y, b.y - a.y, rect.top, rect.bottom]]) {
            if (delta === 0) { if (origin <= min || origin >= max) return false; continue; }
            const first = (min - origin) / delta, second = (max - origin) / delta;
            lo = Math.max(lo, Math.min(first, second)); hi = Math.min(hi, Math.max(first, second));
            if (lo >= hi) return false;
        }
        return hi > 0 && lo < 1;
    });
    const distances = points.map(() => Infinity), previous = points.map(() => -1), used = new Set<number>();
    distances[0] = 0;
    while (used.size < points.length) {
        let current = -1;
        for (let i = 0; i < points.length; i++) if (!used.has(i) && (current < 0 || distances[i] < distances[current])) current = i;
        if (current < 0 || !Number.isFinite(distances[current]) || current === 1) break;
        used.add(current);
        for (let next = 0; next < points.length; next++) {
            if (used.has(next) || !clear(points[current], points[next])) continue;
            const distance = distances[current] + Math.hypot(points[current].x - points[next].x, points[current].y - points[next].y);
            if (distance < distances[next]) { distances[next] = distance; previous[next] = current; }
        }
    }
    if (previous[1] < 0) return null;
    const route: Point[] = [];
    for (let index = 1; index >= 0; index = previous[index]) route.push(points[index]);
    return route.reverse();
}
