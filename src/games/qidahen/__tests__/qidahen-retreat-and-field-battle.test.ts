import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID } from '../domain/ordinaryHandCardIdentities';
import { random, diceSequence, apply, setFactionCharactersInPlay, factionHandCards, clearRuntimeBattleFixture } from './helpers/paymentSelectionHarness';

describe('七大恨野战撤退与劫掠', () => {
it('结构化川兵攻下空区后会随幸存部队进驻目标区', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
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
                            id: 'ming-chuanbing-lv4',
                            label: '川兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 4,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
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
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'ming',
            troops: 0,
            specialTroops: [],
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'ming',
            troops: 4,
            specialTroops: [
                {
                    id: 'ming-chuanbing-lv4',
                    label: '川兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 2,
                    level: 4,
                },
            ],
        });
    });

it('杨镐在场时大明突袭可指挥最多 10 个部队', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-yang-gao',
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
                    troops: 10,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 3,
                    population: 0,
                    specialTroops: [],
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
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceAvailableTroops: 10,
            committedTroops: 10,
        });
        expect(pending.pendingTargetAction?.resolutionHint).toContain('出兵10/战力');
    });

it('结构化守军野战败退时会把幸存特殊部队撤到相邻友方区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                    specialTroops: [
                        {
                            id: 'ming-elite-infantry-lv4',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 4,
                        },
                        {
                            id: 'ming-chuanbing-lv4',
                            label: '川兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 4,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 7,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv1',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 7,
                            level: 1,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
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
        }, diceSequence(4, 4, 4, 1, 1, 1));

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-14',
            survivingTroops: 4,
            attackerLosses: 2,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            troops: 4,
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
        });
        expect(resolved.actionLog[0]?.text).toContain('战斗掷骰（野战）');
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后撤至 奈曼部');
    });

it('守军败退后若只剩炮兵没有步骑掩护，炮兵不会撤到友方区域', () => {
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
            battleWidth: 1,
            boundaryUnitCap: null,
            sourceAvailableTroops: 5,
            committedTroops: 5,
            attackPressure: 1,
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
                            id: 'ming-infantry-lv3',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 3,
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
                            count: 2,
                            level: 2,
                        },
                        {
                            id: 'jin-artillery-lv1',
                            label: '后金炮兵',
                            faction: 'jin',
                            troopKind: 'artillery',
                            count: 1,
                            level: 1,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
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
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后无残部可撤');
    });

it('战斗损伤不会由炮兵承受，炮兵也不计入胜负兵力，步骑全灭后炮兵一并移除', () => {
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
            battleWidth: 1,
            boundaryUnitCap: null,
            sourceAvailableTroops: 1,
            committedTroops: 1,
            attackPressure: 1,
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
                    troops: 1,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv1',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
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
                            id: 'jin-infantry-lv1',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                        },
                        {
                            id: 'jin-artillery-lv4',
                            label: '后金炮兵',
                            faction: 'jin',
                            troopKind: 'artillery',
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

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.actionLog[0]?.text).toContain('守军减员 1');
        expect(resolved.actionLog[0]?.text).not.toContain('等待战后处理');
    });

it('攻方只剩炮兵时不会因为炮兵幸存而赢得战斗', () => {
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
            battleWidth: 1,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 1,
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
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-artillery-lv4',
                            label: '大明炮兵',
                            faction: 'ming',
                            troopKind: 'artillery',
                            count: 1,
                            level: 4,
                        },
                        {
                            id: 'ming-infantry-lv1',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv1',
                            label: '后金步兵',
                            faction: 'jin',
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

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.actionLog[0]?.text).toContain('守军减员 1，攻方损失 1，撤退断后损失 1');
        expect(resolved.actionLog[0]?.text).not.toContain('等待战后处理');
    });

