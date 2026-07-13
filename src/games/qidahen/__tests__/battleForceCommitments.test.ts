import { describe, expect, it } from 'vitest';
import {
    getQidahenBattleForceCommitments,
    updateQidahenForceCommitmentsFromOutcomes,
    updateQidahenPrimaryForceCommittedTroops,
} from '../domain/battleForceCommitments';
import {
    buildQidahenBattleForceOutcomes,
    buildQidahenBattleForceRetreatOutcomes,
} from '../domain/battleForceOutcomes';
import { createInitialCore } from '../domain/initialCoreSetup';
import { resolvePostBattleDecision } from '../domain/postBattleDecisionResolution';
import { resolvePendingTargetActionByActionType } from '../domain/pendingTargetResolution';
import type {
    QidahenPendingTargetAction,
    QidahenPostBattleSelection,
} from '../domain/types';

const buildPendingAction = (
    overrides: Partial<QidahenPendingTargetAction> = {},
): QidahenPendingTargetAction => ({
    actionId: 'raid',
    battleMode: 'field',
    targetKind: 'region',
    title: '突袭待结算',
    attackerFactionId: 'ming',
    sourceRegionId: 'city-region-1',
    sourceRegionName: '辽东',
    attackerPositionRegionId: null,
    targetRegionId: 'city-region-2',
    targetRegionName: '建州',
    targetRuntimeRegionId: 'city-region-2',
    defenderFactionId: 'jin',
    defenderLabel: '后金',
    restriction: '仅进攻行动',
    battleWidth: 3,
    boundaryUnitCap: null,
    sourceAvailableTroops: 5,
    committedTroops: 3,
    movementProfileId: null,
    attackPressure: 1,
    attackBoundaryType: 'plain',
    resolutionHint: '辽东 → 建州',
    defenderPayCost: null,
    ...overrides,
});

const buildMultiSourcePostBattleState = () => {
    const state = createInitialCore(['0', '1', '2']);
    state.regions = state.regions.map((region) => {
        if (region.id === 'city-region-1' || region.id === 'city-region-3') {
            const secondSource = region.id === 'city-region-3';
            return {
                ...region,
                controller: 'ming',
                troops: 3,
                cityState: null,
                siegeState: null,
                specialTroops: secondSource
                    ? [{
                        id: 'ming-support-infantry',
                        label: '大明增援步兵',
                        faction: 'ming',
                        troopKind: 'infantry',
                        count: 1,
                        level: 2,
                        pieceIds: ['ming-support-infantry-1'],
                    }]
                    : [],
            };
        }
        if (region.id === 'city-region-2') {
            return {
                ...region,
                controller: 'jin',
                controlLabel: '后金',
                troops: 0,
                population: 0,
                cityState: null,
                siegeState: null,
                specialTroops: [],
            };
        }
        return region;
    });
    return state;
};

const buildMultiSourcePostBattleSelection = (
    choices: QidahenPostBattleSelection['choices'],
): QidahenPostBattleSelection => ({
    actionId: 'raid',
    battleMode: 'field',
    targetKind: 'region',
    attackerFactionId: 'ming',
    sourceRegionId: 'city-region-1',
    sourceRegionName: '辽东',
    attackerPositionRegionId: null,
    targetRegionId: 'city-region-2',
    targetRegionName: '建州',
    targetRuntimeRegionId: 'city-region-2',
    committedTroops: 5,
    survivingTroops: 4,
    attackerLosses: 1,
    movementProfileId: null,
    attackerCasualtyPriority: 'highest-level',
    attackerBattleCasualtyPriority: 'highest-level',
    originalController: 'jin',
    originalControlLabel: '后金',
    title: '战后处理',
    summary: '多来源战后处理',
    forceOutcomes: [
        {
            id: 'force-city-region-1',
            sourceRegionId: 'city-region-1',
            sourceRegionName: '辽东',
            sourceAvailableTroops: 3,
            committedTroops: 3,
            movementProfileId: null,
            battleWidth: 3,
            boundaryUnitCap: null,
            attackBoundaryType: 'plain',
            attackerLosses: 1,
            survivingTroops: 2,
            survivingSpecialTroops: [],
        },
        {
            id: 'force-city-region-3',
            sourceRegionId: 'city-region-3',
            sourceRegionName: '沈阳',
            sourceAvailableTroops: 3,
            committedTroops: 2,
            movementProfileId: null,
            battleWidth: 3,
            boundaryUnitCap: null,
            attackBoundaryType: 'plain',
            attackerLosses: 0,
            survivingTroops: 2,
            survivingSpecialTroops: [{
                id: 'ming-support-infantry',
                label: '大明增援步兵',
                faction: 'ming',
                troopKind: 'infantry',
                count: 1,
                level: 2,
                pieceIds: ['ming-support-infantry-1'],
            }],
        },
    ],
    choices,
});

