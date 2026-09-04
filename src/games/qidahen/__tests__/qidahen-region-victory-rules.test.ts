import { describe, expect, it } from 'vitest';import { getQidahenEffectiveVpByFaction, QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';
import { getActionChoicesForFaction } from '../domain/factionActionWindow';
import { syncQidahenMapTokensFromRegions } from '../domain/mapTokens';import { QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID } from '../domain/ordinaryHandCardIdentities';

import { syncPiecesFromRegions } from '../domain/troopCompat';import { QIDAHEN_MAP_HEIGHT, QIDAHEN_MAP_WIDTH } from '../ui/mapRegions';
import type { QidahenCore } from '../domain/types';
import { random, apply, factionHandCards } from './helpers/paymentSelectionHarness';

describe('七大恨区域规则与胜利', () => {
it('运行时区域会为朝鲜与海路保留独立移动代价', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(core.regions.find((region) => region.id === 'city-region-18')?.travelCostByRegionId['city-region-29']).toBe(3);
        expect(core.regions.find((region) => region.id === 'city-region-18')?.travelCostByRegionId['xian-xing']).toBe(3);
        expect(core.regions.find((region) => region.id === 'song-jin')?.travelCostByRegionId['city-region-22']).toBe(2);
        expect(core.regions.find((region) => region.id === 'song-jin')?.movementCostByRegionId['city-region-22']).toBe(2);
        expect(core.regions.find((region) => region.id === 'song-jin')?.boundaryTypeByRegionId['city-region-22']).toBe('coast');
    });

it('当前样板开局会把朝鲜三地初始化为大明控制，汉城额外威望默认未解锁', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(core.regions.find((region) => region.id === 'xian-xing')?.controller).toBe('ming');
        expect(core.regions.find((region) => region.id === 'city-region-18')?.controller).toBe('ming');
        expect(core.regions.find((region) => region.id === 'city-region-29')?.controller).toBe('ming');
        expect(core.regions.find((region) => region.id === 'xian-xing')?.population).toBe(0);
        expect(core.regions.find((region) => region.id === 'city-region-18')?.population).toBe(0);
        expect(core.regions.find((region) => region.id === 'city-region-29')?.population).toBe(0);
        expect(core.hanseongPrestigeUnlocked).toBe(false);
        expect(getQidahenEffectiveVpByFaction(core, 'ming')).toBe(core.factions.ming.vp);
    });

it('失去汉城后会按逻辑区口径自动解锁额外威望', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedActionId = 'recruit';
        core.selectedRegionId = 'city-region-22';
        core.actionChoices = getActionChoicesForFaction('ming');
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(next.hanseongPrestigeUnlocked).toBe(true);
    });