it('野战守军战败但未死光时会自动断后并把残部撤到相邻友方区域', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
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
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-14',
            survivingTroops: 3,
            attackerLosses: 3,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-17')?.troops).toBe(3);
        expect(resolved.factions.jin.defeatMarkers).toBe(1);
        expect(resolved.factions.jin.characters.find((character) => character.id === 'jin-nurhaci')?.defeatMarkers).toBe(1);
        expect(resolved.factions.jin.characters.find((character) => character.id === 'jin-eidu')?.defeatMarkers).toBe(0);
        expect(resolved.factions.ming.defeatMarkers).toBe(0);
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退断后损失 1');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退至 奈曼部');
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后撤至 奈曼部');
        expect(resolved.actionLog[0]?.text).toContain('后金 获得 1 个战败标记');
    });

it('野战守军自动撤退选区时会按 cityState 合并后的兵力优先选择友方城市', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    population: 0,
                    cityState: null,
                };
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: {
                        troops: 4,
                        population: 2,
                        specialTroops: [],
                    },
                };
            }
            if (region.id === 'city-region-19-liaoxi') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
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
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            troops: 2,
            cityState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'jinzhou')).toMatchObject({
            controller: 'jin',
            troops: 5,
            population: 2,
            cityState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退至 锦州');
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后撤至 锦州');
    });

it('守军败退撤入非围城 cityState 城市时会先并回守军，再接收撤退残部', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-28',
            sourceRegionName: '顺天',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试',
            battleMode: 'field',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 6,
            committedTroops: 6,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 6,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
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
                                id: 'ming-ningyuan-infantry-lv2',
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
            if (region.id === 'city-region-22' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 3,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-ningyuan-infantry-lv2', count: 2, level: 2 }),
            ]),
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后撤至 宁远');
    });

it('守军败退撤入己方被围城市时会并入 cityState，而不是落到城市顶层', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-28',
            sourceRegionName: '顺天',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试',
            battleMode: 'field',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 6,
            committedTroops: 6,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 6,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-28',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-ningyuan-infantry-lv2',
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
            if (region.id === 'city-region-22' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 0,
            siegeState: expect.objectContaining({
                attackerFactionId: 'jin',
                attackerTroops: 2,
            }),
            cityState: {
                troops: 3,
                population: 2,
                specialTroops: expect.arrayContaining([
                    expect.objectContaining({ id: 'ming-ningyuan-infantry-lv2', count: 2, level: 2 }),
                ]),
            },
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后撤至 宁远');
    });

it('守军自动败退选区时会按被围城市的 cityState 守军优先选择友方区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-28',
            sourceRegionName: '顺天',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试',
            battleMode: 'field',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 6,
            committedTroops: 6,
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 6,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-28',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-ningyuan-infantry-lv2',
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
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-25');
        expect(resolved.regions.find((region) => region.id === 'city-region-22')).toMatchObject({
            controller: 'ming',
            troops: 1,
            cityState: null,
            siegeState: null,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 0,
            siegeState: expect.objectContaining({
                attackerFactionId: 'jin',
                attackerTroops: 2,
            }),
            cityState: {
                troops: 3,
                population: 2,
                specialTroops: expect.arrayContaining([
                    expect.objectContaining({ id: 'ming-ningyuan-infantry-lv2', count: 2, level: 2 }),
                ]),
            },
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.actionLog[0]?.text).toContain('守军断后损失 1 后撤至 宁远');
    });

it('代善在场时后金守军战败撤退不执行部队损失惩罚', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-daisan',
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
                    troops: 6,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
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

        expect(resolved.regions.find((region) => region.id === 'city-region-17')?.troops).toBe(4);
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退不执行部队损失惩罚');
        expect(resolved.actionLog[0]?.text).toContain('守军不执行部队损失惩罚 后撤至 奈曼部');
    });

it('野战守军战败撤退时可选择溃败让残部全灭', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 6,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
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
            payload: { retreatLossMode: 'rout' },
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-17')?.troops).toBe(2);
        expect(resolved.factions.jin.defeatMarkers).toBe(1);
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退溃败损失 2');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('无残部可撤');
        expect(resolved.actionLog[0]?.text).toContain('守军溃败损失 2 后无残部可撤');
        expect(resolved.actionLog[0]?.text).toContain('后金 获得 1 个战败标记');
    });

