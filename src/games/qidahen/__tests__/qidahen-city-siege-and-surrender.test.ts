import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';
import { getActionChoicesForFaction } from '../domain/factionActionWindow';
import { buildPendingTargetChoiceOptions } from '../domain/pendingTargetChoiceOptions';import type { QidahenCore } from '../domain/types';
import { random, apply, getWheelDispatchSelection, setRegionCavalry } from './helpers/paymentSelectionHarness';

describe('七大恨城战、围城与诱降', () => {
it('城市目标被攻击前会提供守城宣告入口，进入城战后不再重复提供', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const pendingTargetAction = {
            actionId: 'raid' as const,
            title: '山海关 守城宣告',
            attackerFactionId: 'ming' as const,
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin' as const,
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain' as const,
            resolutionHint: '测试',
            defenderPayCost: null,
        };

        expect(buildPendingTargetChoiceOptions(core, pendingTargetAction).map((option) => option.id)).toEqual(
            expect.arrayContaining(['defender-hold-city', 'defender-sortie']),
        );
        expect(buildPendingTargetChoiceOptions(core, {
            ...pendingTargetAction,
            battleMode: 'city' as const,
        }).map((option) => option.id)).not.toEqual(
            expect.arrayContaining(['defender-hold-city', 'defender-sortie']),
        );
    });

it('城市守军可选择守城避战，把最多 2 部队与 2 人口收入城中并直接进入城战待结算', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 4,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderHoldCity: true },
        });

        expect(resolved.turnPhase).toBe('resolve-pending');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.pendingTargetAction).toMatchObject({
            title: '山海关 城战待结算',
            battleMode: 'city',
            targetRuntimeRegionId: 'city-region-25',
            committedTroops: 4,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 2,
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [],
            },
        });
        expect(resolved.factions.jin.defeatMarkers).toBe(0);
        expect(resolved.actionLog[0]?.text).toContain('守方守城避战收入城中 2 部队与 2 人口');
        expect(resolved.actionLog[0]?.text).toContain('直接进入城战');
    });

it('旱灾城市守城避战时人口视为 0，不会把真实人口收入城中', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 4,
                    eventMarkers: [{
                        id: 'drought-marker-city-region-25',
                        kind: 'drought' as const,
                        label: '旱灾标记',
                        sourceCardDefId: 'qidahen-atlas05-1613-northeast-drought',
                        imageSrc: 'qidahen/markers/drought-marker',
                    }],
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderHoldCity: true },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            population: 4,
            cityState: {
                troops: 2,
                population: 0,
                specialTroops: [],
            },
        });
        expect(resolved.actionLog[0]?.text).toContain('守方守城避战收入城中 2 部队与 0 人口');
    });

it('城市守军守城避战后若仍有城外部队，攻方打赢野战会继续进入城战待结算', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 5,
            committedTroops: 5,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 4,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderHoldCity: true },
        });

        expect(resolved.turnPhase).toBe('resolve-pending');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.pendingTargetAction).toMatchObject({
            title: '山海关 城战待结算',
            battleMode: 'city',
            targetRuntimeRegionId: 'city-region-25',
            committedTroops: 3,
            sourceAvailableTroops: 3,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 2,
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [],
            },
        });
        expect(resolved.factions.jin.defeatMarkers).toBe(0);
        expect(resolved.actionLog[0]?.text).toContain('守方守城避战收入城中 2 部队与 2 人口');
        expect(resolved.actionLog[0]?.text).toContain('继续攻城');
    });

it('城市守军守城避战时会把收入城中的特殊部队写入 cityState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 5,
            committedTroops: 5,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 3,
                    population: 4,
                    specialTroops: [
                        {
                            id: 'jin-shanghai-cavalry-lv3',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 3,
                            pieceIds: ['jin-shanghai-piece-1'],
                        },
                        {
                            id: 'jin-shanghai-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 2,
                            pieceIds: ['jin-shanghai-piece-2'],
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderHoldCity: true },
        });

        expect(resolved.pendingTargetAction).toMatchObject({
            battleMode: 'city',
            targetRuntimeRegionId: 'city-region-25',
        });
        const shanhaiguan = resolved.regions.find((region) => region.id === 'city-region-25');
        expect(shanhaiguan).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 2,
            specialTroops: [],
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [
                    {
                        id: 'jin-shanghai-cavalry-lv3',
                        label: '后金骑兵',
                        faction: 'jin',
                        troopKind: 'cavalry',
                        count: 1,
                        level: 3,
                        pieceIds: ['jin-shanghai-piece-1'],
                    },
                    {
                        id: 'jin-shanghai-infantry-lv2',
                        label: '后金步兵',
                        faction: 'jin',
                        troopKind: 'infantry',
                        count: 1,
                        level: 2,
                        pieceIds: ['jin-shanghai-piece-2'],
                    },
                ],
            },
        });
        expect(
            resolved.pieces
                .filter((piece) => piece.regionId === 'city-region-25' && piece.location === 'city')
                .map((piece) => piece.id),
        ).toEqual(['jin-shanghai-piece-1', 'jin-shanghai-piece-2']);
    });

