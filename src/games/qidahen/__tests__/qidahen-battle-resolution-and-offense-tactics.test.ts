import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';
import { createQidahenStructuredBattleRolls } from '../domain/battleRollMath';
import { syncQidahenMapTokensFromRegions } from '../domain/mapTokens';import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID } from '../domain/ordinaryHandCardIdentities';

import { getQidahenPendingTargetActionFromInteraction } from '../domain/interactionSelectionAccessors';
import { syncQidahenRuntimeInteractionState } from '../domain/runtimeInteractions';
import { syncPiecesFromRegions } from '../domain/troopCompat';import type { QidahenCore } from '../domain/types';
import { createInitialSystemState } from '../../../engine/pipeline';

import { engineConfig } from '../game';import { random, testRandom, stateOf, apply, applyPipeline, setFactionCharactersInPlay, clearRuntimeBattleFixture } from './helpers/paymentSelectionHarness';

describe('七大恨战斗结算与进攻战术', () => {
it('战斗双方剩余兵力相同时守方获胜，攻方必须撤退', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-recruit-train';
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
            if (region.id === 'city-region-20') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 4,
                    specialTroops: [],
                    population: 0,
                };
            }
            return region;
        });

        const targeting = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
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
        expect(resolved.regions.find((region) => region.id === 'city-region-20')).toMatchObject({
            controller: 'neutral',
            controlLabel: '中立',
            troops: 1,
        });
        expect(resolved.regions.find((region) => region.id === 'city-region-24')).toMatchObject({
            controller: 'ming',
            controlLabel: '大明',
            troops: 0,
        });
        expect(resolved.factions.ming.defeatMarkers).toBe(1);
        expect(resolved.actionLog[0]?.text).toContain('守军减员 3，攻方损失 3');
        expect(resolved.actionLog[0]?.text).toContain('撤退断后损失 1');
        expect(resolved.actionLog[0]?.text).not.toContain('战斗掷骰');
    });

it('结构化川兵会按兵种阶段掷骰结算战斗损伤，而不是只按总兵力处理', () => {
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
            survivingTroops: 2,
            attackerLosses: 4,
        });
        expect(resolved.actionLog[0]?.text).toContain('战斗掷骰（野战）');
        expect(resolved.actionLog[0]?.text).toContain('攻方造成 4 损伤，守方造成 4 损伤');
        expect(resolved.regions.find((region) => region.id === 'city-region-14')?.note).toContain('撤退断后损失 1');
    });

it('巴雅喇打出后会让本次进攻守方所有部队防御等级 -1', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'ming', []);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 巴雅喇',
            battleWidth: 4,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 4,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        const mingCard = core.handCards.find((card) => card.faction === 'ming');
        expect(mingCard).toBeTruthy();
        core.handCards = [
            {
                ...mingCard!,
                id: 'test-bayara-card',
                label: '巴雅喇',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1602-bayara',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1602-bayara'],
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
                    troops: 4,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv4',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 4,
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
                    troops: 3,
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
                            id: 'jin-cavalry-lv2',
                            label: '后金骑兵',
                            faction: 'jin',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 2,
                        },
                        {
                            id: 'jin-artillery-lv2',
                            label: '后金炮兵',
                            faction: 'jin',
                            troopKind: 'artillery',
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
            payload: { cardId: 'test-bayara-card' },
        });
        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const defenderRolls = (resolved.postBattleSelection?.battleRolls?.stages ?? [])
            .flatMap((stage) => stage.defenderRolls);

        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1602-bayara',
                label: '巴雅喇',
                side: 'defender',
                troopKind: 'infantry',
                levelBonus: -1,
            }),
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1602-bayara',
                label: '巴雅喇',
                side: 'defender',
                troopKind: 'cavalry',
                levelBonus: -1,
            }),
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1602-bayara',
                label: '巴雅喇',
                side: 'defender',
                troopKind: 'artillery',
                levelBonus: -1,
            }),
        ]));
        expect(tacticPlayed.lastSeasonSummary?.lines.join(' ')).toContain('巴雅喇：本次进攻中守方所有部队防御等级 -1');
        expect(defenderRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'infantry', level: 2 }),
            expect.objectContaining({ troopKind: 'cavalry', level: 1 }),
            expect.objectContaining({ troopKind: 'artillery', level: 1 }),
        ]));
    });

