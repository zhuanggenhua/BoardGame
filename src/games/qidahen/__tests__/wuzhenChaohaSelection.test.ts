import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { MatchState, RandomFn } from '../../../engine/types';
import { engineConfig } from '../game';
import { QidahenDomain } from '../domain';
import { buildQidahenBattleForceOutcomes } from '../domain/battleForceOutcomes';
import { createQidahenStructuredBattleRolls } from '../domain/battleRollMath';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import { syncQidahenMapTokensFromRegions } from '../domain/mapTokens';
import { syncQidahenRuntimeInteractionState } from '../domain/runtimeInteractions';
import { syncPiecesFromRegions } from '../domain/troopCompat';
import type { QidahenCommand, QidahenCore } from '../domain/types';
import {
    buildQidahenWuzhenChaohaSelection,
    resolveQidahenWuzhenChaohaSelection,
    setQidahenWuzhenChaohaArtilleryTechCount,
} from '../domain/wuzhenChaohaSelection';

const fixedRandom: RandomFn = {
    random: () => 0.5,
    d: () => 4,
    range: (min) => min,
    shuffle: <T>(items: T[]) => [...items],
};

const buildCore = (): QidahenCore => {
    const core = QidahenDomain.setup(['0', '1', '2'], () => 0.5);
    const baseCard = core.handCards.find((card) => card.faction === 'ming')!;
    core.currentPlayer = '0';
    core.turnPhase = 'resolve-pending';
    core.scenarioVote = null;
    core.pendingScenarioCharacterChoices = [];
    core.pendingScenarioArmamentChoices = [];
    core.handCards = [{
        ...baseCard,
        id: 'ming-wuzhen-chaoha',
        label: '乌真超哈',
        faction: 'ming',
        accent: 'ming',
        status: 'payable',
        cardKind: 'tactic',
        armamentId: null,
        cardDefId: 'qidahen-atlas05-1650-wuzhen-chaoha-special',
        rulesSummary: '指定 1 个步兵提前在炮兵阶段攻击；每销毁 1 张《火炮技术》，该部队攻击等级 +1。',
    }];
    core.factions = {
        ...core.factions,
        ming: {
            ...core.factions.ming,
            armaments: core.factions.ming.armaments.map((armament) => (
                armament.id === 'artillery-tech'
                    ? {
                        ...armament,
                        level: 2,
                        sourceCardDefIds: [
                            'qidahen-atlas05-1626-artillery-tech',
                            'qidahen-atlas05-1634-red-coat-cannon',
                        ],
                }
                    : armament
            )),
        },
        jin: {
            ...core.factions.jin,
            characters: core.factions.jin.characters.map((character) => ({
                ...character,
                inPlay: false,
            })),
        },
    };
    core.regions = core.regions.map((region) => {
        if (region.id === 'city-region-16') {
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 2,
                specialTroops: [{
                    id: 'ming-test-infantry',
                    label: '大明步兵',
                    faction: 'ming',
                    originalFaction: 'ming',
                    troopClass: 'regular',
                    troopKind: 'infantry',
                    count: 2,
                    level: 3,
                    pieceIds: ['ming-infantry-1', 'ming-infantry-2'],
                }],
            };
        }
        if (region.id === 'city-region-14') {
            return {
                ...region,
                controller: 'jin',
                controlLabel: '后金',
                troops: 4,
                specialTroops: [{
                    id: 'jin-test-infantry',
                    label: '后金步兵',
                    faction: 'jin',
                    originalFaction: 'jin',
                    troopClass: 'regular',
                    troopKind: 'infantry',
                    count: 4,
                    level: 2,
                    pieceIds: [
                        'jin-infantry-1',
                        'jin-infantry-2',
                        'jin-infantry-3',
                        'jin-infantry-4',
                    ],
                }],
            };
        }
        return region;
    });
    core.pendingTargetAction = {
        actionId: 'wheel-dispatch',
        battleMode: 'field',
        targetKind: 'region',
        title: '野战待结算',
        attackerFactionId: 'ming',
        sourceRegionId: 'city-region-16',
        sourceRegionName: '东江',
        targetRegionId: 'city-region-14',
        targetRegionName: '辽东',
        targetRuntimeRegionId: 'city-region-14',
        defenderFactionId: 'jin',
        defenderLabel: '后金',
        restriction: '测试乌真超哈',
        battleWidth: 4,
        boundaryUnitCap: null,
        sourceAvailableTroops: 2,
        committedTroops: 2,
        movementProfileId: 'infantry',
        attackPressure: 2,
        attackBoundaryType: 'plain',
        resolutionHint: '东江 → 辽东',
        defenderPayCost: null,
    };
    core.pieces = syncPiecesFromRegions(core.regions);
    core.mapTokens = syncQidahenMapTokensFromRegions(core.regions, core.pieces);
    return core;
};

