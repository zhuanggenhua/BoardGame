import type { QidahenMapToken } from '../domain/types';
import { QIDAHEN_RUNTIME_REGION_BY_ID, QIDAHEN_MAP_NAMEPLATE_OBSTACLES, QIDAHEN_PRINTED_NAMEPLATE_BOUNDS } from './mapGraph';
import { placeQidahenMapObject } from './mapObjectPlacement';
import { QIDAHEN_POPULATION_SIZE, type PopulationSite } from './populationLayout';
import type { QidahenRuntimeRegionPoint as Point } from './runtimeRegionOwnership';

export interface QidahenArmyCallout { tokenId: string; point: Point; anchor: Point }

export const getArmyStackExtension = (size: number) => 16 * Math.min(1, size / 26);

export const getArmyMapBounds = (point: Point, half: number, extension = 0) => ({
    left: point.x - half, top: point.y - half, width: half * 2 + extension * 3 / 8, height: half * 2 + extension,
});

export const armyMapBoundsSeparate = (a: ReturnType<typeof getArmyMapBounds>, b: ReturnType<typeof getArmyMapBounds>, gap: number) => (
    a.left + a.width + gap <= b.left || b.left + b.width + gap <= a.left
    || a.top + a.height + gap <= b.top || b.top + b.height + gap <= a.top
);

/** 逐兵选择后放大地图时，兵牌屏幕尺寸不低于进入选择前的尺寸。 */
export const getArmyScreenScale = (zoom: number, entryZoom: number) => Math.min(1, entryZoom / zoom);

function placeStackedArmyRegion(
    pieces: readonly QidahenMapToken[], site: PopulationSite, obstacles: readonly ReturnType<typeof getArmyMapBounds>[],
    stackTokenIds: ReadonlySet<string>, includePopulation: boolean,
) {
    const shapes = pieces.map(token => ({ size: token.size ?? 26, stack: stackTokenIds.has(token.id) }));
    if (includePopulation) shapes.push({ size: QIDAHEN_POPULATION_SIZE, stack: false });
    const choices = shapes.map(({ size, stack }) => {
        const extension = stack ? getArmyStackExtension(size) : 0;
        return site.candidates.flatMap(point => {
            const bounds = getArmyMapBounds(point, size / 2, extension);
            return obstacles.every(box => armyMapBoundsSeparate(bounds, box, 4))
                && QIDAHEN_PRINTED_NAMEPLATE_BOUNDS.every(box => armyMapBoundsSeparate(bounds, box, 2)) ? [{ point, bounds }] : [];
        }).sort((a, b) => Math.hypot(a.point.x - site.anchor.x, a.point.y - site.anchor.y)
            - Math.hypot(b.point.x - site.anchor.x, b.point.y - site.anchor.y));
    });
    const order = choices.map((list, index) => ({ index, available: list.length })).sort((a, b) => Number(a.index === pieces.length) - Number(b.index === pieces.length) || a.available - b.available);
    const placed: Array<typeof choices[number][number]> = [];
    let checks = 0;
    const solve = (index: number): boolean => {
        if (index >= order.length) return true;
        const current = order[index].index;
        const allies = placed.filter((_, pieceIndex) => pieceIndex < pieces.length);
        // 人口单独定位。兵牌先找已有队列的行列，再比较间距，避免逐枚贴到地形尖角。
        const population = current === pieces.length;
        const formationCost = (point: Point) => Math.min(...allies.map(({ point: other }) => {
            const dx = Math.abs(point.x - other.x);
            const dy = Math.abs(point.y - other.y);
            return Math.hypot(dx, dy) + Math.min(dx, dy) * 2;
        }));
        const populationCost = (option: typeof choices[number][number]) => {
            const left = Math.min(...allies.map(ally => ally.bounds.left));
            const top = Math.min(...allies.map(ally => ally.bounds.top));
            const right = Math.max(...allies.map(ally => ally.bounds.left + ally.bounds.width));
            const bottom = Math.max(...allies.map(ally => ally.bounds.top + ally.bounds.height));
            const inFormation = !armyMapBoundsSeparate(option.bounds, { left, top, width: right - left, height: bottom - top }, 4);
            return (inFormation ? 1000 : 0) + Math.hypot(option.point.x - site.anchor.x, option.point.y - site.anchor.y);
        };
        const options = allies.length
            ? choices[current].map(option => ({ option, cost: population ? populationCost(option) : formationCost(option.point) }))
                .sort((a, b) => a.cost - b.cost).map(({ option }) => option)
            : choices[current];
        for (const option of options) {
            if (++checks > 30_000) return false;
            if (!placed.every(other => armyMapBoundsSeparate(option.bounds, other.bounds, 4))) continue;
            placed[current] = option;
            if (solve(index + 1)) return true;
            delete placed[current];
        }
        return false;
    };
    return solve(0) ? placed.map(option => option.point) : null;
}

