import { describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../engine/types';
import { QidahenDomain } from '../domain';
import { createQidahenStructuredBattleRolls } from '../domain/battleRollMath';
import type { QidahenCore } from '../domain/types';

const testRandom: RandomFn = {
    random: () => 0.5,
    d: () => 4,
    range: (min) => min,
    shuffle: <T>(array: T[]) => [...array],
};

const buildCavalryFirearmBattleCore = (): QidahenCore => {
    const core = QidahenDomain.setup(['0', '1', '2'], testRandom);
    return {
        ...core,
        factions: {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: core.factions.ming.armaments.map((armament) => (
                    armament.id === 'cavalry-firearm'
                        ? { ...armament, level: 1 }
                        : armament
                )),
            },
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => (
                    character.id === 'jin-nurhaci' || character.id === 'jin-eidu'
                        ? { ...character, inPlay: false }
                        : character
                )),
            },
        },
        pendingTargetAction: {
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
            restriction: '测试 · 骑兵火器',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-cavalry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        },
        regions: core.regions.map((region) => {
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
        }),
    };
};

const buildArtilleryTechBattleCore = (): QidahenCore => {
    const core = QidahenDomain.setup(['0', '1', '2'], testRandom);
    return {
        ...core,
        factions: {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: core.factions.ming.armaments.map((armament) => (
                    armament.id === 'artillery-tech'
                        ? { ...armament, level: 1 }
                        : armament
                )),
                characters: core.factions.ming.characters.map((character) => (
                    character.id === 'ming-sun-yuanhua' || character.id === 'ming-yuan-chonghuan'
                        ? { ...character, inPlay: false }
                        : character
                )),
            },
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => (
                    character.id === 'jin-nurhaci' || character.id === 'jin-eidu'
                        ? { ...character, inPlay: false }
                        : character
                )),
            },
        },
        pendingTargetAction: {
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
            restriction: '测试 · 火炮技术',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        },
        regions: core.regions.map((region) => {
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
                            id: 'ming-artillery-lv2',
                            label: '大明炮兵',
                            faction: 'ming',
                            troopKind: 'artillery',
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
        }),
    };
};

const buildWesternBastionBattleCore = (): QidahenCore => {
    const core = QidahenDomain.setup(['0', '1', '2'], testRandom);
    return {
        ...core,
        factions: {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: core.factions.ming.armaments.map((armament) => (
                    armament.id === 'western-bastion'
                        ? { ...armament, level: 1 }
                        : armament
                )),
            },
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => (
                    character.id === 'jin-nurhaci'
                        ? { ...character, inPlay: false }
                        : character
                )),
            },
        },
        pendingTargetAction: {
            actionId: 'raid',
            title: '攻城作战待结算',
            attackerFactionId: 'jin',
            battleMode: 'city',
            sourceRegionId: 'city-region-14',
            sourceRegionName: '区域 14',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            restriction: '测试 · 西式棱堡',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 1,
            committedTroops: 1,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 1,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        },
        regions: core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    controller: 'jin',
                    controlLabel: '后金',
                    troops: 1,
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
            if (region.id === 'city-region-25') {
                return {
                    ...region,
                    controller: 'ming',
                    controlLabel: '大明',
                    troops: 2,
                    population: 0,
                    cityState: {
                        troops: 2,
                        population: 0,
                        specialTroops: [
                            {
                                id: 'ming-city-infantry-lv2',
                                label: '大明城内步兵',
                                faction: 'ming',
                                troopKind: 'infantry',
                                count: 2,
                                level: 2,
                            },
                        ],
                    },
                    specialTroops: [],
                };
            }
            return region;
        }),
    };
};