it('城战守军被突破后不会自动撤退或获得野战战败标记', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 0,
                };
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-28')?.troops).toBe(2);
        expect(resolved.factions.jin.defeatMarkers).toBe(0);
        expect(resolved.factions.ming.defeatMarkers).toBe(0);
        expect(resolved.regions.find((region) => region.id === 'city-region-25')?.note).toContain('等待决定是否占领');
        expect(resolved.actionLog[0]?.text).toContain('等待战后处理');
        expect(resolved.actionLog[0]?.text).not.toContain('撤至');
        expect(resolved.actionLog[0]?.text).not.toContain('战败标记');
    });

it('城市守军可选择出城野战，战败后会退回城市并继续进入城战待结算', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 5,
            committedTroops: 5,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 2,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderSortieBattle: true },
        });

        expect(resolved.turnPhase).toBe('resolve-pending');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.pendingTargetAction).toMatchObject({
            title: '山海关 城战待结算',
            battleMode: 'city',
            committedTroops: 2,
            sourceAvailableTroops: 2,
            targetRuntimeRegionId: 'city-region-25',
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 0,
            cityState: {
                troops: 1,
                population: 2,
                specialTroops: [],
            },
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')?.note).toContain('继续攻城');
        expect(resolved.factions.jin.defeatMarkers).toBe(1);
        expect(resolved.actionLog[0]?.text).toContain('守军出城野战');
        expect(resolved.actionLog[0]?.text).toContain('继续攻城');
    });

it('城战待结算会原生读取 cityState，而不是依赖顶层 troops 镜像', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            battleMode: 'city',
            title: '山海关 城战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.postBattleSelection?.battleMode).toBe('city');
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            troops: 0,
            population: 2,
            cityState: {
                troops: 0,
                population: 2,
                specialTroops: [],
            },
        });
        expect(resolved.actionLog[0]?.text).toContain('等待战后处理');
    });

it('城战突破后占领可把城内外剩余人口合并到占领后的区域人口', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            battleMode: 'city',
            title: '山海关 城战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'occupy-plunder-4')).toBe(true);

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 2,
            population: 4,
            cityState: null,
        });
    });

it('城战突破后可选择围城并保留守方控制权', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 2,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'besiege')).toBe(true);
        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'besiege-plunder-1')).toBe(false);

        const besieged = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'besiege' },
        });

        expect(besieged.postBattleSelection).toBeNull();
        expect(besieged.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            population: 0,
            troops: 0,
            siegeState: expect.objectContaining({
                attackerFactionId: 'ming',
                sourceRegionId: 'city-region-24',
            }),
            cityState: {
                troops: 0,
                population: 2,
                specialTroops: [],
            },
        });
        expect(besieged.regions.find((region) => region.id === 'city-region-25')?.note).toContain('围城');
        expect(besieged.actionLog[0]?.text).toContain('战后围城');
        expect(besieged.selectedRegionId).toBe('city-region-25');
    });

