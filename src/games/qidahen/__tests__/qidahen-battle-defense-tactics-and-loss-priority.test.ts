import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID } from '../domain/ordinaryHandCardIdentities';import { random, stateOf, apply, setFactionCharactersInPlay } from './helpers/paymentSelectionHarness';

describe('七大恨防守战术与承伤优先级', () => {
it.each([
        { factionId: 'jin' as const, playerId: '2', factionName: '后金' },
        { factionId: 'mongol' as const, playerId: '1', factionName: '蒙古' },
    ])('$factionName打出战车阵同样会让本次战斗攻方步兵防御等级 +1', ({ factionId, playerId }) => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'ming', []);
        setFactionCharactersInPlay(core, factionId, []);
        core.currentPlayer = playerId;
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
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试 · 战车阵同势力效果',
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
        const sourceCard = core.handCards.find((card) => card.faction === factionId);
        expect(sourceCard).toBeTruthy();
        core.handCards = [
            {
                ...sourceCard!,
                id: `test-war-chariot-formation-card-${factionId}`,
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
                    controller: factionId,
                    controlLabel: core.factions[factionId].name,
                    troops: 2,
                    specialTroops: [
                        {
                            id: `${factionId}-infantry-lv2`,
                            label: `${core.factions[factionId].name}步兵`,
                            faction: factionId,
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                        },
                    ],
                    cityState: null,
                    siegeState: null,
                };
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2-war-chariot-target',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 2,
                        },
                    ],
                    cityState: null,
                    siegeState: null,
                };
            }
            return region;
        });

        expect(QidahenDomain.validate(stateOf({
            ...core,
            pendingTargetAction: {
                ...core.pendingTargetAction!,
                battleMode: 'city',
            },
        }), {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'test-cavalry-charge-card' },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });

        const tacticPlayed = apply(core, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId,
            payload: { cardId: `test-war-chariot-formation-card-${factionId}` },
        });
        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId,
            payload: {},
        });
        const infantryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry');

        expect(tacticPlayed.handCards.some((card) => card.id === `test-war-chariot-formation-card-${factionId}`)).toBe(false);
        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1645-war-chariot-formation',
                side: 'attacker',
                troopKind: 'infantry',
                levelBonus: 1,
            }),
        ]);
        expect(infantryStage?.attackerRolls).toEqual([
            expect.objectContaining({ troopKind: 'infantry', level: 3, dieSides: 10 }),
            expect.objectContaining({ troopKind: 'infantry', level: 3, dieSides: 10 }),
        ]);
        expect(infantryStage?.defenderRolls).toEqual([
            expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
        ]);
    });

it('机里耐步兵打出后会让进攻明军的攻方步兵每部队额外掷 1 颗骰', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'ming', []);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            battleMode: 'field',
            sourceRegionId: 'city-region-14',
            sourceRegionName: '区域 14',
            targetRegionId: 'city-region-16',
            targetRegionName: '区域 16',
            targetRuntimeRegionId: 'city-region-16',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试 · 机里耐步兵',
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
        const jinCard = core.handCards.find((card) => card.faction === 'jin');
        expect(jinCard).toBeTruthy();
        core.handCards = [
            {
                ...jinCard!,
                id: 'test-jirinai-infantry-card',
                label: '机里耐步兵',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1640-jirinai-infantry',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1640-jirinai-infantry'],
            },
        ];
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
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
                };
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                    specialTroops: [
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
            return region;
        });

        const tacticPlayed = apply(core, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: 'test-jirinai-infantry-card' },
        });
        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });
        const infantryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry');

        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1640-jirinai-infantry',
                label: '机里耐步兵',
                side: 'attacker',
                troopKind: 'infantry',
                levelBonus: 0,
                diceCountBonus: 1,
            }),
        ]);
        expect(tacticPlayed.lastSeasonSummary?.lines.join(' ')).toContain('机里耐步兵：本次野战中进攻明军的攻方每个步兵部队额外掷 1 颗骰');
        expect(resolved.actionLog[0]?.text).toContain('步兵 攻');
        expect(infantryStage?.attackerRolls).toHaveLength(4);
        expect(infantryStage?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
        ]));
        expect(infantryStage?.defenderRolls).toHaveLength(1);
    });

