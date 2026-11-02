import { describe, expect, it } from 'vitest';
import { getQidahenMaintenanceContextRegionIds } from '../ui/turnContextRegions';

describe('正式维护对象的地图上下文', () => {
    const core = { regions: [{ id: 'city-region-25', isLogicalRegion: false }, { id: 'ji-zhen', isLogicalRegion: true }] };
    it('维护山海关显示实际城市，不把依赖的蓟镇冒充维护对象', () => {
        expect(getQidahenMaintenanceContextRegionIds(core, 'shanhaiguan')).toEqual(['city-region-25']);
    });
    it('内长城显示边界两侧，不能只取一个不存在的城市中心', () => {
        const regions = getQidahenMaintenanceContextRegionIds(core, 'inner-wall');
        expect(regions).toEqual(expect.arrayContaining(['city-region-1', 'city-region-27', 'city-region-30']));
        expect(regions).not.toContain('city-region-25');
    });
    it('没有维护请求时不主动改地图取景', () => {
        expect(getQidahenMaintenanceContextRegionIds(core, null)).toEqual([]);
    });
});