it('出城野战后若战后选择围城，会保留退回城市的守军 cityState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.postBattleSelection = {
            actionId: 'raid',
            battleMode: 'city',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            committedTroops: 4,
            survivingTroops: 3,
            attackerLosses: 1,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            originalController: 'jin',
            originalControlLabel: '后金',
            title: '战后处理',
            summary: '测试',
            choices: [
                {
                    id: 'besiege',
                    mode: 'besiege',
                    regionId: 'city-region-25',
                    plunderPopulation: 0,
                    plunderSource: null,
                    label: '围城该区',
                    detail: '测试',
                },
            ],
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 1,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'jin-city-infantry-lv2',
                                label: '后金步兵',
                                faction: 'jin',
                                troopKind: 'infantry',
                                count: 1,
                                level: 2,
                                pieceIds: ['jin-city-infantry-piece-1'],
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const besieged = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'besiege' },
        });

        expect(besieged.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 0,
            siegeState: expect.objectContaining({
                attackerFactionId: 'ming',
                attackerTroops: 3,
            }),
            cityState: {
                troops: 1,
                population: 2,
                specialTroops: [
                    expect.objectContaining({
                        id: 'jin-city-infantry-lv2',
                        count: 1,
                    }),
                ],
            },
        });
        const besiegedCityPieceIds = besieged.regions.find((region) => region.id === 'city-region-25')
            ?.cityState?.specialTroops.flatMap((stack) => stack.pieceIds ?? []) ?? [];
        expect(besiegedCityPieceIds).toEqual(['jin-city-infantry-piece-1']);
        expect(
            besieged.pieces
                .filter((piece) => piece.regionId === 'city-region-25' && piece.location === 'city')
                .map((piece) => piece.id),
        ).toEqual(besiegedCityPieceIds);
        expect(besieged.selectedRegionId).toBe('city-region-25');
    });

it('城战突破后放弃占领会把剩余人口回写进 cityState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            battleMode: 'city',
            title: '山海关 城战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        const withdrawn = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-24' },
        });

        expect(withdrawn.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 0,
            cityState: {
                troops: 0,
                population: 4,
                specialTroops: [],
            },
        });
        expect(withdrawn.actionLog[0]?.text).toContain('放弃占领');
        expect(withdrawn.selectedRegionId).toBe('city-region-24');
        expect(withdrawn.selectedRegionId).toBe('city-region-24');
    });

it('出城野战后若战后放弃占领，会保留退回城市的守军 cityState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.postBattleSelection = {
            actionId: 'raid',
            battleMode: 'city',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            committedTroops: 4,
            survivingTroops: 3,
            attackerLosses: 1,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            originalController: 'jin',
            originalControlLabel: '后金',
            title: '战后处理',
            summary: '测试',
            choices: [
                {
                    id: 'withdraw:city-region-24',
                    mode: 'withdraw',
                    regionId: 'city-region-24',
                    plunderPopulation: 0,
                    plunderSource: null,
                    label: '回退宁远',
                    detail: '测试',
                },
            ],
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 1,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'jin-city-cavalry-lv2',
                                label: '后金骑兵',
                                faction: 'jin',
                                troopKind: 'cavalry',
                                count: 1,
                                level: 2,
                                pieceIds: ['jin-city-cavalry-piece-1'],
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const withdrawn = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-24' },
        });

        expect(withdrawn.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 0,
            siegeState: null,
            cityState: {
                troops: 1,
                population: 2,
                specialTroops: [
                    expect.objectContaining({
                        id: 'jin-city-cavalry-lv2',
                        count: 1,
                    }),
                ],
            },
        });
        const withdrawnCityPieceIds = withdrawn.regions.find((region) => region.id === 'city-region-25')
            ?.cityState?.specialTroops.flatMap((stack) => stack.pieceIds ?? []) ?? [];
        expect(withdrawnCityPieceIds).toEqual(['jin-city-cavalry-piece-1']);
        expect(
            withdrawn.pieces
                .filter((piece) => piece.regionId === 'city-region-25' && piece.location === 'city')
                .map((piece) => piece.id),
        ).toEqual(withdrawnCityPieceIds);
        expect(withdrawn.actionLog[0]?.text).toContain('放弃占领');
        expect(withdrawn.selectedRegionId).toBe('city-region-24');
    });

it('战后撤回接兵时若友方目标城市守军仍在 cityState，会先并回再接收撤回部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.postBattleSelection = {
            actionId: 'raid',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-20',
            sourceRegionName: '土默特部',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            committedTroops: 4,
            survivingTroops: 2,
            attackerLosses: 2,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            originalController: 'jin',
            originalControlLabel: '后金',
            title: '战后处理',
            summary: '测试',
            choices: [
                {
                    id: 'withdraw:city-region-24',
                    mode: 'withdraw',
                    regionId: 'city-region-24',
                    plunderPopulation: 0,
                    plunderSource: null,
                    label: '回退宁远',
                    detail: '测试',
                },
            ],
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            { id: 'ming-ningyuan-infantry-lv2', label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 2, level: 2 },
                        ],
                    },
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 1,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const withdrawn = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-24' },
        });

        expect(withdrawn.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 4,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-ningyuan-infantry-lv2', count: 2, level: 2 }),
            ]),
        });
        expect(withdrawn.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 0,
            cityState: {
                troops: 1,
                population: 2,
                specialTroops: [],
            },
        });
        expect(withdrawn.actionLog[0]?.text).toContain('放弃占领');
    });