it('策反内应打出后会让 1 个敌方炮兵临时转为攻方参战', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'ming', []);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 策反/内应',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        const mingCard = core.handCards.find((card) => card.faction === 'ming');
        expect(mingCard).toBeTruthy();
        core.handCards = [
            {
                ...mingCard!,
                id: 'test-instigate-defection-insider-card',
                label: '策反/内应',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1604-instigate-defection-insider',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1604-instigate-defection-insider'],
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
                    troops: 2,
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
                            id: 'jin-artillery-lv2',
                            label: '后金炮兵',
                            faction: 'jin',
                            troopKind: 'artillery',
                            count: 1,
                            level: 2,
                        },
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
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
            payload: { cardId: 'test-instigate-defection-insider-card' },
        });
        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const artilleryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'artillery');

        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1604-instigate-defection-insider',
                label: '策反/内应',
                side: 'attacker',
                troopKind: 'artillery',
                levelBonus: 0,
                convertEnemyTroopCount: 1,
            }),
        ]);
        expect(tacticPlayed.lastSeasonSummary?.lines.join(' ')).toContain('策反/内应：本次战斗中 1 个敌方炮兵临时改为攻方阵营并立即参战');
        expect(artilleryStage?.attackerRolls ?? []).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'artillery', level: 2, dieSides: 8 }),
        ]));
        expect(artilleryStage?.attackerRolls.length ?? 0).toBeGreaterThanOrEqual(1);
        expect(artilleryStage?.defenderRolls).toEqual([]);
        expect(tacticPlayed.regions.find((region) => region.id === 'city-region-14')?.specialTroops).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'jin-artillery-lv2',
                    faction: 'jin',
                    troopKind: 'artillery',
                    count: 1,
                    level: 2,
                }),
            ]),
        );
    });

it('策反打出后复用炮兵转侧窄口并保留真实牌名摘要', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'ming', []);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 策反',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        const mingCard = core.handCards.find((card) => card.faction === 'ming');
        expect(mingCard).toBeTruthy();
        core.handCards = [
            {
                ...mingCard!,
                id: 'test-instigate-defection-card',
                label: '策反',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1611-instigate-defection',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1611-instigate-defection'],
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
                    troops: 2,
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
                            id: 'jin-artillery-lv2',
                            label: '后金炮兵',
                            faction: 'jin',
                            troopKind: 'artillery',
                            count: 1,
                            level: 2,
                        },
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
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
            payload: { cardId: 'test-instigate-defection-card' },
        });
        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const artilleryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'artillery');

        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1611-instigate-defection',
                label: '策反',
                side: 'attacker',
                troopKind: 'artillery',
                levelBonus: 0,
                convertEnemyTroopCount: 1,
            }),
        ]);
        expect(tacticPlayed.pendingTargetAction?.restriction).toContain('策反：1 个敌方炮兵临时转为攻方');
        expect(tacticPlayed.pendingTargetAction?.restriction).not.toContain('策反/内应：1 个敌方炮兵临时转为攻方');
        expect(tacticPlayed.pendingTargetAction?.resolutionHint).toContain('策反敌方炮兵转攻方');
        expect(tacticPlayed.pendingTargetAction?.resolutionHint).not.toContain('策反/内应敌方炮兵转攻方');
        expect(tacticPlayed.lastSeasonSummary?.lines.join(' ')).toContain('策反：本次战斗中 1 个敌方炮兵临时改为攻方阵营并立即参战');
        expect(tacticPlayed.lastSeasonSummary?.lines.join(' ')).not.toContain('策反/内应：本次战斗中 1 个敌方炮兵临时改为攻方阵营并立即参战');
        expect(artilleryStage?.attackerRolls ?? []).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'artillery', level: 2, dieSides: 8 }),
        ]));
        expect(artilleryStage?.defenderRolls).toEqual([]);
        expect(tacticPlayed.regions.find((region) => region.id === 'city-region-14')?.specialTroops).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'jin-artillery-lv2',
                    faction: 'jin',
                    troopKind: 'artillery',
                    count: 1,
                    level: 2,
                }),
            ]),
        );
    });