it('结构化守军溃败时会降级幸存步兵，而不是把高等级残部全灭', () => {
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
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 6,
            committedTroops: 6,
            attackPressure: 3,
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
                    troops: 6,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 4,
                            level: 2,
                            pieceIds: ['jin-piece-1', 'jin-piece-2', 'jin-piece-3', 'jin-piece-4'],
                        },
                    ],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 2,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
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
            payload: { retreatLossMode: 'rout' },
        }, diceSequence(2, 2, 2, 1, 1, 1));

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            controller: 'jin',
            troops: 4,
            specialTroops: [
                {
                    id: 'jin-infantry-lv2-rout-lv1',
                    label: '后金步兵',
                    faction: 'jin',
                    troopKind: 'infantry',
                    count: 2,
                    level: 1,
                    pieceIds: ['jin-piece-1', 'jin-piece-2'],
                },
            ],
        });
        expect(
            resolved.pieces
                .filter((piece) => piece.regionId === 'city-region-17' && piece.location === 'field')
                .map((piece) => piece.id),
        ).toEqual(['jin-piece-1', 'jin-piece-2']);
        expect(
            resolved.pieces
                .filter((piece) => piece.regionId === 'city-region-17' && piece.location === 'field')
                .every((piece) => (
                    piece.level === 1
                    && piece.rotationDeg === 90
                    && piece.sourceStackId === 'jin-infantry-lv2-rout-lv1'
                )),
        ).toBe(true);
        expect(
            resolved.mapTokens
                .filter((token) => token.type === 'army' && token.id.startsWith('city-region-17-army-jin-piece-'))
                .every((token) => token.rotationDeg === 90),
        ).toBe(true);
        expect(resolved.actionLog[0]?.text).toContain('守军溃败损伤 2 后撤至 奈曼部');
    });

it('战斗后步骑全灭时不会留下孤立炮兵', () => {
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
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 1,
            committedTroops: 1,
            attackPressure: 1,
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
                    troops: 1,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv1',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
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
                            id: 'jin-artillery-lv1',
                            label: '后金炮兵',
                            faction: 'jin',
                            troopKind: 'artillery',
                            count: 1,
                            level: 1,
                        },
                        {
                            id: 'jin-infantry-lv1',
                            label: '后金步兵',
                            faction: 'jin',
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
        }, diceSequence(6, 6, 1));

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'ming',
            troops: 0,
            specialTroops: [],
        });
        expect(resolved.actionLog[0]?.text).toContain('攻方损失 1');
        expect(resolved.actionLog[0]?.text).toContain('战斗掷骰');
    });

it('结构化守方骑兵可在野战避战并撤到相邻友方区且不视为战败', () => {
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
                    specialTroops: [],
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
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                            pieceIds: ['jin-cavalry-piece-1', 'jin-cavalry-piece-2'],
                        },
                    ],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-19' || region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
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
            payload: { defenderCavalryEvasion: true },
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.postBattleSelection).toMatchObject({
            targetRuntimeRegionId: 'city-region-14',
            survivingTroops: 4,
            attackerLosses: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 0,
            specialTroops: [],
        });
        const naiman = resolved.regions.find((region) => region.id === 'city-region-17');
        expect(naiman).toMatchObject({
            controller: 'jin',
            troops: 3,
            specialTroops: [
                {
                    id: 'jin-cavalry-lv2',
                    label: '后金骑兵',
                    faction: 'jin',
                    troopKind: 'cavalry',
                    count: 2,
                    level: 2,
                    pieceIds: ['jin-cavalry-piece-1', 'jin-cavalry-piece-2'],
                },
            ],
        });
        expect(
            resolved.pieces
                .filter((piece) => piece.regionId === 'city-region-17' && piece.location === 'field')
                .map((piece) => piece.id),
        ).toEqual(['jin-cavalry-piece-1', 'jin-cavalry-piece-2']);
        expect(resolved.factions.jin.defeatMarkers).toBe(0);
        expect(resolved.actionLog[0]?.text).toContain('守方骑兵避战 2 撤至 奈曼部');
        expect(resolved.actionLog[0]?.text).not.toContain('后金 获得 1 个战败标记');
    });

