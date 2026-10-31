import { describe, expect, it } from 'vitest';
import { createInitialCore } from '../domain/initialCoreSetup';
import { applyQidahenFriendlyDispatch, getQidahenDispatchDraftTargets, getQidahenDispatchSourcePieces, getQidahenDispatchSourceRegionIds } from '../domain/wheelDispatchDraft';
import { getQidahenPopulationCap } from '../domain/populationRules';

describe('轮盘调度按来源、具体部队、真实目标形成命令', () => {
    it('来源由玩家明确指定；部队不存在、重复或超过六个时没有合法目标', () => {
        const core = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true);
        const sourceId = 'city-region-15';
        const pieces = getQidahenDispatchSourcePieces(core, 'ming', sourceId);
        expect(getQidahenDispatchSourceRegionIds(core, 'ming')).toContain(sourceId);
        expect(pieces.length).toBeGreaterThan(0);
        expect(getQidahenDispatchDraftTargets(core, 'ming', sourceId, ['missing'])).toEqual([]);
        expect(getQidahenDispatchDraftTargets(core, 'ming', sourceId, [pieces[0].id, pieces[0].id])).toEqual([]);
    });
    it('辽北跨河到叶赫宽度2，炮兵不占宽度；不能把第三支非炮兵算成可入场', () => {
        const core = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true);
        const sourceId = 'city-region-15';
        const pieces = getQidahenDispatchSourcePieces(core, 'ming', sourceId);
        const targets = getQidahenDispatchDraftTargets(core, 'ming', sourceId, pieces.map(piece => piece.id));
        const yehe = targets.find(target => core.regions.find(region => region.id === target.regionId)?.name.includes('叶赫'));
        expect(yehe?.passage.boundaryType).toBe('river');
        expect(yehe?.passage.battleWidth).toBe(2);
        expect(pieces.filter(piece => piece.troopKind === 'artillery')).toHaveLength(1);
        expect(pieces.filter(piece => piece.troopKind !== 'artillery')).toHaveLength(2);
    });
    it('友方调度转移已选实体，未选部队留原地，总数与身份守恒', () => {
        const core = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true);
        const sourceId = 'city-region-15';
        const selectedId = getQidahenDispatchSourcePieces(core, 'ming', sourceId)[0].id;
        const target = getQidahenDispatchDraftTargets(core, 'ming', sourceId, [selectedId]).find(item => item.friendly)!;
        expect(target).toBeDefined();
        const before = core.pieces.map(piece => piece.id).sort();
        const next = applyQidahenFriendlyDispatch(core, 'ming', sourceId, [selectedId], target.regionId);
        expect(next.pieces.map(piece => piece.id).sort()).toEqual(before);
        expect(next.pieces.find(piece => piece.id === selectedId)?.regionId).toBe(target.regionId);
        expect(next.pieces.filter(piece => piece.regionId === sourceId)).toHaveLength(core.pieces.filter(piece => piece.regionId === sourceId).length - 1);
    });
    it('人口上限读地图马数，朝鲜不能开垦；不能一律上限5', () => {
        expect(getQidahenPopulationCap('city-region-15')).toBe(3);
        expect(getQidahenPopulationCap('city-region-7')).toBe(2);
        expect(getQidahenPopulationCap('xian-xing')).toBe(0);
    });
});
