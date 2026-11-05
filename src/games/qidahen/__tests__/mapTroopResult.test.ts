import { describe, expect, it } from 'vitest';
import {
    buildQidahenMapTroopSnapshot,
    findQidahenMapTroopResult,
    findQidahenMapTroopResults,
    getQidahenMapRegionTroopCount,
} from '../domain/mapTroopResult';

const region = (overrides: Record<string, unknown> = {}) => ({
    id: 'city-region-25',
    isLogicalRegion: false,
    troops: 0,
    cityState: null,
    siegeState: null,
    ...overrides,
}) as Parameters<typeof getQidahenMapRegionTroopCount>[0];

describe('Qidahen map troop results', () => {
    it('counts field, city-garrison, and besieging troops shown in one runtime region', () => {
        expect(getQidahenMapRegionTroopCount(region({
            troops: 2,
            cityState: { troops: 3 } as never,
            siegeState: { attackerTroops: 4 } as never,
        }))).toBe(9);
    });

    it('snapshots runtime regions only and tracks troop counts rather than unrelated state changes', () => {
        const before = buildQidahenMapTroopSnapshot([
            region({ troops: 2 }),
            region({ id: 'logical-region', isLogicalRegion: true, troops: 99 }),
        ]);

        expect(before).toEqual(new Map([['city-region-25', 2]]));
        expect(findQidahenMapTroopResult(before, [region({
            troops: 2,
            siegeState: { attackerTroops: 0 } as never,
        })])).toBeNull();
    });

    it('reports the concrete before and after counts when city defenders are lost', () => {
        const before = new Map([['city-region-25', 2]]);
        const afterRegions = [region({ cityState: { troops: 0 } as never })];

        expect(findQidahenMapTroopResult(before, afterRegions)).toEqual({
            regionId: 'city-region-25',
            troopDelta: -2,
            beforeTroops: 2,
            afterTroops: 0,
        });
    });

    it('counts troops entering a besieged region without producing a zero-to-zero result', () => {
        const before = new Map([['city-region-25', 0]]);
        const afterRegions = [region({ siegeState: { attackerTroops: 4 } as never })];

        expect(findQidahenMapTroopResult(before, afterRegions)).toEqual({
            regionId: 'city-region-25',
            troopDelta: 4,
            beforeTroops: 0,
            afterTroops: 4,
        });
        expect(findQidahenMapTroopResult(before, [region()])).toBeNull();
    });

    it('returns all changed runtime regions in stable visual-priority order', () => {
        const before = new Map([
            ['city-region-25', 2],
            ['city-region-29', 1],
        ]);
        expect(findQidahenMapTroopResults(before, [
            region({ id: 'city-region-25', troops: 1 }),
            region({ id: 'city-region-29', troops: 0 }),
        ])).toEqual([
            { regionId: 'city-region-25', troopDelta: -1, beforeTroops: 2, afterTroops: 1 },
            { regionId: 'city-region-29', troopDelta: -1, beforeTroops: 1, afterTroops: 0 },
        ]);
    });
});
