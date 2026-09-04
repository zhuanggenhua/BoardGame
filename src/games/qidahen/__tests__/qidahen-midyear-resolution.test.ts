import { describe, expect, it } from 'vitest';import { QidahenDomain } from '../domain';

import { QIDAHEN_COMMANDS } from '../domain/commands';import { random, apply, getInternalDispatchSelection, factionHandCards } from './helpers/paymentSelectionHarness';

describe('七大恨年中结算', () => {
it('轮盘进入年中时会结算土地税赋并留下摘要', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.regions = core.regions.map((region) => {
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    troops: 1,
                    population: 4,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.actionWheelPosition).toBe('wheel-midyear');
        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-28');
        expect(next.currentYear).toBe('天命四年 1619');
        expect(next.factions.ming.handCount).toBe(20);
        expect(next.factions.ming.drawPileCount).toBe(15);
        expect(next.factions.mongol.handCount).toBe(9);
        expect(next.factions.mongol.drawPileCount).toBe(18);
        expect(factionHandCards(next, 'mongol')).toHaveLength(8);
        expect(next.lastSeasonSummary?.title).toBe('年中结算');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('大明 因土地税赋获得 12 张手牌');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('蒙古 因土地税赋获得 1 张手牌');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('大明因江南漕运获得 5 张手牌');
        expect(next.actionLog[0]?.text).toContain('轮盘停在年中');
    });

it('围城区域在年中不会提供土地税赋', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
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
                    population: 4,
                    siegeState: {
                        attackerFactionId: 'jin',
                        attackerTroops: 2,
                        attackerSpecialTroops: [],
                        sourceRegionId: 'city-region-28',
                    },
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.factions.ming.handCount).toBe(8);
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('大明 本次年中未从土地税赋获得手牌');
    });

it('非围城城市保留在 cityState 的城内人口与守军也会参与年中土地税赋判断', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
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
                    cityState: {
                        troops: 1,
                        population: 2,
                        specialTroops: [],
                    },
                    siegeState: null,
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.factions.ming.handCount).toBe(9);
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('大明 因土地税赋获得 1 张手牌');
    });

it('旱灾标记区域在年中土地税赋中人口视为 0', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 1,
                    population: 4,
                    eventMarkers: [{
                        id: 'drought-marker-song-jin',
                        kind: 'drought',
                        label: '旱灾标记',
                        sourceCardDefId: 'qidahen-atlas05-1608-mongol-drought',
                        imageSrc: 'qidahen/markers/drought-marker',
                    }],
                };
            }
            return {
                ...region,
                population: region.troops,
            };
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.factions.ming.handCount).toBe(8);
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('大明 本次年中未从土地税赋获得手牌');
    });

it('轮盘进入年中时会处理并移除已有战败标记', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                defeatMarkers: 2,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong' || character.id === 'ming-wang-huazhen',
                })),
            },
            mongol: {
                ...core.factions.mongol,
                defeatMarkers: 1,
            },
            jin: {
                ...core.factions.jin,
                defeatMarkers: 1,
            },
        };

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.actionWheelPosition).toBe('wheel-midyear');
        expect(next.turnPhase).toBe('internal-dispatch-choice');
        expect(next.selectedRegionId).toBe('city-region-28');
        expect(getInternalDispatchSelection(next)?.sourceRegionId).toBe('city-region-28');
        expect(next.factions.ming.defeatMarkers).toBe(0);
        expect(next.factions.mongol.defeatMarkers).toBe(0);
        expect(next.factions.jin.defeatMarkers).toBe(0);
        const summary = next.lastSeasonSummary?.lines.join(' | ') ?? '';
        expect(summary).toContain('年中战败标记与人物判定');
        expect(summary).toContain('人物额外判定：毛文龙(d10) 掷 9→8：下野，回到大明人物牌堆');
        expect(summary).toContain('王化贞(d10) 掷 3→2：无效果');
        expect(summary).toContain('林丹·乎图克图(d12) 掷 10：无效果');
        expect(summary).toContain('额亦都(d10) 掷 10→9：无效果');
        expect(summary).toContain('大明处理 2 个战败标记，掷骰 4/6');
        expect(summary).toContain('王化贞(2) 掷 4→3');
        expect(summary).toContain('王化贞(2) 掷 6→5');
        expect(summary).toContain('蒙古处理 1 个战败标记，掷骰 1');
        expect(summary).toContain('林丹·乎图克图(1) 掷 1 离场');
        expect(summary).toContain('后金处理 1 个战败标记，掷骰 4');
        expect(summary).toContain('努尔哈赤(1) 掷 4');
        expect(summary).toContain('标记已移除');
        expect(next.factions.ming.characters.find((character) => character.id === 'ming-mao-wenlong')?.inPlay).toBe(false);
        expect(next.factions.ming.characters.every((character) => character.defeatMarkers === 0)).toBe(true);
        expect(next.factions.mongol.characters.find((character) => character.id === 'mongol-lindan-hutuktu')?.inPlay).toBe(false);
        expect(next.factions.mongol.characters.every((character) => character.defeatMarkers === 0)).toBe(true);
        expect(next.factions.jin.characters.every((character) => character.defeatMarkers === 0)).toBe(true);
    });

