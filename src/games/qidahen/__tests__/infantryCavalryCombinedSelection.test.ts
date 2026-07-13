import { describe, expect, it } from 'vitest';
import { QidahenDomain } from '../domain';
import { createQidahenStructuredBattleRolls } from '../domain/battleRollMath';
import {
    buildQidahenInfantryCavalryCombinedSelection,
    resolveQidahenInfantryCavalryCombinedSelection,
} from '../domain/infantryCavalryCombinedSelection';
import {
    QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID,
} from '../domain/ordinaryHandCardIdentities';
import type { QidahenCore, QidahenFactionId } from '../domain/types';
import type { RandomFn } from '../../../engine/types';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 4,
    range: (min) => min,
    shuffle: <T>(array: T[]) => [...array],
};

const FACTION_LABELS: Record<QidahenFactionId, string> = {
    ming: '大明',
    jin: '后金',
    mongol: '蒙古',
};

const DEFENDER_BY_ATTACKER: Record<QidahenFactionId, QidahenFactionId> = {
    ming: 'jin',
    jin: 'ming',
    mongol: 'ming',
};

const buildCore = (attackerFactionId: QidahenFactionId = 'ming'): QidahenCore => {
    const core = QidahenDomain.setup(['0', '1', '2'], () => 0.5);
    const attackerCard = core.handCards.find((card) => card.faction === attackerFactionId);
    if (!attackerCard) {
        throw new Error(`测试需要${FACTION_LABELS[attackerFactionId]}手牌`);
    }
    const defenderFactionId = DEFENDER_BY_ATTACKER[attackerFactionId];
    core.pendingTargetAction = {
        actionId: 'raid',
        title: '突袭作战待结算',
        attackerFactionId,
        battleMode: 'field',
        sourceRegionId: 'city-region-16',
        sourceRegionName: '区域 16',
        targetRegionId: 'city-region-14',
        targetRegionName: '区域 14',
        targetRuntimeRegionId: 'city-region-14',
        defenderFactionId,
        defenderLabel: FACTION_LABELS[defenderFactionId],
        restriction: '测试 · 步骑联合',
        battleWidth: 4,
        boundaryUnitCap: null,
        sourceAvailableTroops: 3,
        committedTroops: 3,
        attackPressure: 3,
        attackBoundaryType: 'plain',
        resolutionHint: '测试',
        defenderPayCost: null,
    };
    core.handCards = [{
        ...attackerCard,
        id: 'test-infantry-cavalry-combined-card',
        label: '步骑联合',
        status: 'payable',
        cardKind: 'tactic',
        armamentId: null,
        cardDefId: 'qidahen-atlas05-1628-infantry-cavalry-combined',
        rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
            'qidahen-atlas05-1628-infantry-cavalry-combined'
        ],
    }];
    core.regions = core.regions.map((region) => {
        if (region.isLogicalRegion) {
            return region;
        }
        if (region.id === 'city-region-16') {
            return {
                ...region,
                controller: attackerFactionId,
                controlLabel: FACTION_LABELS[attackerFactionId],
                troops: 3,
                specialTroops: [
                    {
                        id: `${attackerFactionId}-cavalry-lv2`,
                        label: `${FACTION_LABELS[attackerFactionId]}骑兵`,
                        faction: attackerFactionId,
                        troopKind: 'cavalry',
                        count: 1,
                        level: 2,
                        pieceIds: [`${attackerFactionId}-cavalry-1`],
                    },
                    {
                        id: `${attackerFactionId}-infantry-lv2`,
                        label: `${FACTION_LABELS[attackerFactionId]}步兵`,
                        faction: attackerFactionId,
                        troopKind: 'infantry',
                        count: 2,
                        level: 2,
                        pieceIds: [
                            `${attackerFactionId}-infantry-1`,
                            `${attackerFactionId}-infantry-2`,
                        ],
                    },
                ],
            };
        }
        if (region.id === 'city-region-14') {
            return {
                ...region,
                controller: defenderFactionId,
                controlLabel: FACTION_LABELS[defenderFactionId],
                troops: 1,
                population: 0,
                specialTroops: [{
                    id: `${defenderFactionId}-infantry-lv2`,
                    label: `${FACTION_LABELS[defenderFactionId]}步兵`,
                    faction: defenderFactionId,
                    troopKind: 'infantry',
                    count: 1,
                    level: 2,
                    pieceIds: [`${defenderFactionId}-infantry-1`],
                }],
            };
        }
        return region;
    });
    return core;
};