it('机里耐步兵战斗掷骰层会让防守明军步兵先结算并压制攻方反击', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'ming', []);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            battleMode: 'field',
            sourceRegionId: 'city-region-14',
            sourceRegionName: '区域 14',
            targetRegionId: 'city-region-16',
            targetRegionName: '区域 16',
            targetRuntimeRegionId: 'city-region-16',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试 · 机里耐步兵防守明军先结算',
            battleWidth: 4,
            boundaryUnitCap: null,
            sourceAvailableTroops: 4,
            committedTroops: 4,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 4,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
            tacticModifiers: [
                {
                    id: 'test-jirinai-infantry-defensive-priority',
                    sourceCardDefId: 'qidahen-atlas05-1640-jirinai-infantry',
                    label: '机里耐步兵',
                    side: 'defender',
                    troopKind: 'infantry',
                    levelBonus: 0,
                    priorityRoll: true,
                },
            ],
        };
        core.handCards = core.handCards.filter((card) => card.cardDefId !== 'qidahen-atlas05-1640-jirinai-infantry');
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 4,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(core.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1640-jirinai-infantry',
                label: '机里耐步兵',
                side: 'defender',
                troopKind: 'infantry',
                levelBonus: 0,
                priorityRoll: true,
            }),
        ]);
        expect(resolved.actionLog[0]?.text).toContain('步兵(机里耐步兵指定步兵先掷) 攻-=0/守4/4/4=12');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 4 损伤');
        expect(resolved.postBattleSelection).toBeNull();
    });

it('机里耐步兵由防守明军正式打出后会让明军步兵先结算', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'ming', []);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            battleMode: 'field',
            sourceRegionId: 'city-region-14',
            sourceRegionName: '区域 14',
            targetRegionId: 'city-region-16',
            targetRegionName: '区域 16',
            targetRuntimeRegionId: 'city-region-16',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试 · 机里耐步兵防守正式打出',
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
                id: 'test-jirinai-infantry-defense-card',
                label: '机里耐步兵',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1640-jirinai-infantry',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1640-jirinai-infantry'],
            },
        ];
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 4,
                    specialTroops: [
                        {
                            id: 'jin-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 4,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 3,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 3,
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
            payload: { cardId: 'test-jirinai-infantry-defense-card' },
        });
        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });

        expect(tacticPlayed.handCards.some((card) => card.id === 'test-jirinai-infantry-defense-card')).toBe(false);
        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1640-jirinai-infantry',
                label: '机里耐步兵',
                side: 'defender',
                troopKind: 'infantry',
                levelBonus: 0,
                priorityRoll: true,
            }),
        ]);
        expect(tacticPlayed.lastSeasonSummary?.lines.join(' ')).toContain('机里耐步兵：本次野战中防守明军步兵先结算');
        expect(tacticPlayed.pendingTargetAction?.restriction).toContain('机里耐步兵：防守明军步兵先结算');
        expect(tacticPlayed.pendingTargetAction?.resolutionHint).toContain('机里耐步兵防守明军先结算');
        expect(resolved.actionLog[0]?.text).toContain('步兵(机里耐步兵指定步兵先掷) 攻-=0/守4/4/4=12');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 4 损伤');
        expect(resolved.postBattleSelection).toBeNull();
    });

it('巴雅喇战斗掷骰层会让防守方步兵防御等级 +1', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'ming', []);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            battleMode: 'field',
            sourceRegionId: 'city-region-14',
            sourceRegionName: '区域 14',
            targetRegionId: 'city-region-16',
            targetRegionName: '区域 16',
            targetRuntimeRegionId: 'city-region-16',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试 · 巴雅喇防守步兵防御等级',
            battleWidth: 4,
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
                    id: 'test-bayara-defensive-infantry-armor',
                    sourceCardDefId: 'qidahen-atlas05-1602-bayara',
                    label: '巴雅喇',
                    side: 'defender',
                    troopKind: 'infantry',
                    levelBonus: 1,
                },
            ],
        };
        core.handCards = core.handCards.filter((card) => card.cardDefId !== 'qidahen-atlas05-1602-bayara');
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
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
                };
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                    specialTroops: [
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
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });
        const infantryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry');

        expect(core.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1602-bayara',
                label: '巴雅喇',
                side: 'defender',
                troopKind: 'infantry',
                levelBonus: 1,
            }),
        ]);
        expect(infantryStage?.defenderRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'infantry', level: 3, dieSides: 10 }),
        ]));
        expect(resolved.actionLog[0]?.text).toContain('步兵 攻4->5/4->5=10/守4=4');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 1 损伤');
    });

