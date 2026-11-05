import { describe, expect, it } from 'vitest';
import {
    findQidahenReachableRuntimeRegions,
    QidahenDomain,
} from '../domain';
import { reduceQidahenTurnResolutionFact } from '../domain/turnResolutionFacts';
import { getQidahenDirectedPassageRule } from '../domain/movement';
import { syncQidahenRuntimeInteractionState } from '../domain/runtimeInteractions';
import type { QidahenCommand, QidahenCore, QidahenEvent } from '../domain/types';
import type { MatchState, RandomFn } from '../../../engine/types';

const random: RandomFn = { random: () => 0.5, d: () => 1, range: min => min, shuffle: items => [...items] };

function stateOf(core: QidahenCore): MatchState<QidahenCore> {
    return syncQidahenRuntimeInteractionState({
        core,
        sys: {} as MatchState<QidahenCore>['sys'],
    });
}

function getDirectedTravelCostIfUsable(
    core: QidahenCore,
    fromId: string,
    toId: string,
    factionId: 'ming' | 'mongol' | 'jin',
) {
    const passage = getQidahenDirectedPassageRule(core, fromId, toId, factionId);
    return passage?.usable ? passage.travelCost : null;
}

function isReachableWithinBudget(
    core: QidahenCore,
    fromId: string,
    toId: string,
    factionId: 'ming' | 'mongol' | 'jin',
    movementBudget: number,
) {
    return findQidahenReachableRuntimeRegions(core, fromId, factionId, movementBudget)
        .some((item) => item.regionId === toId);
}

describe('七大恨移动规则 helper', () => {
    it('未围城时，连接城市的水路不会作为正式可用相邻边', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);

        expect(getDirectedTravelCostIfUsable(core, 'city-region-22', 'song-jin', 'ming')).toBeNull();
        expect(getDirectedTravelCostIfUsable(core, 'city-region-22', 'song-jin', 'jin')).toBeNull();
        expect(getQidahenDirectedPassageRule(core, 'city-region-22', 'song-jin', 'ming')?.unitCap).toBe(2);
        expect(isReachableWithinBudget(core, 'city-region-22', 'song-jin', 'ming', 2)).toBe(false);
        expect(isReachableWithinBudget(core, 'city-region-22', 'song-jin', 'jin', 2)).toBe(false);
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

        expect(getDirectedTravelCostIfUsable(core, 'city-region-22', 'song-jin', 'ming')).toBe(1);
        expect(getDirectedTravelCostIfUsable(core, 'city-region-22', 'song-jin', 'jin')).toBeNull();
        expect(isReachableWithinBudget(core, 'city-region-22', 'song-jin', 'ming', 2)).toBe(true);
        expect(isReachableWithinBudget(core, 'city-region-22', 'song-jin', 'jin', 2)).toBe(false);
    });

    it.each([["outer-wall","city-region-26","city-region-31"],["outer-wall","city-region-26","city-region-1"],["outer-wall","city-region-21","city-region-1"],["outer-wall","city-region-21","xuan-fu"],["outer-wall","duoyan","xuan-fu"],["outer-wall","duoyan","city-region-28-jizhen"],["inner-wall","city-region-1","city-region-30"],["inner-wall","city-region-1","city-region-27"],["inner-wall","xuan-fu","city-region-27"],["inner-wall","xuan-fu","city-region-28"],["inner-wall","xuan-fu","city-region-28-jizhen"]] as const)('%s 的 %s→%s 完好凸1平3，仅所属墙破败变平原3，维护可恢复', (owner, from, to) => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        const maintained = getQidahenDirectedPassageRule(core, from, to, 'ming');
        expect(maintained).toMatchObject({ boundaryType: 'wall-convex', travelCost: 1, battleWidth: 1 });
        expect(getQidahenDirectedPassageRule(core, to, from, 'ming')).toMatchObject({ boundaryType: 'wall-flat', battleWidth: 3 });
        const applyMaintenanceFact = (state: QidahenCore, id: string, maintain: boolean) => reduceQidahenTurnResolutionFact(state, {
            type: 'TURN_RESOLUTION_APPLIED', timestamp: 100,
            payload: { frameId: 'movement-maintenance', factionId: 'ming', fromStep: 'maintenance', fact: { kind: 'maintenance', fortificationId: id, cardIds: [], maintain } },
        });
        // 这里只核维护事实后的边界投影；合法支付另由正式年度管线验证。
        const other = applyMaintenanceFact(core, owner === 'outer-wall' ? 'inner-wall' : 'outer-wall', false);
        expect(getQidahenDirectedPassageRule(other, from, to, 'ming')).toMatchObject({ boundaryType: 'wall-convex', battleWidth: 1 });
        const ruined = applyMaintenanceFact(core, owner, false);
        for (const [left, right] of [[from, to], [to, from]]) expect(getQidahenDirectedPassageRule(ruined, left, right, 'ming')).toMatchObject({ boundaryType: 'plain', travelCost: 1, battleWidth: 3 });
        const repaired = applyMaintenanceFact(ruined, owner, true);
        expect(getQidahenDirectedPassageRule(repaired, from, to, 'ming')).toEqual(maintained);
        expect(getQidahenDirectedPassageRule(core, from, to, 'ming')).toEqual(maintained);
    });
    it('土默特与宣府之间隔着喀喇沁，不生成伪邻接；土默特与宁远也不相邻', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        expect(getQidahenDirectedPassageRule(core, 'city-region-20', 'xuan-fu', 'ming')).toBeNull();
        expect(getQidahenDirectedPassageRule(core, 'city-region-20', 'city-region-24', 'ming')).toBeNull();
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
            totalTravelCost: 1,
            usesCoast: true,
        });
        expect(bySea.find((item) => item.regionId === 'city-region-32')).toMatchObject({
            totalTravelCost: 2,
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
            if (region.id === 'city-region-28-jizhen') {
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
        expect(reachable.find((item) => item.regionId === 'city-region-28-jizhen')).toMatchObject({
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
            if (region.id === 'city-region-17') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
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

        const reachable = findQidahenReachableRuntimeRegions(core, 'city-region-10', 'mongol', 1);
        expect(reachable.find((item) => item.regionId === 'city-region-19')).toMatchObject({
            totalTravelCost: 2,
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

        const reachable = findQidahenReachableRuntimeRegions(core, 'city-region-10', 'jin', 1);
        expect(reachable.find((item) => item.regionId === 'city-region-19')).toMatchObject({
            totalTravelCost: 2,
        });
    });

    it('骏马育种升级后只让骑兵移动档位 +1，不影响步兵调度档位', () => {
        const core = QidahenDomain.setup(['0', '1', '2'], random);
        core.factions = {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: core.factions.ming.armaments.map((armament) => (
                    armament.id === 'horse-breeding'
                        ? { ...armament, level: 1 }
                        : armament
                )),
            },
        };
        core.regions = core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-10' || region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
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

        const cavalryReachable = findQidahenReachableRuntimeRegions(core, 'city-region-10', 'ming', 1, {
            movementProfileId: 'dispatch-cavalry',
        });
        const infantryReachable = findQidahenReachableRuntimeRegions(core, 'city-region-10', 'ming', 1, {
            movementProfileId: 'dispatch-infantry',
        });

        expect(cavalryReachable.find((item) => item.regionId === 'city-region-19')).toMatchObject({
            totalTravelCost: 2,
        });
        expect(infantryReachable.some((item) => item.regionId === 'city-region-19')).toBe(false);
    });
});