it('当前样板开局会把关键前线普通部队初始化为结构化兵种', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(core.regions.find((region) => region.id === 'song-jin')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-pidao-infantry-lv1', label: '大明步兵', faction: 'ming', count: 2, level: 1 }),
        ]));
        expect(core.regions.find((region) => region.id === 'city-region-25')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'ming-shanhaiguan-infantry-lv1', label: '大明步兵', faction: 'ming', count: 2, level: 1 }),
        ]));
        expect(core.regions.find((region) => region.id === 'city-region-22')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 }),
        ]));
        expect(core.regions.find((region) => region.id === 'city-region-28-jizhen')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: '大明步兵', faction: 'ming', troopKind: 'infantry', count: 1, level: 1 }),
        ]));
        expect(core.regions.find((region) => region.id === 'jinzhou')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'jin-jinzhou-infantry-lv2', label: '后金步兵', faction: 'jin', count: 2, level: 2 }),
        ]));
        expect(core.regions.find((region) => region.id === 'city-region-13')).toMatchObject({
            name: '建州',
            controller: 'jin',
            troops: 3,
            population: 2,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ label: '后金步兵', faction: 'jin', troopKind: 'infantry', count: 2, level: 4 }),
                expect.objectContaining({ label: '后金步兵', faction: 'jin', troopKind: 'infantry', count: 1, level: 2 }),
            ]),
        });
        expect(core.regions.find((region) => region.id === 'city-region-11')).toMatchObject({
            name: '长白',
            controller: 'jin',
            troops: 2,
            population: 2,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ label: '后金步兵', faction: 'jin', troopKind: 'infantry', count: 2, level: 2 }),
            ]),
        });
        expect(core.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            name: '察哈尔',
            controller: 'mongol',
            troops: 3,
            population: 3,
            specialTroops: expect.arrayContaining([
                expect.objectContaining({ label: '蒙古骑兵', faction: 'mongol', troopKind: 'cavalry', count: 3, level: 3 }),
            ]),
        });
        const getArmyTokens = (baseId: string) => core.mapTokens.filter((token) => (
            token.type === 'army' && token.id.startsWith(`${baseId}-army-`)
        ));
        const xianXingPieceId = core.regions.find((region) => region.id === 'xian-xing')?.specialTroops[0]?.pieceIds?.[0];
        const jizhenPieceId = core.regions.find((region) => region.id === 'city-region-28-jizhen')?.specialTroops[0]?.pieceIds?.[0];
        expect(core.mapTokens).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'jianzhou-control', type: 'control', faction: 'jin' }),
            expect.objectContaining({ id: 'changbai-control', type: 'control', faction: 'jin' }),
            expect.objectContaining({ id: 'chahar-control', type: 'control', faction: 'mongol' }),
            expect.objectContaining({ id: 'city-region-25-control', type: 'control', faction: 'ming' }),
            expect.objectContaining({ id: 'city-region-22-control', type: 'control', faction: 'ming' }),
            expect.objectContaining({ id: 'city-region-28-jizhen-control', type: 'control', faction: 'ming' }),
        ]));
        expect(core.mapTokens.some((token) => token.type === 'population' || token.id.endsWith('-pop'))).toBe(false);
        const dongjiangControl = core.mapTokens.find((token) => token.id === 'city-region-22-control');
        expect(dongjiangControl?.x).toBeCloseTo(881 / QIDAHEN_MAP_WIDTH, 4);
        expect(dongjiangControl?.y).toBeCloseTo((719 - 58) / QIDAHEN_MAP_HEIGHT, 4);
        const dongjiang = core.regions.find((region) => region.id === 'city-region-22')!;
        dongjiang.siegeState = {
            attackerFactionId: 'jin',
            attackerTroops: 2,
            attackerSpecialTroops: [],
            sourceRegionId: 'city-region-19',
        };
        const mapTokensWithDongjiangSiege = syncQidahenMapTokensFromRegions(core.regions, syncPiecesFromRegions(core.regions));
        const siegeTokens = mapTokensWithDongjiangSiege
            .filter((token) => token.type === 'army' && token.id.startsWith('city-region-22-siege-army-'));
        expect(siegeTokens).toHaveLength(2);
        expect(siegeTokens).toEqual(expect.arrayContaining([
            expect.objectContaining({
                faction: 'jin',
                regionId: 'city-region-22',
                imageSrc: 'qidahen/units/jin-regular-infantry-unit',
            }),
        ]));
        const averageSiegeTokenX = siegeTokens.reduce((sum, token) => sum + token.x, 0) / siegeTokens.length;
        const averageSiegeTokenY = siegeTokens.reduce((sum, token) => sum + token.y, 0) / siegeTokens.length;
        expect(averageSiegeTokenX).toBeCloseTo(881 / QIDAHEN_MAP_WIDTH, 4);
        expect(averageSiegeTokenY).toBeCloseTo((719 + 30) / QIDAHEN_MAP_HEIGHT, 4);
        expect(Math.max(...siegeTokens.map((token) => token.x)) - Math.min(...siegeTokens.map((token) => token.x)))
            .toBeCloseTo(24 / QIDAHEN_MAP_WIDTH, 4);
        const dongjiangArmyTokens = mapTokensWithDongjiangSiege.filter((token) => (
            token.type === 'army' && token.id.startsWith('city-region-22-army-')
        ));
        const averageDongjiangArmyTokenX = dongjiangArmyTokens.reduce((sum, token) => sum + token.x, 0) / dongjiangArmyTokens.length;
        const averageDongjiangArmyTokenY = dongjiangArmyTokens.reduce((sum, token) => sum + token.y, 0) / dongjiangArmyTokens.length;
        expect(averageDongjiangArmyTokenX).toBeCloseTo(881 / QIDAHEN_MAP_WIDTH, 4);
        expect(averageDongjiangArmyTokenY).toBeCloseTo((719 - 18) / QIDAHEN_MAP_HEIGHT, 4);
        expect(Math.min(...siegeTokens.map((token) => token.y))).toBeGreaterThan(Math.max(...dongjiangArmyTokens.map((token) => token.y)));
        expect(getArmyTokens('jianzhou')).toHaveLength(3);
        expect(getArmyTokens('changbai')).toHaveLength(2);
        expect(getArmyTokens('chahar')).toHaveLength(3);
        expect(getArmyTokens('city-region-25')).toHaveLength(2);
        expect(getArmyTokens('city-region-28-jizhen')).toHaveLength(1);
        expect(getArmyTokens('xian-xing')).toHaveLength(1);
        expect(getArmyTokens('city-region-25')).toEqual(expect.arrayContaining([
            expect.objectContaining({ faction: 'ming', imageSrc: 'qidahen/units/ming-regular-infantry-unit', rotationDeg: 90 }),
        ]));
        expect(xianXingPieceId).toBeTruthy();
        expect(getArmyTokens('xian-xing')).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: `xian-xing-army-${xianXingPieceId}`, faction: 'ming', imageSrc: 'qidahen/units/ming-mercenary-infantry-unit', rotationDeg: 0 }),
        ]));
        expect(jizhenPieceId).toBeTruthy();
        expect(getArmyTokens('city-region-28-jizhen')).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: `city-region-28-jizhen-army-${jizhenPieceId}`, faction: 'ming', imageSrc: 'qidahen/units/ming-regular-infantry-unit', rotationDeg: 90 }),
        ]));
        expect(core.mapTokens.some((token) => token.id === 'xianxing-army-1')).toBe(false);
        expect(core.mapTokens.some((token) => token.id === 'xianxing-army-2')).toBe(false);
        expect(core.regions.find((region) => region.id === 'xian-xing')?.specialTroops).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: '雇佣军', faction: 'ming', troopClass: 'auxiliary', count: 1, level: 2 }),
        ]));
    });