it('林丹·乎图克图在场时会让其他人物的年中人物判定点数 -1，但不影响自己', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                defeatMarkers: 1,
                characters: core.factions.ming.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'ming-mao-wenlong',
                })),
            },
            mongol: {
                ...core.factions.mongol,
                defeatMarkers: 1,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-lindan-hutuktu',
                })),
            },
        };

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-28');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('毛文龙(d10) 掷 9→8：下野，回到大明人物牌堆');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('林丹·乎图克图(d12) 掷 10：无效果');
        expect(next.factions.ming.characters.find((character) => character.id === 'ming-mao-wenlong')?.inPlay).toBe(false);
    });

it('代善在场时会让后金人物免受林丹·乎图克图的年中人物判定减值影响', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                defeatMarkers: 1,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-lindan-hutuktu',
                })),
            },
            jin: {
                ...core.factions.jin,
                defeatMarkers: 1,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-daisan' || character.id === 'jin-eidu',
                })),
            },
        };

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-28');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('额亦都(2) 掷 4');
        expect(next.lastSeasonSummary?.lines.join(' | ')).not.toContain('额亦都(2) 掷 4→3');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('林丹·乎图克图(1) 掷 1 离场');
    });

it('范文程在场时会在年中按后金控制的汉人区域数量额外抽牌', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                handCount: 0,
                drawPileCount: 10,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-fan-wencheng',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.id === 'city-region-27' || region.id === 'city-region-32') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            if (region.id === 'jinzhou') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'neutral',
                    diplomacyMarkerFaction: 'jin',
                    diplomacyMarkerSide: 'friendly',
                    controlLabel: '后金友好',
                };
            }
            return region;
        });

        const baseline = apply({
            ...core,
            factions: {
                ...core.factions,
                jin: {
                    ...core.factions.jin,
                    characters: core.factions.jin.characters.map((character) => ({
                        ...character,
                        inPlay: false,
                    })),
                },
            },
        }, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.actionWheelPosition).toBe('wheel-midyear');
        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-28');
        expect(next.factions.jin.handCount - baseline.factions.jin.handCount).toBe(4);
        expect(next.factions.jin.drawPileCount).toBe(6);
        expect(baseline.factions.jin.drawPileCount).toBe(10);
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('后金因范文程控制 2 个汉人区域，额外抽 4 张手牌');
        expect(next.lastSeasonSummary?.lines.join(' | ')).not.toContain('控制 3 个汉人区域');
    });

it('阿敏在年中人物额外判定命中叛逃时会转入大明人物牌堆', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-amin',
                })),
            },
        };

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });

        expect(next.turnPhase).toBe('action-window');
        expect(next.selectedRegionId).toBe('city-region-28');
        expect(next.lastSeasonSummary?.lines.join(' | ')).toContain('阿敏(d10) 掷 2→1：叛逃，进入大明人物牌堆');
        expect(next.factions.jin.characters.some((character) => character.id === 'jin-amin')).toBe(false);
        expect(next.factions.ming.characters.find((character) => character.id === 'jin-amin')).toMatchObject({
            id: 'jin-amin',
            faction: 'ming',
            inPlay: false,
            removedFromGame: false,
            defeatMarkers: 0,
        });
    });

it('阿敏年中叛逃进大明人物牌堆后，跨到下一次新年纪年启用时不会丢失或回流后金', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-hire';
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-amin',
                })),
            },
        };

        const afterMidyear = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-2-one-opponent' },
        });
        const newYearReady = {
            ...afterMidyear,
            wheelActionUsed: false,
            factionActionUsed: false,
            selectedActionId: null,
            payment: null,
        };
        const pendingNewYear = apply(newYearReady, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        const settled = apply(pendingNewYear, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        const allAminCopies = [settled.factions.ming, settled.factions.mongol, settled.factions.jin]
            .flatMap((faction) => faction.characters)
            .filter((character) => character.id === 'jin-amin');
        const mingAmin = settled.factions.ming.characters.find((character) => character.id === 'jin-amin');

        expect(settled.currentYearIndex).toBe(afterMidyear.currentYearIndex + 1);
        expect(settled.factions.jin.characters.some((character) => character.id === 'jin-amin')).toBe(false);
        expect(allAminCopies).toHaveLength(1);
        expect(mingAmin).toMatchObject({
            id: 'jin-amin',
            faction: 'ming',
            inPlay: false,
            removedFromGame: false,
            defeatMarkers: 0,
        });
    });
});
