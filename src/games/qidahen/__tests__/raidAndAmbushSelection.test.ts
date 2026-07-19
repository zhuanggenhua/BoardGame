import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import type { Command, MatchState, RandomFn } from '../../../engine/types';
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

const buildCore = (): QidahenCore => {
    const core = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true);
    const mingCard = core.handCards.find((card) => card.faction === 'ming')!;
    const jinCard = core.handCards.find((card) => card.faction === 'jin')!;
    core.currentPlayer = '0';
    core.turnPhase = 'resolve-pending';
    core.factions.ming.armaments = [];
    core.factions.jin.armaments = [];
    core.factions.ming.characters = core.factions.ming.characters.map((character) => ({
        ...character,
        inPlay: false,
    }));
    core.factions.jin.characters = core.factions.jin.characters.map((character) => ({
        ...character,
        inPlay: false,
    }));
    core.handCards = [
        {
            ...mingCard,
            id: 'ming-pincer-advance',
            label: '分进合击',
            faction: 'ming',
            accent: 'ming',
            status: 'payable',
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1632-pincer-advance',
            rulesSummary: '只能于野战时使用；可以再移动最多 2 个没有参战的部队进入战斗。',
        },
        {
            ...jinCard,
            id: 'jin-raid-and-ambush',
            label: '偷袭与伏击',
            faction: 'jin',
            accent: 'jin',
            status: 'payable',
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1622-raid-and-ambush',
            rulesSummary: '敌人增援时可指定一种兵种骰子等级 -1；可再从手牌追加一张战术牌。',
        },
        {
            ...jinCard,
            id: 'jin-bayara',
            label: '巴雅喇',
            faction: 'jin',
            accent: 'jin',
            status: 'payable',
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1602-bayara',
            rulesSummary: '防守时己方步兵防御等级 +1。',
        },
    ];
    core.regions = core.regions.map((region) => {
        if (region.id === 'city-region-28-jizhen') {
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 2,
                specialTroops: [
                    {
                        id: 'jizhen-infantry',
                        label: '蓟镇步兵',
                        faction: 'ming',
                        troopKind: 'infantry',
                        count: 2,
                        level: 2,
                        pieceIds: ['jizhen-infantry-1', 'jizhen-infantry-2'],
                    },
                ],
            };
        }
        if (region.id === 'city-region-28') {
            return {
                ...region,
                controller: 'ming',
                controlLabel: '大明',
                troops: 1,
                specialTroops: [{
                    id: 'shuntian-cavalry',
                    label: '顺天骑兵',
                    faction: 'ming',
                    troopKind: 'cavalry',
                    count: 1,
                    level: 3,
                    pieceIds: ['shuntian-cavalry-1'],
                }],
            };
        }
        if (region.id === 'city-region-25') {
            return {
                ...region,
                controller: 'jin',
                controlLabel: '后金',
                troops: 1,
                specialTroops: [{
                    id: 'shanhaiguan-defender',
                    label: '山海关守军',
                    faction: 'jin',
                    troopKind: 'infantry',
                    count: 1,
                    level: 1,
                    pieceIds: ['shanhaiguan-defender-1'],
                }],
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
        restriction: '测试偷袭与伏击',
        battleWidth: 3,
        boundaryUnitCap: null,
        sourceAvailableTroops: 2,
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
            sourceAvailableTroops: 2,
            committedTroops: 1,
            movementProfileId: 'infantry',
            battleWidth: 3,
            boundaryUnitCap: null,
            attackBoundaryType: 'plain',
            selectedSpecialPieceIds: ['jizhen-infantry-1'],
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
    state: MatchState<QidahenCore>,
    command: Command,
): MatchState<QidahenCore> => {
    const result = executePipeline(
        { domain: engineConfig.domain, systems: engineConfig.systems as any },
        state,
        command,
        random,
        ['0', '1', '2'],
    );
    expect(result.success).toBe(true);
    return result.state;
};

const getSourceId = (state: MatchState<QidahenCore>): string | undefined => (
    (state.sys.interaction?.current?.data as { sourceId?: string } | undefined)?.sourceId
);

const getOptionIds = (state: MatchState<QidahenCore>): string[] => (
    (state.sys.interaction?.current?.data as { options?: Array<{ id: string }> } | undefined)
        ?.options
        ?.map((option) => option.id)
    ?? []
);

const respond = (
    state: MatchState<QidahenCore>,
    playerId: string,
    optionId: string,
): MatchState<QidahenCore> => execute(state, {
    type: 'SYS_INTERACTION_RESPOND',
    playerId,
    payload: {
        interactionId: state.sys.interaction?.current?.id,
        optionId,
    },
});

const triggerRaidAndAmbush = (): MatchState<QidahenCore> => {
    let state = stateOf(buildCore());
    state = execute(state, {
        type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
        playerId: '0',
        payload: { cardId: 'ming-pincer-advance' },
    } satisfies QidahenCommand);
    state = execute(state, {
        type: QIDAHEN_COMMANDS.TOGGLE_PINCER_ADVANCE_TROOP,
        playerId: '0',
        payload: { choiceId: 'city-region-28-army-shuntian-cavalry-1' },
    } satisfies QidahenCommand);
    return execute(state, {
        type: QIDAHEN_COMMANDS.RESOLVE_PINCER_ADVANCE,
        playerId: '0',
        payload: {},
    } satisfies QidahenCommand);
};

describe('七大恨偷袭与伏击', () => {
    it('分进合击增援后把操作权交给守方，且响应期间不能提前结算', () => {
        const state = triggerRaidAndAmbush();

        expect(state.core.raidAndAmbushSelection).toMatchObject({
            cardId: 'jin-raid-and-ambush',
            factionId: 'jin',
            phase: 'offer',
            eligibleTroopKinds: ['cavalry', 'infantry'],
        });
        expect(getSourceId(state)).toBe('qidahen:raid-and-ambush');
        expect(getOptionIds(state)).toEqual(['skip']);
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        })).toEqual({ valid: false, error: 'unknownAction' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'ming-pincer-advance' },
        })).toEqual({ valid: false, error: 'notCurrentPlayer' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: 'jin-bayara' },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: 'jin-raid-and-ambush' },
        })).toEqual({ valid: true });
    });

    it('选择不使用会保留手牌并恢复原待结算交互', () => {
        const state = triggerRaidAndAmbush();
        const next = respond(state, '2', 'skip');

        expect(next.core.raidAndAmbushSelection).toBeNull();
        expect(next.core.handCards.some((card) => card.id === 'jin-raid-and-ambush')).toBe(true);
        expect(getSourceId(next)).toBe('qidahen:pending-target');
    });

    it('打出后只能选择实际参战兵种，并在选择后允许追加一张正式守方战术', () => {
        let state = triggerRaidAndAmbush();
        state = execute(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: 'jin-raid-and-ambush' },
        } satisfies QidahenCommand);

        expect(state.core.handCards.some((card) => card.id === 'jin-raid-and-ambush')).toBe(false);
        expect(state.core.raidAndAmbushSelection?.phase).toBe('select-troop-kind');
        expect(getOptionIds(state)).toEqual(['troop-kind:cavalry', 'troop-kind:infantry']);
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: 'jin-bayara' },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });

        state = respond(state, '2', 'troop-kind:cavalry');
        expect(state.core.raidAndAmbushSelection).toMatchObject({
            phase: 'follow-up',
            selectedTroopKind: 'cavalry',
        });
        expect(getOptionIds(state)).toEqual(['skip-follow-up']);
        expect(state.core.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1622-raid-and-ambush',
                side: 'attacker',
                troopKind: 'cavalry',
                levelBonus: -1,
            }),
        ]));
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: 'jin-bayara' },
        })).toEqual({ valid: true });

        state = execute(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: 'jin-bayara' },
        } satisfies QidahenCommand);
        expect(state.core.raidAndAmbushSelection).toBeNull();
        expect(state.core.handCards.some((card) => card.id === 'jin-bayara')).toBe(false);
        expect(getSourceId(state)).toBe('qidahen:pending-target');
        expect(state.core.pendingTargetAction?.tacticModifiers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1622-raid-and-ambush',
                side: 'attacker',
                troopKind: 'cavalry',
                levelBonus: -1,
            }),
            expect.objectContaining({
                sourceCardDefId: 'qidahen-atlas05-1602-bayara',
                side: 'defender',
                troopKind: 'infantry',
                levelBonus: 1,
            }),
        ]));
    });

    it('不追加战术后恢复战斗结算，指定骑兵按降低后的等级掷骰', () => {
        let state = triggerRaidAndAmbush();
        state = execute(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: 'jin-raid-and-ambush' },
        } satisfies QidahenCommand);
        state = respond(state, '2', 'troop-kind:cavalry');
        state = respond(state, '2', 'skip-follow-up');
        state = execute(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        } satisfies QidahenCommand);

        const cavalryStage = state.core.postBattleSelection?.battleRolls?.stages.find(
            (stage) => stage.phase === 'cavalry',
        );
        expect(cavalryStage?.attackerRolls).toEqual(expect.arrayContaining([
            expect.objectContaining({
                troopKind: 'cavalry',
                level: 2,
                dieSides: 8,
            }),
        ]));
    });
});