it('守方骑兵避战撤入非围城 cityState 城市时会先并回守军，再接收避战骑兵', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-28',
            sourceRegionName: '顺天',
            targetRegionId: 'city-region-27',
            targetRegionName: '保定',
            targetRuntimeRegionId: 'city-region-27',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试',
            battleMode: 'field',
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
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-27') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
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
                                id: 'ming-ningyuan-infantry-lv2',
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
            if (
                region.id === 'city-region-20'
                || region.id === 'city-region-22'
                || region.id === 'city-region-30'
                || region.id === 'city-region-33'
            ) {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: { defenderCavalryEvasion: true, defenderCavalryEvasionRegionId: 'city-region-24' },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 4,
            population: 2,
            cityState: null,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ id: 'ming-ningyuan-infantry-lv2', count: 2, level: 2 }),
                expect.objectContaining({ id: 'ming-cavalry-lv2', count: 2, level: 2 }),
            ]),
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-27')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 0,
            specialTroops: [],
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(0);
        expect(resolved.actionLog[0]?.text).toContain('守方骑兵避战 2 撤至 宁远');
    });

it('守方骑兵避战撤入己方被围城市时会并入 cityState，而不是落到城市顶层', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-28',
            sourceRegionName: '顺天',
            targetRegionId: 'city-region-27',
            targetRegionName: '保定',
            targetRuntimeRegionId: 'city-region-27',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试',
            battleMode: 'field',
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
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    population: 0,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-27') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-28',
                    },
                    cityState: {
                        troops: 2,
                        population: 2,
                        specialTroops: [
                            {
                                id: 'ming-ningyuan-infantry-lv2',
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
            if (
                region.id === 'city-region-20'
                || region.id === 'city-region-22'
                || region.id === 'city-region-30'
                || region.id === 'city-region-33'
            ) {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: { defenderCavalryEvasion: true, defenderCavalryEvasionRegionId: 'city-region-24' },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 0,
            siegeState: expect.objectContaining({
                attackerFactionId: 'jin',
                attackerTroops: 2,
            }),
            cityState: {
                troops: 4,
                population: 2,
                specialTroops: expect.arrayContaining([
                    expect.objectContaining({ id: 'ming-ningyuan-infantry-lv2', count: 2, level: 2 }),
                    expect.objectContaining({ id: 'ming-cavalry-lv2', count: 2, level: 2 }),
                ]),
            },
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-27')).toMatchObject({
            controller: 'ming',
            troops: 0,
            population: 0,
            specialTroops: [],
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(0);
        expect(resolved.actionLog[0]?.text).toContain('守方骑兵避战 2 撤至 宁远');
    });

it('结构化守方骑兵避战可指定相邻友方撤退目标', () => {
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
                    specialTroops: [],
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
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 2,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    specialTroops: [],
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { defenderCavalryEvasion: true, defenderCavalryEvasionRegionId: 'city-region-19' },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-17')).toMatchObject({
            controller: 'jin',
            troops: 5,
            specialTroops: [],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-19')).toMatchObject({
            controller: 'jin',
            troops: 3,
            specialTroops: [
                {
                    id: 'jin-cavalry-lv2',
                    label: '后金骑兵',
                    faction: 'jin',
                    troopKind: 'cavalry',
                    count: 2,
                    level: 2,
                },
            ],
        });
        expect(resolved.actionLog[0]?.text).toContain('守方骑兵避战 2 撤至 敖汉部');
    });