it('非围城 cityState 守军在下一轮仍可从城市发起突袭，并在出兵后清空 cityState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-city-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });

        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'raid',
            sourceRegionId: 'city-region-25',
            sourceRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-24',
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
        });

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 2,
            specialTroops: [],
            cityState: null,
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 2,
            specialTroops: [
                expect.objectContaining({
                    id: 'ming-city-infantry-lv2',
                    count: 2,
                }),
            ],
        });
    });

it('非围城 cityState 守军会被轮盘调度进攻识别为可用来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-city-cavalry-lv2',
                                label: '大明骑兵',
                                faction: 'ming',
                                troopKind: 'cavalry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const dispatchSelection = getWheelDispatchSelection(targeting);
        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('city-region-24');
        expect(dispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            restriction: '轮盘进攻/调度 · 调骑 4',
        });
        expect(dispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-20')).toMatchObject({
            targetRuntimeRegionId: 'city-region-20',
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
        });
    });

it('围城时只可劫掠城外人口，城内保留 2 人口', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 4,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'besiege-plunder-1')).toBe(false);
        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'besiege-plunder-2')).toBe(false);
        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'besiege-plunder-3')).toBe(false);

        const injected = {
            ...resolved,
            postBattleSelection: {
                ...resolved.postBattleSelection!,
                choices: [
                    ...resolved.postBattleSelection!.choices,
                    {
                        ...resolved.postBattleSelection!.choices.find((choice) => choice.id === 'besiege')!,
                        id: 'besiege-plunder-overflow',
                        plunderPopulation: 4,
                        plunderSource: 'attacker' as const,
                        label: '测试：围城超额劫掠',
                        detail: '测试注入：尝试绕过 UI 劫掠全部人口。',
                    },
                ],
            },
        };

        const besieged = apply(injected, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'besiege-plunder-overflow' },
        });

        expect(besieged.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            population: 0,
            troops: 0,
            cityState: {
                troops: 0,
                population: 4,
                specialTroops: [],
            },
            siegeState: expect.objectContaining({
                attackerFactionId: 'ming',
                attackerTroops: 2,
            }),
        });
        expect(besieged.regions.find((region) => region.id === 'city-region-25')?.note).not.toContain('城外人口被劫掠');
    });

it('围城攻方在下一轮可直接从围城状态继续城战并占领城市', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 4,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-24',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const dispatchSelection = getWheelDispatchSelection(targeting);
        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('city-region-24');
        expect(dispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-24',
            sourceRegionName: '山海关围城军',
        });
        expect(dispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25')).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            attackerPositionRegionId: 'city-region-25',
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            battleMode: 'city',
            sourceRegionId: 'city-region-24',
            attackerPositionRegionId: 'city-region-25',
            targetRuntimeRegionId: 'city-region-25',
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('围城续攻');
        expect(pending.selectedRegionId).toBe('city-region-25');

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.postBattleSelection).toMatchObject({
            battleMode: 'city',
            sourceRegionId: 'city-region-24',
            attackerPositionRegionId: 'city-region-25',
            targetRuntimeRegionId: 'city-region-25',
        });
        expect(resolved.selectedRegionId).toBe('city-region-25');

        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 1,
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 2,
            population: 2,
            siegeState: null,
            cityState: null,
            specialTroops: [],
        });
        expect(occupied.selectedRegionId).toBe('city-region-25');
    });

it('当前未选中被围城城市时，轮盘调度仍会优先续攻己方 siegeState 围城军', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 4,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (region.controller === 'ming') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const dispatchSelection = getWheelDispatchSelection(targeting);
        expect(targeting.turnPhase).toBe('dispatch-targeting');
        expect(targeting.selectedRegionId).toBe('city-region-20');
        expect(dispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-20',
            sourceRegionName: '山海关围城军',
        });
        expect(dispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25')).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            attackerPositionRegionId: 'city-region-25',
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
        });
    });

