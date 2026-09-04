import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';import { random, dieSidesRandom, apply, setFactionCharactersInPlay } from './helpers/paymentSelectionHarness';

describe('七大恨战斗人物修正', () => {
it('后金步兵铁甲会增强结构化步兵掷骰并进入战斗损伤', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 4,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 4,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 4,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection).toMatchObject({
            attackerLosses: 3,
            survivingTroops: 1,
        });
        expect(resolved.actionLog[0]?.text).toContain('守4->5/4->5=10');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 3 损伤');
    });

it('努尔哈赤在场时会让后金结构化步兵战斗掷骰等级 +1，最高到 4', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 4,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 4,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-nurhaci',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 4,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv3',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 3,
                        },
                        {
                            id: 'jin-infantry-lv4',
                            label: '后金精锐步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 4,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.actionLog[0]?.text).toContain('守4->5/4->5=10');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 3 损伤');
    });

it('额亦都在场时会让后金指定同兵种先掷骰，从而先压低对手同兵种回击', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.factions.jin.armaments = [];
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 5,
            boundaryUnitCap: null,
            sourceAvailableTroops: 5,
            committedTroops: 5,
            attackPressure: 5,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 5,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 3,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const baseline = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        setFactionCharactersInPlay(core, 'jin', ['jin-eidu']);

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(baseline.postBattleSelection).toMatchObject({
            survivingTroops: 1,
            attackerLosses: 4,
        });
        expect(baseline.actionLog[0]?.text).toContain('步兵 攻4/4/4/4/4=20/守4/4/4=12');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.actionLog[0]?.text).toContain('步兵(额亦都指定步兵先掷) 攻4=4/守4/4/4=12');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 4 损伤');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 2,
            specialTroops: [
                {
                    id: 'jin-infantry-lv2',
                    label: '后金步兵',
                    faction: 'jin',
                    troopKind: 'infantry',
                    count: 2,
                    level: 2,
                },
            ],
        });
    });

it('蒙古骑兵铁甲会增强结构化骑兵野战掷骰并进入战斗损伤', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '察哈尔',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'mongol',
            defenderLabel: '蒙古',
            restriction: '测试',
            battleWidth: 4,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 4,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 4,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'mongol-cavalry-lv2',
                            label: '蒙古骑兵',
                            faction: 'mongol',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.postBattleSelection).toMatchObject({
            attackerLosses: 3,
            survivingTroops: 1,
        });
        expect(resolved.actionLog[0]?.text).toContain('骑兵 攻-=0/守4->5/4->5=10');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 3 损伤');
    });

it('齐赛诺延在场时会让蒙古进攻骑兵按高一级掷骰，最高 4 级', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'mongol',
            sourceRegionId: 'city-region-14',
            sourceRegionName: '察哈尔',
            targetRegionId: 'city-region-13',
            targetRegionName: '建州',
            targetRuntimeRegionId: 'city-region-13',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 2,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                armaments: core.factions.mongol.armaments.map((armament) => (
                    armament.id === 'cavalry-armor'
                        ? { ...armament, level: 0 }
                        : armament
                )),
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-qisai-noyan',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'mongol-cavalry-lv2',
                            label: '蒙古骑兵',
                            faction: 'mongol',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-13') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv1',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 2,
                            level: 1,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '1',
            payload: {},
        }, dieSidesRandom);

        expect(resolved.actionLog[0]?.text).toContain('骑兵 攻10/10=20/守-=0');
        expect(resolved.actionLog[0]?.text).toContain('步兵 攻-=0/守8->9/8->9=18');
        expect(resolved.actionLog[0]?.text).toContain('攻方造成 6 损伤');
    });

it('孙元化单独在场时不会让大明炮兵战斗掷骰点数加 2', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '察哈尔',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'mongol',
            defenderLabel: '蒙古',
            restriction: '测试',
            battleWidth: 2,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-sun-yuanhua',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-artillery-lv1',
                            label: '大明炮兵',
                            faction: 'ming',
                            troopKind: 'artillery',
                            count: 1,
                            level: 1,
                        },
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 1,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'mongol-infantry-lv1',
                            label: '蒙古步兵',
                            faction: 'mongol',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.actionLog.map((entry) => entry.text).join(' | ')).not.toContain('炮兵 攻4->6=6/守-=0');
    });

it('孙元化与袁崇焕同时在场时会让大明每颗炮兵战斗骰点数加 2', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '察哈尔',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'mongol',
            defenderLabel: '蒙古',
            restriction: '测试',
            battleWidth: 2,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-sun-yuanhua' || character.id === 'ming-yuan-chonghuan',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-artillery-lv1',
                            label: '大明炮兵',
                            faction: 'ming',
                            troopKind: 'artillery',
                            count: 1,
                            level: 1,
                        },
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    troops: 1,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'mongol-infantry-lv1',
                            label: '蒙古步兵',
                            faction: 'mongol',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.actionLog.map((entry) => entry.text).join(' | ')).toContain('炮兵 攻4->6/4->6=12/守-=0');
        expect(resolved.actionLog.map((entry) => entry.text).join(' | ')).toContain('攻方造成 5 损伤');
    });

it('待结算进攻可选择少投入部队并按选择数量进入战后处理', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试：可少投入',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 4,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { committedTroops: 2 },
        });
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.postBattleSelection).toMatchObject({
            committedTroops: 2,
            survivingTroops: 2,
            attackerLosses: 0,
        });
        expect(resolved.actionLog[0]?.text).toContain('投入 2 部队');
        expect(occupied.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 2,
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'ming',
            troops: 2,
        });
    });
});
