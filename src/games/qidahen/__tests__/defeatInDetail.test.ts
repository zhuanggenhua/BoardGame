import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { MatchState, RandomFn } from '../../../engine/types';
import { engineConfig } from '../game';
import { QidahenDomain } from '../domain';
import { QIDAHEN_COMMANDS } from '../domain/commands';
import { createInitialCore } from '../domain/initialCoreSetup';
import { syncQidahenMapTokensFromRegions } from '../domain/mapTokens';
import { syncQidahenRuntimeInteractionState } from '../domain/runtimeInteractions';
import { syncPiecesFromRegions } from '../domain/troopCompat';
import type {
    QidahenCommand,
    QidahenCore,
    QidahenFactionId,
} from '../domain/types';

const random: RandomFn = {
    random: () => 0.5,
    d: () => 4,
    range: (min) => min,
    shuffle: <T>(items: T[]) => [...items],
};

const playerIdByFaction: Record<QidahenFactionId, string> = {
    ming: '0',
    mongol: '1',
    jin: '2',
};

const sourceRegionIds = [
    'city-region-28-jizhen',
    'city-region-28',
] as const;
const targetRegionId = 'city-region-25';

interface BuildDefeatInDetailCoreOptions {
    defenderFaction?: QidahenFactionId;
    sourceCount?: 1 | 2;
    sourceTroops?: [number, number];
    sourceLevels?: [number, number];
    defenderTroops?: number;
    defenderLevel?: number;
}

const buildPieceIds = (prefix: string, count: number): string[] => (
    Array.from({ length: count }, (_, index) => `${prefix}-piece-${index + 1}`)
);