const buildLinkedMusketsBattleCore = (): QidahenCore => {
    const core = QidahenDomain.setup(['0', '1', '2'], testRandom);
    return {
        ...core,
        factions: {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: core.factions.ming.armaments.map((armament) => (
                    armament.id === 'long-barreled-musket'
                        ? { ...armament, level: 1 }
                        : armament
                )),
            },
            jin: {
                ...core.factions.jin,
                characters: core.factions.jin.characters.map((character) => (
                    character.id === 'jin-nurhaci' || character.id === 'jin-eidu'
                        ? { ...character, inPlay: false }
                        : character
                )),
            },
        },
        pendingTargetAction: {
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
            restriction: '测试 · 连环火铳',
            battleWidth: 3,
            boundaryUnitCap: null,
            sourceAvailableTroops: 2,
            committedTroops: 2,
            movementProfileId: 'dispatch-infantry',
            attackPressure: 2,
            attackBoundaryType: 'plain',
            resolutionHint: '测试',
            defenderPayCost: null,
        },
        regions: core.regions.map((region) => {
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
        }),
    };
};

describe('七大恨战斗军备效果', () => {
    it('火炮技术升级后会让每个炮兵额外掷 1 颗骰', () => {
        const core = buildArtilleryTechBattleCore();
        const rolls = createQidahenStructuredBattleRolls(
            core,
            core.pendingTargetAction!,
            testRandom,
            {
                defenderHoldCity: false,
                defenderSortieBattle: false,
                defenderCavalryEvasion: false,
                attackerCavalryPlunder: false,
            },
        );
        const artilleryStage = rolls?.stages.find((stage) => stage.phase === 'artillery');

        expect(rolls?.summary).toContain('炮兵 攻4/4/4/4=16/守-=0');
        expect(artilleryStage?.attackerRolls).toHaveLength(4);
        expect(artilleryStage?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'artillery', level: 2, dieSides: 8 }),
        ]));
    });

    it('骑兵火器升级后会让野战骑兵阶段每个骑兵额外掷 1 颗骰', () => {
        const core = buildCavalryFirearmBattleCore();
        const rolls = createQidahenStructuredBattleRolls(
            core,
            core.pendingTargetAction!,
            testRandom,
            {
                defenderHoldCity: false,
                defenderSortieBattle: false,
                defenderCavalryEvasion: false,
                attackerCavalryPlunder: false,
            },
        );
        const cavalryStage = rolls?.stages.find((stage) => stage.phase === 'cavalry');

        expect(rolls?.summary).toContain('骑兵 攻4/4/4/4=16/守-=0');
        expect(cavalryStage?.attackerRolls).toHaveLength(4);
        expect(cavalryStage?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'cavalry', level: 2, dieSides: 8 }),
        ]));
    });

    it('西式棱堡升级后会让城战守方每个部队投 2 颗骰', () => {
        const core = buildWesternBastionBattleCore();
        const rolls = createQidahenStructuredBattleRolls(
            core,
            core.pendingTargetAction!,
            testRandom,
            {
                defenderHoldCity: false,
                defenderSortieBattle: false,
                defenderCavalryEvasion: false,
                attackerCavalryPlunder: false,
            },
        );
        const meleeStage = rolls?.stages.find((stage) => stage.phase === 'melee');

        expect(rolls?.summary).toContain('战斗掷骰（城战）：骑步');
        expect(rolls?.summary).toContain('守4/4/4/4=16');
        expect(meleeStage?.defenderRolls).toHaveLength(4);
        expect(meleeStage?.defenderRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
        ]));
    });

    it('连环火铳升级后会让野战步兵阶段每个步兵额外掷 1 颗骰', () => {
        const core = buildLinkedMusketsBattleCore();
        const rolls = createQidahenStructuredBattleRolls(
            core,
            core.pendingTargetAction!,
            testRandom,
            {
                defenderHoldCity: false,
                defenderSortieBattle: false,
                defenderCavalryEvasion: false,
                attackerCavalryPlunder: false,
            },
        );
        const infantryStage = rolls?.stages.find((stage) => stage.phase === 'infantry');

        expect(rolls?.summary).toContain('战斗掷骰（野战）');
        expect(rolls?.summary).toContain('步兵 攻4/4/4/4=16');
        expect(infantryStage?.attackerRolls).toHaveLength(4);
        expect(infantryStage?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'infantry', level: 2, dieSides: 8 }),
        ]));
    });
});
