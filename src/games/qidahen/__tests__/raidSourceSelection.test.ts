import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../../../engine';
import { QidahenDomain } from '../domain';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import { getExplicitRaidTargetAction, getQidahenRaidSourceCandidateIds } from '../domain/pendingTargetActionBuilder';
import { reduceQidahenRegionSelected } from '../domain/regionSelectionReducer';
import { resolveQidahenPreviewActionConfirmedEvent, resolveQidahenPreviewActionCancelledEvent } from '../domain/previewActionReducer';
import { getQidahenMapSelectionCandidateIds } from '../ui/mapSelectionCandidates';

// 本文件只验证大明行动窗口内的合法选择；完整开局顺位由年度自然链验证。
const opening = () => ({ ...QidahenDomain.setup(['0','1','2'], createSeededRandom(81), buildQidahenTutorialSetupData('basic-opening', true)!.setupData), currentPlayer: '0' });
const preview = () => resolveQidahenPreviewActionConfirmedEvent(opening(), { type: 'PREVIEW_ACTION_CONFIRMED', timestamp: 1, payload: { actionId: 'raid' } });
describe('突袭的军源与目标属于玩家决定', () => {
    it('先显示己方军源，未选来源不能通过目标反推军队', () => {
        const core=preview();
        const ids=getQidahenMapSelectionCandidateIds(core, {raidPreview:true,regularTroopPlacement:false,actionCandidateIds:[]});
        expect(ids).toContain('city-region-15');
        expect(ids).not.toContain('city-region-7');
        expect(getExplicitRaidTargetAction({...core,explicitRegionId:'city-region-7'}, 'ming')).toBeNull();
        expect(reduceQidahenRegionSelected(core,'city-region-7',2).regionFocusState.lockedSourceRegionId).toBeNull();
    });
    it('明确选择辽北后，只能从辽北进攻叶赫；重选军源清掉目标', () => {
        let core=reduceQidahenRegionSelected(preview(),'city-region-15',2);
        expect(core.regionFocusState.lockedSourceRegionId).toBe('city-region-15');
        expect(core.explicitRegionId).toBeNull();
        core=reduceQidahenRegionSelected(core,'city-region-7',3);
        expect(getExplicitRaidTargetAction(core,'ming')).toMatchObject({sourceRegionId:'city-region-15',targetRegionId:'city-region-7'});
        core=reduceQidahenRegionSelected(core,getQidahenRaidSourceCandidateIds(core)[0]!,4);
        expect(core.explicitRegionId).toBeNull();
    });
    it('取消后不残留来源，下一次必须重新选择', () => {
        const core=reduceQidahenRegionSelected(preview(),'city-region-15',2);
        const cancelled=resolveQidahenPreviewActionCancelledEvent(core,{type:'PREVIEW_ACTION_CANCELLED',timestamp:3,payload:{}});
        expect(cancelled.regionFocusState.lockedSourceRegionId).toBeNull();
    });
});