const buildDefeatInDetailCore = ({
    defenderFaction = 'jin',
    sourceCount = 2,
    sourceTroops = [2, 1],
    sourceLevels = [2, 2],
    defenderTroops = 2,
    defenderLevel = 2,
}: BuildDefeatInDetailCoreOptions = {}): QidahenCore => {
    const attackerFaction: QidahenFactionId = defenderFaction === 'jin' ? 'ming' : 'jin';
    const core = createInitialCore(['0', '1', '2']);
    const baseCard = core.handCards.find((card) => card.faction === defenderFaction)!;
    const activeSourceRegionIds = sourceRegionIds.slice(0, sourceCount);
    core.currentPlayer = playerIdByFaction[attackerFaction];
    core.turnPhase = 'resolve-pending';
    core.handCards = [{
        ...baseCard,
        id: `${defenderFaction}-defeat-in-detail`,
        label: '各个击破',
        faction: defenderFaction,
        accent: defenderFaction,
        status: 'payable',
        cardKind: 'event',
        armamentId: null,
        cardDefId: 'qidahen-atlas05-1601-defeat-in-detail',
        rulesSummary: '只能在遭到攻击时打出；敌方来自不同边界的部队需分别进行完整战斗；由防守方决定结算顺序；大明、蒙古使用无效果。',
    }];
    core.regions = core.regions.map((region) => {
        const sourceIndex = activeSourceRegionIds.indexOf(region.id as typeof activeSourceRegionIds[number]);
        if (sourceIndex >= 0) {
            const troopCount = sourceTroops[sourceIndex] ?? 0;
            const sourceName = sourceIndex === 0 ? '蓟镇' : '顺天';
            const stackId = `${attackerFaction}-source-${sourceIndex + 1}`;
            return {
                ...region,
                name: sourceName,
                controller: attackerFaction,
                controlLabel: core.factions[attackerFaction].name,
                troops: troopCount,
                specialTroops: troopCount > 0
                    ? [{
                        id: stackId,
                        label: `${sourceName}部队`,
                        faction: attackerFaction,
                        troopKind: 'infantry' as const,
                        count: troopCount,
                        level: sourceLevels[sourceIndex] ?? 1,
                        pieceIds: buildPieceIds(stackId, troopCount),
                    }]
                    : [],
            };
        }
        if (region.id === targetRegionId) {
            const stackId = `${defenderFaction}-target`;
            return {
                ...region,
                name: '山海关',
                controller: defenderFaction,
                controlLabel: core.factions[defenderFaction].name,
                troops: defenderTroops,
                specialTroops: defenderTroops > 0
                    ? [{
                        id: stackId,
                        label: '山海关守军',
                        faction: defenderFaction,
                        troopKind: 'infantry' as const,
                        count: defenderTroops,
                        level: defenderLevel,
                        pieceIds: buildPieceIds(stackId, defenderTroops),
                    }]
                    : [],
            };
        }
        return region;
    });
    const forceCommitments = activeSourceRegionIds.map((sourceRegionId, sourceIndex) => {
        const troopCount = sourceTroops[sourceIndex] ?? 0;
        const sourceName = sourceIndex === 0 ? '蓟镇' : '顺天';
        return {
            id: `force-${sourceRegionId}`,
            sourceRegionId,
            sourceRegionName: sourceName,
            sourceAvailableTroops: troopCount,
            committedTroops: troopCount,
            movementProfileId: 'infantry',
            battleWidth: 4,
            boundaryUnitCap: null,
            attackBoundaryType: 'plain',
            selectedSpecialPieceIds: buildPieceIds(`${attackerFaction}-source-${sourceIndex + 1}`, troopCount),
            selectedGenericTroops: 0,
        };
    });
    core.pendingTargetAction = {
        actionId: 'wheel-dispatch',
        battleMode: 'field',
        targetKind: 'region',
        title: '山海关野战待结算',
        attackerFactionId: attackerFaction,
        sourceRegionId: forceCommitments[0]!.sourceRegionId,
        sourceRegionName: forceCommitments[0]!.sourceRegionName,
        attackerPositionRegionId: null,
        targetRegionId,
        targetRegionName: '山海关',
        targetRuntimeRegionId: targetRegionId,
        defenderFactionId: defenderFaction,
        defenderLabel: core.factions[defenderFaction].name,
        restriction: '测试各个击破',
        battleWidth: 4,
        boundaryUnitCap: null,
        sourceAvailableTroops: forceCommitments.reduce((sum, commitment) => sum + commitment.sourceAvailableTroops, 0),
        committedTroops: forceCommitments.reduce((sum, commitment) => sum + commitment.committedTroops, 0),
        movementProfileId: 'infantry',
        attackPressure: forceCommitments.reduce((sum, commitment) => sum + commitment.committedTroops, 0),
        attackBoundaryType: 'plain',
        resolutionHint: `${forceCommitments.map((commitment) => commitment.sourceRegionName).join('、')} → 山海关`,
        defenderPayCost: null,
        forceCommitments,
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

const execute = (
    core: QidahenCore,
    command: QidahenCommand,
): QidahenCore => {
    const result = executePipeline(
        { domain: engineConfig.domain, systems: engineConfig.systems as any },
        stateOf(core),
        command,
        random,
        ['0', '1', '2'],
    );
    expect(result.success).toBe(true);
    return result.state.core;
};

const playDefeatInDetail = (
    core: QidahenCore,
    factionId: QidahenFactionId = 'jin',
): QidahenCore => execute(core, {
    type: QIDAHEN_COMMANDS.PLAY_BATTLE_RESPONSE_EVENT_CARD,
    playerId: playerIdByFaction[factionId],
    payload: { cardId: `${factionId}-defeat-in-detail` },
});

describe('七大恨各个击破', () => {
    it('后金只有一个进攻来源时不能打出', () => {
        const core = buildDefeatInDetailCore({ sourceCount: 1 });

        expect(QidahenDomain.validate(stateOf(core), {
            type: QIDAHEN_COMMANDS.PLAY_BATTLE_RESPONSE_EVENT_CARD,
            playerId: '2',
            payload: { cardId: 'jin-defeat-in-detail' },
        })).toEqual({
            valid: false,
            error: 'unknownPaymentCard',
        });
    });

    it('多来源进攻时只有防守方可以打出', () => {
        const core = buildDefeatInDetailCore();
        const command: QidahenCommand = {
            type: QIDAHEN_COMMANDS.PLAY_BATTLE_RESPONSE_EVENT_CARD,
            playerId: '2',
            payload: { cardId: 'jin-defeat-in-detail' },
        };

        expect(QidahenDomain.validate(stateOf(core), command)).toEqual({ valid: true });
        expect(QidahenDomain.validate(stateOf(core), {
            ...command,
            playerId: '0',
        })).toEqual({
            valid: false,
            error: 'notCurrentPlayer',
        });
    });

    it('打出后才消耗手牌，并进入防守方地图选序态', () => {
        const core = buildDefeatInDetailCore();
        const discardPileCount = core.discardPileCount;
        const selecting = playDefeatInDetail(core);

        expect(selecting.handCards.some((card) => card.id === 'jin-defeat-in-detail')).toBe(false);
        expect(selecting.discardPileCount).toBe(discardPileCount + 1);
        expect(selecting.pendingTargetAction?.defeatInDetail).toMatchObject({
            phase: 'select-order',
            orderedSourceRegionIds: [],
            remainingSourceRegionIds: [...sourceRegionIds],
        });
        expect(QidahenDomain.validate(stateOf(selecting), {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        })).toEqual({
            valid: false,
            error: 'unknownAction',
        });
        expect(QidahenDomain.validate(stateOf(selecting), {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: targetRegionId },
        })).toEqual({
            valid: false,
            error: 'unknownRegion',
        });
    });

    it('选择第二来源优先后会自动补齐顺序，并只激活该来源兵力', () => {
        const selecting = playDefeatInDetail(buildDefeatInDetailCore());
        const ordered = execute(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: sourceRegionIds[1] },
        });

        expect(ordered.pendingTargetAction).toMatchObject({
            sourceRegionId: sourceRegionIds[1],
            sourceRegionName: '顺天',
            committedTroops: 1,
            defeatInDetail: {
                phase: 'resolving',
                orderedSourceRegionIds: [sourceRegionIds[1], sourceRegionIds[0]],
                currentSourceIndex: 0,
                currentSourceRegionId: sourceRegionIds[1],
            },
        });
        expect(ordered.pendingTargetAction?.forceCommitments).toEqual([
            expect.objectContaining({
                sourceRegionId: sourceRegionIds[1],
                committedTroops: 1,
            }),
        ]);
    });

    it('第一来源战败后会推进到下一来源，并只扣除已交战来源兵牌', () => {
        const core = buildDefeatInDetailCore({
            sourceTroops: [2, 1],
            sourceLevels: [4, 1],
            defenderTroops: 4,
            defenderLevel: 4,
        });
        const selecting = playDefeatInDetail(core);
        const ordered = execute(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: sourceRegionIds[1] },
        });
        const resolved = execute(ordered, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.pendingTargetAction).toMatchObject({
            sourceRegionId: sourceRegionIds[0],
            committedTroops: 2,
            defeatInDetail: {
                phase: 'resolving',
                currentSourceIndex: 1,
                currentSourceRegionId: sourceRegionIds[0],
            },
        });
        expect(resolved.regions.find((region) => region.id === sourceRegionIds[1])?.troops).toBe(0);
        expect(resolved.regions.find((region) => region.id === sourceRegionIds[0])?.troops).toBe(2);
    });

    it('第一来源获胜时未交战来源以零损失并入战后来源组', () => {
        const core = buildDefeatInDetailCore({
            sourceTroops: [4, 1],
            sourceLevels: [4, 1],
            defenderTroops: 1,
            defenderLevel: 1,
        });
        const selecting = playDefeatInDetail(core);
        const ordered = execute(selecting, {
            type: QIDAHEN_COMMANDS.SELECT_REGION,
            playerId: '2',
            payload: { regionId: sourceRegionIds[0] },
        });
        const resolved = execute(ordered, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });

        expect(resolved.pendingTargetAction).toBeNull();
        expect(resolved.postBattleSelection?.forceCommitments?.map((commitment) => commitment.sourceRegionId)).toEqual([
            sourceRegionIds[0],
            sourceRegionIds[1],
        ]);
        expect(resolved.postBattleSelection?.forceOutcomes).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceRegionId: sourceRegionIds[1],
                attackerLosses: 0,
                survivingTroops: 1,
            }),
        ]));
    });

    it.each([
        ['ming' as const, '0'],
        ['mongol' as const, '1'],
    ])('%s 打出后无效果但仍正常消耗手牌', (defenderFaction, defenderPlayerId) => {
        const core = buildDefeatInDetailCore({
            defenderFaction,
            sourceCount: 1,
        });
        const pendingBefore = core.pendingTargetAction;
        const discardPileCount = core.discardPileCount;
        const resolved = execute(core, {
            type: QIDAHEN_COMMANDS.PLAY_BATTLE_RESPONSE_EVENT_CARD,
            playerId: defenderPlayerId,
            payload: { cardId: `${defenderFaction}-defeat-in-detail` },
        });

        expect(resolved.handCards.some((card) => card.id === `${defenderFaction}-defeat-in-detail`)).toBe(false);
        expect(resolved.discardPileCount).toBe(discardPileCount + 1);
        expect(resolved.pendingTargetAction).toEqual(pendingBefore);
        expect(resolved.lastSeasonSummary?.lines.join(' ')).toContain('使用无效果');
    });
});