it('巴雅喇由防守方正式打出后会让防守方步兵防御等级 +1', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        setFactionCharactersInPlay(core, 'ming', []);
        setFactionCharactersInPlay(core, 'jin', []);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '突袭作战待结算',
            attackerFactionId: 'jin',
            battleMode: 'field',
            sourceRegionId: 'city-region-14',
            sourceRegionName: '区域 14',
            targetRegionId: 'city-region-16',
            targetRegionName: '区域 16',
            targetRuntimeRegionId: 'city-region-16',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试 · 巴雅喇防守正式打出',
            battleWidth: 4,
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
                id: 'test-bayara-defense-card',
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
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
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
                };
            }
            if (region.id === 'city-region-16') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 0,
                    specialTroops: [
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
            return region;
        });

        const tacticPlayed = apply(core, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'test-bayara-defense-card' },
        });
        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '2',
            payload: {},
        });
        const infantryStage = resolved.postBattleSelection?.battleRolls?.stages.find((stage) => stage.phase === 'infantry');

        expect(tacticPlayed.handCards.some((card) => card.id === 'test-bayara-defense-card')).toBe(false);
        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1602-bayara',
                label: '巴雅喇',
                side: 'defender',
                troopKind: 'infantry',
                levelBonus: 1,
            }),
        ]);
        expect(tacticPlayed.lastSeasonSummary?.lines.join(' ')).toContain('巴雅喇：本次防守中己方步兵防御等级 +1');
        expect(tacticPlayed.pendingTargetAction?.restriction).toContain('巴雅喇：防守方步兵防御等级 +1');
        expect(tacticPlayed.pendingTargetAction?.resolutionHint).toContain('巴雅喇防守步兵+1');
        expect(infantryStage?.defenderRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'infantry', level: 3, dieSides: 10 }),
        ]));
        expect(resolved.actionLog[0]?.text).toContain('步兵 攻4->5/4->5=10/守4=4');
        expect(resolved.actionLog[0]?.text).toContain('守方造成 1 损伤');
    });

it.each([
        { factionName: '大明', factionId: 'ming' as const, playerId: '0', opponentFactionId: 'jin' as const },
        { factionName: '蒙古', factionId: 'mongol' as const, playerId: '1', opponentFactionId: 'ming' as const },
        { factionName: '后金', factionId: 'jin' as const, playerId: '2', opponentFactionId: 'mongol' as const },
    ])('$factionName 使用巴雅喇时攻守两种效果与其它势力相同', ({
        factionId,
        playerId,
        opponentFactionId,
    }) => {
        const buildCore = (side: 'attacker' | 'defender') => {
            const core = QidahenDomain.setup(['0', '1', '2'], random);
            core.pendingTargetAction = {
                actionId: 'raid',
                title: '突袭作战待结算',
                attackerFactionId: side === 'attacker' ? factionId : opponentFactionId,
                battleMode: 'field',
                sourceRegionId: 'city-region-16',
                sourceRegionName: '区域 16',
                targetRegionId: 'city-region-14',
                targetRegionName: '区域 14',
                targetRuntimeRegionId: 'city-region-14',
                defenderFactionId: side === 'defender' ? factionId : opponentFactionId,
                defenderLabel: side === 'defender' ? factionId : opponentFactionId,
                restriction: `测试 · 巴雅喇${side === 'attacker' ? '进攻' : '防守'}势力同效`,
                battleWidth: 4,
                boundaryUnitCap: null,
                sourceAvailableTroops: 2,
                committedTroops: 2,
                movementProfileId: 'dispatch-infantry',
                attackPressure: 2,
                attackBoundaryType: 'plain',
                resolutionHint: '测试',
                defenderPayCost: null,
            };
            const factionCard = core.handCards.find((card) => card.faction === factionId);
            expect(factionCard).toBeTruthy();
            core.handCards = [{
                ...factionCard!,
                id: `test-bayara-${side}-${factionId}`,
                label: '巴雅喇',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1602-bayara',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                    'qidahen-atlas05-1602-bayara'
                ],
            }];
            return core;
        };

        const attackResult = apply(buildCore('attacker'), {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId,
            payload: { cardId: `test-bayara-attacker-${factionId}` },
        });
        expect(attackResult.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({ side: 'defender', troopKind: 'infantry', levelBonus: -1 }),
            expect.objectContaining({ side: 'defender', troopKind: 'cavalry', levelBonus: -1 }),
            expect.objectContaining({ side: 'defender', troopKind: 'artillery', levelBonus: -1 }),
        ]));

        const defenseResult = apply(buildCore('defender'), {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId,
            payload: { cardId: `test-bayara-defender-${factionId}` },
        });
        expect(defenseResult.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({ side: 'defender', troopKind: 'infantry', levelBonus: 1 }),
        ]);
    });