it('步骑联合打出后会让本次野战攻方步兵和骑兵掷骰等级 +1', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'ming', []);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
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
        const mingCard = core.handCards.find((card) => card.faction === 'ming');
        expect(mingCard).toBeTruthy();
        core.handCards = [
            {
                ...mingCard!,
                id: 'test-infantry-cavalry-combined-card',
                label: '步骑联合',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1628-infantry-cavalry-combined',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1628-infantry-cavalry-combined'],
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
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                        {
                            id: 'ming-cavalry-lv2',
                            label: '大明骑兵',
                            faction: 'ming',
                            troopKind: 'cavalry',
                            count: 1,
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
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
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
            payload: { cardId: 'test-infantry-cavalry-combined-card' },
        });
        const jointAttackSelected = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_INFANTRY_CAVALRY_COMBINED,
            playerId: '0',
            payload: { mode: 'joint-attack' },
        });
        const resolved = apply(jointAttackSelected, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const cavalryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'cavalry');
        const infantryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry');

        expect(tacticPlayed.infantryCavalryCombinedSelection).toEqual(expect.objectContaining({
            cardId: 'test-infantry-cavalry-combined-card',
            infantryCount: 2,
            cavalryCount: 1,
        }));
        expect(tacticPlayed.handCards.some((card) => card.id === 'test-infantry-cavalry-combined-card')).toBe(true);
        expect(jointAttackSelected.infantryCavalryCombinedSelection).toBeNull();
        expect(jointAttackSelected.handCards.some((card) => card.id === 'test-infantry-cavalry-combined-card')).toBe(false);
        expect(jointAttackSelected.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1628-infantry-cavalry-combined',
                label: '步骑联合',
                side: 'attacker',
                troopKind: 'infantry',
                levelBonus: 1,
                cancelEnemyPrioritySourceCardDefIds: ['qidahen-atlas05-1646-linked-muskets'],
            }),
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1628-infantry-cavalry-combined',
                label: '步骑联合',
                side: 'attacker',
                troopKind: 'cavalry',
                levelBonus: 1,
                rollAsPhase: 'infantry',
                rollUnitCount: 1,
                cancelEnemyPrioritySourceCardDefIds: ['qidahen-atlas05-1646-linked-muskets'],
            }),
        ]));
        expect(jointAttackSelected.lastSeasonSummary?.lines.join(' ')).toContain('骑兵转入步兵阶段');
        expect(cavalryStage?.attackerRolls ?? []).toEqual([]);
        expect(infantryStage?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'infantry', level: 3, dieSides: 10 }),
            expect.objectContaining({ troopKind: 'cavalry', level: 3, dieSides: 10 }),
        ]));
    });

it('鸟真超哈打出后会让本次野战攻方步兵掷骰等级 +1', () => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 鸟真超哈',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        const mingCard = core.handCards.find((card) => card.faction === 'ming');
        expect(mingCard).toBeTruthy();
        core.handCards = [
            {
                ...mingCard!,
                id: 'test-wuzhen-chaoha-card',
                label: '鸟真超哈',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1644-wuzhen-chaoha',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1644-wuzhen-chaoha'],
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
                    troops: 2,
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
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
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
            payload: { cardId: 'test-wuzhen-chaoha-card' },
        });
        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1644-wuzhen-chaoha',
                label: '鸟真超哈',
                side: 'attacker',
                troopKind: 'infantry',
                levelBonus: 1,
            }),
        ]);
        expect(tacticPlayed.lastSeasonSummary?.lines.join(' ')).toContain('鸟真超哈：本次野战中攻方步兵骰子等级 +1');
        expect(resolved.actionLog[0]?.text).toContain('步兵 攻4/4=8/守4->5=5');
        expect(resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry')?.attackerRolls)
            .toEqual(expect.arrayContaining([
                expect.objectContaining({ troopKind: 'infantry', level: 3, dieSides: 10 }),
            ]));
        expect(resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry')?.defenderRolls)
            .toEqual(expect.arrayContaining([
                expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
            ]));
    });

it.each([
        { factionName: '大明', factionId: 'ming' as const, playerId: '0', defenderFactionId: 'jin' as const },
        { factionName: '蒙古', factionId: 'mongol' as const, playerId: '1', defenderFactionId: 'ming' as const },
        { factionName: '后金', factionId: 'jin' as const, playerId: '2', defenderFactionId: 'mongol' as const },
    ])('$factionName 正式打出鸟真超哈会获得相同的野战步兵等级修正', ({
        factionId,
        playerId,
        defenderFactionId,
    }) => {
        const core = clearRuntimeBattleFixture(QidahenDomain.setup(['0', '1', '2'], random));
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: factionId,
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId,
            defenderLabel: defenderFactionId,
            restriction: '测试 · 鸟真超哈三势力同效',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        const factionCard = core.handCards.find((card) => card.faction === factionId);
        expect(factionCard).toBeTruthy();
        core.handCards = [{
            ...factionCard!,
            id: `test-wuzhen-chaoha-${factionId}`,
            label: '鸟真超哈',
            status: 'payable',
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1644-wuzhen-chaoha',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                'qidahen-atlas05-1644-wuzhen-chaoha'
            ],
        }];

        const tacticPlayed = apply(core, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId,
            payload: { cardId: `test-wuzhen-chaoha-${factionId}` },
        });

        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1644-wuzhen-chaoha',
                side: 'attacker',
                troopKind: 'infantry',
                levelBonus: 1,
            }),
        ]);
    });