/** 对需要逐枚操作的拥挤地区，联合为兵牌与人口寻找区内位置。 */
export function packExpandedArmiesWithinRegions(
    tokens: readonly QidahenMapToken[], callouts: readonly QidahenArmyCallout[], sites: ReadonlyMap<string, PopulationSite>,
    width: number, height: number, expandedRegionIds: ReadonlySet<string>, populationRegionIds: ReadonlySet<string>,
    selectedOnlyRegions: ReadonlySet<string> = new Set(), selectedPieceIds: ReadonlySet<string> = new Set(),
    stackAccessoryTokenIds: ReadonlySet<string> = new Set(),
): { tokens: readonly QidahenMapToken[]; callouts: QidahenArmyCallout[]; unresolvedRegionIds: string[]; populationSites: ReadonlyMap<string, Point> } {
    const positions = new Map<string, Point>();
    const populationSites = new Map<string, Point>();
    const packedIds = new Set<string>();
    const unresolvedRegionIds: string[] = [];
    for (const regionId of expandedRegionIds) {
        const pieces = tokens.filter(token => token.type === 'army' && token.location === 'field' && token.regionId === regionId);
        // 出兵选择结束后，已出兵牌与未出兵的合堆同时展示；把出兵牌相邻放置。
        // 逐枚选择阶段不重排，避免每点一枚牌就改变候选位置。
        if (selectedOnlyRegions.has(regionId)) pieces.sort((a, b) => Number(selectedPieceIds.has(b.pieceId ?? '')) - Number(selectedPieceIds.has(a.pieceId ?? '')));
        const hasCallouts = pieces.some(piece => callouts.some(callout => callout.tokenId === piece.id));
        if (pieces.length < 2) continue;
        const site = sites.get(regionId);
        if (!site) { if (hasCallouts) unresolvedRegionIds.push(regionId); continue; }
        const half = Math.max(...pieces.map(piece => (piece.size ?? 26) / 2));
        const extension = pieces.some(token => stackAccessoryTokenIds.has(token.id)) ? getArmyStackExtension(half * 2) : 0;
        const obstacles = tokens.filter(token => !pieces.includes(token)).map(token => {
            const size = token.size ?? 30;
            return getArmyMapBounds(positions.get(token.id) ?? { x: token.x * width, y: token.y * height }, size / 2,
                stackAccessoryTokenIds.has(token.id) ? getArmyStackExtension(size) : 0);
        });
        obstacles.push(...QIDAHEN_MAP_NAMEPLATE_OBSTACLES.map(item => getArmyMapBounds(item, item.size / 2)));
        if (extension) {
            const joint = placeStackedArmyRegion(pieces, site, obstacles, stackAccessoryTokenIds, populationRegionIds.has(regionId));
            if (joint) {
                pieces.forEach((piece, index) => { positions.set(piece.id, joint[index]); packedIds.add(piece.id); });
                if (joint[pieces.length]) populationSites.set(regionId, joint[pieces.length]);
                continue;
            }
        }
        let points = site.candidates.filter(point => {
            const bounds = getArmyMapBounds(point, half, extension);
            return obstacles.every(box => armyMapBoundsSeparate(bounds, box, 4))
                && (!extension || QIDAHEN_PRINTED_NAMEPLATE_BOUNDS.every(box => armyMapBoundsSeparate(bounds, box, 2)));
        });
        if (points.length < pieces.length) { if (hasCallouts) unresolvedRegionIds.push(regionId); continue; }
        const separate = (a: Point, b: Point, gap: number, verticalGap = gap) => Math.abs(a.x - b.x) >= gap || Math.abs(a.y - b.y) >= verticalGap;
        const distance = half * 2 + 3 * (half * 2 / 26);
        const verticalDistance = distance + extension;
        // 出兵与留守分组，给兵堆底部的数量留出空间。
        const stackDistance = half * 2 + 24 * (half * 2 / 26);
        const selectedCount = selectedOnlyRegions.has(regionId)
            ? pieces.filter(piece => selectedPieceIds.has(piece.pieceId ?? '')).length : 0;
        // 按真实区域候选点尝试紧凑方阵，让同一区域的兵牌可作为一组阅读。
        // 找不到完整方阵时保留原有布局 / 溢出路径，不把兵牌推到别的地区。
        const step = Math.ceil(distance / 3) * 3;
        const rowStep = Math.ceil(verticalDistance / 3) * 3;
        const pointKeys = new Set(points.map(point => `${point.x},${point.y}`));
        const starts = points.slice().sort((a, b) => ((a.x - site.anchor.x) ** 2 + (a.y - site.anchor.y) ** 2)
            - ((b.x - site.anchor.x) ** 2 + (b.y - site.anchor.y) ** 2)).slice(0, 100);
        let compact: Point[] | undefined;
        let compactScore = Infinity;
        // 候选点按 26px 人口方块生成；更大的兵牌不能仅凭这些点证明完整落区。
        for (const start of half <= 13 && !selectedCount ? starts : []) for (let columns = 1; columns <= Math.min(pieces.length, 5); columns++) {
            const grid = pieces.map((_, index) => ({ x: start.x + step * (index % columns), y: start.y + rowStep * Math.floor(index / columns) }));
            if (!grid.every(point => pointKeys.has(`${point.x},${point.y}`))) continue;
            if (populationRegionIds.has(regionId) && !points.some(point => grid.every(other => separate(point, other, half + 13 + 4)))) continue;
            const rows = Math.ceil(pieces.length / columns);
            const center = { x: start.x + step * (columns - 1) / 2, y: start.y + rowStep * (rows - 1) / 2 };
            const score = columns * rows * step * rowStep + (center.x - site.anchor.x) ** 2 + (center.y - site.anchor.y) ** 2;
            if (score < compactScore) { compact = grid; compactScore = score; }
        }
        if (!compact && half <= 13) {
            // 不规则地区未必容得下矩形；逐枚向已有编组靠拢，同时尽量对齐行列。
            const sorted = points.slice().sort((a, b) => ((a.x - site.anchor.x) ** 2 + (a.y - site.anchor.y) ** 2)
                - ((b.x - site.anchor.x) ** 2 + (b.y - site.anchor.y) ** 2));
            const stride = Math.max(6, Math.ceil(sorted.length / 100));
            const seeds = sorted.filter((_, index) => index % stride === 0);
            for (const seed of seeds) {
                const chosen = [seed];
                while (chosen.length < pieces.length) {
                    let best: Point | undefined;
                    let bestScore = Infinity;
                    for (const point of points) {
                        if (!chosen.every((other, index) => separate(point, other,
                            selectedCount && (index >= selectedCount || chosen.length >= selectedCount) ? stackDistance : distance,
                            selectedCount && (index >= selectedCount || chosen.length >= selectedCount) ? stackDistance : verticalDistance))) continue;
                        const nearest = Math.min(...chosen.map(other => Math.hypot(point.x - other.x, point.y - other.y)));
                        const alignment = Math.min(...chosen.map(other => Math.min(Math.abs(point.x - other.x), Math.abs(point.y - other.y))));
                        const score = nearest + alignment * 0.35 + Math.hypot(point.x - seed.x, point.y - seed.y) * 0.08;
                        if (score < bestScore) { best = point; bestScore = score; }
                    }
                    if (!best) break;
                    chosen.push(best);
                }
                if (chosen.length !== pieces.length) continue;
                if (populationRegionIds.has(regionId) && !points.some(point => chosen.every(other => separate(point, other, half + 17)))) continue;
                const center = { x: chosen.reduce((sum, point) => sum + point.x, 0) / chosen.length,
                    y: chosen.reduce((sum, point) => sum + point.y, 0) / chosen.length };
                const score = chosen.reduce((sum, point) => sum + Math.hypot(point.x - center.x, point.y - center.y), 0);
                if (score < compactScore) { compact = chosen; compactScore = score; }
            }
        }
        if (compact) {
            pieces.forEach((piece, index) => { positions.set(piece.id, compact![index]); packedIds.add(piece.id); });
            continue;
        }
        if (!hasCallouts) continue;
        if (points.length > 1000) {
            const populationCandidates = populationRegionIds.has(regionId)
                ? points.slice().sort((a, b) => ((b.x - site.anchor.x) ** 2 + (b.y - site.anchor.y) ** 2)
                    - ((a.x - site.anchor.x) ** 2 + (a.y - site.anchor.y) ** 2)).slice(0, 30)
                : [null];
            let greedy: Point[] | undefined;
            for (const population of populationCandidates) {
                for (const order of [points, points.slice().reverse()]) {
                    const chosen: Point[] = [];
                    for (const point of order) {
                        if (population && !separate(point, population, half + 13 + 4)) continue;
                        if (chosen.every(other => separate(point, other, distance, verticalDistance))) chosen.push(point);
                        if (chosen.length === pieces.length) { greedy = chosen; break; }
                    }
                    if (greedy) break;
                }
                if (greedy) break;
            }
            if (greedy) {
                pieces.forEach((piece, index) => { positions.set(piece.id, greedy![index]); packedIds.add(piece.id); });
                continue;
            }
            // 区域很大时用空间格采样控制回溯成本，不因为候选多就直接判定无解。
            let step = 6;
            while (points.filter(point => point.x % step === 0 && point.y % step === 0).length > 1000) step += 3;
            points = points.filter(point => point.x % step === 0 && point.y % step === 0);
            if (points.length < pieces.length) { unresolvedRegionIds.push(regionId); continue; }
        }
        const compatible = points.map((point, i) => Uint8Array.from(points, (other, j) => i !== j && separate(point, other, distance, verticalDistance) ? 1 : 0));
        const ids = points.map((_, index) => index);
        const populationCandidates = populationRegionIds.has(regionId)
            ? ids.slice().sort((a, b) => ((points[b].x - site.anchor.x) ** 2 + (points[b].y - site.anchor.y) ** 2)
                - ((points[a].x - site.anchor.x) ** 2 + (points[a].y - site.anchor.y) ** 2))
            : [-1];
        let attempts = 0;
        let solution: number[] | null = null;
        const search = (chosen: number[], candidates: number[]): boolean => {
            if (chosen.length === pieces.length) { solution = chosen; return true; }
            if (chosen.length + candidates.length < pieces.length || attempts++ >= 20000) return false;
            const order: number[] = [], colors: number[] = [];
            let remaining = candidates;
            let color = 0;
            while (remaining.length) {
                color += 1;
                const independent: number[] = [];
                for (const candidate of remaining) if (independent.every(other => !compatible[candidate][other])) {
                    independent.push(candidate); order.push(candidate); colors.push(color);
                }
                const excluded = new Set(independent);
                remaining = remaining.filter(candidate => !excluded.has(candidate));
            }
            for (let i = order.length - 1; i >= 0; i--) {
                if (chosen.length + colors[i] < pieces.length || attempts >= 20000) return false;
                const candidate = order[i];
                if (search([...chosen, candidate], order.slice(0, i).filter(other => compatible[candidate][other] === 1))) return true;
            }
            return false;
        };
        for (const population of populationCandidates.slice(0, 40)) {
            const available = population < 0 ? ids : ids.filter(index => separate(points[index], points[population], half + 13 + 4));
            if (search([], available) || attempts >= 20000) break;
        }
        if (!solution) { unresolvedRegionIds.push(regionId); continue; }
        pieces.forEach((piece, index) => { positions.set(piece.id, points[solution![index]]); packedIds.add(piece.id); });
    }
    return {
        tokens: tokens.map(token => { const point = positions.get(token.id); return point ? { ...token, x: point.x / width, y: point.y / height } : token; }),
        callouts: callouts.filter(callout => !packedIds.has(callout.tokenId)), unresolvedRegionIds, populationSites,
    };
}