const stateOf = (core: QidahenCore): MatchState<QidahenCore> => (
    syncQidahenRuntimeInteractionState({
        core,
        sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
    })
);

const execute = (core: QidahenCore, command: QidahenCommand): QidahenCore => {
    const result = executePipeline(
        { domain: engineConfig.domain, systems: engineConfig.systems as any },
        stateOf(core),
        command,
        fixedRandom,
        ['0', '1', '2'],
    );
    expect(result.success).toBe(true);
    return result.state.core;
};

describe('乌真超哈选择', () => {
    it('只把实际参战步兵作为地图直选目标，并只计算真实《火炮技术》来源牌', () => {
        const core = buildCore();
        const selection = buildQidahenWuzhenChaohaSelection(core, 'ming-wuzhen-chaoha');

        expect(selection?.choices).toHaveLength(2);
        expect(selection?.choices.every((choice) => choice.sourceRegionId === 'city-region-16')).toBe(true);
        expect(selection?.maxDestroyedArtilleryTechCount).toBe(1);
        expect(selection?.destroyedArtilleryTechCount).toBe(0);
    });

    it('确认兵牌后才消耗手牌，销毁火炮技术但保留红衣大炮来源', () => {
        const core = buildCore();
        core.wuzhenChaohaSelection = buildQidahenWuzhenChaohaSelection(core, 'ming-wuzhen-chaoha');
        const selectedCount = setQidahenWuzhenChaohaArtilleryTechCount(core, 1);
        const choice = selectedCount.wuzhenChaohaSelection!.choices[0]!;
        const resolved = resolveQidahenWuzhenChaohaSelection(selectedCount, choice.id, 100);
        const artilleryTech = resolved.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech');

        expect(resolved.wuzhenChaohaSelection).toBeNull();
        expect(resolved.handCards.some((card) => card.id === 'ming-wuzhen-chaoha')).toBe(false);
        expect(resolved.discardPileCount).toBe(core.discardPileCount + 1);
        expect(artilleryTech).toMatchObject({
            level: 1,
            sourceCardDefIds: ['qidahen-atlas05-1634-red-coat-cannon'],
        });
        expect(resolved.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1650-wuzhen-chaoha-special',
                targetPieceId: choice.pieceId,
                targetTokenId: choice.tokenId,
                rollAsPhase: 'artillery',
                rollUnitCount: 1,
                levelBonus: 1,
            }),
        ]);
    });

    it('正式命令链会先建立选择态，再按数量和地图兵牌完成结算', () => {
        const core = buildCore();
        const selecting = execute(core, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'ming-wuzhen-chaoha' },
        });

        expect(selecting.wuzhenChaohaSelection?.choices).toHaveLength(2);
        expect(selecting.handCards.some((card) => card.id === 'ming-wuzhen-chaoha')).toBe(true);

        const counted = execute(selecting, {
            type: QIDAHEN_COMMANDS.SET_WUZHEN_CHAOHA_ARTILLERY_TECH_COUNT,
            playerId: '0',
            payload: { count: 1 },
        });
        const choiceId = counted.wuzhenChaohaSelection!.choices[0]!.id;
        const resolved = execute(counted, {
            type: QIDAHEN_COMMANDS.RESOLVE_WUZHEN_CHAOHA,
            playerId: '0',
            payload: { choiceId },
        });

        expect(resolved.wuzhenChaohaSelection).toBeNull();
        expect(resolved.handCards.some((card) => card.id === 'ming-wuzhen-chaoha')).toBe(false);
        expect(resolved.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                targetTokenId: choiceId,
                levelBonus: 1,
                rollAsPhase: 'artillery',
            }),
        ]);
    });

    it('指定步兵提前在炮兵阶段攻击且不会在普通步兵阶段重复攻击', () => {
        const core = buildCore();
        core.regions = core.regions.map((region) => (
            region.id === 'city-region-16'
                ? {
                    ...region,
                    specialTroops: region.specialTroops.map((stack) => ({
                        ...stack,
                        level: stack.pieceIds?.includes('ming-infantry-1') ? 3 : 2,
                    })),
                }
                : region
        ));
        core.pieces = syncPiecesFromRegions(core.regions);
        core.mapTokens = syncQidahenMapTokensFromRegions(core.regions, core.pieces);
        core.wuzhenChaohaSelection = buildQidahenWuzhenChaohaSelection(core, 'ming-wuzhen-chaoha');
        const selectedCount = setQidahenWuzhenChaohaArtilleryTechCount(core, 1);
        const choice = selectedCount.wuzhenChaohaSelection!.choices.find((candidate) => (
            candidate.pieceId === 'ming-infantry-1'
        ))!;
        const resolved = resolveQidahenWuzhenChaohaSelection(selectedCount, choice.id, 101);
        const battleRolls = createQidahenStructuredBattleRolls(
            resolved,
            resolved.pendingTargetAction!,
            fixedRandom,
            {
                defenderSortieBattle: false,
                defenderHoldCity: false,
                defenderCavalryEvasion: false,
                attackerCavalryPlunder: false,
            },
        );
        const artilleryStage = battleRolls.stages.find((stage) => stage.phase === 'artillery');
        const infantryStage = battleRolls.stages.find((stage) => stage.phase === 'infantry');

        expect(artilleryStage?.attackerRolls).toEqual([
            expect.objectContaining({
                troopKind: 'infantry',
                level: 4,
            }),
        ]);
        expect(infantryStage?.attackerRolls).toEqual([
            expect.objectContaining({
                troopKind: 'infantry',
                level: 3,
            }),
        ]);
    });

    it('指定步兵提前攻击时仍会叠加其他全体步兵等级加成', () => {
        const core = buildCore();
        core.regions = core.regions.map((region) => (
            region.id === 'city-region-16'
                ? {
                    ...region,
                    specialTroops: region.specialTroops.map((stack) => ({
                        ...stack,
                        level: 2,
                    })),
                }
                : region
        ));
        core.pieces = syncPiecesFromRegions(core.regions);
        core.mapTokens = syncQidahenMapTokensFromRegions(core.regions, core.pieces);
        core.pendingTargetAction = {
            ...core.pendingTargetAction!,
            tacticModifiers: [{
                id: 'all-infantry-level-bonus',
                sourceCardDefId: 'test-all-infantry-level-bonus',
                label: '全体步兵等级加成',
                side: 'attacker',
                troopKind: 'infantry',
                levelBonus: 1,
            }],
        };
        core.wuzhenChaohaSelection = buildQidahenWuzhenChaohaSelection(core, 'ming-wuzhen-chaoha');
        const selectedCount = setQidahenWuzhenChaohaArtilleryTechCount(core, 1);
        const choice = selectedCount.wuzhenChaohaSelection!.choices.find((candidate) => (
            candidate.pieceId === 'ming-infantry-1'
        ))!;
        const resolved = resolveQidahenWuzhenChaohaSelection(selectedCount, choice.id, 102);
        const battleRolls = createQidahenStructuredBattleRolls(
            resolved,
            resolved.pendingTargetAction!,
            fixedRandom,
            {
                defenderSortieBattle: false,
                defenderHoldCity: false,
                defenderCavalryEvasion: false,
                attackerCavalryPlunder: false,
            },
        );
        const artilleryStage = battleRolls.stages.find((stage) => stage.phase === 'artillery');
        const infantryStage = battleRolls.stages.find((stage) => stage.phase === 'infantry');

        expect(artilleryStage?.attackerRolls).toEqual([
            expect.objectContaining({
                troopKind: 'infantry',
                level: 4,
            }),
        ]);
        expect(infantryStage?.attackerRolls).toEqual([
            expect.objectContaining({
                troopKind: 'infantry',
                level: 3,
            }),
        ]);
    });

    it('指定步兵提前攻击后仍进入常规战损并可以实际承受伤害', () => {
        const core = buildCore();
        core.regions = core.regions.map((region) => (
            region.id === 'city-region-16'
                ? {
                    ...region,
                    specialTroops: [
                        {
                            id: 'ming-wuzhen-target-infantry',
                            label: '大明乌真超哈目标步兵',
                            faction: 'ming',
                            originalFaction: 'ming',
                            troopClass: 'regular',
                            troopKind: 'infantry',
                            count: 1,
                            level: 4,
                            pieceIds: ['ming-wuzhen-target-piece'],
                        },
                        {
                            id: 'ming-other-infantry',
                            label: '大明普通步兵',
                            faction: 'ming',
                            originalFaction: 'ming',
                            troopClass: 'regular',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                            pieceIds: ['ming-other-infantry-piece'],
                        },
                    ],
                }
                : region
        ));
        core.pieces = syncPiecesFromRegions(core.regions);
        core.mapTokens = syncQidahenMapTokensFromRegions(core.regions, core.pieces);
        core.wuzhenChaohaSelection = buildQidahenWuzhenChaohaSelection(core, 'ming-wuzhen-chaoha');
        const choice = core.wuzhenChaohaSelection!.choices.find((candidate) => (
            candidate.pieceId === 'ming-wuzhen-target-piece'
        ))!;
        const resolved = resolveQidahenWuzhenChaohaSelection(core, choice.id, 103);
        const outcomes = buildQidahenBattleForceOutcomes(
            resolved,
            resolved.pendingTargetAction!,
            1,
            'highest-level',
        );
        const survivingPieceIds = outcomes.flatMap((outcome) => (
            outcome.survivingSpecialTroops.flatMap((stack) => stack.pieceIds ?? [])
        ));

        expect(outcomes).toEqual([
            expect.objectContaining({
                attackerLosses: 1,
                survivingTroops: 1,
            }),
        ]);
        expect(survivingPieceIds).not.toContain('ming-wuzhen-target-piece');
        expect(survivingPieceIds).toContain('ming-other-infantry-piece');
    });

    it('蒙古使用时同样可直选参战步兵并通过销毁火炮技术提高提前攻击等级', () => {
        const core = buildCore();
        core.handCards = core.handCards.map((card) => ({
            ...card,
            id: 'mongol-wuzhen-chaoha',
            faction: 'mongol',
            accent: 'mongol',
        }));
        core.factions = {
            ...core.factions,
            mongol: {
                ...core.factions.mongol,
                armaments: core.factions.mongol.armaments.map((armament) => (
                    armament.id === 'artillery-tech'
                        ? {
                            ...armament,
                            level: 1,
                            sourceCardDefIds: ['qidahen-atlas05-1626-artillery-tech'],
                        }
                        : armament
                )),
            },
        };
        core.regions = core.regions.map((region) => (
            region.id === 'city-region-16'
                ? {
                    ...region,
                    controller: 'mongol',
                    controlLabel: '蒙古',
                    specialTroops: [{
                        id: 'mongol-test-infantry',
                        label: '蒙古步兵',
                        faction: 'mongol',
                        originalFaction: 'mongol',
                        troopClass: 'regular',
                        troopKind: 'infantry',
                        count: 2,
                        level: 2,
                        pieceIds: ['mongol-infantry-1', 'mongol-infantry-2'],
                    }],
                }
                : region
        ));
        core.pendingTargetAction = {
            ...core.pendingTargetAction!,
            attackerFactionId: 'mongol',
        };
        core.pieces = syncPiecesFromRegions(core.regions);
        core.mapTokens = syncQidahenMapTokensFromRegions(core.regions, core.pieces);

        core.wuzhenChaohaSelection = buildQidahenWuzhenChaohaSelection(core, 'mongol-wuzhen-chaoha');
        expect(core.wuzhenChaohaSelection?.choices).toHaveLength(2);
        expect(core.wuzhenChaohaSelection?.maxDestroyedArtilleryTechCount).toBe(1);

        const selectedCount = setQidahenWuzhenChaohaArtilleryTechCount(core, 1);
        const choice = selectedCount.wuzhenChaohaSelection!.choices.find((candidate) => (
            candidate.pieceId === 'mongol-infantry-1'
        ))!;
        const resolved = resolveQidahenWuzhenChaohaSelection(selectedCount, choice.id, 104);
        const battleRolls = createQidahenStructuredBattleRolls(
            resolved,
            resolved.pendingTargetAction!,
            fixedRandom,
            {
                defenderSortieBattle: false,
                defenderHoldCity: false,
                defenderCavalryEvasion: false,
                attackerCavalryPlunder: false,
            },
        );
        const artilleryStage = battleRolls.stages.find((stage) => stage.phase === 'artillery');
        const infantryStage = battleRolls.stages.find((stage) => stage.phase === 'infantry');
        const artilleryTech = resolved.factions.mongol.armaments.find((armament) => (
            armament.id === 'artillery-tech'
        ));

        expect(artilleryTech).toMatchObject({
            level: 0,
            sourceCardDefIds: [],
        });
        expect(artilleryStage?.attackerRolls).toEqual([
            expect.objectContaining({
                troopKind: 'infantry',
                level: 3,
            }),
        ]);
        expect(infantryStage?.attackerRolls).toEqual([
            expect.objectContaining({
                troopKind: 'infantry',
                level: 2,
            }),
        ]);
    });
});