it('乌真超哈特殊牌正式打出后会让 1 个攻方步兵提前在炮兵阶段攻击', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 乌真超哈特殊牌',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        const mingCard = core.handCards.find((card) => card.faction === 'ming');
        expect(mingCard).toBeTruthy();
        core.handCards = [
            {
                ...mingCard!,
                id: 'test-wuzhen-chaoha-special-card',
                label: '乌真超哈',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1650-wuzhen-chaoha-special',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1650-wuzhen-chaoha-special'],
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
                    troops: 2,
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
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });
        core.pieces = syncPiecesFromRegions(core.regions);
        core.mapTokens = syncQidahenMapTokensFromRegions(core.regions, core.pieces);
        core.turnPhase = 'resolve-pending';

        let state = syncQidahenRuntimeInteractionState({
            core,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        });
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'test-wuzhen-chaoha-special-card' },
        }).state;
        const tacticPlayed = state.core;
        const choiceId = tacticPlayed.wuzhenChaohaSelection!.choices[0]!.id;
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_WUZHEN_CHAOHA,
            playerId: '0',
            payload: { choiceId },
        }).state;
        const tacticResolved = state.core;
        const syncedPendingTargetAction = getQidahenPendingTargetActionFromInteraction(
            state.sys.interaction?.current,
        );
        state = applyPipeline(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        }).state;
        const resolved = state.core;
        const artilleryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'artillery');
        const infantryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry');

        expect(tacticPlayed.handCards.some((card) => card.id === 'test-wuzhen-chaoha-special-card')).toBe(true);
        expect(tacticPlayed.wuzhenChaohaSelection?.choices).toHaveLength(2);
        expect(tacticResolved.handCards.some((card) => card.id === 'test-wuzhen-chaoha-special-card')).toBe(false);
        expect(tacticResolved.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1650-wuzhen-chaoha-special',
                label: '乌真超哈',
                side: 'attacker',
                troopKind: 'infantry',
                levelBonus: 0,
                rollAsPhase: 'artillery',
                rollUnitCount: 1,
                targetTokenId: choiceId,
            }),
        ]);
        expect(syncedPendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1650-wuzhen-chaoha-special',
                targetTokenId: choiceId,
                rollAsPhase: 'artillery',
            }),
        ]);
        expect(tacticResolved.lastSeasonSummary?.lines.join(' ')).toContain('提前在炮兵阶段攻击');
        expect(artilleryStage?.attackerRolls).toEqual([
            expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
        ]);
        expect(infantryStage?.attackerRolls).toHaveLength(1);
        expect(infantryStage?.attackerRolls).toEqual([
            expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
        ]);
        expect(infantryStage?.defenderRolls).toEqual([
            expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
        ]);
    });

it('箭如雨下战斗掷骰层会让野战攻方步兵先结算并压制守方反击', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 箭如雨下',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
            tacticModifiers: [
                {
                    id: 'test-arrows-like-rain-priority',
                    sourceCardDefId: 'qidahen-atlas05-1615-arrows-like-rain',
                    label: '箭如雨下',
                    side: 'attacker',
                    troopKind: 'infantry',
                    levelBonus: 0,
                    priorityRoll: true,
                },
            ],
        };
        core.handCards = core.handCards.filter((card) => card.cardDefId !== 'qidahen-atlas05-1615-arrows-like-rain');
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
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
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
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
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
            payload: {},
        });
        const infantryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry');

        expect(core.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1615-arrows-like-rain',
                label: '箭如雨下',
                side: 'attacker',
                troopKind: 'infantry',
                levelBonus: 0,
                priorityRoll: true,
            }),
        ]);
        expect(resolved.actionLog[0]?.text).toContain('步兵(箭如雨下指定步兵先掷) 攻4/4=8/守-=0');
        expect(infantryStage?.attackerRolls).toHaveLength(2);
        expect(infantryStage?.defenderRolls).toHaveLength(0);
    });