it('非大明势力不会把船锚海路当作普通相邻进攻线', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedActionId = 'raid';
        core.selectedRegionId = 'song-jin';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                };
            }
            if (region.id === 'city-region-22') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 3,
                };
            }
            if (region.id === 'city-region-15' || region.id === 'city-region-15-liaodong' || region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                    troops: 0,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'raid' },
        });

        expect(next.pendingTargetAction).toBeNull();
    });

it('汉城额外威望在解锁后会给当前控制者 +1，并可触发威望胜利', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '0';
        core.selectedActionId = 'recruit';
        core.selectedRegionId = 'city-region-29';
        core.actionChoices = getActionChoicesForFaction('ming');
        core.hanseongPrestigeUnlocked = true;
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                vp: 2,
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '0',
            payload: { actionId: 'recruit' },
        });

        expect(next.hanseongPrestigeUnlocked).toBe(true);
        expect(getQidahenEffectiveVpByFaction(next, 'ming')).toBe(3);
        expect(next.victoryStatus).toMatchObject({
            winnerFactionId: 'ming',
            condition: 'prestige',
        });
        expect(next.victoryStatus?.detail).toContain('含汉城');
        expect(QidahenDomain.isGameOver?.(next)).toEqual({ winner: '0' });
    });

it('玉匣出土在同控土默特部的归化城和鄂尔多斯部时才给拥有者 +1 威望', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const jadeCasketCardDefId = 'qidahen-atlas05-1625-jade-casket-unearthed';
        const activeJadeCasket = {
            id: 'active-event-qidahen-atlas05-1625-jade-casket-unearthed-ming',
            cardDefId: jadeCasketCardDefId,
            label: '玉匣出土',
            ownerFactionId: 'ming' as const,
            rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[jadeCasketCardDefId],
        };
        const withBothControlledByMing: QidahenCore = {
            ...core,
            activeEventCards: [activeJadeCasket],
            factions: {
                ...core.factions,
                ming: {
                    ...core.factions.ming,
                    vp: 2,
                },
            },
            regions: core.regions.map((region) => (
                region.id === 'city-region-20' || region.id === 'city-region-26'
                    ? {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                    }
                    : region
            )),
        };

        expect(getQidahenEffectiveVpByFaction(withBothControlledByMing, 'ming')).toBe(3);

        const withoutGuihuaControl: QidahenCore = {
            ...withBothControlledByMing,
            regions: withBothControlledByMing.regions.map((region) => (
                region.id === 'city-region-20'
                    ? {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                    }
                    : region
            )),
        };
        expect(getQidahenEffectiveVpByFaction(withoutGuihuaControl, 'ming')).toBe(2);

        const withoutOrdosControl: QidahenCore = {
            ...withBothControlledByMing,
            regions: withBothControlledByMing.regions.map((region) => (
                region.id === 'city-region-26'
                    ? {
                        ...region,
                        controller: 'jin',
                        controlLabel: '后金',
                    }
                    : region
            )),
        };
        expect(getQidahenEffectiveVpByFaction(withoutOrdosControl, 'ming')).toBe(2);
    });