it('结构化攻方骑兵可在旱灾区域按真实人口劫掠并按存活骑兵移除人口后撤', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'wheel-dispatch',
            title: '调骑 4 待结算',
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
            sourceAvailableTroops: 3,
            committedTroops: 3,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 3,
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
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 3,
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
                    troops: 1,
                    population: 3,
                    eventMarkers: [{
                        id: 'drought-marker-city-region-14',
                        kind: 'drought' as const,
                        label: '旱灾标记',
                        sourceCardDefId: 'qidahen-atlas05-1608-mongol-drought',
                        imageSrc: 'qidahen/markers/drought-marker',
                    }],
                    specialTroops: [
                        {
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 1,
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
            payload: { attackerCavalryPlunder: true },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 1,
            population: 1,
            specialTroops: [
                {
                    id: 'jin-cavalry-lv2',
                    label: '后金骑兵',
                    faction: 'jin',
                    troopKind: 'cavalry',
                    count: 1,
                    level: 2,
                },
            ],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'ming',
            troops: 2,
            specialTroops: [
                {
                    id: 'ming-cavalry-lv2',
                    label: '大明骑兵',
                    faction: 'ming',
                    troopKind: 'cavalry',
                    count: 2,
                    level: 2,
                },
            ],
        });
        expect(resolved.factions.ming.handCount).toBe(core.factions.ming.handCount + 2);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount + 2);
        expect(resolved.factions.ming.drawPileCount).toBe(core.factions.ming.drawPileCount - 4);
        expect(resolved.factions.jin.defeatMarkers).toBe(0);
        expect(resolved.actionLog[0]?.text).toContain('骑兵劫掠');
        expect(resolved.actionLog[0]?.text).toContain('损失 1');
        expect(resolved.actionLog[0]?.text).toContain('劫掠 2 人口');
    });

it('打草惊蛇战斗劫掠层底座会让骑兵劫掠不受守方反击伤害', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'wheel-dispatch',
            title: '调骑 4 待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 打草惊蛇',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 3,
            committedTroops: 3,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
            tacticModifiers: [
                {
                    id: 'test-raid-grain',
                    sourceCardDefId: 'qidahen-atlas05-1612-raid-grain',
                    label: '打草惊蛇',
                    side: 'attacker',
                    troopKind: 'cavalry',
                    levelBonus: 0,
                    cavalryPlunderCounterDamageDisabled: true,
                },
            ],
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
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 3,
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
                    troops: 1,
                    population: 3,
                    specialTroops: [
                        {
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 1,
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
            payload: { attackerCavalryPlunder: true },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            population: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 3,
            specialTroops: [
                {
                    id: 'ming-cavalry-lv2',
                    label: '大明骑兵',
                    faction: 'ming',
                    troopKind: 'cavalry',
                    count: 3,
                    level: 2,
                },
            ],
        });
        expect(resolved.factions.ming.handCount).toBe(core.factions.ming.handCount + 3);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount + 3);
        expect(resolved.actionLog[0]?.text).toContain('打草惊蛇使劫掠部队不受反击伤害');
        expect(resolved.actionLog[0]?.text).toContain('劫掠 3 人口');
        expect(resolved.actionLog[0]?.text).not.toContain('损失 1');
    });

it('打草惊蛇正式打出后会让本次攻方骑兵劫掠不受守方反击伤害', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'wheel-dispatch',
            title: '调骑 4 待结算',
            attackerFactionId: 'ming',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 骑兵劫掠',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 3,
            committedTroops: 3,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 3,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        core.handCards = [
            {
                id: 'test-raid-grain-card',
                label: '打草惊蛇',
                faction: 'ming',
                previewRef: {
                    source: 'qidahen-atlas05',
                    cardDefId: 'qidahen-atlas05-1612-raid-grain',
                },
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1612-raid-grain',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1612-raid-grain'],
            },
        ];
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 3,
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
                    troops: 1,
                    population: 3,
                    specialTroops: [
                        {
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const tacticPlayed = apply(core, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'test-raid-grain-card' },
        });
        expect(tacticPlayed.handCards.some((card) => card.id === 'test-raid-grain-card')).toBe(false);
        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1612-raid-grain',
                label: '打草惊蛇',
                side: 'attacker',
                troopKind: 'cavalry',
                cavalryPlunderCounterDamageDisabled: true,
            }),
        ]));

        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { attackerCavalryPlunder: true },
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            population: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 3,
            specialTroops: [
                {
                    id: 'ming-cavalry-lv2',
                    label: '大明骑兵',
                    faction: 'ming',
                    troopKind: 'cavalry',
                    count: 3,
                    level: 2,
                },
            ],
        });
        expect(resolved.actionLog[0]?.text).toContain('打草惊蛇使劫掠部队不受反击伤害');
        expect(resolved.actionLog[0]?.text).toContain('劫掠 3 人口');
        expect(resolved.actionLog[0]?.text).not.toContain('损失 1');
    });

