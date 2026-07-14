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

const buildFineSteelSaberBattleCore = (controlsOrdos: boolean): QidahenCore => {
    const core = buildCavalryFirearmBattleCore();
    return {
        ...core,
        factions: {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: core.factions.ming.armaments.map((armament) => (
                    armament.id === 'cavalry-firearm'
                        ? {
                            ...armament,
                            level: 1,
                            sourceCardDefIds: ['qidahen-atlas05-1616-fine-steel-saber'],
                        }
                        : armament
                )),
            },
        },
        regions: core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-26') {
                return {
                    ...region,
                    controller: controlsOrdos ? 'ming' : 'neutral',
                    controlLabel: controlsOrdos ? '大明' : '中立',
                    troops: 0,
                    population: 0,
                    specialTroops: [],
                };
            }
            return region;
        }),
    };
};

const buildCavalryFirearmPriorityBattleCore = (): QidahenCore => {
    const core = buildCavalryFirearmBattleCore();
    return {
        ...core,
        factions: {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: core.factions.ming.armaments.map((armament) => (
                    armament.id === 'cavalry-firearm'
                        ? {
                            ...armament,
                            level: 1,
                            sourceCardDefIds: ['qidahen-atlas05-1639-cavalry-firearm'],
                        }
                        : armament
                )),
            },
        },
        regions: core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
                    troops: 1,
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

const buildRedCoatCannonCityAttackBattleCore = (): QidahenCore => {
    const core = buildArtilleryTechBattleCore();
    return {
        ...core,
        factions: {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: core.factions.ming.armaments.map((armament) => (
                    armament.id === 'artillery-tech'
                        ? {
                            ...armament,
                            level: 1,
                            sourceCardDefIds: ['qidahen-atlas05-1634-red-coat-cannon'],
                        }
                        : armament
                )),
            },
        },
        pendingTargetAction: {
            ...core.pendingTargetAction!,
            title: '攻城待结算',
            battleMode: 'city',
            targetRegionId: 'city-region-25',
            targetRegionName: '山海关',
            targetRuntimeRegionId: 'city-region-25',
            restriction: '测试 · 红衣大炮攻城进攻',
        },
        regions: core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-25') {
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

const buildRedCoatCannonFieldDefenseBattleCore = (): QidahenCore => {
    const core = buildArtilleryTechBattleCore();
    return {
        ...core,
        factions: {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: core.factions.ming.armaments.map((armament) => (
                    armament.id === 'artillery-tech'
                        ? {
                            ...armament,
                            level: 1,
                            sourceCardDefIds: ['qidahen-atlas05-1634-red-coat-cannon'],
                        }
                        : armament
                )),
            },
        },
        pendingTargetAction: {
            ...core.pendingTargetAction!,
            attackerFactionId: 'jin',
            defenderFactionId: 'ming',
            defenderLabel: '大明',
            sourceRegionId: 'city-region-14',
            sourceRegionName: '区域 14',
            targetRegionId: 'city-region-16',
            targetRegionName: '区域 16',
            targetRuntimeRegionId: 'city-region-16',
            restriction: '测试 · 红衣大炮野战防守',
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

const buildSteadfastDefenseBattleCore = (): QidahenCore => {
    const core = buildWesternBastionBattleCore();
    return {
        ...core,
        factions: {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: core.factions.ming.armaments.map((armament) => (
                    armament.id === 'western-bastion'
                        ? { ...armament, level: 0 }
                        : armament
                )),
            },
        },
        pendingTargetAction: {
            ...core.pendingTargetAction!,
            restriction: '测试 · 坚守不屈',
            tacticModifiers: (['artillery', 'cavalry', 'infantry'] as const).map((troopKind) => ({
                id: `test-steadfast-defense-${troopKind}`,
                sourceCardDefId: 'qidahen-atlas05-1635-steadfast-defense',
                label: '坚守不屈',
                side: 'attacker',
                troopKind,
                levelBonus: 0,
                rollValueDivisor: 2,
            })),
        },
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

const buildLinkedMusketsPriorityBattleCore = (): QidahenCore => {
    const core = buildLinkedMusketsBattleCore();
    return {
        ...core,
        factions: {
            ...core.factions,
            ming: {
                ...core.factions.ming,
                armaments: core.factions.ming.armaments.map((armament) => (
                    armament.id === 'long-barreled-musket'
                        ? {
                            ...armament,
                            level: 1,
                            sourceCardDefIds: ['qidahen-atlas05-1646-linked-muskets'],
                        }
                        : armament
                )),
            },
        },
        regions: core.regions.map((region) => {
            if (region.isLogicalRegion) {
                return region;
            }
            if (region.id === 'city-region-14') {
                return {
                    ...region,
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

    it('红衣大炮来源牌会让攻城进攻炮兵每个额外掷 2 颗骰', () => {
        const core = buildRedCoatCannonCityAttackBattleCore();
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

        expect(rolls?.summary).toContain('炮兵 攻4/4/4/4/4/4/4/4=32/守-=0');
        expect(artilleryStage?.attackerRolls).toHaveLength(8);
        expect(artilleryStage?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'artillery', level: 2, dieSides: 8 }),
        ]));
    });

    it('红衣大炮来源牌会让野战防守炮兵每个额外掷 1 颗骰', () => {
        const core = buildRedCoatCannonFieldDefenseBattleCore();
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

        expect(rolls?.summary).toContain('炮兵 攻-=0/守4/4/4/4/4/4=24');
        expect(artilleryStage?.defenderRolls).toHaveLength(6);
        expect(artilleryStage?.defenderRolls).toEqual(expect.arrayContaining([
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

    it('骑兵火器升级后会让野战骑兵阶段先结算并压制对手反击', () => {
        const core = buildCavalryFirearmPriorityBattleCore();
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

        expect(rolls?.summary).toContain('骑兵(骑兵火器指定骑兵先掷) 攻4/4/4/4=16/守-=0');
        expect(cavalryStage?.priorityNote).toBe('骑兵火器指定骑兵先掷');
        expect(cavalryStage?.attackerRolls).toHaveLength(4);
        expect(cavalryStage?.defenderRolls).toHaveLength(0);
        expect(cavalryStage?.attackerDamage).toBe(5);
    });

    it('拒马会让对手骑兵火器骑兵先结算修正失效', () => {
        const core = buildCavalryFirearmPriorityBattleCore();
        core.pendingTargetAction = {
            ...core.pendingTargetAction!,
            tacticModifiers: [
                {
                    id: 'test-cheval-de-frise-cancel-cavalry-firearm',
                    sourceCardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
                    label: '拒马',
                    side: 'defender',
                    troopKind: 'cavalry',
                    levelBonus: 0,
                    cancelEnemyPrioritySourceCardDefIds: ['qidahen-atlas05-1639-cavalry-firearm'],
                },
            ],
        };
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

        expect(rolls?.summary).toContain('骑兵 攻4/4/4/4=16/守4=4');
        expect(cavalryStage?.priorityNote).toBeNull();
        expect(cavalryStage?.attackerRolls).toHaveLength(4);
        expect(cavalryStage?.defenderRolls).toHaveLength(1);
    });

    it('拒马会让对手骑兵按步兵阶段掷骰的修正失效', () => {
        const core = buildCavalryFirearmPriorityBattleCore();
        core.pendingTargetAction = {
            ...core.pendingTargetAction!,
            tacticModifiers: [
                {
                    id: 'test-enemy-cavalry-roll-as-infantry',
                    sourceCardDefId: 'test-enemy-cavalry-roll-as-infantry-source',
                    label: '测试骑兵转步兵阶段',
                    side: 'attacker',
                    troopKind: 'cavalry',
                    levelBonus: 0,
                    rollAsPhase: 'infantry',
                    rollUnitCount: 4,
                },
            ],
        };
        const withoutCheval = createQidahenStructuredBattleRolls(
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
        const infantryStageWithoutCheval = withoutCheval?.stages.find((stage) => stage.phase === 'infantry');

        core.pendingTargetAction = {
            ...core.pendingTargetAction!,
            tacticModifiers: [
                ...core.pendingTargetAction!.tacticModifiers!,
                {
                    id: 'test-cheval-de-frise-cancel-roll-as-phase',
                    sourceCardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
                    label: '拒马',
                    side: 'defender',
                    troopKind: 'cavalry',
                    levelBonus: 0,
                    cancelEnemyRollAsPhaseSourceCardDefIds: ['test-enemy-cavalry-roll-as-infantry-source'],
                },
            ],
        };
        const withCheval = createQidahenStructuredBattleRolls(
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
        const infantryStageWithCheval = withCheval?.stages.find((stage) => stage.phase === 'infantry');

        expect(infantryStageWithoutCheval?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'cavalry' }),
        ]));
        expect(infantryStageWithCheval?.attackerRolls).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ troopKind: 'cavalry' }),
        ]));
    });

    it('精钢马刀来源牌只有控制鄂尔多斯部时才让野战骑兵额外掷 1 颗骰', () => {
        const uncontrolledCore = buildFineSteelSaberBattleCore(false);
        const uncontrolledRolls = createQidahenStructuredBattleRolls(
            uncontrolledCore,
            uncontrolledCore.pendingTargetAction!,
            testRandom,
            {
                defenderHoldCity: false,
                defenderSortieBattle: false,
                defenderCavalryEvasion: false,
                attackerCavalryPlunder: false,
            },
        );
        const uncontrolledCavalryStage = uncontrolledRolls?.stages.find((stage) => stage.phase === 'cavalry');

        expect(uncontrolledRolls?.summary).toContain('骑兵 攻4/4=8/守-=0');
        expect(uncontrolledCavalryStage?.priorityNote).toBeNull();
        expect(uncontrolledCavalryStage?.attackerRolls).toHaveLength(2);

        const controlledCore = buildFineSteelSaberBattleCore(true);
        const controlledRolls = createQidahenStructuredBattleRolls(
            controlledCore,
            controlledCore.pendingTargetAction!,
            testRandom,
            {
                defenderHoldCity: false,
                defenderSortieBattle: false,
                defenderCavalryEvasion: false,
                attackerCavalryPlunder: false,
            },
        );
        const controlledCavalryStage = controlledRolls?.stages.find((stage) => stage.phase === 'cavalry');

        expect(controlledRolls?.summary).toContain('骑兵 攻4/4/4/4=16/守-=0');
        expect(controlledCavalryStage?.priorityNote).toBeNull();
        expect(controlledCavalryStage?.attackerRolls).toHaveLength(4);
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

    it('坚守不屈战斗掷骰层会让攻城攻击方最终骰值除以 2', () => {
        const core = buildSteadfastDefenseBattleCore();
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

        expect(rolls?.summary).toContain('战斗掷骰（城战）：骑步 攻4->2=2/守4/4=8');
        expect(meleeStage?.attackerRolls).toEqual([
            expect.objectContaining({ troopKind: 'infantry', raw: 4, value: 2 }),
        ]);
        expect(meleeStage?.defenderRolls).toHaveLength(2);
        expect(meleeStage?.attackerDamage).toBe(0);
    });

    it('坚守不屈会先计算攻城骑兵减值再除以 2 并向下取整', () => {
        const core = buildSteadfastDefenseBattleCore();
        core.pendingTargetAction = {
            ...core.pendingTargetAction!,
            movementProfileId: 'dispatch-cavalry',
        };
        core.regions = core.regions.map((region) => {
            if (region.id !== 'city-region-14') {
                return region;
            }
            return {
                ...region,
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
        });
        const rolls = createQidahenStructuredBattleRolls(
            core,
            core.pendingTargetAction,
            {
                ...testRandom,
                d: () => 5,
            },
            {
                defenderHoldCity: false,
                defenderSortieBattle: false,
                defenderCavalryEvasion: false,
                attackerCavalryPlunder: false,
            },
        );
        const meleeStage = rolls?.stages.find((stage) => stage.phase === 'melee');

        expect(meleeStage?.attackerRolls).toEqual([
            expect.objectContaining({
                troopKind: 'cavalry',
                raw: 5,
                value: 2,
            }),
        ]);
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

    it('连环火铳升级后会让野战步兵阶段先结算并压制对手反击', () => {
        const core = buildLinkedMusketsPriorityBattleCore();
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

        expect(rolls?.summary).toContain('步兵(连环火铳指定步兵先掷) 攻4/4/4/4=16/守-=0');
        expect(infantryStage?.priorityNote).toBe('连环火铳指定步兵先掷');
        expect(infantryStage?.attackerRolls).toHaveLength(4);
        expect(infantryStage?.defenderRolls).toHaveLength(0);
        expect(infantryStage?.attackerDamage).toBe(5);
    });

    it('拒马会让对手连环火铳步兵先结算修正失效', () => {
        const core = buildLinkedMusketsPriorityBattleCore();
        core.pendingTargetAction = {
            ...core.pendingTargetAction!,
            tacticModifiers: [
                {
                    id: 'test-cheval-de-frise-cancel-linked-muskets',
                    sourceCardDefId: 'qidahen-atlas05-1636-cheval-de-frise',
                    label: '拒马',
                    side: 'defender',
                    troopKind: 'cavalry',
                    levelBonus: 0,
                    cancelEnemyPrioritySourceCardDefIds: ['qidahen-atlas05-1646-linked-muskets'],
                },
            ],
        };
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

        expect(rolls?.summary).toContain('步兵 攻4/4/4/4=16/守4->5=5');
        expect(infantryStage?.priorityNote).toBeNull();
        expect(infantryStage?.attackerRolls).toHaveLength(4);
        expect(infantryStage?.defenderRolls).toHaveLength(1);
    });
});