/** 只投影野战兵牌的显示位置，身份、等级和规则坐标均由正式状态保留。 */
export function layoutQidahenFieldArmies(
    tokens: readonly QidahenMapToken[], sites: ReadonlyMap<string, PopulationSite>, width: number, height: number,
    stackAccessoryTokenIds: ReadonlySet<string> = new Set(),
): { tokens: readonly QidahenMapToken[]; callouts: QidahenArmyCallout[] } {
    const isLandArmy = (token: QidahenMapToken) => token.type === 'army' && token.location === 'field'
        && Boolean(token.regionId && sites.has(token.regionId) && QIDAHEN_RUNTIME_REGION_BY_ID.get(token.regionId)?.mapRole === 'land');
    const armies = tokens.filter(isLandArmy).sort((a, b) => sites.get(a.regionId!)!.clearance - sites.get(b.regionId!)!.clearance || a.id.localeCompare(b.id));
    const obstacles = tokens.filter(token => !isLandArmy(token)).map(token =>
        getArmyMapBounds({ x: token.x * width, y: token.y * height }, (token.size ?? 30) / 2));
    obstacles.push(...QIDAHEN_MAP_NAMEPLATE_OBSTACLES.map(obstacle => getArmyMapBounds(obstacle, obstacle.size / 2)),
        ...QIDAHEN_PRINTED_NAMEPLATE_BOUNDS);
    const placements = new Map<string, Point>();
    const callouts: QidahenArmyCallout[] = [];
    for (const token of armies) {
        const half = (token.size ?? 26) / 2;
        const extension = stackAccessoryTokenIds.has(token.id) ? getArmyStackExtension(half * 2) : 0;
        const free = (point: Point) => {
            if (point.x < half + 2 || point.x >= width - half - 2 || point.y < half + 2 || point.y >= height - half - extension - 2) return false;
            const bounds = getArmyMapBounds(point, half, extension);
            return obstacles.every(box => armyMapBoundsSeparate(bounds, box, 10));
        };
        const placement = placeQidahenMapObject(sites.get(token.regionId!)!, { x: token.x * width, y: token.y * height }, free, half + 9);
        if (!placement) throw new Error(`兵牌没有可用显示位置：${token.id}`);
        placements.set(token.id, placement.point);
        obstacles.push(getArmyMapBounds(placement.point, half, extension));
        if (placement.callout) callouts.push({ tokenId: token.id, point: placement.point, anchor: placement.anchor });
    }
    return { tokens: tokens.map(token => {
        const point = placements.get(token.id);
        return point ? { ...token, x: point.x / width, y: point.y / height } : token;
    }), callouts };
}