it('结构化攻方骑兵劫掠可选择抽守方普通牌堆', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'wheel-dispatch',
            title: '调骑 4 待结算',
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
            sourceAvailableTroops: 3,
            committedTroops: 3,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 3,
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
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 3,
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
                    troops: 1,
                    population: 3,
                    specialTroops: [
                        {
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 1,
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
            payload: { attackerCavalryPlunder: true, attackerCavalryPlunderSource: 'defender' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.population).toBe(1);
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 2,
            specialTroops: [
                {
                    id: 'ming-cavalry-lv2',
                    label: '大明骑兵',
                    faction: 'ming',
                    troopKind: 'cavalry',
                    count: 2,
                    level: 2,
                },
            ],
        });
        expect(resolved.factions.ming.handCount).toBe(core.factions.ming.handCount + 2);
        expect(resolved.factions.ming.discardPileCount).toBe(core.factions.ming.discardPileCount);
        expect(resolved.factions.jin.drawPileCount).toBe(core.factions.jin.drawPileCount - 2);
        expect(factionHandCards(resolved, 'ming')).toHaveLength(factionHandCards(core, 'ming').length + 2);
        expect(resolved.actionLog[0]?.text).toContain('抽后金牌堆获得 2 张手牌');
        expect(resolved.actionLog[0]?.text).not.toContain('弃牌堆 +');
    });

it('野战攻方未突破但仍有残部时会自动断后再撤回源区', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
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
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
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

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'ming',
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 2,
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.factions.jin.defeatMarkers).toBe(0);
        expect(resolved.regions.find((region) => region.id === 'city-region-16')?.note).toContain('其中撤退断后 1');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退断后损失 1');
        expect(resolved.actionLog[0]?.text).toContain('攻方损失 3，撤退断后损失 1');
        expect(resolved.actionLog[0]?.text).toContain('大明 获得 1 个战败标记');
    });

it('代善在场时后金攻方未突破撤回源区不执行部队损失惩罚', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.currentPlayer = '2';
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-daisan',
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
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const pending = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'raid' },
        });
        const resolved = apply(pending, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'jin',
            troops: 1,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-16')?.note).not.toContain('其中撤退断后 1');
        expect(resolved.actionLog[0]?.text).toContain('攻方损失 3，撤退不执行部队损失惩罚');
    });

it('野战攻方未突破撤退时可选择溃败让残部全灭', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.selectedRegionId = 'city-region-14';
        core.selectedActionId = 'raid';
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
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 5,
                    population: 0,
                    specialTroops: [],
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
            payload: { retreatLossMode: 'rout' },
        });

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'ming',
            troops: 0,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 2,
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.regions.find((region) => region.id === 'city-region-16')?.note).toContain('其中撤退溃败 2');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退溃败损失 2');
        expect(resolved.actionLog[0]?.text).toContain('攻方损失 3，撤退溃败损失 2');
        expect(resolved.actionLog[0]?.text).toContain('大明 获得 1 个战败标记');
    });

it('结构化攻方未突破溃败时会降级幸存步兵，而不是把高等级残部全灭', () => {
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
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 5,
            committedTroops: 5,
            attackPressure: 1,
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
                    troops: 5,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { retreatLossMode: 'rout' },
        }, diceSequence(4, 2, 2, 2));

        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(resolved.postBattleSelection).toBeNull();
        expect(resolved.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            controller: 'ming',
            troops: 3,
            specialTroops: [
                {
                    id: 'ming-infantry-lv2-rout-lv1',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 3,
                    level: 1,
                },
            ],
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'jin',
            troops: 4,
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.regions.find((region) => region.id === 'city-region-16')?.note).toContain('撤退溃败损伤 3');
        expect(resolved.actionLog[0]?.text).toContain('攻方损失 2，撤退溃败损伤 3');
        expect(resolved.actionLog[0]?.text).toContain('大明 获得 1 个战败标记');
    });
});
