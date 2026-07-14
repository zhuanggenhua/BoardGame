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
} from '../domain/types';

const random: RandomFn = {
    random: () => 0.5,
    d: () => 4,
    range: (min) => min,
    shuffle: <T>(items: T[]) => [...items],
};

const buildPincerCore = (): QidahenCore => {
    const core = createInitialCore(['0', '1', '2']);
    const baseCard = core.handCards.find((card) => card.faction === 'ming')!;
    core.currentPlayer = '0';
    core.turnPhase = 'resolve-pending';
    core.handCards = [{
        ...baseCard,
        id: 'ming-pincer-advance',
        label: '分进合击',
        faction: 'ming',
        accent: 'ming',
        status: 'payable',
        cardKind: 'tactic',
        armamentId: null,
        cardDefId: 'qidahen-atlas05-1632-pincer-advance',
        rulesSummary: '只能于野战时使用；可以再移动最多 2 个没有参战的部队进入战斗；进入战场的部队仍受行动距离限制。',
    }];
    core.regions = core.regions.map((region) => {
        if (region.id === 'city-region-28-jizhen' || region.id === 'city-region-28') {
            const isJizhen = region.id === 'city-region-28-jizhen';
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: isJizhen ? 3 : 2,
                specialTroops: isJizhen
                    ? [
                        {
                            id: 'jizhen-elite',
                            label: '蓟镇三级步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 3,
                            pieceIds: ['jizhen-elite-1'],
                        },
                        {
                            id: 'jizhen-veteran',
                            label: '蓟镇二级步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 2,
                            pieceIds: ['jizhen-veteran-2'],
                        },
                        {
                            id: 'jizhen-selected',
                            label: '蓟镇一级步兵',
                            faction: 'ming',
                            troopKind: 'infantry',
                            count: 1,
                            level: 1,
                            pieceIds: ['jizhen-selected-3'],
                        },
                    ]
                    : [{
                        id: 'shuntian-cavalry',
                        label: '顺天骑兵',
                        faction: 'ming',
                        troopKind: 'cavalry',
                        count: 1,
                        level: 1,
                        pieceIds: ['shuntian-cavalry-1'],
                    }],
            };
        }
        if (region.id === 'city-region-25') {
            return {
                ...region,
                controller: 'jin',
                controlLabel: '后金',
                troops: 2,
                specialTroops: [],
            };
        }
        return region;
    });
    core.pendingTargetAction = {
        actionId: 'wheel-dispatch',
        battleMode: 'field',
        targetKind: 'region',
        title: '山海关野战待结算',
        attackerFactionId: 'ming',
        sourceRegionId: 'city-region-28-jizhen',
        sourceRegionName: '蓟镇',
        attackerPositionRegionId: null,
        targetRegionId: 'city-region-25',
        targetRegionName: '山海关',
        targetRuntimeRegionId: 'city-region-25',
        defenderFactionId: 'jin',
        defenderLabel: '后金',
        restriction: '测试分进合击',
        battleWidth: 3,
        boundaryUnitCap: null,
        sourceAvailableTroops: 3,
        committedTroops: 1,
        movementProfileId: 'infantry',
        attackPressure: 1,
        attackBoundaryType: 'plain',
        resolutionHint: '蓟镇 → 山海关',
        defenderPayCost: null,
        forceCommitments: [{
            id: 'force-city-region-28-jizhen',
            sourceRegionId: 'city-region-28-jizhen',
            sourceRegionName: '蓟镇',
            sourceAvailableTroops: 3,
            committedTroops: 1,
            movementProfileId: 'infantry',
            battleWidth: 3,
            boundaryUnitCap: null,
            attackBoundaryType: 'plain',
            selectedSpecialPieceIds: ['jizhen-selected-3'],
            selectedGenericTroops: 0,
        }],
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

const playPincerAdvance = (core: QidahenCore): QidahenCore => execute(core, {
    type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
    playerId: '0',
    payload: { cardId: 'ming-pincer-advance' },
});

const togglePincerChoice = (
    core: QidahenCore,
    choiceId: string,
): QidahenCore => execute(core, {
    type: QIDAHEN_COMMANDS.TOGGLE_PINCER_ADVANCE_TROOP,
    playerId: '0',
    payload: { choiceId },
});

describe('七大恨分进合击', () => {
    it('按具体兵牌编号排除已参战部队，不会按前 N 个兵牌猜测', () => {
        const core = buildPincerCore();

        expect(QidahenDomain.validate(stateOf(core), {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'ming-pincer-advance' },
        })).toEqual({ valid: true });

        const selecting = playPincerAdvance(core);

        expect(selecting.pincerAdvanceSelection?.choices.map((choice) => choice.id)).toEqual([
            'city-region-28-jizhen-army-jizhen-elite-1',
            'city-region-28-jizhen-army-jizhen-veteran-2',
            'city-region-28-army-shuntian-cavalry-1',
        ]);
        expect(selecting.pincerAdvanceSelection?.selectedChoiceIds).toEqual([]);
        expect(selecting.handCards.some((card) => card.id === 'ming-pincer-advance')).toBe(true);
        expect(selecting.discardPileCount).toBe(core.discardPileCount);
    });

    it('只有野战且存在合法未参战部队时才能打出', () => {
        const fieldCore = buildPincerCore();
        const cityCore = {
            ...fieldCore,
            pendingTargetAction: {
                ...fieldCore.pendingTargetAction!,
                battleMode: 'city' as const,
            },
        };
        const noCandidateCore = {
            ...fieldCore,
            mapTokens: fieldCore.mapTokens.filter((token) => (
                token.pieceId === 'jizhen-selected-3'
                || token.id === 'city-region-28-army-fallback-2'
            )),
        };
        const command: QidahenCommand = {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'ming-pincer-advance' },
        };

        expect(QidahenDomain.validate(stateOf(fieldCore), command)).toEqual({ valid: true });
        expect(QidahenDomain.validate(stateOf(cityCore), command)).toEqual({
            valid: false,
            error: 'unknownPaymentCard',
        });
        expect(QidahenDomain.validate(stateOf(noCandidateCore), command)).toEqual({
            valid: false,
            error: 'unknownPaymentCard',
        });
    });

    it('最多选择两个增援兵牌，取消选中后才能改选第三个', () => {
        const selecting = playPincerAdvance(buildPincerCore());
        const choiceIds = selecting.pincerAdvanceSelection!.choices.map((choice) => choice.id);
        const firstSelected = togglePincerChoice(selecting, choiceIds[0]!);
        const secondSelected = togglePincerChoice(firstSelected, choiceIds[1]!);
        const thirdCommand: QidahenCommand = {
            type: QIDAHEN_COMMANDS.TOGGLE_PINCER_ADVANCE_TROOP,
            playerId: '0',
            payload: { choiceId: choiceIds[2]! },
        };

        expect(secondSelected.pincerAdvanceSelection?.selectedChoiceIds).toEqual([
            choiceIds[0],
            choiceIds[1],
        ]);
        expect(QidahenDomain.validate(stateOf(secondSelected), thirdCommand)).toEqual({
            valid: false,
            error: 'unknownAction',
        });

        const firstDeselected = togglePincerChoice(secondSelected, choiceIds[0]!);
        expect(QidahenDomain.validate(stateOf(firstDeselected), thirdCommand)).toEqual({ valid: true });
        const thirdSelected = execute(firstDeselected, thirdCommand);
        expect(thirdSelected.pincerAdvanceSelection?.selectedChoiceIds).toEqual([
            choiceIds[1],
            choiceIds[2],
        ]);
    });

    it('取消分进合击会保留手牌和原战斗兵力', () => {
        const core = buildPincerCore();
        const selecting = playPincerAdvance(core);
        const selected = togglePincerChoice(
            selecting,
            selecting.pincerAdvanceSelection!.choices[0]!.id,
        );
        const cancelled = execute(selected, {
            type: QIDAHEN_COMMANDS.CANCEL_PINCER_ADVANCE,
            playerId: '0',
            payload: {},
        });

        expect(cancelled.pincerAdvanceSelection).toBeNull();
        expect(cancelled.handCards.some((card) => card.id === 'ming-pincer-advance')).toBe(true);
        expect(cancelled.discardPileCount).toBe(core.discardPileCount);
        expect(cancelled.pendingTargetAction).toEqual(core.pendingTargetAction);
    });

    it('确认后才消耗手牌，并把同一来源的两个增援合并进原来源组', () => {
        const core = buildPincerCore();
        const selecting = playPincerAdvance(core);
        expect(QidahenDomain.validate(stateOf(selecting), {
            type: QIDAHEN_COMMANDS.RESOLVE_PINCER_ADVANCE,
            playerId: '0',
            payload: {},
        })).toEqual({
            valid: false,
            error: 'unknownAction',
        });

        const firstSelected = togglePincerChoice(
            selecting,
            'city-region-28-jizhen-army-jizhen-elite-1',
        );
        const secondSelected = togglePincerChoice(
            firstSelected,
            'city-region-28-jizhen-army-jizhen-veteran-2',
        );
        const resolved = execute(secondSelected, {
            type: QIDAHEN_COMMANDS.RESOLVE_PINCER_ADVANCE,
            playerId: '0',
            payload: {},
        });

        expect(resolved.pincerAdvanceSelection).toBeNull();
        expect(resolved.handCards.some((card) => card.id === 'ming-pincer-advance')).toBe(false);
        expect(resolved.discardPileCount).toBe(core.discardPileCount + 1);
        expect(resolved.pendingTargetAction?.committedTroops).toBe(3);
        expect(resolved.pendingTargetAction?.forceCommitments).toEqual([
            expect.objectContaining({
                sourceRegionId: 'city-region-28-jizhen',
                committedTroops: 3,
                selectedSpecialPieceIds: [
                    'jizhen-selected-3',
                    'jizhen-elite-1',
                    'jizhen-veteran-2',
                ],
                selectedGenericTroops: 0,
            }),
        ]);
    });

    it('不同来源的增援保持独立来源组并记录具体兵牌编号', () => {
        const core = buildPincerCore();
        const selecting = playPincerAdvance(core);
        const jizhenSelected = togglePincerChoice(
            selecting,
            'city-region-28-jizhen-army-jizhen-elite-1',
        );
        const shuntianSelected = togglePincerChoice(
            jizhenSelected,
            'city-region-28-army-shuntian-cavalry-1',
        );
        const resolved = execute(shuntianSelected, {
            type: QIDAHEN_COMMANDS.RESOLVE_PINCER_ADVANCE,
            playerId: '0',
            payload: {},
        });

        expect(resolved.pendingTargetAction?.committedTroops).toBe(3);
        expect(resolved.pendingTargetAction?.forceCommitments).toEqual([
            expect.objectContaining({
                sourceRegionId: 'city-region-28-jizhen',
                committedTroops: 2,
                selectedSpecialPieceIds: [
                    'jizhen-selected-3',
                    'jizhen-elite-1',
                ],
            }),
            expect.objectContaining({
                sourceRegionId: 'city-region-28',
                committedTroops: 1,
                selectedSpecialPieceIds: ['shuntian-cavalry-1'],
                selectedGenericTroops: 0,
            }),
        ]);
    });
});
