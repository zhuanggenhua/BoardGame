import type { QidahenMapToken } from '../domain/types';
import type { QidahenArmyCallout } from './fieldArmyLayout';
import { QIDAHEN_MAP_NAMEPLATE_BOUNDS, QIDAHEN_PRINTED_NAMEPLATE_BOUNDS, QIDAHEN_RUNTIME_REGION_BY_ID, QIDAHEN_RUNTIME_REGION_DEFINITIONS } from './mapGraph';
import { QIDAHEN_POPULATION_SIZE, type PopulationPlacement, type PopulationSite } from './populationLayout';

type Rect = { left: number; top: number; width: number; height: number };

/** 同区兵牌与人口都外置时，先尝试用实际矩形障碍联合安排到区域内部。 */
export function fitRegionObjects(
    tokens: readonly QidahenMapToken[], callouts: readonly QidahenArmyCallout[],
    populations: readonly PopulationPlacement[], sites: ReadonlyMap<string, PopulationSite>,
    width: number, height: number, reserved: readonly Rect[] = [],
    protectedTokenIds: ReadonlySet<string> = new Set(),
    overlays: readonly (Rect & { excludeRegionId?: string })[] = [],
    collisionTokens: readonly QidahenMapToken[] = tokens,
    overlayProtectedRegions?: ReadonlySet<string>,
): { tokens: readonly QidahenMapToken[]; callouts: readonly QidahenArmyCallout[]; populations: readonly PopulationPlacement[] } {
    let nextTokens = tokens.slice();
    let nextPopulations = populations.slice();
    const fitted = new Set<string>();
    const rectangles = [...QIDAHEN_MAP_NAMEPLATE_BOUNDS, ...QIDAHEN_PRINTED_NAMEPLATE_BOUNDS, ...reserved];
    const cityMarkers = QIDAHEN_RUNTIME_REGION_DEFINITIONS.flatMap(region => region.mapRole === 'city' && region.markerBounds ? [region.markerBounds] : []);
    for (const population of populations.filter(item => item.callout)) {
        const armies = nextTokens.filter(token => token.type === 'army' && token.location === 'field' && token.regionId === population.regionId);
        const army = armies[0];
        const site = sites.get(population.regionId);
        if (armies.length !== 1 || !site || protectedTokenIds.has(army.id) || !callouts.some(item => item.tokenId === army.id)) continue;
        const armyHalf = (army.size ?? 26) / 2;
        // 采样按 26px 方块生成，不能用它证明更大的兵牌符合边界约束。
        if (armyHalf > 13) continue;
        const others = [
            ...nextTokens.filter(token => token.id !== army.id).map(token => ({ x: token.x * width, y: token.y * height,
                half: (collisionTokens.find(item => item.id === token.id)?.size ?? token.size ?? 30) / 2 })),
            ...nextPopulations.filter(item => item.regionId !== population.regionId).map(item => ({ ...item.point, half: (item.size ?? QIDAHEN_POPULATION_SIZE) / 2 })),
        ];
        const free = (point: { x: number; y: number }, half: number, margin: number) => rectangles.every(rect =>
            point.x + half + margin <= rect.left || point.x - half - margin >= rect.left + rect.width
            || point.y + half + margin <= rect.top || point.y - half - margin >= rect.top + rect.height)
            && ((overlayProtectedRegions != null && !overlayProtectedRegions.has(population.regionId))
                || overlays.filter(rect => rect.excludeRegionId !== population.regionId).every(rect =>
                point.x + half + 2 <= rect.left || point.x - half - 2 >= rect.left + rect.width
                || point.y + half + 2 <= rect.top || point.y - half - 2 >= rect.top + rect.height))
            && others.every(other => Math.abs(point.x - other.x) >= half + other.half + 2
                || Math.abs(point.y - other.y) >= half + other.half + 2);
        let best: { army: { x: number; y: number }; population: { x: number; y: number }; size: number; score: number } | undefined;
        search: for (const avoidCityAmbiguity of [true, false]) for (const size of [QIDAHEN_POPULATION_SIZE, 22, 18]) for (const compact of [false, true]) {
            const candidates = compact ? [...site.candidates, ...(site.compactCandidates ?? [])] : site.candidates;
            const armyPoints = candidates.filter(point => free(point, armyHalf, 0)
                && cityMarkers.every(rect => point.x + armyHalf + 6 <= rect.left || point.x - armyHalf - 6 >= rect.left + rect.width
                    || point.y + armyHalf + 6 <= rect.top || point.y - armyHalf - 6 >= rect.top + rect.height));
            for (const point of candidates.filter(candidate => free(candidate, size / 2, compact || size === 18 ? 0 : 2)
                && cityMarkers.every(rect => candidate.x + size / 2 + 6 <= rect.left || candidate.x - size / 2 - 6 >= rect.left + rect.width
                    || candidate.y + size / 2 + 6 <= rect.top || candidate.y - size / 2 - 6 >= rect.top + rect.height))) for (const armyPoint of armyPoints) {
                if (Math.abs(point.x - armyPoint.x) < size / 2 + armyHalf + 3
                    && Math.abs(point.y - armyPoint.y) < size / 2 + armyHalf + 3) continue;
                // 人口数更靠近其他城市牌时，容易被误认为城市读数。
                const armyDistance = (point.x - armyPoint.x) ** 2 + (point.y - armyPoint.y) ** 2;
                if (avoidCityAmbiguity && cityMarkers.some(rect => (point.x - (rect.left + rect.width / 2)) ** 2
                    + (point.y - (rect.top + rect.height / 2)) ** 2 < armyDistance)) continue;
                // 同区对象越分散越容易被误认为城池读数。
                const score = 4 * ((point.x - armyPoint.x) ** 2 + (point.y - armyPoint.y) ** 2)
                    + (point.x - site.anchor.x) ** 2 + (point.y - site.anchor.y) ** 2
                    + (armyPoint.x - site.anchor.x) ** 2 + (armyPoint.y - site.anchor.y) ** 2;
                if (!best || score < best.score) best = { army: armyPoint, population: point, size, score };
            }
            // 大尺寸有合法解时不要为了缩短距离而缩小人口标记。
            if (best) break search;
        }
        if (!best) continue;
        const chosen = best;
        nextTokens = nextTokens.map(token => token.id === army.id ? { ...token, x: chosen.army.x / width, y: chosen.army.y / height } : token);
        nextPopulations = nextPopulations.map(item => item.regionId === population.regionId
            ? { ...item, point: chosen.population, size: chosen.size, callout: false } : item);
        fitted.add(army.id);
    }
    // 独立外置的人口也先尝试真实地名矩形；不要让细长字牌的方形近似产生多余引线。
    for (const population of nextPopulations.filter(item => item.callout)) {
        if (QIDAHEN_RUNTIME_REGION_BY_ID.get(population.regionId)?.mapRole !== 'land') continue;
        const site = sites.get(population.regionId);
        if (!site || callouts.some(line => nextTokens.some(token => token.id === line.tokenId && token.regionId === population.regionId))) continue;
        const half = QIDAHEN_POPULATION_SIZE / 2;
        const others = [
            ...nextTokens.map(token => ({ x: token.x * width, y: token.y * height,
                half: (collisionTokens.find(item => item.id === token.id)?.size ?? token.size ?? 30) / 2 })),
            ...nextPopulations.filter(item => item.regionId !== population.regionId).map(item => ({ ...item.point, half: (item.size ?? QIDAHEN_POPULATION_SIZE) / 2 })),
        ];
        const eligible = site.candidates.filter(point => rectangles.every(rect => point.x + half + 2 <= rect.left
            || point.x - half - 2 >= rect.left + rect.width || point.y + half + 2 <= rect.top || point.y - half - 2 >= rect.top + rect.height)
            && cityMarkers.every(rect => point.x + half + 6 <= rect.left || point.x - half - 6 >= rect.left + rect.width
                || point.y + half + 6 <= rect.top || point.y - half - 6 >= rect.top + rect.height)
            && ((overlayProtectedRegions != null && !overlayProtectedRegions.has(population.regionId)) || overlays.filter(rect => rect.excludeRegionId !== population.regionId).every(rect =>
                point.x + half + 2 <= rect.left || point.x - half - 2 >= rect.left + rect.width || point.y + half + 2 <= rect.top || point.y - half - 2 >= rect.top + rect.height))
            && others.every(other => Math.abs(point.x - other.x) >= half + other.half + 5 || Math.abs(point.y - other.y) >= half + other.half + 5));
        const point = eligible.sort((a, b) => (a.x - site.anchor.x) ** 2 + (a.y - site.anchor.y) ** 2
            - ((b.x - site.anchor.x) ** 2 + (b.y - site.anchor.y) ** 2))[0];
        if (point) nextPopulations = nextPopulations.map(item => item.regionId === population.regionId ? { ...item, point, callout: false } : item);
    }
    return { tokens: nextTokens, populations: nextPopulations, callouts: callouts.filter(item => !fitted.has(item.tokenId)) };
}
