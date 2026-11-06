import type { QidahenMapToken } from '../domain/types';
import { QIDAHEN_RUNTIME_REGION_BY_ID, QIDAHEN_MAP_NAMEPLATE_OBSTACLES } from './mapGraph';
import { placeQidahenMapObject } from './mapObjectPlacement';
import type { PopulationSite } from './populationLayout';
import type { QidahenRuntimeRegionPoint as Point } from './runtimeRegionOwnership';

export interface QidahenArmyCallout { tokenId: string; point: Point; anchor: Point }

/** 只投影野战兵牌的显示位置，身份、等级和规则坐标均由正式状态保留。 */
export function layoutQidahenFieldArmies(
    tokens: readonly QidahenMapToken[], sites: ReadonlyMap<string, PopulationSite>, width: number, height: number,
): { tokens: readonly QidahenMapToken[]; callouts: QidahenArmyCallout[] } {
    const isLandArmy = (token: QidahenMapToken) => token.type === 'army' && token.location === 'field'
        && Boolean(token.regionId && sites.has(token.regionId) && QIDAHEN_RUNTIME_REGION_BY_ID.get(token.regionId)?.mapRole === 'land');
    const armies = tokens.filter(isLandArmy).sort((a, b) => sites.get(a.regionId!)!.clearance - sites.get(b.regionId!)!.clearance || a.id.localeCompare(b.id));
    const obstacles = tokens.filter(token => !isLandArmy(token)).map(token => ({ x: token.x * width, y: token.y * height, half: (token.size ?? 30) / 2 }));
    obstacles.push(...QIDAHEN_MAP_NAMEPLATE_OBSTACLES.map(obstacle => ({ x: obstacle.x, y: obstacle.y, half: obstacle.size / 2 })));
    const placements = new Map<string, Point>();
    const callouts: QidahenArmyCallout[] = [];
    for (const token of armies) {
        const half = (token.size ?? 26) / 2;
        const free = (point: Point) => point.x >= half + 2 && point.x < width - half - 2 && point.y >= half + 2 && point.y < height - half - 2
            && obstacles.every(box => Math.abs(point.x - box.x) >= half + box.half + 4 || Math.abs(point.y - box.y) >= half + box.half + 4);
        const placement = placeQidahenMapObject(sites.get(token.regionId!)!, { x: token.x * width, y: token.y * height }, free, half + 9);
        if (!placement) throw new Error(`兵牌没有可用显示位置：${token.id}`);
        placements.set(token.id, placement.point);
        obstacles.push({ ...placement.point, half });
        if (placement.callout) callouts.push({ tokenId: token.id, point: placement.point, anchor: placement.anchor });
    }
    return { tokens: tokens.map(token => {
        const point = placements.get(token.id);
        return point ? { ...token, x: point.x / width, y: point.y / height } : token;
    }), callouts };
}
