import { describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../engine/types';
import { QidahenDomain } from '../domain';

const random: RandomFn = { random: () => 0.5, d: () => 4, range: min => min, shuffle: <T>(items: T[]) => [...items] };

// 正式规则 PDF Ver1.3 第 9 页的正面控制标记；本土标记是另一种对象。
describe('剧本初始外交标记', () => {
    it.each([
        ['post-sarhu-1619', ['0', '1', '2'], {
            jin: ['city-region-5', 'city-region-9'],
            mongol: ['city-region-7', 'city-region-6', 'city-region-16', 'city-region-8', 'city-region-10', 'city-region-17', 'city-region-19'],
            ming: ['xian-xing', 'city-region-18', 'city-region-29', 'duoyan'],
        }],
    ] as const)('%s 的控制标记及控制权与规则书一致', (scenario, players, positive) => {
        const core = QidahenDomain.setup([...players], random, { scenario });
        const regions = core.regions.filter(region => !region.isLogicalRegion);
        for (const [faction, ids] of Object.entries(positive)) for (const id of ids) {
            expect(regions.find(region => region.id === id), id).toMatchObject({ controller: faction, diplomacyMarkerFaction: faction, diplomacyMarkerSide: 'vassal' });
        }
        expect(regions.filter(region => region.diplomacyMarkerFaction != null)).toHaveLength(Object.values(positive).flat().length);
        for (const id of ['city-region-11', 'city-region-13']) {
            expect(regions.find(region => region.id === id), id).toMatchObject({ controller: 'jin', diplomacyMarkerFaction: null, diplomacyMarkerSide: null });
        }
    });
});