it.each([
        { factionName: '大明', factionId: 'ming' as const, playerId: '0', attackerFactionId: 'jin' as const },
        { factionName: '蒙古', factionId: 'mongol' as const, playerId: '1', attackerFactionId: 'ming' as const },
        { factionName: '后金', factionId: 'jin' as const, playerId: '2', attackerFactionId: 'mongol' as const },
    ])('$factionName 守城正式打出坚守不屈会获得相同的攻城方骰值减半修正', ({
        factionId,
        playerId,
        attackerFactionId,
    }) => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.pendingTargetAction = {
            actionId: 'raid',
            title: '攻城作战待结算',
            attackerFactionId,
            battleMode: 'city',
            sourceRegionId: 'city-region-14',
            sourceRegionName: '区域 14',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: factionId,
            defenderLabel: factionId,
            restriction: '测试 · 坚守不屈三势力同效',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 1,
            committedTroops: 1,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 1,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        };
        const factionCard = core.handCards.find((card) => card.faction === factionId);
        expect(factionCard).toBeTruthy();
        core.handCards = [{
            ...factionCard!,
            id: `test-steadfast-defense-${factionId}`,
            label: '坚守不屈',
            status: 'payable',
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1635-steadfast-defense',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                'qidahen-atlas05-1635-steadfast-defense'
            ],
        }];

        const tacticPlayed = apply(core, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId,
            payload: { cardId: `test-steadfast-defense-${factionId}` },
        });

        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({ side: 'attacker', troopKind: 'infantry', rollValueDivisor: 2 }),
            expect.objectContaining({ side: 'attacker', troopKind: 'cavalry', rollValueDivisor: 2 }),
            expect.objectContaining({ side: 'attacker', troopKind: 'artillery', rollValueDivisor: 2 }),
        ]));
        expect(tacticPlayed.lastSeasonSummary?.lines.join(' ')).toContain('坚守不屈：本次城战中攻城方掷骰结果减半');
    });

it('链炮阵打出后会让攻方炮兵先于步兵承受战斗损失', () => {
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
            restriction: '测试 · 链炮阵',
            battleWidth: 3,
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
                id: 'test-chain-cannon-formation-card',
                label: '链炮阵',
                status: 'payable',
                cardKind: 'tactic',
                armamentId: null,
                cardDefId: 'qidahen-atlas05-1638-chain-cannon-formation',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID['qidahen-atlas05-1638-chain-cannon-formation'],
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
                            id: 'ming-artillery-lv3',
                            label: '大明炮兵',
                            faction: 'ming',
                            troopKind: 'artillery',
                            count: 1,
                            level: 3,
                            pieceIds: ['ming-artillery-piece-1'],
                        },
                        {
                            id: 'ming-infantry-lv2',
                            label: '大明步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 2,
                            pieceIds: ['ming-infantry-piece-1', 'ming-infantry-piece-2'],
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
                            id: 'jin-infantry-lv3',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 3,
                        },
                    ],
                };
            }
            return region;
        });

        const tacticPlayed = apply(core, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'test-chain-cannon-formation-card' },
        });
        const resolved = apply(tacticPlayed, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });
        const artilleryStage = resolved.postBattleSelection?.battleRolls?.stages.find(
            (stage) => stage.phase === 'artillery',
        );
        const occupiedRegion = occupied.regions.find((region) => region.id === 'city-region-14');

        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1638-chain-cannon-formation',
                label: '链炮阵',
                side: 'attacker',
                troopKind: 'artillery',
                levelBonus: 0,
                levelOverride: 4,
                casualtyPriority: 'artillery-first',
            }),
        ]);
        expect(tacticPlayed.lastSeasonSummary?.lines.join(' ')).toContain('链炮阵：本次野战中攻方承受损伤时炮兵单位先承受；每个炮兵的防御等级为 4，受损炮兵立即移除');
        expect(artilleryStage?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({
                troopKind: 'artillery',
                level: 4,
                dieSides: 12,
            }),
        ]));
        expect(artilleryStage?.attackerRolls.every((roll) => (
            roll.troopKind !== 'artillery'
            || (roll.level === 4 && roll.dieSides === 12)
        ))).toBe(true);
        expect(resolved.postBattleSelection).toMatchObject({
            attackerLosses: 1,
            attackerBattleCasualtyPriority: 'artillery-first',
            survivingTroops: 2,
        });
        expect(occupiedRegion).toMatchObject({
            controller: 'ming',
            troops: 2,
            specialTroops: [
                {
                    id: 'ming-infantry-lv2',
                    label: '大明步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 2,
                    level: 2,
                    pieceIds: ['ming-infantry-piece-1', 'ming-infantry-piece-2'],
                },
            ],
        });
        expect(occupiedRegion?.specialTroops.some((stack) => stack.id === 'ming-artillery-lv3')).toBe(false);
    });