it('拒马战斗掷骰层会让对手箭如雨下先结算修正失效', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 拒马',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
            tacticModifiers: [
                {
                    id: 'test-arrows-like-rain-priority',
                    sourceCardDefId: 'qidahen-atlas05-1615-arrows-like-rain',
                    label: '箭如雨下',
                    side: 'attacker',
                    troopKind: 'infantry',
                    levelBonus: 0,
                    priorityRoll: true,
                },
                {
                    id: 'test-cheval-de-frise-cancel',
                    sourceCardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
                    label: '拒马',
                    side: 'defender',
                    troopKind: 'cavalry',
                    levelBonus: 0,
                    cancelEnemyPrioritySourceCardDefIds: ['qidahen-atlas05-1615-arrows-like-rain'],
                },
            ],
        };
        core.handCards = core.handCards.filter((card) => (
            card.cardDefId !== 'qidahen-atlas05-1615-arrows-like-rain'
            && card.cardDefId !== 'qidahen-atlas05-1636-cheval-de-frise'
        ));
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
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
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
                            id: 'jin-infantry-lv2-a',
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
        expect(resolved.actionLog[0]?.text).toContain('步兵 攻4/4=8/守');
        expect(resolved.actionLog[0]?.text).not.toContain('箭如雨下指定步兵先掷');
        expect(resolved.actionLog[0]?.text).toContain('攻方造成 2 损伤');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 3 损伤');
    });

it('箭如雨下与拒马会按打出先后结算，并在同一时点发动时两者都生效', () => {
        const buildCore = (arrowsPlayedAt: number, chevalPlayedAt: number) => {
            const core = QidahenDomain.setup(['0', '1', '2'], random);
            setFactionCharactersInPlay(core, 'jin', []);
            core.pendingTargetAction = {
                actionId: 'raid',
                title: '突袭作战待结算',
                attackerFactionId: 'ming',
                battleMode: 'field',
                sourceRegionId: 'city-region-16',
                sourceRegionName: '区域 16',
                targetRegionId: 'city-region-14',
                targetRegionName: '区域 14',
                targetRuntimeRegionId: 'city-region-14',
                defenderFactionId: 'jin',
                defenderLabel: '后金',
                restriction: '测试 · 箭如雨下与拒马时序',
                battleWidth: 3,
                boundaryUnitCap: null,
                sourceAvailableTroops: 3,
                committedTroops: 3,
                movementProfileId: null,
                attackPressure: 3,
                attackBoundaryType: 'plain',
                resolutionHint: '测试',
                defenderPayCost: null,
                tacticModifiers: [
                    {
                        id: 'test-arrows-like-rain-timing',
                        sourceCardDefId: 'qidahen-atlas05-1615-arrows-like-rain',
                        playedAt: arrowsPlayedAt,
                        label: '箭如雨下',
                        side: 'attacker',
                        troopKind: 'infantry',
                        levelBonus: 0,
                        priorityRoll: true,
                        cancelEnemyTacticSourceCardDefIds: ['qidahen-atlas05-1636-cheval-de-frise'],
                    },
                    {
                        id: 'test-cavalry-roll-as-infantry',
                        sourceCardDefId: 'test-cavalry-roll-as-infantry-source',
                        playedAt: 0,
                        label: '测试骑兵转步兵阶段',
                        side: 'attacker',
                        troopKind: 'cavalry',
                        levelBonus: 0,
                        rollAsPhase: 'infantry',
                        rollUnitCount: 1,
                    },
                    {
                        id: 'test-cheval-de-frise-timing-infantry',
                        sourceCardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
                        playedAt: chevalPlayedAt,
                        label: '拒马',
                        side: 'defender',
                        troopKind: 'infantry',
                        levelBonus: 0,
                        cancelEnemyTacticSourceCardDefIds: ['qidahen-atlas05-1615-arrows-like-rain'],
                    },
                    {
                        id: 'test-cheval-de-frise-timing-cavalry',
                        sourceCardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
                        playedAt: chevalPlayedAt,
                        label: '拒马',
                        side: 'defender',
                        troopKind: 'cavalry',
                        levelBonus: 0,
                        cancelEnemyTacticSourceCardDefIds: ['qidahen-atlas05-1615-arrows-like-rain'],
                        cancelEnemyRollAsPhaseSourceCardDefIds: ['test-cavalry-roll-as-infantry-source'],
                    },
                ],
            };
            core.handCards = core.handCards.filter((card) => (
                card.cardDefId !== 'qidahen-atlas05-1615-arrows-like-rain'
                && card.cardDefId !== 'qidahen-atlas05-1636-cheval-de-frise'
            ));
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
                                id: 'ming-infantry-lv2',
                                label: '大明步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                            {
                                id: 'ming-cavalry-lv2',
                                label: '大明骑兵',
                                faction: 'ming',
                                troopKind: 'cavalry',
                                count: 1,
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
            return core;
        };
        const resolve = (arrowsPlayedAt: number, chevalPlayedAt: number) => {
            const core = buildCore(arrowsPlayedAt, chevalPlayedAt);
            return createQidahenStructuredBattleRolls(
                core,
                core.pendingTargetAction!,
                testRandom,
                {
                    defenderSortieBattle: false,
                    defenderHoldCity: false,
                    defenderCavalryEvasion: false,
                    attackerCavalryPlunder: false,
                },
            )?.stages.find((stage) => stage.phase === 'infantry');
        };

        const chevalLater = resolve(1, 2);
        expect(chevalLater?.priorityNote).toBeNull();
        expect(chevalLater?.attackerRolls).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'cavalry' }),
        ]));
        expect(chevalLater?.defenderRolls).toHaveLength(2);

        const arrowsLater = resolve(2, 1);
        expect(arrowsLater?.priorityNote).toBe('箭如雨下指定步兵先掷');
        expect(arrowsLater?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'cavalry' }),
        ]));

        const simultaneous = resolve(1, 1);
        expect(simultaneous?.priorityNote).toBe('箭如雨下指定步兵先掷');
        expect(simultaneous?.attackerRolls).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'cavalry' }),
        ]));
    });