it('围城增援后下一轮继续城战会读取更新后的 siegeState 兵力，并显示围城军来源', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const reinforceTargeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const reinforcePending = apply(reinforceTargeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const reinforced = apply(reinforcePending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        reinforced.selectedRegionId = 'city-region-25';
        reinforced.turnPhase = 'action-window';
        reinforced.wheelActionUsed = false;
        reinforced.actionWheelPosition = 'wheel-military-farm';
        reinforced.pendingTargetAction = null;
        reinforced.postBattleSelection = null;

        const continueTargeting = apply(reinforced, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const continueDispatchSelection = getWheelDispatchSelection(continueTargeting);
        expect(continueDispatchSelection).toMatchObject({
            sourceRegionId: 'city-region-20',
            sourceRegionName: '山海关围城军',
        });
        expect(continueDispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25')).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            attackerPositionRegionId: 'city-region-25',
            sourceAvailableTroops: 6,
            committedTroops: 6,
        });
    });

it('围城攻方在下一轮继续城战后可撤回原始友方来源区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-25';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 4,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-24',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection?.choices.some((choice) => choice.id === 'withdraw:city-region-24')).toBe(true);

        const withdrawn = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'withdraw:city-region-24' },
        });

        expect(withdrawn.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 3,
            specialTroops: [],
        });
        expect(withdrawn.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            troops: 0,
            population: 0,
            siegeState: null,
            cityState: {
                troops: 0,
                population: 2,
                specialTroops: [],
            },
        });
        expect(withdrawn.selectedRegionId).toBe('city-region-24');
    });

it('友方被围城市会作为调度进攻的解围目标，并在胜利后清空 siegeState', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const dispatchSelection = getWheelDispatchSelection(targeting);
        expect(targeting.selectedRegionId).toBe('city-region-24');
        expect(dispatchSelection?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25')).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            battleMode: 'field',
            targetKind: 'siege-attacker',
            defenderFactionId: 'jin',
            defenderLabel: '后金围城军',
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            battleMode: 'field',
            targetKind: 'siege-attacker',
            defenderFactionId: 'jin',
            targetRuntimeRegionId: 'city-region-25',
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('解围');
        expect(pending.selectedRegionId).toBe('city-region-25');

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.postBattleSelection).toMatchObject({
            battleMode: 'field',
            targetKind: 'siege-attacker',
        });
        expect(resolved.postBattleSelection?.choices).toEqual([
            expect.objectContaining({
                id: 'occupy',
                label: '解除围城并进驻',
            }),
        ]);
        expect(resolved.selectedRegionId).toBe('city-region-25');

        const relieved = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(relieved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 0,
        });
        expect(relieved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            troops: 2,
            population: 2,
            siegeState: null,
            cityState: {
                troops: 0,
                population: 2,
                specialTroops: [],
            },
        });
        expect(relieved.selectedRegionId).toBe('city-region-25');
    });

it('轮盘调度候选排序在同路费时会按围城军兵力优先列出友方被围城市', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                    siegeState: null,
                    cityState: null,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 4,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const dispatchSelection = getWheelDispatchSelection(targeting);
        expect(dispatchSelection?.candidates[0]).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            targetKind: 'siege-attacker',
            defenderFactionId: 'jin',
            priorityTroops: 4,
        });
        expect(dispatchSelection?.candidates.some((candidate) => candidate.targetRuntimeRegionId === 'city-region-20')).toBe(true);
    });

it('我方部队可调度进入己方围城区域并直接并入 siegeState，不进入战斗', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const reinforceCandidate = getWheelDispatchSelection(targeting)?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25');

        expect(reinforceCandidate).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            battleMode: 'field',
            targetKind: 'siege-reinforce',
            defenderLabel: '大明围城军',
        });
        expect(reinforceCandidate?.resolutionHint).toContain('增援围城');

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });

        expect(pending.pendingTargetAction).toMatchObject({
            actionId: 'wheel-dispatch',
            battleMode: 'field',
            targetKind: 'siege-reinforce',
            targetRuntimeRegionId: 'city-region-25',
            committedTroops: reinforceCandidate?.committedTroops,
        });

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 4 - (reinforceCandidate?.committedTroops ?? 0),
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            siegeState: expect.objectContaining({
                attackerFactionId: 'ming',
                attackerTroops: 2 + (reinforceCandidate?.committedTroops ?? 0),
            }),
        });
        expect(resolved.actionLog[0]?.text).toContain('不进入战斗');
    });

