import { describe, expect, it } from 'vitest';
import {
    findQidahenReachableRuntimeRegions,
    getQidahenAdjacentRuntimeRegions,
    getQidahenDirectedPassageRule,
    getQidahenDirectedTravelCost,
    QidahenDomain,
} from '../domain';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import type { QidahenCommand, QidahenCore, QidahenEvent } from '../domain/types';
import type { MatchState } from '../../../engine/types';

const random = () => 0.5;

function stateOf(core: QidahenCore): MatchState<QidahenCore> {
    return { core, sys: {} as MatchState<QidahenCore>['sys'] };
}

function apply(core: QidahenCore, command: QidahenCommand): QidahenCore {
    const validation = QidahenDomain.validate(stateOf(core), command);
    expect(validation.valid).toBe(true);
    return QidahenDomain.execute(stateOf(core), command).reduce(
        (next, event) => QidahenDomain.reduce(next, event as QidahenEvent),
        core,
    );
}

describe('七大恨移动规则 helper', () => {
    it('未围城时，连接城市的水路不会作为正式可用相邻边', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(getQidahenDirectedTravelCost(core, 'city-region-22', 'song-jin', 'ming')).toBeNull();
        expect(getQidahenDirectedTravelCost(core, 'city-region-22', 'song-jin', 'jin')).toBeNull();
        expect(getQidahenDirectedPassageRule(core, 'city-region-22', 'song-jin', 'ming')?.unitCap).toBe(2);
        expect(getQidahenAdjacentRuntimeRegions(core, 'city-region-22', 'ming').some((item) => item.regionId === 'song-jin')).toBe(false);
        expect(getQidahenAdjacentRuntimeRegions(core, 'city-region-22', 'jin').some((item) => item.regionId === 'song-jin')).toBe(false);
    });

    it('围城会重新开放连接城市的水路，但仍只对大明开放', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion || region.id !== 'city-region-22') {
                return region;
            }
            return {
                ...region,
                siegeState: {
                    attackerFactionId: 'jin',
                    attackerTroops: 2,
                    attackerSpecialTroops: [],
                    sourceRegionId: 'city-region-25',
                },
            };
        });

        expect(getQidahenDirectedTravelCost(core, 'city-region-22', 'song-jin', 'ming')).toBe(2);
        expect(getQidahenDirectedTravelCost(core, 'city-region-22', 'song-jin', 'jin')).toBeNull();
        expect(getQidahenAdjacentRuntimeRegions(core, 'city-region-22', 'ming').some((item) => item.regionId === 'song-jin')).toBe(true);
        expect(getQidahenAdjacentRuntimeRegions(core, 'city-region-22', 'jin').some((item) => item.regionId === 'song-jin')).toBe(false);
    });

    it('防线破败后会把运行时边界与移动代价一起刷新到最新规则', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.actionWheelPosition = 'wheel-midyear';
        expect(getQidahenDirectedPassageRule(core, 'jinzhou', 'city-region-25', 'ming')).toMatchObject({
            boundaryType: 'city',
            travelCost: 2,
            battleWidth: 1,
            usable: true,
        });
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'xian-xing') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                };
            }
            if (region.id === 'city-region-18' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            if (region.id === 'song-jin') {
                return {
                    ...region,
                    troops: 3,
                    population: 1,
                };
            }
            return region;
        });

        const next = apply(core, {
            type: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: 'move-1-free' },
        });
        expect(next.fortificationMaintenanceSelection).not.toBeNull();

        const settled = apply(next, {
            type: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            playerId: '0',
            payload: { choiceId: 'skip-all' },
        });

        expect(getQidahenDirectedPassageRule(settled, 'city-region-20', 'city-region-24', 'ming')).toMatchObject({
            boundaryType: 'plain',
            travelCost: 1,
            battleWidth: 3,
            usable: true,
        });
        expect(getQidahenDirectedPassageRule(settled, 'jinzhou', 'city-region-25', 'ming')).toMatchObject({
            boundaryType: 'plain',
            travelCost: 1,
            battleWidth: 3,
            usable: true,
        });
    });

    it('可达搜索会消费 travelCost，并阻止水路后再接陆路扩展', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'song-jin' || region.id === 'city-region-22' || region.id === 'city-region-29') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    siegeState: region.id === 'city-region-22'
                        ? {
                            attackerFactionId: 'jin',
                            attackerTroops: 2,
                            attackerSpecialTroops: [],
                            sourceRegionId: 'city-region-25',
                        }
                        : region.siegeState,
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            return region;
        });

        const bySea = findQidahenReachableRuntimeRegions(core, 'song-jin', 'ming', 4);
        expect(bySea.find((item) => item.regionId === 'city-region-22')).toMatchObject({
            totalTravelCost: 2,
            usesCoast: true,
        });
        expect(bySea.find((item) => item.regionId === 'city-region-32')).toMatchObject({
            totalTravelCost: 4,
            usesCoast: true,
        });
    });

    it('友好控制标记会把中立区视为可通行友方区', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-24') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                };
            }
            if (region.id === 'city-region-28') {
                return {
                    ...region,
                    controller: 'neutral',
                    diplomacyMarkerFaction: 'ming',
                    diplomacyMarkerSide: 'friendly',
                    controlLabel: '大明友好',
                };
            }
            if (region.id === 'city-region-27') {
                return {
                    ...region,
                    controller: 'neutral',
                    controlLabel: '中立',
                };
            }
            return region;
        });

        const reachable = findQidahenReachableRuntimeRegions(core, 'city-region-24', 'ming', 4);
        expect(reachable.find((item) => item.regionId === 'city-region-28')).toMatchObject({
            stopsOnEntry: false,
        });
        expect(reachable.find((item) => item.regionId === 'city-region-27')).toMatchObject({
            totalTravelCost: 2,
        });
    });

    it('奥巴台吉在场时会让蒙古部队移动力 +1，从而可达原本超出 1 格预算的区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                characters: core.factions.mongol.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'mongol-oba-taiji',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-10' || region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            return region;
        });

        const reachable = findQidahenReachableRuntimeRegions(core, 'city-region-10', 'mongol', 4);
        expect(reachable.find((item) => item.regionId === 'city-region-19')).toMatchObject({
            totalTravelCost: 5,
        });
    });

    it('莽古尔泰在场时会让后金部队移动力 +1，从而可达原本超出 1 格预算的区域', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.factions = {
            ...core.factions,
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => ({
                    ...character,
                    inPlay: character.id === 'jin-manggultai',
                })),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-10' || region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                };
            }
            if (region.id === 'city-region-19') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                };
            }
            return region;
        });

        const reachable = findQidahenReachableRuntimeRegions(core, 'city-region-10', 'jin', 4);
        expect(reachable.find((item) => item.regionId === 'city-region-19')).toMatchObject({
            totalTravelCost: 5,
        });
    });
});