it('玉匣出土正式打出后会按土默特部控制者同步归化并即时计入威望', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const jadeCasketCardDefId = 'qidahen-atlas05-1625-jade-casket-unearthed';
        const sourceCard = factionHandCards(core, 'ming')[0];
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[jadeCasketCardDefId];
        const mappedCore: QidahenCore = {
            ...core,
            selectedRegionId: 'city-region-26',
            guihuaPrestigeMarkerController: null,
            factions: {
                ...core.factions,
                ming: {
                    ...core.factions.ming,
                    vp: 2,
                },
            },
            regions: core.regions.map((region) => (
                region.id === 'city-region-20' || region.id === 'city-region-26'
                    ? {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                    }
                    : region
            )),
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '玉匣出土',
                        status: 'payable' as const,
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: jadeCasketCardDefId,
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(executed.handCards.some((card) => card.id === sourceCard.id)).toBe(false);
        expect(executed.guihuaPrestigeMarkerController).toBe('ming');
        expect(executed.activeEventCards).toEqual(expect.arrayContaining([
            expect.objectContaining({
                cardDefId: jadeCasketCardDefId,
                label: '玉匣出土',
                ownerFactionId: 'ming',
                rulesSummary,
            }),
        ]));
        expect(getQidahenEffectiveVpByFaction(executed, 'ming')).toBe(3);
        expect(executed.victoryStatus).toMatchObject({
            winnerFactionId: 'ming',
            condition: 'prestige',
        });
        expect(executed.lastSeasonSummary?.lines.join(' ')).toContain('玉匣出土作为持续事件留在场上。');
    });