describe('步骑联合选择', () => {
    it('攻城或守城属于城战，不能建立步骑联合选择', () => {
        const core = buildCore();
        core.pendingTargetAction!.battleMode = 'city';

        expect(buildQidahenInfantryCavalryCombinedSelection(
            core,
            'test-infantry-cavalry-combined-card',
        )).toBeNull();
    });

    it.each([
        ['jin', '后金'],
        ['mongol', '蒙古'],
    ] as const)('%s 使用时同样让步兵与骑兵在步兵阶段共同攻击并提升等级', (factionId, factionName) => {
        const core = buildCore(factionId);
        const selection = buildQidahenInfantryCavalryCombinedSelection(
            core,
            'test-infantry-cavalry-combined-card',
        );
        expect(selection).toEqual(expect.objectContaining({
            factionId,
            infantryCount: 2,
            cavalryCount: 1,
        }));
        core.infantryCavalryCombinedSelection = selection;

        const resolved = resolveQidahenInfantryCavalryCombinedSelection(
            core,
            'joint-attack',
            90,
        );

        expect(resolved.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                troopKind: 'infantry',
                levelBonus: 1,
            }),
            expect.objectContaining({
                troopKind: 'cavalry',
                levelBonus: 1,
                rollAsPhase: 'infantry',
                rollUnitCount: 1,
            }),
        ]));
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain(`${factionName} 打出战术牌「步骑联合」`);
    });

    it('选择骑兵撤离后只保留具体步兵参战，骑兵不会被排序重新选回战斗', () => {
        const core = buildCore();
        const selection = buildQidahenInfantryCavalryCombinedSelection(
            core,
            'test-infantry-cavalry-combined-card',
        );
        expect(selection).toEqual(expect.objectContaining({
            infantryCount: 2,
            cavalryCount: 1,
        }));
        core.infantryCavalryCombinedSelection = selection;

        const resolved = resolveQidahenInfantryCavalryCombinedSelection(
            core,
            'withdraw-cavalry',
            100,
        );
        const commitment = resolved.pendingTargetAction?.forceCommitments?.[0];
        const battleRolls = resolved.pendingTargetAction
            ? createQidahenStructuredBattleRolls(
                resolved,
                resolved.pendingTargetAction,
                fixedRandom,
                {
                    defenderSortieBattle: false,
                    defenderHoldCity: false,
                    defenderCavalryEvasion: false,
                    attackerCavalryPlunder: false,
                },
            )
            : null;
        const cavalryStage = battleRolls?.stages.find((stage) => stage.phase === 'cavalry');
        const infantryStage = battleRolls?.stages.find((stage) => stage.phase === 'infantry');

        expect(resolved.pendingTargetAction?.committedTroops).toBe(2);
        expect(commitment).toEqual(expect.objectContaining({
            committedTroops: 2,
            movementProfileId: null,
            selectedSpecialPieceIds: ['ming-infantry-1', 'ming-infantry-2'],
            selectedGenericTroops: 0,
        }));
        expect(resolved.regions.find((region) => region.id === 'city-region-16')?.specialTroops)
            .toEqual(expect.arrayContaining([
                expect.objectContaining({
                    troopKind: 'cavalry',
                    pieceIds: ['ming-cavalry-1'],
                }),
            ]));
        expect(cavalryStage?.attackerRolls ?? []).toEqual([]);
        expect(infantryStage?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({
                troopKind: 'infantry',
                level: 2,
                dieSides: 8,
            }),
        ]));
        expect(
            battleRolls?.stages
                .flatMap((stage) => stage.attackerRolls)
                .some((roll) => roll.troopKind === 'cavalry'),
        ).toBe(false);
    });
});
