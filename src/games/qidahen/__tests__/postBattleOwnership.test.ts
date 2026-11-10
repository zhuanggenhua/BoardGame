import { describe, expect, it } from 'vitest';
import { createInitialCore } from '../domain/initialCoreSetup';
import { resolvePostBattleDecision } from '../domain/postBattleDecisionResolution';
import type { QidahenPostBattleSelection } from '../domain/types';

describe('占领后的控制标记', () => {
    it.each([
        ['city-region-7', 'mongol', 'ming', 'vassal'],
        ['city-region-11', 'jin', 'ming', 'vassal'],
        ['city-region-15', 'jin', null, null],
    ] as const)('%s 按地区本土身份结算占领', (regionId, defender, markerFaction, markerSide) => {
        const state = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true);
        state.regions = state.regions.map(region => region.id === regionId ? {
            ...region, controller: defender,
            diplomacyMarkerFaction: regionId === 'city-region-11' ? null : defender,
            diplomacyMarkerSide: regionId === 'city-region-11' ? null : 'vassal' as const,
        } : region);
        const selection: QidahenPostBattleSelection = {
            actionId: 'raid', battleMode: 'field', targetKind: 'region', attackerFactionId: 'ming',
            sourceRegionId: 'city-region-1', sourceRegionName: '大同', attackerPositionRegionId: null,
            targetRegionId: regionId, targetRuntimeRegionId: regionId, targetRegionName: regionId,
            committedTroops: 1, survivingTroops: 1, attackerLosses: 0, movementProfileId: null,
            attackerCasualtyPriority: 'highest-level', attackerBattleCasualtyPriority: 'highest-level',
            originalController: defender, originalControlLabel: '原控制者', title: '战后处理', summary: '占领',
            choices: [{ id: 'occupy', mode: 'occupy', regionId, plunderPopulation: 0, plunderSource: null, label: '占领', detail: '' }],
        };
        const result = resolvePostBattleDecision(state, selection, 'occupy');
        expect(result.regions.find(region => region.id === regionId)).toMatchObject({
            controller: 'ming', diplomacyMarkerFaction: markerFaction, diplomacyMarkerSide: markerSide,
        });
    });

    it('大明攻胜蒙古附庸叶赫后撤回，叶赫仍由蒙古控制并保留原正面标记', () => {
        const state = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true);
        const selection: QidahenPostBattleSelection = {
            actionId: 'raid', battleMode: 'field', targetKind: 'region', attackerFactionId: 'ming',
            sourceRegionId: 'city-region-15', sourceRegionName: '辽北', attackerPositionRegionId: null,
            targetRegionId: 'city-region-7', targetRuntimeRegionId: 'city-region-7', targetRegionName: '叶赫部',
            committedTroops: 1, survivingTroops: 1, attackerLosses: 0, movementProfileId: null,
            attackerCasualtyPriority: 'highest-level', attackerBattleCasualtyPriority: 'highest-level',
            originalController: 'mongol', originalControlLabel: '蒙古附庸', title: '战后处理', summary: '撤回',
            choices: [{ id: 'withdraw', mode: 'withdraw', regionId: 'city-region-15', plunderPopulation: 0, plunderSource: null, label: '撤回', detail: '' }],
        };
        const result = resolvePostBattleDecision(state, selection, 'withdraw');
        expect(result.regions.find(region => region.id === 'city-region-7')).toMatchObject({
            controller: 'mongol', diplomacyMarkerFaction: 'mongol', diplomacyMarkerSide: 'vassal', controlLabel: '蒙古附庸',
        });
    });
});