it.each([
        { factionName: '大明', factionId: 'ming' as const, playerId: '0', attackerFactionId: 'jin' as const },
        { factionName: '蒙古', factionId: 'mongol' as const, playerId: '1', attackerFactionId: 'ming' as const },
        { factionName: '后金', factionId: 'jin' as const, playerId: '2', attackerFactionId: 'mongol' as const },
    ])('$factionName 野战防守正式打出拒马会获得相同的反制修正', ({
        factionId,
        playerId,
        attackerFactionId,
    }) => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
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
            defenderFactionId: factionId,
            defenderLabel: factionId,
            restriction: '测试 · 拒马三势力同效',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        const factionCard = core.handCards.find((card) => card.faction === factionId);
        expect(factionCard).toBeTruthy();
        core.handCards = [{
            ...factionCard!,
            id: `test-cheval-de-frise-${factionId}`,
            label: '拒马',
            status: 'payable',
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                'qidahen-atlas05-1636-cheval-de-frise'
            ],
        }];

        const tacticPlayed = apply(core, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId,
            payload: { cardId: `test-cheval-de-frise-${factionId}` },
        });

        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
                troopKind: 'infantry',
                cancelEnemyTacticSourceCardDefIds: ['qidahen-atlas05-1615-arrows-like-rain'],
            }),
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
                troopKind: 'cavalry',
                cancelEnemyRollAsPhaseSourceCardDefIds: ['qidahen-atlas05-1639-cavalry-firearm'],
            }),
        ]));
    });