it('玉匣出土正式打出时不会让未控制土默特部的玩家凭空取得归化', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const jadeCasketCardDefId = 'qidahen-atlas05-1625-jade-casket-unearthed';
        const sourceCard = factionHandCards(core, 'ming')[0];
        const rulesSummary = QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[jadeCasketCardDefId];
        const mappedCore: QidahenCore = {
            ...core,
            selectedRegionId: 'city-region-26',
            guihuaPrestigeMarkerController: null,
            factions: {
                ...core.factions,
                ming: {
                    ...core.factions.ming,
                    vp: 2,
                },
            },
            regions: core.regions.map((region) => (
                region.id === 'city-region-26'
                    ? {
                        ...region,
                        controller: 'ming',
                        controlLabel: '大明',
                    }
                    : region.id === 'city-region-20'
                        ? {
                            ...region,
                            controller: 'neutral',
                            controlLabel: '中立',
                        }
                        : region
            )),
            handCards: core.handCards.map((card) => (
                card.id === sourceCard.id
                    ? {
                        ...card,
                        label: '玉匣出土',
                        status: 'payable' as const,
                        cardKind: 'event' as const,
                        armamentId: null,
                        cardDefId: jadeCasketCardDefId,
                        rulesSummary,
                    }
                    : card
            )),
        };

        const previewed = apply(mappedCore, {
            type: QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION,
            playerId: '0',
            payload: { actionId: 'play-event-card', sourceHandCardId: sourceCard.id },
        });
        const executed = apply(previewed, {
            type: QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(executed.activeEventCards).toEqual(expect.arrayContaining([
            expect.objectContaining({
                cardDefId: jadeCasketCardDefId,
                ownerFactionId: 'ming',
            }),
        ]));
        expect(executed.guihuaPrestigeMarkerController).toBe('neutral');
        expect(getQidahenEffectiveVpByFaction(executed, 'ming')).toBe(2);
        expect(executed.victoryStatus).toBeNull();
    });

it.each([
        { targetRegionId: 'city-region-20', targetRegionName: '土默特部' },
        { targetRegionId: 'city-region-26', targetRegionName: '鄂尔多斯部' },
    ])('玉匣出土拥有者战后失去$targetRegionName时会转移给新控制者', ({ targetRegionId, targetRegionName }) => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const jadeCasketCardDefId = 'qidahen-atlas05-1625-jade-casket-unearthed';
        core.currentPlayer = '2';
        core.postBattleSelection = {
            actionId: 'raid',
            battleMode: 'field',
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId,
            targetRegionName,
            targetRuntimeRegionId: targetRegionId,
            committedTroops: 3,
            survivingTroops: 2,
            attackerLosses: 1,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            originalController: 'ming',
            originalControlLabel: '大明',
            title: '战后处理',
            summary: '测试',
            choices: [
                {
                    id: 'occupy',
                    mode: 'occupy',
                    regionId: targetRegionId,
                    plunderPopulation: 0,
                    plunderSource: null,
                    label: `占领${targetRegionName}`,
                    detail: '测试',
                },
            ],
        };
        core.activeEventCards = [
            {
                id: 'active-event-qidahen-atlas05-1625-jade-casket-unearthed-ming',
                cardDefId: jadeCasketCardDefId,
                label: '玉匣出土',
                ownerFactionId: 'ming',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[jadeCasketCardDefId],
            },
        ];
        core.guihuaPrestigeMarkerController = 'ming';
        core.factions.ming.vp = 2;
        core.factions.jin.vp = 2;
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'jin-ningyuan-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-20' || region.id === 'city-region-26') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        expect(getQidahenEffectiveVpByFaction(core, 'ming')).toBe(3);

        const occupied = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '2',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === targetRegionId)).toMatchObject({
            controller: 'jin',
            controlLabel: '后金',
        });
        expect(occupied.activeEventCards).toEqual([
            expect.objectContaining({
                id: 'active-event-qidahen-atlas05-1625-jade-casket-unearthed-jin',
                cardDefId: jadeCasketCardDefId,
                label: '玉匣出土',
                ownerFactionId: 'jin',
            }),
        ]);
        expect(getQidahenEffectiveVpByFaction(occupied, 'ming')).toBe(2);
        expect(getQidahenEffectiveVpByFaction(occupied, 'jin')).toBe(2);
    });

