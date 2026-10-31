import { describe, expect, it } from 'vitest';
import { QidahenDomain } from '../domain';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import { createSeededRandom } from '../../../engine';
import { getQidahenMapSelectionCandidateIds } from '../ui/mapSelectionCandidates';
import { getQidahenHomelandFaction } from '../domain/regionConfig';

const options = { actionCandidateIds: [], regularTroopPlacement: false, raidPreview: false };
const opening = () => ({ ...QidahenDomain.setup(
    ['0', '1', '2'], createSeededRandom(81), buildQidahenTutorialSetupData('basic-opening', true)!.setupData,
), currentPlayer: '0' });

describe('地图合法候选与教程引导分层', () => {
    it('军屯呈现全部己方合法建军地，不能仅剩教程推荐的辽东', () => {
        const ids = getQidahenMapSelectionCandidateIds(opening(), { ...options, regularTroopPlacement: true });
        expect(ids).toContain('city-region-15-liaodong');
        expect(ids.length).toBeGreaterThan(1);
        expect(ids).not.toContain('city-region-7');
    });

    it('突袭先呈现全部出兵来源，选定来源后才呈现合法目标', () => {
        const core = opening();
        core.explicitRegionId = null;
        const ids = getQidahenMapSelectionCandidateIds(core, { ...options, raidPreview: true });
        expect(ids).toContain('city-region-15');
        expect(ids).not.toContain('city-region-7');
        expect(core.explicitRegionId).toBeNull();
        core.regionFocusState.lockedSourceRegionId = 'city-region-15';
        const targets = getQidahenMapSelectionCandidateIds(core, { ...options, raidPreview: true });
        expect(targets).toContain('city-region-7');
        expect(targets).not.toContain('city-region-15');
    });

    it('受控中立区和朝鲜控制标记不被误标成正规军建军地', () => {
        const core = opening();
        core.regions.find(region => region.id === 'city-region-7')!.controller = 'ming';
        const ids = getQidahenMapSelectionCandidateIds(core, { ...options, regularTroopPlacement: true });
        expect(ids).not.toContain('city-region-7');
        expect(ids).not.toContain('xian-xing');
        expect(ids).not.toContain('city-region-18');
        expect(ids).not.toContain('city-region-29');
    });

    it('普通浏览不把所有地区伪装成候选，既有调度选择完整保留', () => {
        expect(getQidahenMapSelectionCandidateIds(opening(), options)).toEqual([]);
        expect(getQidahenMapSelectionCandidateIds(opening(), {
            ...options, actionCandidateIds: ['city-region-7', 'city-region-13', 'city-region-7'],
        })).toEqual(['city-region-7', 'city-region-13']);
    });

    it('没有合法本土时不把非本土伪装成建军候选', () => {
        const core = opening();
        core.regions = core.regions.map(region => ({
            ...region,
            controller: getQidahenHomelandFaction(region.id) === 'ming' ? 'jin' as const
                : region.id === 'city-region-7' ? 'ming' as const : region.controller,
        }));
        core.selectedRegionId = 'city-region-7';
        expect(getQidahenMapSelectionCandidateIds(core, { ...options, regularTroopPlacement: true })).toEqual([]);
    });
});