it('非围城 cityState 守军增援己方围城区域时会先并回来源区，再正确扣除守军与结构化部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 4,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-cavalry-lv2',
                                label: '大明骑兵',
                                faction: 'ming',
                                troopKind: 'cavalry',
                                count: 4,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'ming',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const reinforceCandidate = getWheelDispatchSelection(targeting)?.candidates.find((candidate) => candidate.targetRuntimeRegionId === 'city-region-25');

        expect(reinforceCandidate).toMatchObject({
            targetRuntimeRegionId: 'city-region-25',
            targetKind: 'siege-reinforce',
            sourceAvailableTroops: 4,
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 4 - (reinforceCandidate?.committedTroops ?? 0),
            cityState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')?.specialTroops).toEqual([]);
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            siegeState: expect.objectContaining({
                attackerFactionId: 'ming',
                attackerTroops: 2 + (reinforceCandidate?.committedTroops ?? 0),
                attackerSpecialTroops: [
                    expect.objectContaining({
                        id: 'ming-cavalry-lv2',
                        label: '大明骑兵',
                        faction: 'ming',
                        troopKind: 'cavalry',
                        count: reinforceCandidate?.committedTroops ?? 0,
                        level: 2,
                    }),
                ],
            }),
        });
    });

it('解围失败时会保留 siegeState 并给援军方战败标记', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 2,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 4,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-20',
                    },
                    cityState: {
                        troops: 0,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });
        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-25' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            siegeState: expect.objectContaining({
                attackerFactionId: 'jin',
                attackerTroops: 2,
            }),
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 0,
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.actionLog[0]?.text).toContain('解围失败');
    });

it('调度进攻打入有守军区域时会互损但未突破，不进入战后处理', () => {
        const core = setRegionCavalry(QidahenDomain.setup(['0', '1', '2'], random), 'city-region-24', 'ming', 2);
        core.selectedRegionId = 'city-region-24';
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-3-all-opponents' },
        });

        const pending = apply(targeting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '0',
            payload: { regionId: 'city-region-20' },
        });

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-24');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'jin',
            controlLabel: '后金',
            troops: 0,
        });
        expect(resolved.actionLog[0]?.text).toContain('攻方损失 2');
    });

it('后金联姻诱降会按守军手牌支付结算并保留山海关控制权', () => {
        const mingDone = apply(apply(apply(QidahenDomain.setup(['0', '1', '2'], random), {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        }), {
            type: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            playerId: '0',
            payload: { choiceId: 'level-2-troops' },
        }), {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const mongolActionDone = apply(apply(mingDone, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '1',
            payload: { actionId: 'khan-edict' },
        }), {
            type: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            playerId: '1',
            payload: { choiceId: 'recruit-train' },
        });
        const mongolDone = apply(mongolActionDone, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '1',
            payload: { moveId: 'move-1-free' },
        });
        const readyForPayment: QidahenCore = {
            ...mongolDone,
            factions: {
                ...mongolDone.factions,
                ming: {
                    ...mongolDone.factions.ming,
                    handCount: 4,
                },
            },
        };
        const selected = apply(readyForPayment, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: 'city-region-25' },
        });
        const pending = apply(selected, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.currentPlayer).toBe('2');
        expect(pending.pendingTargetAction?.defenderPayCost).toBe(4);

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')?.controller).toBe('ming');
        expect(resolved.factions.ming.handCount).toBe(0);
        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.currentPlayer).toBe('2');
        expect(resolved.lastSeasonSummary?.title).toBe('联姻诱降');
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('守住 山海关');
        expect(resolved.actionLog[0]?.text).toContain('守住 山海关');
    });

it('联姻诱降指定辽西时会按规则少算 2 个部队的支付代价', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-19-liaoxi';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-19-liaoxi') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-19-liaoxi') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.pendingTargetAction?.targetRegionId).toBe('city-region-19-liaoxi');
        expect(pending.pendingTargetAction?.targetRegionName).toBe('辽西');
        expect(pending.pendingTargetAction?.defenderPayCost).toBe(4);
    });

it('联姻诱降指定辽西时若山海关已破败则不再享受 2 部队减免', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-19-liaoxi';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.fortifications = core.fortifications.map((fortification) => (
            fortification.id === 'shanhaiguan'
                ? { ...fortification, ruined: true }
                : fortification
        ));
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-19-liaoxi') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-19-liaoxi') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.pendingTargetAction?.targetRegionId).toBe('city-region-19-liaoxi');
        expect(pending.pendingTargetAction?.defenderPayCost).toBe(8);
    });

