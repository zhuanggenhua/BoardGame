import type { QidahenCore } from './types';

export interface QidahenMapTroopResult {
    regionId: string;
    troopDelta: number;
    beforeTroops: number;
    afterTroops: number;
}

type QidahenMapTroopRegion = Pick<
    QidahenCore['regions'][number],
    'id' | 'isLogicalRegion' | 'troops' | 'cityState' | 'siegeState'
>;

export const getQidahenMapRegionTroopCount = (region: QidahenMapTroopRegion): number => (
    region.troops
    + (region.cityState?.troops ?? 0)
    + (region.siegeState?.attackerTroops ?? 0)
);

export const buildQidahenMapTroopSnapshot = (
    regions: readonly QidahenMapTroopRegion[],
): Map<string, number> => new Map(
    regions
        .filter((region) => !region.isLogicalRegion)
        .map((region) => [region.id, getQidahenMapRegionTroopCount(region)]),
);

export const findQidahenMapTroopResult = (
    previousSnapshot: ReadonlyMap<string, number>,
    regions: readonly QidahenMapTroopRegion[],
): QidahenMapTroopResult | null => findQidahenMapTroopResults(previousSnapshot, regions)[0] ?? null;

export const findQidahenMapTroopResults = (
    previousSnapshot: ReadonlyMap<string, number>,
    regions: readonly QidahenMapTroopRegion[],
): QidahenMapTroopResult[] => regions
    .filter((region) => !region.isLogicalRegion)
    .map((region) => {
        const beforeTroops = previousSnapshot.get(region.id);
        const afterTroops = getQidahenMapRegionTroopCount(region);
        return beforeTroops == null
            ? null
            : {
                regionId: region.id,
                troopDelta: afterTroops - beforeTroops,
                beforeTroops,
                afterTroops,
            };
    })
    .filter((change): change is QidahenMapTroopResult => change != null && change.troopDelta !== 0)
    .sort((left, right) => Math.abs(right.troopDelta) - Math.abs(left.troopDelta)
        || right.troopDelta - left.troopDelta
        || left.regionId.localeCompare(right.regionId, 'en'));
