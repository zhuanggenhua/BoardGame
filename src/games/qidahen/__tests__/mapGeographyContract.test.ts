import { describe, expect, it } from 'vitest';
import { QIDAHEN_PRINTED_REGION_DEFINITIONS, QIDAHEN_RUNTIME_REGION_BY_ID, getQidahenRuntimeRegionIdsForPrintedRegionId } from '../ui/mapGraph';
import { resolveQidahenPrimaryRuntimeRegionId } from '../domain/regionConfig';
import { countQidahenControlledRuntimeRegions } from '../domain/victoryResolution';
import { QidahenDomain } from '../domain';
import { resolveQidahenMapRegionAtPoint } from '../ui/mapRegionHitTesting';
import type { RandomFn } from '../../../engine/types';
import { expandSpecialTroopStacksToCompatPieces, sortCompatPiecesForSelection } from '../domain/troopCompat';

const random: RandomFn = { random: () => 0, d: () => 1, range: min => min, shuffle: items => [...items] };

describe('七大恨原图地理对象合同', () => {
    it('土地逐区录入，城名不再切割父地域；宣府不再借用宁远编号', () => {
        expect(QIDAHEN_PRINTED_REGION_DEFINITIONS).toHaveLength(35);
        for (const region of QIDAHEN_PRINTED_REGION_DEFINITIONS) {
            expect(getQidahenRuntimeRegionIdsForPrintedRegionId(region.id)).toEqual([region.id]);
        }
        expect(resolveQidahenPrimaryRuntimeRegionId('xuan-fu')).toBe('xuan-fu');
        expect(QIDAHEN_RUNTIME_REGION_BY_ID.get('city-region-24')).toMatchObject({ name: '宁远', mapRole: 'city', parentRegionId: 'city-region-19-liaoxi' });
        expect(QIDAHEN_RUNTIME_REGION_BY_ID.get('city-region-25')).toMatchObject({ mapRole: 'city', parentRegionId: 'city-region-28-jizhen' });
    });

    it('原图城名牌可检视；选择父土地时命中仍归父地域', () => {
        const width = 1265, height = 893;
        const ownership = new Array<string | null>(width * height).fill('city-region-19-liaoxi');
        const point = { x: 751, y: 434 };
        expect(resolveQidahenMapRegionAtPoint(ownership, width, height, point)).toBe('jinzhou');
        expect(resolveQidahenMapRegionAtPoint(ownership, width, height, point, ['city-region-19-liaoxi'])).toBe('city-region-19-liaoxi');
        expect(resolveQidahenMapRegionAtPoint(ownership, width, height, point, ['jinzhou'])).toBe('jinzhou');
    });

    it('占领同一土地及两座城只计一片土地，朝鲜点位不混入霸权区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const selected = new Set(['city-region-19-liaoxi', 'jinzhou', 'city-region-24', 'city-region-18']);
        const regions = core.regions.map(region => ({ ...region, controller: selected.has(region.id) ? 'ming' as const : 'neutral' as const }));
        expect(countQidahenControlledRuntimeRegions(regions, 'ming')).toBe(1);
    });

    it('地图出兵数的前缀与正式部队选择顺序相同，不把另一兵种标成参战', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const region = core.regions.find(region => region.id === 'city-region-15')!;
        const expected = sortCompatPiecesForSelection(expandSpecialTroopStacksToCompatPieces(region.specialTroops)).map(piece => piece.id);
        const visible = core.mapTokens.filter(token => token.type === 'army' && token.regionId === region.id && token.location === 'field');
        expect(visible.map(token => token.pieceId)).toEqual(expected);
        expect(visible.map(token => token.troopIndex)).toEqual([1, 2, 3]);
    });
});