it('骑马步兵只把攻方参战附兵视为步兵，并承接步兵战术与防御修正', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 骑马步兵',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
            tacticModifiers: [
                {
                    id: 'test-mounted-infantry-defense-bonus',
                    sourceCardDefId: 'qidahen-atlas05-1645-war-chariot-formation',
                    label: '战车阵',
                    side: 'attacker',
                    troopKind: 'infantry',
                    levelBonus: 1,
                },
                {
                    id: 'test-mounted-infantry-dice-bonus',
                    sourceCardDefId: 'qidahen-atlas05-1640-jirinai-infantry',
                    label: '机里耐步兵',
                    side: 'attacker',
                    troopKind: 'infantry',
                    levelBonus: 0,
                    diceCountBonus: 1,
                },
            ],
        };
        const mingCard = core.handCards.find((card) => card.faction === 'ming');
        expect(mingCard).toBeTruthy();
        core.handCards = [
            {
                ...mingCard!,
                id: 'test-mounted-infantry-card',
                label: '骑马步兵',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1620-mounted-infantry',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                    'qidahen-atlas05-1620-mounted-infantry'
                ],
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
                    troops: 2,
                    specialTroops: [
                        {
                            id: 'ming-auxiliary-cavalry-lv3',
                            label: '大明附兵骑兵',
                            faction: 'ming',
                            originalFaction: 'ming',
                            troopClass: 'auxiliary',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 3,
                        },
                        {
                            id: 'ming-regular-cavalry-lv2',
                            label: '大明正规骑兵',
                            faction: 'ming',
                            originalFaction: 'ming',
                            troopClass: 'regular',
                            troopKind: 'cavalry',
                            count: 1,
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
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-auxiliary-cavalry-lv3',
                            label: '后金附兵骑兵',
                            faction: 'jin',
                            originalFaction: 'jin',
                            troopClass: 'auxiliary',
                            troopKind: 'cavalry',
                            count: 1,
                            level: 3,
                        },
                    ],
                };
            }
            return region;
        });

        const coreWithoutCommittedAuxiliary: QidahenCore = {
            ...core,
            regions: core.regions.map((region) => {
                if (region.isLogicalRegion || region.id !== 'city-region-16') {
                    return region;
                }
                return {
                    ...region,
                    troops: 1,
                    specialTroops: region.specialTroops.filter((stack) => stack.troopClass !== 'auxiliary'),
                };
            }),
        };
        expect(QidahenDomain.validate(stateOf(coreWithoutCommittedAuxiliary), {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'test-mounted-infantry-card' },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });

        const tacticPlayed = apply(core, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'test-mounted-infantry-card' },
        });
        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const cavalryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'cavalry');
        const infantryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry');
        const sourceRegionAfterTactic = tacticPlayed.regions.find((region) => region.id === 'city-region-16');

        expect(tacticPlayed.handCards.some((card) => card.id === 'test-mounted-infantry-card')).toBe(false);
        expect(tacticPlayed.discardPileCount).toBe(core.discardPileCount + 1);
        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toHaveLength(3);
        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1645-war-chariot-formation',
                troopKind: 'infantry',
                levelBonus: 1,
            }),
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1640-jirinai-infantry',
                troopKind: 'infantry',
                diceCountBonus: 1,
            }),
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1620-mounted-infantry',
                label: '骑马步兵',
                side: 'attacker',
                troopKind: 'infantry',
                targetTroopClass: 'auxiliary',
                treatAsTroopKind: 'infantry',
            }),
        ]));
        expect(sourceRegionAfterTactic?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'ming-auxiliary-cavalry-lv3',
                troopClass: 'auxiliary',
                troopKind: 'cavalry',
            }),
        ]));
        expect(cavalryStage?.attackerRolls).toEqual([
            expect.objectContaining({ troopKind: 'cavalry', level: 2, dieSides: 8 }),
        ]);
        expect(cavalryStage?.defenderRolls).toEqual([
            expect.objectContaining({ troopKind: 'cavalry', level: 3, dieSides: 10 }),
        ]);
        expect(infantryStage?.attackerRolls).toHaveLength(2);
        expect(infantryStage?.attackerRolls).toEqual([
            expect.objectContaining({ troopKind: 'infantry', level: 4, dieSides: 12 }),
            expect.objectContaining({ troopKind: 'infantry', level: 4, dieSides: 12 }),
        ]);
        expect(infantryStage?.defenderRolls).toEqual([]);
    });

it('偷袭与伏击战斗掷骰层会让被指定兵种骰子等级 -1', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 偷袭与伏击指定步兵降级',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
            tacticModifiers: [
                {
                    id: 'test-raid-and-ambush-infantry-debuff',
                    sourceCardDefId: 'qidahen-atlas05-1622-raid-and-ambush',
                    label: '偷袭与伏击',
                    side: 'defender',
                    troopKind: 'infantry',
                    levelBonus: -1,
                },
            ],
        };
        core.handCards = core.handCards.filter((card) => card.cardDefId !== 'qidahen-atlas05-1622-raid-and-ambush');
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
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
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
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
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
            payload: {},
        });
        const infantryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry');

        expect(core.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1622-raid-and-ambush',
                label: '偷袭与伏击',
                side: 'defender',
                troopKind: 'infantry',
                levelBonus: -1,
            }),
        ]);
        expect(infantryStage?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
        ]));
        expect(infantryStage?.defenderRolls).toEqual([
            expect.objectContaining({ troopKind: 'infantry', level: 1, dieSides: 6 }),
        ]);
        expect(resolved.actionLog[0]?.text).toContain('步兵 攻4/4=8/守4->5=5');
    });

