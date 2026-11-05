import type { QidahenRuntimeRegionPoint } from './runtimeRegionOwnership';

export const QIDAHEN_POPULATION_SIZE = 26;
const CLEARANCE = QIDAHEN_POPULATION_SIZE / 2 + 2;
const GAP = 4;
type Point = QidahenRuntimeRegionPoint;
type Region = { id: string; x: number; y: number; population: number; isLogicalRegion: boolean };
type Obstacle = { x: number; y: number; size?: number };
export interface PopulationSite {
    anchor: Point;
    candidates: Point[];
    clearance: number;
}
export interface PopulationPlacement {
    regionId: string;
    point: Point;
    anchor: Point;
    callout: boolean;
}

/** 与命中检测共用像素归属；计算方块到异区的棋盘距离，而非可能落区外的算术质心。 */
export function buildQidahenPopulationSites(
    owners: readonly (string | null)[], width: number, height: number,
    regions: readonly Region[],
): Map<string, PopulationSite> {
    const distance = new Uint16Array(width * height);
    const visit = (x: number, y: number, neighbors: readonly (readonly [number, number])[]) => {
        const i = y * width + x;
        const id = owners[i];
        if (!id) return;
        let nearest = distance[i] || 65535;
        for (const [dx, dy] of neighbors) {
            const nx = x + dx, ny = y + dy, j = ny * width + nx;
            nearest = Math.min(nearest, nx < 0 || nx >= width || ny < 0 || ny >= height || owners[j] !== id ? 1 : distance[j] + 1);
        }
        distance[i] = nearest;
    };
    const before = [[-1, 0], [-1, -1], [0, -1], [1, -1]] as const;
    const after = [[1, 0], [-1, 1], [0, 1], [1, 1]] as const;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) visit(x, y, before);
    for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) visit(x, y, after);

    const regionById = new Map(regions.filter(r => !r.isLogicalRegion).map(r => [r.id, r]));
    const sites = new Map<string, PopulationSite>();
    for (let i = 0; i < owners.length; i++) {
        const id = owners[i];
        const region = id ? regionById.get(id) : undefined;
        if (!id || !region) continue;
        const point = { x: i % width, y: Math.floor(i / width) };
        let site = sites.get(id);
        if (!site) {
            site = { anchor: point, candidates: [], clearance: 0 };
            sites.set(id, site);
        }
        const preferred = { x: region.x * width, y: region.y * height };
        if (distance[i] > site.clearance || (distance[i] === site.clearance && squaredDistance(point, preferred) < squaredDistance(site.anchor, preferred))) {
            site.anchor = point;
            site.clearance = distance[i];
        }
        // 三像素采样只减少候选数量，不改变归属或完整方块的内部性判断。
        if (distance[i] >= CLEARANCE && point.x % 3 === 0 && point.y % 3 === 0) site.candidates.push(point);
    }
    return sites;
}

const squaredDistance = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** 人口是同一份规则读数；窄区用引线连接内部锚点，不缩小方块、不伪造区域中心。 */
export function layoutQidahenPopulation(
    sites: ReadonlyMap<string, PopulationSite>, regions: readonly Region[],
    tokens: readonly Obstacle[], width: number, height: number,
): PopulationPlacement[] {
    const obstacles = tokens.map(token => ({ x: token.x * width, y: token.y * height, half: (token.size ?? 30) / 2 }));
    const half = QIDAHEN_POPULATION_SIZE / 2;
    const free = (point: Point) => point.x >= CLEARANCE && point.x < width - CLEARANCE && point.y >= CLEARANCE && point.y < height - CLEARANCE
        && obstacles.every(box => Math.abs(point.x - box.x) >= half + box.half + GAP || Math.abs(point.y - box.y) >= half + box.half + GAP);
    const result: PopulationPlacement[] = [];
    const ordered = regions.filter(r => !r.isLogicalRegion && sites.has(r.id))
        .sort((a, b) => sites.get(a.id)!.clearance - sites.get(b.id)!.clearance || a.id.localeCompare(b.id));
    for (const region of ordered) {
        const site = sites.get(region.id)!;
        const preferred = { x: region.x * width + 20, y: region.y * height + 22 };
        let point: Point | undefined;
        let best = Infinity;
        for (const candidate of site.candidates) {
            const score = squaredDistance(candidate, preferred);
            if (score < best && free(candidate)) { point = candidate; best = score; }
        }
        const callout = !point;
        if (!point) {
            // 当前辽西等狭窄分区无法容纳整块；邻近空位仍由短引线明确归属。
            best = Infinity;
            for (let dy = -160; dy <= 160; dy += 2) {
                for (let dx = -160; dx <= 160; dx += 2) {
                    const score = dx ** 2 + dy ** 2;
                    if (score < (CLEARANCE + 7) ** 2 || score >= best) continue;
                    const candidate = { x: site.anchor.x + dx, y: site.anchor.y + dy };
                    if (free(candidate)) { point = candidate; best = score; }
                }
            }
        }
        if (!point) throw new Error(`人口标记没有可用位置：${region.id}`);
        // 每区保留稳定的几何槽位；人口从零变正时不挤走邻区读数。
        if (region.population > 0) result.push({ regionId: region.id, point, anchor: site.anchor, callout });
        obstacles.push({ ...point, half });
    }
    return result;
}