it('联姻诱降经逻辑区辽西选中时会保留当前焦点，并映射到同一运行时区域享受减免', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'liao-xi';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-19-liaoxi') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.selectedRegionId).toBe('liao-xi');
        expect(pending.pendingTargetAction).toMatchObject({
            targetRegionId: 'liao-xi',
            targetRegionName: '辽西',
            targetRuntimeRegionId: 'city-region-19-liaoxi',
            defenderPayCost: 4,
        });
    });

it('联姻诱降经逻辑区蓟镇选中时，阻断提示会保留规则名而不是退回顺天', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'ji-zhen';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            if (region.controller === 'jin' && region.id !== 'city-region-25') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                    diplomacyMarkerFaction: null,
                    diplomacyMarkerSide: null,
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.selectedRegionId).toBe('ji-zhen');
        expect(pending.pendingTargetAction).toBeNull();
        expect(pending.lastSeasonSummary?.title).toBe('联姻诱降');
        expect(pending.lastSeasonSummary?.lines.join(' | ')).toContain('蓟镇');
        expect(pending.lastSeasonSummary?.lines.join(' | ')).not.toContain('顺天');
        expect(pending.actionLog[0]?.text).toContain('蓟镇');
    });

it('联姻诱降失败时会消灭原守军并只留下 1 个转阵营部队', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.ming.handCount = 0;

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.pendingTargetAction?.defenderPayCost).toBe(4);

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            controlLabel: '后金',
            troops: 1,
        });
        expect(resolved.factions.ming.handCount).toBe(0);
        expect(resolved.factions.ming.troops).toBe(core.factions.ming.troops - 2);
        expect(resolved.factions.jin.troops).toBe(core.factions.jin.troops + 1);
        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.lastSeasonSummary?.title).toBe('联姻诱降');
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('守军未能支付代价');
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('仅余 1 个部队转为 后金');
        expect(resolved.actionLog[0]?.text).toContain('守军未能支付代价');
        expect(resolved.actionLog[0]?.text).toContain('1 个部队转为其麾下');
    });

it('联姻诱降面对仅 cityState 守军的敌城时也会按城内守军计算支付并转控', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.ming.handCount = 0;
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.pendingTargetAction?.defenderPayCost).toBe(4);

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            controlLabel: '后金',
            troops: 1,
            population: 2,
            cityState: null,
            specialTroops: [],
        });
        expect(resolved.factions.ming.handCount).toBe(0);
        expect(resolved.factions.ming.troops).toBe(core.factions.ming.troops - 2);
        expect(resolved.factions.jin.troops).toBe(core.factions.jin.troops + 1);
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('守军未能支付代价');
        expect(resolved.actionLog[0]?.text).toContain('1 个部队转为其麾下');
    });

it('联姻诱降面对仅 cityState 守军且守方支付代价时会保留 cityState，不会直接物化到顶层', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.ming.handCount = 4;
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.pendingTargetAction?.defenderPayCost).toBe(4);

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明',
            troops: 0,
            population: 0,
            specialTroops: [],
            cityState: {
                troops: 2,
                population: 2,
                specialTroops: [
                    {
                        id: 'ming-infantry-lv2',
                        label: '大明步兵',
                        faction: 'ming',
                        troopKind: 'infantry',
                        count: 2,
                        level: 2,
                    },
                ],
            },
        });
        expect(resolved.factions.ming.handCount).toBe(0);
        expect(resolved.factions.ming.troops).toBe(core.factions.ming.troops);
        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.lastSeasonSummary?.lines.join(' | ')).toContain('支付 4 张手牌');
        expect(resolved.actionLog[0]?.text).toContain('支付 4 张手牌');
    });

it('联姻诱降失败转控 cityState 结构化守军时不会残留原守军木块', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-25';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.selectedActionId = 'marriage-subjugation';
        core.factions.ming.handCount = 0;
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'marriage-subjugation' },
        });

        expect(pending.pendingTargetAction?.defenderPayCost).toBe(4);

        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-25')).toMatchObject({
            controller: 'jin',
            controlLabel: '后金',
            troops: 1,
            cityState: null,
            specialTroops: [],
        });
        expect(resolved.actionLog[0]?.text).toContain('守军未能支付代价');
        expect(resolved.actionLog[0]?.text).toContain('1 个部队转为其麾下');
    });
});