it('乌真超哈特殊牌战斗掷骰层底座会让一个步兵提前在炮兵阶段攻击且不重复攻击', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 乌真超哈特殊牌',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
            tacticModifiers: [
                {
                    id: 'test-wuzhen-chaoha-special-early-artillery',
                    sourceCardDefId: 'qidahen-atlas05-1650-wuzhen-chaoha-special',
                    label: '乌真超哈',
                    side: 'attacker',
                    troopKind: 'infantry',
                    levelBonus: 0,
                    rollAsPhase: 'artillery',
                    rollUnitCount: 1,
                },
            ],
        };
        core.handCards = core.handCards.filter((card) => card.cardDefId !== 'qidahen-atlas05-1650-wuzhen-chaoha-special');
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
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
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
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
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
            payload: {},
        });
        const artilleryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'artillery');
        const infantryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry');

        expect(core.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1650-wuzhen-chaoha-special',
                label: '乌真超哈',
                side: 'attacker',
                troopKind: 'infantry',
                levelBonus: 0,
                rollAsPhase: 'artillery',
                rollUnitCount: 1,
            }),
        ]);
        expect(artilleryStage?.attackerRolls).toHaveLength(1);
        expect(artilleryStage?.attackerRolls).toEqual([
            expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
        ]);
        expect(artilleryStage?.defenderRolls).toHaveLength(0);
        expect(infantryStage?.attackerRolls).toHaveLength(1);
        expect(infantryStage?.attackerRolls).toEqual([
            expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
        ]);
        expect(infantryStage?.defenderRolls).toHaveLength(1);
        expect(infantryStage?.defenderRolls).toEqual([
            expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
        ]);
        expect(resolved.actionLog[0]?.text).toContain('炮兵 攻4=4/守-=0');
        expect(resolved.actionLog[0]?.text).toContain('步兵 攻4=4/守');
    });

it('骑兵冲锋打出后会让本次野战攻方每个骑兵额外掷 2 颗骰', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 骑兵冲锋',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        const mingCard = core.handCards.find((card) => card.faction === 'ming');
        expect(mingCard).toBeTruthy();
        core.handCards = [
            {
                ...mingCard!,
                id: 'test-cavalry-charge-card',
                label: '骑兵冲锋',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1618-cavalry-charge',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1618-cavalry-charge'],
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
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
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
            payload: { cardId: 'test-cavalry-charge-card' },
        });
        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const cavalryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'cavalry');

        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1618-cavalry-charge',
                label: '骑兵冲锋',
                side: 'attacker',
                troopKind: 'cavalry',
                levelBonus: 0,
                diceCountBonus: 2,
            }),
        ]);
        expect(tacticPlayed.lastSeasonSummary?.lines.join(' ')).toContain('骑兵冲锋：本次野战中攻方每个骑兵部队额外掷 2 颗骰');
        expect(resolved.actionLog[0]?.text).toContain('骑兵 攻4/4/4/4/4/4=24/守-=0');
        expect(cavalryStage?.attackerRolls).toHaveLength(6);
        expect(cavalryStage?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'cavalry', level: 2, dieSides: 8 }),
        ]));
    });

it('战车阵打出后会让本次战斗攻方步兵防御等级 +1', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'ming',
            battleMode: 'field',
            sourceRegionId: 'city-region-16',
            sourceRegionName: '区域 16',
            targetRegionId: 'city-region-14',
            targetRegionName: '区域 14',
            targetRuntimeRegionId: 'city-region-14',
            defenderFactionId: 'jin',
            defenderLabel: '后金',
            restriction: '测试 · 战车阵',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        const mingCard = core.handCards.find((card) => card.faction === 'ming');
        expect(mingCard).toBeTruthy();
        core.handCards = [
            {
                ...mingCard!,
                id: 'test-war-chariot-formation-card',
                label: '战车阵',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1645-war-chariot-formation',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1645-war-chariot-formation'],
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
                    troops: 2,
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
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
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
            payload: { cardId: 'test-war-chariot-formation-card' },
        });
        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const infantryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry');

        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1645-war-chariot-formation',
                label: '战车阵',
                side: 'attacker',
                troopKind: 'infantry',
                levelBonus: 1,
            }),
        ]);
        expect(tacticPlayed.lastSeasonSummary?.lines.join(' ')).toContain('战车阵：本次战斗中攻方步兵防御等级 +1');
        expect(resolved.actionLog[0]?.text).toContain('步兵 攻4/4=8/守4->5=5');
        expect(infantryStage?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'infantry', level: 3, dieSides: 10 }),
        ]));
        expect(infantryStage?.defenderRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
        ]));
    });
});
