import type { QidahenMapToken } from '../domain/types';
import { QIDAHEN_MAP_NAMEPLATE_BOUNDS, QIDAHEN_RUNTIME_REGION_BY_ID } from './mapGraph';
import type { PopulationSite } from './populationLayout';

/** 相邻控制章重叠时，让城市章贴近城市竖牌，土地章留在真实归属蒙版内部。 */
export function layoutQidahenControlMarkers(
    tokens: readonly QidahenMapToken[], sites: ReadonlyMap<string, PopulationSite>, width: number, height: number,
): { tokens: readonly QidahenMapToken[] } {
    const result = [...tokens];
    const cityControls = result.filter(token => token.type === 'control' && token.regionId
        && QIDAHEN_RUNTIME_REGION_BY_ID.get(token.regionId)?.mapRole === 'city');
    const overlaps = (a: QidahenMapToken, b: QidahenMapToken) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height)
        < ((a.size ?? 30) + (b.size ?? 30)) / 2 + 4;
    const cityDestination = (token: QidahenMapToken): QidahenMapToken | null => {
        const bounds = QIDAHEN_RUNTIME_REGION_BY_ID.get(token.regionId!)?.markerBounds;
        if (!bounds) return null;
        return { ...token, x: (bounds.left + bounds.width / 2) / width,
            y: (bounds.top - (token.size ?? 30) / 2 - 4) / height };
    };
    const movedCities = new Set(cityControls.filter(city => result.some(other => other.type === 'control'
        && other.id !== city.id && overlaps(city, other))).map(city => city.id));
    // 相邻城市的旧章位可能占据新的贴牌位置，需要一起调整，不能把重叠从一对挪到另一对。
    for (let changed = true; changed;) {
        changed = false;
        for (const city of cityControls.filter(token => movedCities.has(token.id))) {
            const destination = cityDestination(city);
            if (!destination) continue;
            for (const neighbor of cityControls) {
                if (movedCities.has(neighbor.id) || !overlaps(destination, neighbor)) continue;
                movedCities.add(neighbor.id);
                changed = true;
            }
        }
    }
    const controls = result.filter(token => token.type === 'control' && token.regionId
        && QIDAHEN_RUNTIME_REGION_BY_ID.get(token.regionId)?.mapRole === 'land' && sites.has(token.regionId))
        .sort((a, b) => a.id.localeCompare(b.id));
    for (const control of controls) {
        const center = { x: control.x * width, y: control.y * height };
        const half = (control.size ?? 30) / 2;
        const others = result.filter(token => token.type === 'control' && token.id !== control.id);
        const coversLabel = (point: { x: number; y: number }, half: number) => QIDAHEN_MAP_NAMEPLATE_BOUNDS.some(label =>
            point.x + half + 2 > label.left && point.x - half - 2 < label.left + label.width
            && point.y + half + 2 > label.top && point.y - half - 2 < label.top + label.height);
        const collides = coversLabel(center, half) || others.some(token => Math.hypot(center.x - token.x * width, center.y - token.y * height)
            < half + (token.size ?? 30) / 2 + 4);
        if (!collides) continue;
        const obstacles = result.filter(token => token.id !== control.id && !movedCities.has(token.id) && !(token.type === 'army' && token.location === 'field'))
            .map(token => ({ x: token.x * width, y: token.y * height, half: (token.size ?? 30) / 2 }));
        let placement: { point: { x: number; y: number }; size: number } | undefined;
        let bestScore = Infinity;
        for (const size of [control.size ?? 30, 26, 24, 22, 20].filter((value, index, all) => value <= (control.size ?? 30) && all.indexOf(value) === index)) {
            const radius = size / 2;
            const candidates = sites.get(control.regionId!)!.candidates.filter(candidate => !coversLabel(candidate, radius)
                && candidate.x >= radius + 2 && candidate.y >= radius + 2 && candidate.x < width - radius - 2 && candidate.y < height - radius - 2
                && !obstacles.some(other => Math.abs(candidate.x - other.x) < radius + other.half + 4
                    && Math.abs(candidate.y - other.y) < radius + other.half + 4));
            for (const point of candidates) {
                const score = Math.hypot(point.x - center.x, point.y - center.y) + ((control.size ?? 30) - size) * 2;
                if (score < bestScore) { placement = { point, size }; bestScore = score; }
            }
        }
        if (placement) {
            const index = result.findIndex(token => token.id === control.id);
            result[index] = { ...control, x: placement.point.x / width, y: placement.point.y / height, size: placement.size };
        }
    }
    const placedCities = new Set<string>();
    for (const city of cityControls.filter(token => movedCities.has(token.id))) {
        const preferred = cityDestination(city);
        const definition = QIDAHEN_RUNTIME_REGION_BY_ID.get(city.regionId!);
        const ownLabel = definition?.markerBounds;
        if (!preferred || !ownLabel) continue;
        let destination: QidahenMapToken | null = null;
        let best = Infinity;
        const landSites = [...sites.entries()].filter(([id]) => QIDAHEN_RUNTIME_REGION_BY_ID.get(id)?.mapRole === 'land');
        for (const [regionId, site] of landSites) for (const point of site.candidates) for (const size of [city.size ?? 30, 26, 24, 22, 20].filter((value, index, all) => value <= (city.size ?? 30) && all.indexOf(value) === index)) {
            if (Math.abs(point.x - preferred.x * width) > 64 || Math.abs(point.y - preferred.y * height) > 64) continue;
            const candidate = { ...preferred, x: point.x / width, y: point.y / height, size };
            const x = candidate.x * width, y = candidate.y * height, half = (candidate.size ?? 30) / 2;
            const distance = Math.hypot(x - ownLabel.left - ownLabel.width / 2, y - ownLabel.top - ownLabel.height / 2)
                + ((city.size ?? 30) - size) * 2 + (regionId === definition?.parentRegionId ? 0 : 30);
            if (distance >= best) continue;
            if (x < half + 2 || x > width - half - 2 || y < half + 2 || y > height - half - 2) continue;
            if (result.some(other => other.type === 'control' && other.id !== city.id
                && (!movedCities.has(other.id) || placedCities.has(other.id)) && overlaps(candidate, other))) continue;
            if (QIDAHEN_MAP_NAMEPLATE_BOUNDS.some(label => x + half + 2 > label.left && x - half - 2 < label.left + label.width
                && y + half + 2 > label.top && y - half - 2 < label.top + label.height)) continue;
            destination = candidate;
            best = distance;
        }
        if (destination) result[result.findIndex(token => token.id === city.id)] = destination;
        placedCities.add(city.id);
    }
    return { tokens: result };
}