it.each([
        { factionName: '大明', factionId: 'ming' as const, playerId: '0', defenderFactionId: 'jin' as const },
        { factionName: '蒙古', factionId: 'mongol' as const, playerId: '1', defenderFactionId: 'ming' as const },
        { factionName: '后金', factionId: 'jin' as const, playerId: '2', defenderFactionId: 'mongol' as const },
    ])('$factionName 正式打出链炮阵会获得相同的炮兵固定等级和优先承伤修正', ({
        factionId,
        playerId,
        defenderFactionId,
    }) => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
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
            restriction: '测试 · 链炮阵三势力同效',
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
            id: `test-chain-cannon-formation-${factionId}`,
            label: '链炮阵',
            status: 'payable',
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1638-chain-cannon-formation',
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[
                'qidahen-atlas05-1638-chain-cannon-formation'
            ],
        }];

        const tacticPlayed = apply(core, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId,
            payload: { cardId: `test-chain-cannon-formation-${factionId}` },
        });

        expect(tacticPlayed.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                side: 'attacker',
                troopKind: 'artillery',
                levelOverride: 4,
                casualtyPriority: 'artillery-first',
            }),
        ]);
    });

it('结构化攻方可选择低级部队优先承伤以保留精锐木块', () => {
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
            sourceAvailableTroops: 3,
            committedTroops: 3,
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
                            id: 'ming-elite-infantry-lv4',
                            label: '大明精锐步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 4,
                            pieceIds: ['ming-elite-piece-1'],
                        },
                        {
                            id: 'ming-militia-lv1',
                            label: '大明低级步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 2,
                            level: 1,
                            pieceIds: ['ming-militia-piece-1', 'ming-militia-piece-2'],
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
                            id: 'jin-infantry-lv3',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 3,
                        },
                    ],
                };
            }
            return region;
        });

        const resolved = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: { attackerCasualtyPriority: 'lowest-level' },
        });
        const occupied = apply(resolved, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '0',
            payload: { choiceId: 'occupy' },
        });

        expect(resolved.turnPhase).toBe('post-battle-decision');
        expect(resolved.selectedRegionId).toBe('city-region-14');
        expect(resolved.postBattleSelection).toMatchObject({
            attackerLosses: 1,
            attackerCasualtyPriority: 'lowest-level',
            survivingTroops: 2,
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            controller: 'ming',
            troops: 2,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({
                    id: 'ming-elite-infantry-lv4',
                    label: '大明精锐步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 1,
                    level: 4,
                    pieceIds: ['ming-elite-piece-1'],
                }),
                expect.objectContaining({
                    id: 'ming-militia-lv1',
                    label: '大明低级步兵',
                    faction: 'ming',
                    troopKind: 'infantry',
                    count: 1,
                    level: 1,
                    pieceIds: ['ming-militia-piece-1'],
                }),
            ]),
        });
        expect(occupied.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 0,
            specialTroops: [],
        });
        expect(
            occupied.pieces
                .filter((piece) => piece.regionId === 'city-region-14' && piece.location === 'field')
                .map((piece) => piece.id),
        ).toEqual(['ming-elite-piece-1', 'ming-militia-piece-1']);
    });

it('结构化守方可选择低级部队优先承伤以保留守方精锐木块', () => {
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
            sourceAvailableTroops: 2,
            committedTroops: 2,
            attackPressure: 2,
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
                    troops: 4,
                    population: 0,
                    specialTroops: [
                        {
                            id: 'jin-elite-infantry-lv4',
                            label: '后金精锐步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 1,
                            level: 4,
                        },
                        {
                            id: 'jin-militia-lv1',
                            label: '后金低级步兵',
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
            playerId: '0',
            payload: { defenderCasualtyPriority: 'lowest-level' },
        });

        const targetRegion = resolved.regions.find((region) => region.id === 'city-region-14');
        expect(resolved.turnPhase).toBe('action-window');
        expect(resolved.selectedRegionId).toBe('city-region-16');
        expect(targetRegion).toMatchObject({
            controller: 'jin',
            troops: 2,
            specialTroops: [
                {
                    id: 'jin-elite-infantry-lv4',
                    label: '后金精锐步兵',
                    faction: 'jin',
                    troopKind: 'infantry',
                    count: 1,
                    level: 4,
                },
            ],
        });
        expect(targetRegion?.specialTroops.some((stack) => stack.id === 'jin-militia-lv1')).toBe(false);
        expect(resolved.actionLog[0]?.text).toContain('守军减员 2');
    });
});
