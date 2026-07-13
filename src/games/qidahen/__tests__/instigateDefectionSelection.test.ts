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
import type { QidahenCommand, QidahenCore, QidahenEvent } from '../domain/types';

const random: RandomFn = {
    random: () => 0.5,
    d: () => 1,
    range: (min) => min,
    shuffle: <T>(items: T[]) => [...items],
};

const buildCore = (): QidahenCore => {
    const core = createInitialCore(['0', '1', '2']);
    const baseCard = core.handCards.find((card) => card.faction === 'ming')!;
    core.currentPlayer = '0';
    core.turnPhase = 'resolve-pending';
    core.scenarioVote = null;
    core.pendingScenarioCharacterChoices = [];
    core.pendingScenarioArmamentChoices = [];
    core.handCards = [{
        ...baseCard,
        id: 'ming-instigate-defection-alt',
        label: '策反',
        faction: 'ming',
        accent: 'ming',
        status: 'payable',
        cardKind: 'tactic',
        armamentId: null,
        cardDefId: 'qidahen-atlas05-1629-instigate-defection-alt',
        rulesSummary: '敌方次级部队参战时使用，使 1 个敌方次级部队改为己方阵营并参战；战后按牌面回归。',
    }];
    core.regions = core.regions.map((region) => {
        if (region.id === 'city-region-16') {
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 2,
                specialTroops: [{
                    id: 'ming-regular-infantry',
                    label: '大明正规步兵',
                    faction: 'ming',
                    originalFaction: 'ming',
                    troopClass: 'regular',
                    troopKind: 'infantry',
                    count: 2,
                    level: 2,
                    pieceIds: ['ming-regular-infantry-1', 'ming-regular-infantry-2'],
                }],
            };
        }
        if (region.id === 'city-region-14') {
            return {
                ...region,
                controller: 'jin',
                controlLabel: '后金',
                troops: 3,
                specialTroops: [
                    {
                        id: 'jin-secondary-cavalry',
                        label: '后金次级骑兵',
                        faction: 'jin',
                        originalFaction: 'jin',
                        troopClass: 'secondary',
                        troopKind: 'cavalry',
                        count: 1,
                        level: 3,
                        pieceIds: ['jin-secondary-cavalry-1'],
                    },
                    {
                        id: 'jin-regular-cavalry',
                        label: '后金正规骑兵',
                        faction: 'jin',
                        originalFaction: 'jin',
                        troopClass: 'regular',
                        troopKind: 'cavalry',
                        count: 1,
                        level: 2,
                        pieceIds: ['jin-regular-cavalry-1'],
                    },
                    {
                        id: 'jin-secondary-infantry',
                        label: '后金次级步兵',
                        faction: 'jin',
                        originalFaction: 'jin',
                        troopClass: 'secondary',
                        troopKind: 'infantry',
                        count: 1,
                        level: 1,
                        pieceIds: ['jin-secondary-infantry-1'],
                    },
                ],
            };
        }
        return region;
    });
    core.pendingTargetAction = {
        actionId: 'wheel-dispatch',
        battleMode: 'field',
        targetKind: 'region',
        title: '察哈尔野战待结算',
        attackerFactionId: 'ming',
        sourceRegionId: 'city-region-16',
        sourceRegionName: '克什克腾部',
        attackerPositionRegionId: null,
        targetRegionId: 'city-region-14',
        targetRegionName: '察哈尔',
        targetRuntimeRegionId: 'city-region-14',
        defenderFactionId: 'jin',
        defenderLabel: '后金',
        restriction: '测试次级部队版策反',
        battleWidth: 2,
        boundaryUnitCap: null,
        sourceAvailableTroops: 2,
        committedTroops: 2,
        movementProfileId: 'infantry',
        attackPressure: 2,
        attackBoundaryType: 'plain',
        resolutionHint: '克什克腾部 → 察哈尔',
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

const executeResult = (core: QidahenCore, command: QidahenCommand) => {
    const result = executePipeline(
        { domain: engineConfig.domain, systems: engineConfig.systems as any },
        stateOf(core),
        command,
        random,
        ['0', '1', '2'],
    );
    expect(result.success).toBe(true);
    return result;
};

const execute = (core: QidahenCore, command: QidahenCommand): QidahenCore => (
    executeResult(core, command).state.core
);

const playCard = (core: QidahenCore): QidahenCore => execute(core, {
    type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
    playerId: '0',
    payload: { cardId: 'ming-instigate-defection-alt' },
});

describe('七大恨次级部队版策反', () => {
    it('只把实际参战的敌方次级部队作为地图直选目标', () => {
        const core = buildCore();
        expect(QidahenDomain.validate(stateOf(core), {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'ming-instigate-defection-alt' },
        })).toEqual({ valid: true });

        const selecting = playCard(core);

        expect(selecting.instigateDefectionSelection?.choices).toEqual([
            expect.objectContaining({
                pieceId: 'jin-secondary-cavalry-1',
                troopKind: 'cavalry',
            }),
        ]);
        expect(selecting.instigateDefectionSelection?.choices).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ pieceId: 'jin-secondary-infantry-1' }),
            expect.objectContaining({ pieceId: 'jin-regular-cavalry-1' }),
        ]));
        expect(selecting.handCards.some((card) => card.id === 'ming-instigate-defection-alt')).toBe(true);
        expect(selecting.discardPileCount).toBe(core.discardPileCount);
    });

    it('取消目标选择会保留手牌和原战斗状态', () => {
        const core = buildCore();
        const selecting = playCard(core);
        const cancelled = execute(selecting, {
            type: QIDAHEN_COMMANDS.CANCEL_INSTIGATE_DEFECTION,
            playerId: '0',
            payload: {},
        });

        expect(cancelled.instigateDefectionSelection).toBeNull();
        expect(cancelled.handCards.some((card) => card.id === 'ming-instigate-defection-alt')).toBe(true);
        expect(cancelled.discardPileCount).toBe(core.discardPileCount);
        expect(cancelled.pendingTargetAction).toEqual(core.pendingTargetAction);
    });

    it('选择策反目标期间会阻止轮盘等其它行动', () => {
        const selecting = playCard(buildCore());
        const moveId = selecting.wheelMoveChoices[0]?.id;
        expect(moveId).toBeDefined();

        expect(QidahenDomain.validate({
            core: selecting,
            sys: createInitialSystemState(['0', '1', '2'], engineConfig.systems as any),
        }, {
            type: QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE,
            playerId: '0',
            payload: { moveId: moveId! },
        })).toEqual({ valid: false, error: 'wheelAlreadyUsed' });
    });

    it('点击目标后只转侧该次级部队，正规同兵种仍由守方参战且原始阵营不改', () => {
        const core = buildCore();
        const selecting = playCard(core);
        const choiceId = selecting.instigateDefectionSelection!.choices[0]!.id;
        const targeted = execute(selecting, {
            type: QIDAHEN_COMMANDS.RESOLVE_INSTIGATE_DEFECTION,
            playerId: '0',
            payload: { choiceId },
        });

        expect(targeted.instigateDefectionSelection).toBeNull();
        expect(targeted.handCards.some((card) => card.id === 'ming-instigate-defection-alt')).toBe(false);
        expect(targeted.discardPileCount).toBe(core.discardPileCount + 1);
        expect(targeted.pendingTargetAction?.tacticModifiers).toEqual([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1629-instigate-defection-alt',
                troopKind: 'cavalry',
                targetTroopClass: 'secondary',
                targetPieceId: 'jin-secondary-cavalry-1',
                convertEnemyTroopCount: 1,
            }),
        ]);
        expect(targeted.regions.find((region) => region.id === 'city-region-14')?.specialTroops).toEqual(
            core.regions.find((region) => region.id === 'city-region-14')?.specialTroops,
        );

        const resolutionResult = executeResult(targeted, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        });
        const resolved = resolutionResult.state.core;
        const pendingActionResolvedEvent = resolutionResult.events.find((event) => (
            event.type === 'PENDING_ACTION_RESOLVED'
        )) as Extract<QidahenEvent, { type: 'PENDING_ACTION_RESOLVED' }> | undefined;
        const cavalryStage = pendingActionResolvedEvent?.payload.battleRolls?.stages.find((stage) => (
            stage.phase === 'cavalry'
        ));

        expect(cavalryStage?.attackerRolls).toEqual([
            expect.objectContaining({ troopKind: 'cavalry', level: 3 }),
        ]);
        expect(cavalryStage?.defenderRolls).toEqual([
            expect.objectContaining({ troopKind: 'cavalry', level: 2 }),
        ]);
        expect(core.pieces.find((piece) => piece.id === 'jin-secondary-cavalry-1')).toMatchObject({
            faction: 'jin',
            originalFaction: 'jin',
            troopClass: 'secondary',
        });
        expect(resolved.regions
            .find((region) => region.id === 'city-region-14')
            ?.specialTroops.find((stack) => stack.pieceIds?.includes('jin-secondary-cavalry-1')))
            .toMatchObject({
                faction: 'jin',
                originalFaction: 'jin',
                troopClass: 'secondary',
            });
    });
});