describe('七大恨参战来源分组', () => {
    it('旧单来源待结算会归一化为一个正式来源组', () => {
        const commitments = getQidahenBattleForceCommitments(buildPendingAction());

        expect(commitments).toEqual([{
            id: 'force-city-region-1',
            sourceRegionId: 'city-region-1',
            sourceRegionName: '辽东',
            sourceAvailableTroops: 5,
            committedTroops: 3,
            movementProfileId: null,
            battleWidth: 3,
            boundaryUnitCap: null,
            attackBoundaryType: 'plain',
        }]);
    });

    it('调整主来源出兵数时保留第二来源并同步聚合兵力', () => {
        const pendingAction = buildPendingAction({
            committedTroops: 5,
            forceCommitments: [
                {
                    id: 'force-city-region-1',
                    sourceRegionId: 'city-region-1',
                    sourceRegionName: '辽东',
                    sourceAvailableTroops: 5,
                    committedTroops: 3,
                    movementProfileId: null,
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    attackBoundaryType: 'plain',
                },
                {
                    id: 'force-city-region-3',
                    sourceRegionId: 'city-region-3',
                    sourceRegionName: '沈阳',
                    sourceAvailableTroops: 4,
                    committedTroops: 2,
                    movementProfileId: 'dispatch-infantry',
                    battleWidth: 2,
                    boundaryUnitCap: 2,
                    attackBoundaryType: 'mountain',
                },
            ],
        });

        const updated = updateQidahenPrimaryForceCommittedTroops(pendingAction, 2);

        expect(updated.committedTroops).toBe(4);
        expect(updated.forceCommitments).toEqual([
            expect.objectContaining({
                sourceRegionId: 'city-region-1',
                committedTroops: 2,
            }),
            expect.objectContaining({
                sourceRegionId: 'city-region-3',
                committedTroops: 2,
                movementProfileId: 'dispatch-infantry',
            }),
        ]);
        expect(pendingAction.forceCommitments?.[0]?.committedTroops).toBe(3);
    });

    it('连续战斗会按各来源幸存兵力重建来源组，不会把总幸存兵力重复写进第一来源', () => {
        const pendingAction = buildPendingAction({
            committedTroops: 5,
            forceCommitments: [
                {
                    id: 'force-city-region-1',
                    sourceRegionId: 'city-region-1',
                    sourceRegionName: '辽东',
                    sourceAvailableTroops: 3,
                    committedTroops: 3,
                    movementProfileId: null,
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    attackBoundaryType: 'plain',
                },
                {
                    id: 'force-city-region-3',
                    sourceRegionId: 'city-region-3',
                    sourceRegionName: '沈阳',
                    sourceAvailableTroops: 2,
                    committedTroops: 2,
                    movementProfileId: 'dispatch-infantry',
                    battleWidth: 2,
                    boundaryUnitCap: 2,
                    attackBoundaryType: 'mountain',
                },
            ],
        });

        const updated = updateQidahenForceCommitmentsFromOutcomes(pendingAction, [
            {
                ...pendingAction.forceCommitments![0],
                attackerLosses: 2,
                survivingTroops: 1,
                survivingSpecialTroops: [],
            },
            {
                ...pendingAction.forceCommitments![1],
                attackerLosses: 0,
                survivingTroops: 2,
                survivingSpecialTroops: [],
            },
        ]);

        expect(updated.committedTroops).toBe(3);
        expect(updated.sourceAvailableTroops).toBe(3);
        expect(updated.forceCommitments).toEqual([
            expect.objectContaining({
                sourceRegionId: 'city-region-1',
                sourceAvailableTroops: 1,
                committedTroops: 1,
            }),
            expect.objectContaining({
                sourceRegionId: 'city-region-3',
                sourceAvailableTroops: 2,
                committedTroops: 2,
                movementProfileId: 'dispatch-infantry',
            }),
        ]);
    });

    it('原主来源全灭时，连续战斗会切换到仍有幸存者的来源', () => {
        const pendingAction = buildPendingAction({
            committedTroops: 5,
            forceCommitments: [
                {
                    id: 'force-city-region-1',
                    sourceRegionId: 'city-region-1',
                    sourceRegionName: '辽东',
                    sourceAvailableTroops: 3,
                    committedTroops: 3,
                    movementProfileId: null,
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    attackBoundaryType: 'plain',
                },
                {
                    id: 'force-city-region-3',
                    sourceRegionId: 'city-region-3',
                    sourceRegionName: '沈阳',
                    sourceAvailableTroops: 2,
                    committedTroops: 2,
                    movementProfileId: 'dispatch-infantry',
                    battleWidth: 2,
                    boundaryUnitCap: 2,
                    attackBoundaryType: 'mountain',
                },
            ],
        });

        const updated = updateQidahenForceCommitmentsFromOutcomes(pendingAction, [
            {
                ...pendingAction.forceCommitments![0],
                attackerLosses: 3,
                survivingTroops: 0,
                survivingSpecialTroops: [],
            },
            {
                ...pendingAction.forceCommitments![1],
                attackerLosses: 0,
                survivingTroops: 2,
                survivingSpecialTroops: [],
            },
        ]);

        expect(updated).toMatchObject({
            sourceRegionId: 'city-region-3',
            sourceRegionName: '沈阳',
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-infantry',
        });
        expect(updated.forceCommitments).toEqual([
            expect.objectContaining({
                sourceRegionId: 'city-region-3',
                committedTroops: 2,
            }),
        ]);
    });

    it('跨来源伤亡继续使用现有最高等级优先规则并保留来源归属', () => {
        const state = createInitialCore(['0', '1', '2']);
        state.regions = state.regions.map((region) => {
            if (region.id === 'city-region-1') {
                return {
                    ...region,
                    controller: 'ming',
                    troops: 3,
                    specialTroops: [{
                        id: 'ming-high-infantry',
                        label: '大明三级步兵',
                        faction: 'ming',
                        troopKind: 'infantry',
                        count: 1,
                        level: 3,
                        pieceIds: ['ming-high-infantry-1'],
                    }],
                };
            }
            if (region.id === 'city-region-3') {
                return {
                    ...region,
                    controller: 'ming',
                    troops: 3,
                    specialTroops: [{
                        id: 'ming-low-infantry',
                        label: '大明一级步兵',
                        faction: 'ming',
                        troopKind: 'infantry',
                        count: 1,
                        level: 1,
                        pieceIds: ['ming-low-infantry-1'],
                    }],
                };
            }
            return region;
        });
        const pendingAction = buildPendingAction({
            committedTroops: 6,
            forceCommitments: [
                {
                    id: 'force-city-region-1',
                    sourceRegionId: 'city-region-1',
                    sourceRegionName: '辽东',
                    sourceAvailableTroops: 3,
                    committedTroops: 3,
                    movementProfileId: null,
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    attackBoundaryType: 'plain',
                },
                {
                    id: 'force-city-region-3',
                    sourceRegionId: 'city-region-3',
                    sourceRegionName: '沈阳',
                    sourceAvailableTroops: 3,
                    committedTroops: 3,
                    movementProfileId: null,
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    attackBoundaryType: 'plain',
                },
            ],
        });

        const outcomes = buildQidahenBattleForceOutcomes(state, pendingAction, 1, 'highest-level');

        expect(outcomes).toEqual([
            expect.objectContaining({
                sourceRegionId: 'city-region-1',
                attackerLosses: 1,
                survivingTroops: 2,
                survivingSpecialTroops: [],
            }),
            expect.objectContaining({
                sourceRegionId: 'city-region-3',
                attackerLosses: 0,
                survivingTroops: 3,
                survivingSpecialTroops: [expect.objectContaining({
                    id: 'ming-low-infantry',
                    count: 1,
                    pieceIds: ['ming-low-infantry-1'],
                })],
            }),
        ]);
    });

    it('特殊部队伤亡结算后才按来源顺序承担普通部队损失', () => {
        const state = createInitialCore(['0', '1', '2']);
        state.regions = state.regions.map((region) => {
            if (region.id !== 'city-region-1' && region.id !== 'city-region-3') {
                return region;
            }
            const firstSource = region.id === 'city-region-1';
            return {
                ...region,
                controller: 'ming',
                troops: 3,
                specialTroops: [{
                    id: firstSource ? 'ming-high-infantry' : 'ming-low-infantry',
                    label: firstSource ? '大明三级步兵' : '大明一级步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 1,
                    level: firstSource ? 3 : 1,
                    pieceIds: [firstSource ? 'ming-high-infantry-1' : 'ming-low-infantry-1'],
                }],
            };
        });
        const pendingAction = buildPendingAction({
            committedTroops: 6,
            forceCommitments: [
                {
                    id: 'force-city-region-1',
                    sourceRegionId: 'city-region-1',
                    sourceRegionName: '辽东',
                    sourceAvailableTroops: 3,
                    committedTroops: 3,
                    movementProfileId: null,
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    attackBoundaryType: 'plain',
                },
                {
                    id: 'force-city-region-3',
                    sourceRegionId: 'city-region-3',
                    sourceRegionName: '沈阳',
                    sourceAvailableTroops: 3,
                    committedTroops: 3,
                    movementProfileId: null,
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    attackBoundaryType: 'plain',
                },
            ],
        });

        const outcomes = buildQidahenBattleForceOutcomes(state, pendingAction, 3, 'highest-level');

        expect(outcomes.map((outcome) => ({
            sourceRegionId: outcome.sourceRegionId,
            attackerLosses: outcome.attackerLosses,
            survivingTroops: outcome.survivingTroops,
        }))).toEqual([
            {
                sourceRegionId: 'city-region-1',
                attackerLosses: 2,
                survivingTroops: 1,
            },
            {
                sourceRegionId: 'city-region-3',
                attackerLosses: 1,
                survivingTroops: 2,
            },
        ]);
    });

    it('围城续战会以当前围城位置作为实际来源，不会再次扣最初出发区', () => {
        const state = createInitialCore(['0', '1', '2']);
        state.regions = state.regions.map((region) => (
            region.id === 'city-region-2'
                ? {
                    ...region,
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 3,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-1',
                    },
                }
                : region
        ));
        const pendingAction = buildPendingAction({
            battleMode: 'city',
            attackerPositionRegionId: 'city-region-2',
            sourceAvailableTroops: 3,
            committedTroops: 3,
            forceCommitments: [{
                id: 'force-city-region-1',
                sourceRegionId: 'city-region-1',
                sourceRegionName: '辽东',
                sourceAvailableTroops: 5,
                committedTroops: 3,
                movementProfileId: null,
                battleWidth: 3,
                boundaryUnitCap: null,
                attackBoundaryType: 'plain',
            }],
        });

        const outcomes = buildQidahenBattleForceOutcomes(state, pendingAction, 1);

        expect(outcomes).toEqual([
            expect.objectContaining({
                sourceRegionId: 'city-region-2',
                committedTroops: 3,
                attackerLosses: 1,
                survivingTroops: 2,
            }),
        ]);
    });

    it('多来源战后占领会分别从两个来源扣除承诺兵力并合并幸存部队', () => {
        const state = buildMultiSourcePostBattleState();
        const selection = buildMultiSourcePostBattleSelection([{
            id: 'occupy',
            mode: 'occupy',
            regionId: 'city-region-2',
            plunderPopulation: 0,
            plunderSource: null,
            label: '占领该区',
            detail: '4 个幸存部队留在建州',
        }]);

        const resolved = resolvePostBattleDecision(state, selection, 'occupy');

        expect(resolved.regions.find((region) => region.id === 'city-region-1')?.troops).toBe(0);
        expect(resolved.regions.find((region) => region.id === 'city-region-3')).toMatchObject({
            troops: 1,
            specialTroops: [],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-2')).toMatchObject({
            controller: 'ming',
            troops: 4,
            specialTroops: [expect.objectContaining({
                id: 'ming-support-infantry',
                count: 1,
            })],
        });
    });

    it('战后占领只从来源区移除实际参战的具名兵牌', () => {
        const state = createInitialCore(['0', '1', '2']);
        state.regions = state.regions.map((region) => {
            if (region.id === 'city-region-1') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    cityState: null,
                    siegeState: null,
                    specialTroops: [
                        {
                            id: 'ming-high-infantry',
                            label: '大明三级步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 3,
                            pieceIds: ['ming-high-infantry-1'],
                        },
                        {
                            id: 'ming-low-infantry',
                            label: '大明一级步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                            pieceIds: ['ming-low-infantry-1'],
                        },
                    ],
                };
            }
            if (region.id === 'city-region-2') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    cityState: null,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            return region;
        });
        const selection: QidahenPostBattleSelection = {
            actionId: 'raid',
            battleMode: 'field',
            targetKind: 'region',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-1',
            sourceRegionName: '辽东',
            attackerPositionRegionId: null,
            targetRegionId: 'city-region-2',
            targetRegionName: '建州',
            targetRuntimeRegionId: 'city-region-2',
            committedTroops: 1,
            survivingTroops: 1,
            attackerLosses: 0,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            attackerBattleCasualtyPriority: 'highest-level',
            originalController: 'jin',
            originalControlLabel: '后金',
            title: '战后处理',
            summary: '具名兵牌占领',
            forceOutcomes: [{
                id: 'force-city-region-1',
                sourceRegionId: 'city-region-1',
                sourceRegionName: '辽东',
                sourceAvailableTroops: 2,
                committedTroops: 1,
                movementProfileId: null,
                battleWidth: 1,
                boundaryUnitCap: null,
                attackBoundaryType: 'plain',
                selectedSpecialPieceIds: ['ming-low-infantry-1'],
                selectedGenericTroops: 0,
                attackerLosses: 0,
                survivingTroops: 1,
                survivingSpecialTroops: [{
                    id: 'ming-low-infantry',
                    label: '大明一级步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 1,
                    level: 1,
                    pieceIds: ['ming-low-infantry-1'],
                }],
            }],
            choices: [{
                id: 'occupy',
                mode: 'occupy',
                regionId: 'city-region-2',
                plunderPopulation: 0,
                plunderSource: null,
                label: '占领该区',
                detail: '一级步兵占领建州',
            }],
        };

        const resolved = resolvePostBattleDecision(state, selection, 'occupy');

        expect(resolved.regions.find((region) => region.id === 'city-region-1')).toMatchObject({
            troops: 1,
            specialTroops: [expect.objectContaining({
                id: 'ming-high-infantry',
                pieceIds: ['ming-high-infantry-1'],
            })],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-2')).toMatchObject({
            controller: 'ming',
            troops: 1,
            specialTroops: [expect.objectContaining({
                id: 'ming-low-infantry',
                pieceIds: ['ming-low-infantry-1'],
            })],
        });
    });

    it('多来源撤回到其中一个来源区时会保留本地幸存者并接收其他来源残部', () => {
        const state = buildMultiSourcePostBattleState();
        const selection = buildMultiSourcePostBattleSelection([{
            id: 'withdraw:city-region-1',
            mode: 'withdraw',
            regionId: 'city-region-1',
            plunderPopulation: 0,
            plunderSource: null,
            label: '退回辽东',
            detail: '4 个幸存部队撤回辽东',
        }]);

        const resolved = resolvePostBattleDecision(state, selection, 'withdraw:city-region-1');

        expect(resolved.regions.find((region) => region.id === 'city-region-1')).toMatchObject({
            controller: 'ming',
            troops: 4,
            specialTroops: [expect.objectContaining({
                id: 'ming-support-infantry',
                count: 1,
            })],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-3')).toMatchObject({
            troops: 1,
            specialTroops: [],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-2')).toMatchObject({
            controller: 'jin',
            troops: 0,
        });
    });

    it('多来源溃败会分别降级各来源幸存特殊部队并移除普通残部', () => {
        const state = createInitialCore(['0', '1', '2']);
        state.regions = state.regions.map((region) => {
            if (region.id !== 'city-region-1' && region.id !== 'city-region-3') {
                return region;
            }
            const firstSource = region.id === 'city-region-1';
            return {
                ...region,
                controller: 'ming',
                troops: 2,
                cityState: null,
                siegeState: null,
                specialTroops: [{
                    id: firstSource ? 'ming-level-2-infantry' : 'ming-level-1-infantry',
                    label: firstSource ? '大明二级步兵' : '大明一级步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 1,
                    level: firstSource ? 2 : 1,
                    pieceIds: [firstSource ? 'ming-level-2-infantry-1' : 'ming-level-1-infantry-1'],
                }],
            };
        });
        const pendingAction = buildPendingAction({
            committedTroops: 4,
            forceCommitments: [
                {
                    id: 'force-city-region-1',
                    sourceRegionId: 'city-region-1',
                    sourceRegionName: '辽东',
                    sourceAvailableTroops: 2,
                    committedTroops: 2,
                    movementProfileId: null,
                    battleWidth: 2,
                    boundaryUnitCap: null,
                    attackBoundaryType: 'plain',
                },
                {
                    id: 'force-city-region-3',
                    sourceRegionId: 'city-region-3',
                    sourceRegionName: '沈阳',
                    sourceAvailableTroops: 2,
                    committedTroops: 2,
                    movementProfileId: null,
                    battleWidth: 2,
                    boundaryUnitCap: null,
                    attackBoundaryType: 'plain',
                },
            ],
        });

        const outcomes = buildQidahenBattleForceRetreatOutcomes(
            state,
            pendingAction,
            0,
            3,
            'rout',
            false,
        );

        expect(outcomes).toEqual([
            expect.objectContaining({
                sourceRegionId: 'city-region-1',
                attackerLosses: 1,
                survivingTroops: 1,
                survivingSpecialTroops: [expect.objectContaining({
                    id: 'ming-level-2-infantry-rout-lv1',
                    level: 1,
                    count: 1,
                })],
            }),
            expect.objectContaining({
                sourceRegionId: 'city-region-3',
                attackerLosses: 2,
                survivingTroops: 0,
                survivingSpecialTroops: [],
            }),
        ]);
    });

    it('多来源进攻失败会按来源分别扣除战斗与断后损失', () => {
        const state = createInitialCore(['0', '1', '2']);
        state.regions = state.regions.map((region) => {
            if (region.id === 'city-region-1') {
                return {
                    ...region,
                    controller: 'ming',
                    troops: 3,
                    cityState: null,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-3') {
                return {
                    ...region,
                    controller: 'ming',
                    troops: 2,
                    cityState: null,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-2') {
                return {
                    ...region,
                    controller: 'jin',
                    troops: 5,
                    population: 0,
                    cityState: null,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            return region;
        });
        const pendingAction = buildPendingAction({
            committedTroops: 5,
            attackPressure: 3,
            forceCommitments: [
                {
                    id: 'force-city-region-1',
                    sourceRegionId: 'city-region-1',
                    sourceRegionName: '辽东',
                    sourceAvailableTroops: 3,
                    committedTroops: 3,
                    movementProfileId: null,
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    attackBoundaryType: 'plain',
                },
                {
                    id: 'force-city-region-3',
                    sourceRegionId: 'city-region-3',
                    sourceRegionName: '沈阳',
                    sourceAvailableTroops: 2,
                    committedTroops: 2,
                    movementProfileId: null,
                    battleWidth: 3,
                    boundaryUnitCap: null,
                    attackBoundaryType: 'plain',
                },
            ],
        });

        const resolved = resolvePendingTargetActionByActionType(
            state,
            pendingAction,
            'rear-guard',
        );

        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-1')?.troops).toBe(0);
        expect(resolved.regions.find((region) => region.id === 'city-region-3')?.troops).toBe(1);
        expect(resolved.regions.find((region) => region.id === 'city-region-2')?.troops).toBe(2);
        expect(resolved.logText).toContain('攻方损失 3');
        expect(resolved.logText).toContain('断后损失 1');
    });

    it('进攻失败只结算实际参战的具名兵牌，不会误删来源区未参战高级兵', () => {
        const state = createInitialCore(['0', '1', '2']);
        state.regions = state.regions.map((region) => {
            if (region.id === 'city-region-1') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    cityState: null,
                    siegeState: null,
                    specialTroops: [
                        {
                            id: 'ming-high-infantry',
                            label: '大明三级步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 3,
                            pieceIds: ['ming-high-infantry-1'],
                        },
                        {
                            id: 'ming-low-infantry',
                            label: '大明一级步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                            pieceIds: ['ming-low-infantry-1'],
                        },
                    ],
                };
            }
            if (region.id === 'city-region-2') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 3,
                    population: 0,
                    cityState: null,
                    siegeState: null,
                    specialTroops: [],
                };
            }
            return region;
        });
        const pendingAction = buildPendingAction({
            battleWidth: 1,
            sourceAvailableTroops: 2,
            committedTroops: 1,
            attackPressure: 1,
            forceCommitments: [{
                id: 'force-city-region-1',
                sourceRegionId: 'city-region-1',
                sourceRegionName: '辽东',
                sourceAvailableTroops: 2,
                committedTroops: 1,
                movementProfileId: null,
                battleWidth: 1,
                boundaryUnitCap: null,
                attackBoundaryType: 'plain',
                selectedSpecialPieceIds: ['ming-low-infantry-1'],
                selectedGenericTroops: 0,
            }],
        });

        const resolved = resolvePendingTargetActionByActionType(
            state,
            pendingAction,
            'rear-guard',
        );

        expect(resolved.regions.find((region) => region.id === 'city-region-1')).toMatchObject({
            troops: 1,
            specialTroops: [expect.objectContaining({
                id: 'ming-high-infantry',
                pieceIds: ['ming-high-infantry-1'],
            })],
        });
        expect(resolved.logText).toContain('攻方损失 1');
    });
});
