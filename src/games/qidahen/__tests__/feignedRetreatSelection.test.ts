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

type TestFactionId = 'ming' | 'mongol' | 'jin';

const random: RandomFn = {
    random: () => 0.5,
    d: () => 4,
    range: (min) => min,
    shuffle: <T>(items: T[]) => [...items],
};

const getAttackerFactionId = (defenderFactionId: TestFactionId): TestFactionId => (
    defenderFactionId === 'ming' ? 'jin' : 'ming'
);

const buildCore = (defenderFactionId: TestFactionId = 'jin'): QidahenCore => {
    const core = createInitialCore(['0', '1', '2'], 'post-sarhu-1619', true);
    const attackerFactionId = getAttackerFactionId(defenderFactionId);
    const defenderCard = core.handCards.find((card) => card.faction === defenderFactionId)!;
    core.currentPlayer = core.factions[attackerFactionId].playerId;
    core.turnPhase = 'resolve-pending';
    core.handCards = [
        {
            ...defenderCard,
            id: `${defenderFactionId}-feigned-retreat`,
            label: '诈败诱敌',
            faction: defenderFactionId,
            accent: defenderFactionId,
            status: 'payable',
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1660-feigned-retreat-lure-enemy',
            rulesSummary: '效果 8；取消对手宣告的骑兵劫掠，敌方骑兵直接投入战斗，照常撤退。大明、蒙古使用效果同上。',
        },
        {
            ...defenderCard,
            id: `${defenderFactionId}-bayara`,
            label: '巴雅喇',
            faction: defenderFactionId,
            accent: defenderFactionId,
            status: 'payable',
            cardKind: 'tactic',
            armamentId: null,
            cardDefId: 'qidahen-atlas05-1602-bayara',
            rulesSummary: '防守时己方步兵防御等级 +1。',
        },
    ];
    core.regions = core.regions.map((region) => {
        if (region.id === 'city-region-16') {
            return {
                ...region,
                controller: attackerFactionId,
                controlLabel: core.factions[attackerFactionId].name,
                troops: 3,
                specialTroops: [{
                    id: `${attackerFactionId}-cavalry-lv2`,
                    label: `${core.factions[attackerFactionId].name}骑兵`,
                    faction: attackerFactionId,
                    troopKind: 'cavalry',
                    count: 3,
                    level: 2,
                    pieceIds: [
                        `${attackerFactionId}-cavalry-1`,
                        `${attackerFactionId}-cavalry-2`,
                        `${attackerFactionId}-cavalry-3`,
                    ],
                }],
            };
        }
        if (region.id === 'city-region-14') {
            return {
                ...region,
                controller: defenderFactionId,
                controlLabel: core.factions[defenderFactionId].name,
                troops: 1,
                population: 3,
                specialTroops: [{
                    id: `${defenderFactionId}-infantry-lv1`,
                    label: `${core.factions[defenderFactionId].name}步兵`,
                    faction: defenderFactionId,
                    troopKind: 'infantry',
                    count: 1,
                    level: 1,
                    pieceIds: [`${defenderFactionId}-infantry-1`],
                }],
            };
        }
        return region;
    });
    core.pendingTargetAction = {
        actionId: 'wheel-dispatch',
        battleMode: 'field',
        targetKind: 'region',
        title: '调骑 4 待结算',
        attackerFactionId,
        sourceRegionId: 'city-region-16',
        sourceRegionName: '区域 16',
        attackerPositionRegionId: null,
        targetRegionId: 'city-region-14',
        targetRegionName: '区域 14',
        targetRuntimeRegionId: 'city-region-14',
        defenderFactionId,
        defenderLabel: core.factions[defenderFactionId].name,
        restriction: '测试诈败诱敌',
        battleWidth: 3,
        boundaryUnitCap: null,
        sourceAvailableTroops: 3,
        committedTroops: 3,
        movementProfileId: 'dispatch-cavalry',
        attackPressure: 3,
        attackBoundaryType: 'plain',
        resolutionHint: '区域 16 → 区域 14',
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

const declareCavalryPlunder = (
    defenderFactionId: TestFactionId = 'jin',
): MatchState<QidahenCore> => {
    const core = buildCore(defenderFactionId);
    const attackerFactionId = getAttackerFactionId(defenderFactionId);
    return execute(stateOf(core), {
        type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
        playerId: core.factions[attackerFactionId].playerId,
        payload: {
            attackerCavalryPlunder: true,
            attackerCavalryPlunderSource: 'attacker',
        },
    } satisfies QidahenCommand);
};

describe('七大恨诈败诱敌', () => {
    it('骑兵劫掠宣告后先交给守方响应，人口、部队与真实手牌均不提前变化', () => {
        const state = declareCavalryPlunder();

        expect(state.core.feignedRetreatSelection).toMatchObject({
            cardId: 'jin-feigned-retreat',
            factionId: 'jin',
            attackerFactionId: 'ming',
            targetRuntimeRegionId: 'city-region-14',
        });
        expect(getSourceId(state)).toBe('qidahen:feigned-retreat');
        expect(getOptionIds(state)).toEqual(['skip']);
        expect(state.core.regions.find((region) => region.id === 'city-region-14')).toMatchObject({
            population: 3,
            troops: 1,
        });
        expect(state.core.regions.find((region) => region.id === 'city-region-16')).toMatchObject({
            troops: 3,
        });
        expect(state.core.handCards.some((card) => card.id === 'jin-feigned-retreat')).toBe(true);
        expect(state.core.discardPileCount).toBe(buildCore().discardPileCount);
    });

    it('响应期间只允许守方打出对应真实手牌，并阻止提前结算', () => {
        const state = declareCavalryPlunder();

        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            playerId: '0',
            payload: {},
        })).toEqual({ valid: false, error: 'unknownAction' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '0',
            payload: { cardId: 'jin-feigned-retreat' },
        })).toEqual({ valid: false, error: 'notCurrentPlayer' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: 'jin-bayara' },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: 'jin-feigned-retreat' },
        })).toEqual({ valid: true });
    });

    it('选择不使用会沿交互快照恢复原骑兵劫掠并保留手牌', () => {
        const state = declareCavalryPlunder();
        const staleCoreState = {
            ...state,
            core: {
                ...state.core,
                feignedRetreatSelection: null,
            },
        };
        const next = respond(staleCoreState, '2', 'skip');

        expect(next.core.feignedRetreatSelection).toBeNull();
        expect(next.core.handCards.some((card) => card.id === 'jin-feigned-retreat')).toBe(true);
        expect(next.core.regions.find((region) => region.id === 'city-region-14')?.population).toBeLessThan(3);
        expect(next.core.actionLog.some((entry) => entry.text.includes('骑兵劫掠'))).toBe(true);
    });

    it('打出后消耗真实手牌、取消劫掠并让原骑兵进入正常战斗', () => {
        const offered = declareCavalryPlunder();
        const initialDiscardPileCount = offered.core.discardPileCount;
        const next = execute(offered, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: 'jin-feigned-retreat' },
        } satisfies QidahenCommand);

        expect(next.core.feignedRetreatSelection).toBeNull();
        expect(next.core.handCards.some((card) => card.id === 'jin-feigned-retreat')).toBe(false);
        expect(next.core.discardPileCount).toBe(initialDiscardPileCount + 1);
        expect(next.core.regions.find((region) => region.id === 'city-region-14')?.population).toBe(3);
        expect(next.core.actionLog.some((entry) => entry.text.includes('诈败诱敌'))).toBe(true);
        expect(next.core.actionLog.some((entry) => /劫掠 \d+ 人口/.test(entry.text))).toBe(false);
        expect(next.core.regions.find((region) => region.id === 'city-region-14')?.note).not.toContain('遭骑兵劫掠');
        expect(next.core.postBattleSelection?.battleRolls).not.toBeNull();
        expect(next.core.postBattleSelection?.battleRolls?.summary).toContain('战斗掷骰');
        expect(next.core.postBattleSelection?.choices).toEqual(expect.arrayContaining([
            expect.objectContaining({
                mode: 'withdraw',
                regionId: 'city-region-16',
            }),
        ]));
    });

    it.each([
        ['大明', 'ming'],
        ['蒙古', 'mongol'],
    ] as const)('%s作为守方打出诈败诱敌时与后金使用相同效果', (_label, defenderFactionId) => {
        const offered = declareCavalryPlunder(defenderFactionId);
        const defenderPlayerId = offered.core.factions[defenderFactionId].playerId;
        const cardId = `${defenderFactionId}-feigned-retreat`;
        const next = execute(offered, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: defenderPlayerId,
            payload: { cardId },
        } satisfies QidahenCommand);

        expect(next.core.handCards.some((card) => card.id === cardId)).toBe(false);
        expect(next.core.regions.find((region) => region.id === 'city-region-14')?.population).toBe(3);
        expect(next.core.actionLog.some((entry) => /劫掠 \d+ 人口/.test(entry.text))).toBe(false);
        expect(next.core.postBattleSelection).toMatchObject({
            attackerFactionId: getAttackerFactionId(defenderFactionId),
            sourceRegionId: 'city-region-16',
            targetRuntimeRegionId: 'city-region-14',
        });
        expect(next.core.postBattleSelection?.choices).toEqual(expect.arrayContaining([
            expect.objectContaining({
                mode: 'withdraw',
                regionId: 'city-region-16',
            }),
        ]));
    });

    it('没有骑兵劫掠宣告时不能从普通战术窗口打出', () => {
        const state = stateOf(buildCore());

        expect(QidahenDomain.validate(state, {
            type: QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            playerId: '2',
            payload: { cardId: 'jin-feigned-retreat' },
        })).toEqual({ valid: false, error: 'unknownPaymentCard' });
    });
});