it('玉匣出土不属于鄂尔多斯部原控制者时不会因战后占领误转移', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const jadeCasketCardDefId = 'qidahen-atlas05-1625-jade-casket-unearthed';
        core.currentPlayer = '2';
        core.postBattleSelection = {
            actionId: 'raid',
            battleMode: 'field',
            attackerFactionId: 'jin',
            sourceRegionId: 'city-region-24',
            sourceRegionName: '宁远',
            targetRegionId: 'city-region-26',
            targetRegionName: '鄂尔多斯部',
            targetRuntimeRegionId: 'city-region-26',
            committedTroops: 3,
            survivingTroops: 2,
            attackerLosses: 1,
            movementProfileId: null,
            attackerCasualtyPriority: 'highest-level',
            originalController: 'ming',
            originalControlLabel: '大明',
            title: '战后处理',
            summary: '测试',
            choices: [
                {
                    id: 'occupy',
                    mode: 'occupy',
                    regionId: 'city-region-26',
                    plunderPopulation: 0,
                    plunderSource: null,
                    label: '占领鄂尔多斯部',
                    detail: '测试',
                },
            ],
        };
        core.activeEventCards = [
            {
                id: 'active-event-qidahen-atlas05-1625-jade-casket-unearthed-mongol',
                cardDefId: jadeCasketCardDefId,
                label: '玉匣出土',
                ownerFactionId: 'mongol',
                rulesSummary: QIDAHEN_ATLAS05_ORDINARY_HAND_CARD_RULES_SUMMARY_BY_DEF_ID[jadeCasketCardDefId],
            },
        ];
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 3,
                    specialTroops: [
                        {
                            id: 'jin-ningyuan-infantry-lv2',
                            label: '后金步兵',
                            faction: 'jin',
                            troopKind: 'infantry',
                            count: 3,
                            level: 2,
                        },
                    ],
                };
            }
            if (region.id === 'city-region-26') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        });

        const occupied = apply(core, {
            type: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            playerId: '2',
            payload: { choiceId: 'occupy' },
        });

        expect(occupied.regions.find((region) => region.id === 'city-region-26')).toMatchObject({
            controller: 'jin',
            controlLabel: '后金',
        });
        expect(occupied.activeEventCards).toEqual([
            expect.objectContaining({
                id: 'active-event-qidahen-atlas05-1625-jade-casket-unearthed-mongol',
                cardDefId: jadeCasketCardDefId,
                ownerFactionId: 'mongol',
            }),
        ]);
    });

it('攻下已配置首都时会立刻标记军事胜利', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.currentPlayer = '2';
        core.selectedActionId = 'raid';
        core.selectedRegionId = 'city-region-29';
        core.actionChoices = getActionChoicesForFaction('jin');
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_ACTION,
            playerId: '2',
            payload: { actionId: 'raid' },
        });

        expect(next.victoryStatus).toMatchObject({
            winnerFactionId: 'jin',
            condition: 'military',
        });
        expect(next.victoryStatus?.detail).toContain('汉城');
        expect(next.victoryStatus?.detail).toContain('首都');
        expect(QidahenDomain.isGameOver?.(next)).toEqual({ winner: '2' });
    });

it('新年阶段控制 16 个非朝鲜区域时会标记霸权胜利', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion || region.id === 'xian-xing' || region.id === 'city-region-18' || region.id === 'city-region-29') {
                return region;
            }
            return {
                ...region,
                controller: 'jin',
                controlLabel: '后金',
            };
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });

        expect(next.victoryStatus).toMatchObject({
            winnerFactionId: 'jin',
            condition: 'hegemony',
        });
        expect(next.victoryStatus?.detail).toContain('控制');
        expect(QidahenDomain.isGameOver?.(next)).toEqual({ winner: '2' });
    });
});
