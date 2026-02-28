/**
 * 大杀四方 - 巨蚁派系能力
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter,
    addTempPower,
    buildActionCancelRollbackEvents,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    moveMinion,
    removePowerCounter,
} from '../domain/abilityHelpers';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { getCardDef } from '../data/cards';
import { drawCards } from '../domain/utils';
import { SU_EVENTS } from '../domain/types';
import type { CardsDrawnEvent, DeckReshuffledEvent, MinionDestroyedEvent, SmashUpCore, SmashUpEvent } from '../domain/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';

interface MinionCandidate {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
}

function giantAntSoldierOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: [addPowerCounter(ctx.cardUid, ctx.baseIndex, 2, 'giant_ant_soldier', ctx.now)],
    };
}

function giantAntSoldierTalent(ctx: AbilityContext): AbilityResult {
    const soldier = ctx.state.bases[ctx.baseIndex]?.minions.find(m => m.uid === ctx.cardUid);
    if (!soldier || soldier.controller !== ctx.playerId) return { events: [] };
    if ((soldier.powerCounters ?? 0) < 1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
    }

    const candidates: MinionCandidate[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.uid === ctx.cardUid) continue;
            const def = getCardDef(m.defId);
            candidates.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: def?.name ?? m.defId });
        }
    }
    const options = buildMinionTargetOptions(candidates, {
        state: ctx.state,
        sourcePlayerId: ctx.playerId,
        effectType: 'affect',
    });
    if (options.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `giant_ant_soldier_choose_minion_${ctx.now}`,
        ctx.playerId,
        '兵蚁：选择要获得 +1 力量指示物的另一个随从',
        options,
        {
            sourceId: 'giant_ant_soldier_choose_minion',
            targetType: 'minion',
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                continuationContext: {
                    soldierUid: ctx.cardUid,
                    soldierBaseIndex: ctx.baseIndex,
                },
            },
        }),
    };
}

function giantAntDroneOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: [addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, 'giant_ant_drone', ctx.now)],
    };
}


function giantAntKillerQueenTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(m => m.uid === ctx.cardUid);
    if (!self || self.controller !== ctx.playerId) return { events: [] };

    const playedHere = (ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) > 0;
    if (!playedHere) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }

    const candidates = ctx.state.bases[ctx.baseIndex]?.minions
        .filter(m => m.controller === ctx.playerId && m.playedThisTurn)
        .map(m => {
            const def = getCardDef(m.defId);
            return { uid: m.uid, defId: m.defId, baseIndex: ctx.baseIndex, label: def?.name ?? m.defId };
        }) ?? [];

    if (candidates.length === 1) {
        const target = candidates[0];
        return {
            events: [
                addPowerCounter(target.uid, target.baseIndex, 1, 'giant_ant_killer_queen', ctx.now),
                addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, 'giant_ant_killer_queen', ctx.now),
            ],
        };
    }

    const interaction = createSimpleChoice(
        `giant_ant_killer_queen_choose_minion_${ctx.now}`,
        ctx.playerId,
        '杀手女皇：选择本回合打到这里的随从（在其和女皇上各放1个指示物）',
        buildMinionTargetOptions(candidates, { state: ctx.state, sourcePlayerId: ctx.playerId }),
        {
            sourceId: 'giant_ant_killer_queen_choose_minion',
            targetType: 'minion',
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                continuationContext: {
                    queenUid: ctx.cardUid,
                    queenBaseIndex: ctx.baseIndex,
                },
            },
        }),
    };
}

interface CounterSnapshot {
    minionUid: string;
    defId: string;
    baseIndex: number;
    count: number;
}

interface WhoWantsContext {
    actionCardUid: string;
    removedByMinion: Record<string, CounterSnapshot>;
    removedTotal: number;
}

interface KindOfMagicContext {
    actionCardUid: string;
    remaining: number;
    removedSnapshots: CounterSnapshot[];
    distributedByMinion: Record<string, CounterSnapshot>;
}

interface TransferContext {
    sourceMinionUid: string;
    sourceDefId: string;
    sourceBaseIndex: number;
    sourceCounterAmount: number;
    reason: string;
    scoringBaseIndex?: number;
}

interface WeAreTheChampionsSourceContext {
    reason: string;
    scoringBaseIndex: number;
}

interface SoldierTransferContext {
    soldierUid: string;
    soldierBaseIndex: number;
}

interface DronePreventContext {
    targetMinionUid: string;
    targetMinionDefId: string;
    fromBaseIndex: number;
    toPlayerId: PlayerId;
}

type IH = (
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number,
) => { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined;

export function registerGiantAntAbilities(): void {
    registerAbility('giant_ant_worker', 'onPlay', giantAntWorker);
    registerAbility('giant_ant_soldier', 'onPlay', giantAntSoldierOnPlay);
    registerAbility('giant_ant_soldier', 'talent', giantAntSoldierTalent);
    registerAbility('giant_ant_drone', 'onPlay', giantAntDroneOnPlay);
    registerAbility('giant_ant_killer_queen', 'talent', giantAntKillerQueenTalent);

    registerAbility('giant_ant_who_wants_to_live_forever', 'onPlay', giantAntWhoWantsToLiveForever);
    registerAbility('giant_ant_a_kind_of_magic', 'onPlay', giantAntAKindOfMagic);
    registerAbility('giant_ant_we_will_rock_you', 'onPlay', giantAntWeWillRockYou);
    registerAbility('giant_ant_claim_the_prize', 'onPlay', giantAntClaimThePrize);
    registerAbility('giant_ant_under_pressure', 'special', giantAntUnderPressure);
    registerAbility('giant_ant_headlong', 'onPlay', giantAntHeadlong);
    registerAbility('giant_ant_we_are_the_champions', 'special', giantAntWeAreTheChampions);

    registerGiantAntProtections();
}

export function registerGiantAntInteractionHandlers(): void {
    registerInteractionHandler('giant_ant_who_wants_to_live_forever', handleWhoWantsToLiveForever);
    registerInteractionHandler('giant_ant_a_kind_of_magic_distribute', handleAKindOfMagicDistribution);
    registerInteractionHandler('giant_ant_claim_the_prize', handleClaimThePrize);

    registerInteractionHandler('giant_ant_soldier_choose_minion', handleSoldierChooseMinion);
    registerInteractionHandler('giant_ant_killer_queen_choose_minion', handleKillerQueenChooseMinion);
    registerInteractionHandler('giant_ant_drone_prevent_destroy', handleDronePreventDestroy);

    registerInteractionHandler('giant_ant_under_pressure_choose_source', handleUnderPressureChooseSource);
    registerInteractionHandler('giant_ant_under_pressure_choose_target', handleUnderPressureChooseTarget);
    registerInteractionHandler('giant_ant_under_pressure_choose_amount', handleUnderPressureChooseAmount);

    registerInteractionHandler('giant_ant_we_are_the_champions_choose_source', handleWeAreTheChampionsChooseSource);
    registerInteractionHandler('giant_ant_we_are_the_champions_choose_target', handleWeAreTheChampionsChooseTarget);
    registerInteractionHandler('giant_ant_we_are_the_champions_choose_amount', handleWeAreTheChampionsChooseAmount);

    registerInteractionHandler('giant_ant_headlong_choose_minion', handleHeadlongChooseMinion);
    registerInteractionHandler('giant_ant_headlong_choose_base', handleHeadlongChooseBase);
}

function giantAntWorker(ctx: AbilityContext): AbilityResult {
    return {
        events: [addPowerCounter(ctx.cardUid, ctx.baseIndex, 2, 'giant_ant_worker', ctx.now)],
    };
}

const handleSoldierChooseMinion: IH = (state, playerId, value, interactionData, _random, timestamp) => {
    const context = interactionData?.continuationContext as SoldierTransferContext | undefined;
    if (!context) return undefined;

    const selected = value as { minionUid?: string; baseIndex?: number; defId?: string };
    if (!selected.minionUid || selected.baseIndex === undefined) return undefined;

    const soldier = state.core.bases[context.soldierBaseIndex]?.minions.find(m => m.uid === context.soldierUid);
    const target = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
    if (!soldier || !target || soldier.controller !== playerId || (soldier.powerCounters ?? 0) < 1) return { state, events: [] };

    return {
        state,
        events: [
            removePowerCounter(context.soldierUid, context.soldierBaseIndex, 1, 'giant_ant_soldier', timestamp),
            addPowerCounter(target.uid, selected.baseIndex, 1, 'giant_ant_soldier', timestamp),
        ],
    };
};

const handleKillerQueenChooseMinion: IH = (state, playerId, value, interactionData, _random, timestamp) => {
    const context = interactionData?.continuationContext as { queenUid: string; queenBaseIndex: number } | undefined;
    if (!context) return undefined;
    const selected = value as { minionUid?: string; baseIndex?: number };
    if (!selected.minionUid || selected.baseIndex === undefined) return undefined;

    const queen = state.core.bases[context.queenBaseIndex]?.minions.find(m => m.uid === context.queenUid);
    const target = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
    if (!queen || !target || queen.controller !== playerId || target.controller !== playerId) return { state, events: [] };

    return {
        state,
        events: [
            addPowerCounter(target.uid, selected.baseIndex, 1, 'giant_ant_killer_queen', timestamp),
            addPowerCounter(queen.uid, context.queenBaseIndex, 1, 'giant_ant_killer_queen', timestamp),
        ],
    };
};

const handleDronePreventDestroy: IH = (state, playerId, value, interactionData, _random, timestamp) => {
    const context = interactionData?.continuationContext as DronePreventContext | undefined;
    if (!context) return undefined;

    const selected = value as { skip?: boolean; droneUid?: string; droneBaseIndex?: number };
    if (selected.skip) {
        const destroyEvt: MinionDestroyedEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: context.targetMinionUid,
                minionDefId: context.targetMinionDefId,
                fromBaseIndex: context.fromBaseIndex,
                ownerId: context.toPlayerId,
                reason: 'giant_ant_drone_skip',
            },
            timestamp,
        };
        return { state, events: [destroyEvt] };
    }
    if (!selected.droneUid || selected.droneBaseIndex === undefined) return undefined;

    const drone = state.core.bases[selected.droneBaseIndex]?.minions.find(m => m.uid === selected.droneUid);
    const target = state.core.bases[context.fromBaseIndex]?.minions.find(m => m.uid === context.targetMinionUid);
    // 防止失败（雄蜂不存在/指示物不足）→ 重新发出 MINION_DESTROYED，避免随从卡在"待拯救"状态
    if (!drone || !target || drone.controller !== playerId || (drone.powerCounters ?? 0) <= 0) {
        const destroyEvt: MinionDestroyedEvent = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: context.targetMinionUid,
                minionDefId: context.targetMinionDefId,
                fromBaseIndex: context.fromBaseIndex,
                ownerId: context.toPlayerId,
                reason: 'giant_ant_drone_skip',
            },
            timestamp,
        };
        return { state, events: [destroyEvt] };
    }

    return {
        state,
        events: [removePowerCounter(selected.droneUid, selected.droneBaseIndex, 1, 'giant_ant_drone', timestamp)],
    };
};

function giantAntWhoWantsToLiveForever(ctx: AbilityContext): AbilityResult {
    const hasAnyCounter = collectOwnMinionsWithCounters(ctx.state, ctx.playerId).length > 0;
    if (!hasAnyCounter) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
    }

    const interaction = createWhoWantsToLiveForeverInteraction(
        ctx.matchState,
        ctx.playerId,
        {
            actionCardUid: ctx.cardUid,
            removedByMinion: {},
            removedTotal: 0,
        },
        ctx.now,
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function giantAntAKindOfMagic(ctx: AbilityContext): AbilityResult {
    const snapshots = collectOwnMinionsWithCounters(ctx.state, ctx.playerId).map((m) => ({
        minionUid: m.uid,
        defId: m.defId,
        baseIndex: m.baseIndex,
        count: ctx.state.bases[m.baseIndex]?.minions.find(x => x.uid === m.uid)?.powerCounters ?? 0,
    })).filter(item => item.count > 0);

    const total = snapshots.reduce((sum, item) => sum + item.count, 0);
    if (total <= 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
    }

    const removeEvents = snapshots.map(item =>
        removePowerCounter(item.minionUid, item.baseIndex, item.count, 'giant_ant_a_kind_of_magic', ctx.now),
    );

    const interaction = createAKindOfMagicInteraction(
        ctx.matchState,
        ctx.playerId,
        {
            actionCardUid: ctx.cardUid,
            remaining: total,
            removedSnapshots: snapshots,
            distributedByMinion: {},
        },
        ctx.now,
    );

    return {
        events: removeEvents,
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function giantAntWeWillRockYou(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            if ((m.powerCounters ?? 0) <= 0) continue;
            events.push(addTempPower(m.uid, i, m.powerCounters ?? 0, 'giant_ant_we_will_rock_you', ctx.now));
        }
    }
    return { events };
}

function giantAntClaimThePrize(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const options = ownMinions.map(m => ({
        id: `minion-${m.uid}`,
        label: m.label,
        displayMode: 'card' as const,
        _source: 'field' as const,
        value: { minionUid: m.uid, baseIndex: m.baseIndex, defId: m.defId },
    }));

    const interaction = createSimpleChoice(
        `giant_ant_claim_the_prize_${ctx.now}`,
        ctx.playerId,
        '至多选择3个你的随从，每个放置1个力量指示物',
        options,
        {
            sourceId: 'giant_ant_claim_the_prize',
            targetType: 'minion',
            multi: { min: 0, max: Math.min(3, options.length) },
            autoResolveIfSingle: false,
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function giantAntUnderPressure(ctx: AbilityContext): AbilityResult {
    // 承受压力：从计分基地上的随从转移力量指示物到其他基地的随从
    // 来源必须是计分基地上的己方随从
    const scoringBaseIndex = ctx.baseIndex;
    if (scoringBaseIndex === undefined) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const scoringBase = ctx.state.bases[scoringBaseIndex];
    if (!scoringBase) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const sources = scoringBase.minions
        .filter(m => m.controller === ctx.playerId && (m.powerCounters ?? 0) > 0)
        .map(m => {
            const def = getCardDef(m.defId);
            return {
                uid: m.uid,  // buildMinionTargetOptions 需要 uid 字段
                baseIndex: scoringBaseIndex,
                defId: m.defId,
                label: `${def?.name ?? m.defId}（力量指示物 ${m.powerCounters ?? 0}）`,
            };
        });

    if (sources.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `giant_ant_under_pressure_choose_source_${ctx.now}`,
        ctx.playerId,
        '选择计分基地上要转出力量指示物的随从',
        buildMinionTargetOptions(sources, { state: ctx.state, sourcePlayerId: ctx.playerId }),
        {
            sourceId: 'giant_ant_under_pressure_choose_source',
            targetType: 'minion',
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                continuationContext: { scoringBaseIndex },
            },
        }),
    };
}

function giantAntWeAreTheChampions(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
            payload: {
                sourceDefId: 'giant_ant_we_are_the_champions',
                playerId: ctx.playerId,
                baseIndex: ctx.baseIndex,
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

function giantAntHeadlong(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0 || ctx.state.bases.length < 2) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const interaction = createSimpleChoice(
        `giant_ant_headlong_minion_${ctx.now}`,
        ctx.playerId,
        '选择要移动的己方随从',
        buildMinionTargetOptions(ownMinions, { state: ctx.state, sourcePlayerId: ctx.playerId }),
        {
            sourceId: 'giant_ant_headlong_choose_minion',
            targetType: 'minion',
        },
    );

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, interaction),
    };
}

function createWhoWantsToLiveForeverInteraction(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    context: WhoWantsContext,
    now: number,
) {
    const options = buildWhoWantsToLiveForeverOptions(state.core, playerId, context.removedTotal);
    const interaction = createSimpleChoice<any>(
        `giant_ant_who_wants_to_live_forever_${now}`,
        playerId,
        `无人想要永生：点击随从移除1个力量指示物（已移除 ${context.removedTotal}）`,
        options,
        {
            sourceId: 'giant_ant_who_wants_to_live_forever',
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    );

    return {
        ...interaction,
        data: {
            ...interaction.data,
            continuationContext: context,
            optionsGenerator: (nextState: { core: SmashUpCore }, data: any) => {
                const cc = (data?.continuationContext as WhoWantsContext | undefined) ?? context;
                return buildWhoWantsToLiveForeverOptions(nextState.core, playerId, cc.removedTotal);
            },
        },
    };
}

function createAKindOfMagicInteraction(
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    context: KindOfMagicContext,
    now: number,
) {
    const options = buildAKindOfMagicOptions(state.core, playerId);
    const interaction = createSimpleChoice<any>(
        `giant_ant_a_kind_of_magic_${now}`,
        playerId,
        `如同魔法：将力量指示物重新分配（剩余 ${context.remaining}）`,
        options,
        {
            sourceId: 'giant_ant_a_kind_of_magic_distribute',
            targetType: 'minion',
            autoResolveIfSingle: false,
        },
    );

    return {
        ...interaction,
        data: {
            ...interaction.data,
            continuationContext: context,
            optionsGenerator: (nextState: { core: SmashUpCore }) => buildAKindOfMagicOptions(nextState.core, playerId),
        },
    };
}

function buildWhoWantsToLiveForeverOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    removedTotal: number,
): any[] {
    const candidates = collectOwnMinionsWithCounters(core, playerId).map(item => ({
        ...item,
        label: `${item.label}（移除1个）`,
    }));

    const minionOptions = buildMinionTargetOptions(candidates, {
        state: core,
        sourcePlayerId: playerId,
    });

    return [
        ...minionOptions,
        {
            id: 'confirm',
            label: removedTotal > 0 ? `确认并抽 ${removedTotal} 张牌` : '确认（不抽牌）',
            displayMode: 'button' as const,
            value: { skip: true, confirm: true },
        },
        {
            id: 'cancel',
            label: '取消并撤回此牌',
            displayMode: 'button' as const,
            value: { skip: true, cancel: true },
        },
    ];
}

function buildAKindOfMagicOptions(core: SmashUpCore, playerId: PlayerId): any[] {
    const candidates = collectOwnMinions(core, playerId);
    const minionOptions = buildMinionTargetOptions(candidates, {
        state: core,
        sourcePlayerId: playerId,
    });

    return [
        ...minionOptions,
        {
            id: 'cancel',
            label: '取消并撤回此牌',
            displayMode: 'button' as const,
            value: { skip: true, cancel: true },
        },
    ];
}

const handleWhoWantsToLiveForever: IH = (state, playerId, value, interactionData, random, timestamp) => {
    const context = interactionData?.continuationContext as WhoWantsContext | undefined;
    if (!context) return undefined;

    const selected = value as { minionUid?: string; baseIndex?: number; defId?: string; confirm?: boolean; cancel?: boolean; skip?: boolean };

    if (selected.cancel) {
        const restoreEvents = Object.values(context.removedByMinion)
            .filter(item => item.count > 0)
            .map(item => addPowerCounter(item.minionUid, item.baseIndex, item.count, 'giant_ant_who_wants_to_live_forever', timestamp));
        return {
            state,
            events: buildActionCancelRollbackEvents(
                playerId,
                context.actionCardUid,
                'giant_ant_who_wants_to_live_forever',
                timestamp,
                restoreEvents,
            ),
        };
    }

    if (selected.confirm) {
        if (context.removedTotal <= 0) return { state, events: [] };
        const drawEvents = buildDrawEvents(state.core, playerId, context.removedTotal, random, timestamp);
        return { state, events: drawEvents };
    }

    if (!selected.minionUid || selected.baseIndex === undefined) return undefined;

    const minion = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
    if (!minion || minion.controller !== playerId || (minion.powerCounters ?? 0) <= 0) {
        return undefined;
    }

    const updatedSnapshot = context.removedByMinion[selected.minionUid]
        ? {
            ...context.removedByMinion[selected.minionUid],
            count: context.removedByMinion[selected.minionUid].count + 1,
        }
        : {
            minionUid: selected.minionUid,
            defId: selected.defId ?? minion.defId,
            baseIndex: selected.baseIndex,
            count: 1,
        };

    const nextContext: WhoWantsContext = {
        ...context,
        removedByMinion: {
            ...context.removedByMinion,
            [selected.minionUid]: updatedSnapshot,
        },
        removedTotal: context.removedTotal + 1,
    };

    const nextState = queueInteraction(
        state,
        createWhoWantsToLiveForeverInteraction(state, playerId, nextContext, timestamp),
    );

    return {
        state: nextState,
        events: [removePowerCounter(selected.minionUid, selected.baseIndex, 1, 'giant_ant_who_wants_to_live_forever', timestamp)],
    };
};

const handleAKindOfMagicDistribution: IH = (state, playerId, value, interactionData, _random, timestamp) => {
    const context = interactionData?.continuationContext as KindOfMagicContext | undefined;
    if (!context) return undefined;

    const selected = value as { minionUid?: string; baseIndex?: number; defId?: string; cancel?: boolean; skip?: boolean };

    if (selected.cancel) {
        const removeDistributedEvents = Object.values(context.distributedByMinion)
            .filter(item => item.count > 0)
            .map(item => removePowerCounter(item.minionUid, item.baseIndex, item.count, 'giant_ant_a_kind_of_magic_cancel', timestamp));

        const restoreEvents = context.removedSnapshots
            .filter(item => item.count > 0)
            .map(item => addPowerCounter(item.minionUid, item.baseIndex, item.count, 'giant_ant_a_kind_of_magic_cancel', timestamp));

        return {
            state,
            events: buildActionCancelRollbackEvents(
                playerId,
                context.actionCardUid,
                'giant_ant_a_kind_of_magic',
                timestamp,
                [...removeDistributedEvents, ...restoreEvents],
            ),
        };
    }

    if (!selected.minionUid || selected.baseIndex === undefined) return undefined;
    if (context.remaining <= 0) return { state, events: [] };

    const target = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
    if (!target || target.controller !== playerId) return undefined;

    const nextDistributed = context.distributedByMinion[selected.minionUid]
        ? {
            ...context.distributedByMinion[selected.minionUid],
            count: context.distributedByMinion[selected.minionUid].count + 1,
        }
        : {
            minionUid: selected.minionUid,
            baseIndex: selected.baseIndex,
            defId: selected.defId ?? target.defId,
            count: 1,
        };

    const nextContext: KindOfMagicContext = {
        ...context,
        remaining: context.remaining - 1,
        distributedByMinion: {
            ...context.distributedByMinion,
            [selected.minionUid]: nextDistributed,
        },
    };

    const events: SmashUpEvent[] = [
        addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'giant_ant_a_kind_of_magic', timestamp),
    ];

    if (nextContext.remaining <= 0) {
        return { state, events };
    }

    const nextState = queueInteraction(
        state,
        createAKindOfMagicInteraction(state, playerId, nextContext, timestamp),
    );

    return { state: nextState, events };
};

const handleClaimThePrize: IH = (state, playerId, value, _interactionData, _random, timestamp) => {
    const selections = Array.isArray(value) ? value as Array<{ minionUid: string; baseIndex: number }> : [];
    const unique = new Map<string, { minionUid: string; baseIndex: number }>();

    for (const item of selections) {
        if (!item?.minionUid || item.baseIndex === undefined) continue;
        unique.set(item.minionUid, item);
    }

    const events: SmashUpEvent[] = [];
    for (const item of unique.values()) {
        const minion = state.core.bases[item.baseIndex]?.minions.find(m => m.uid === item.minionUid);
        if (!minion || minion.controller !== playerId) continue;
        events.push(addPowerCounter(item.minionUid, item.baseIndex, 1, 'giant_ant_claim_the_prize', timestamp));
    }

    return { state, events };
};

const handleUnderPressureChooseSource: IH = (state, playerId, value, interactionData, _random, timestamp) => {
    const context = interactionData?.continuationContext as { scoringBaseIndex?: number } | undefined;
    const scoringBaseIndex = context?.scoringBaseIndex;
    if (scoringBaseIndex === undefined) return undefined;

    const selected = value as { minionUid?: string; baseIndex?: number; defId?: string };
    if (!selected.minionUid || selected.baseIndex === undefined) return undefined;

    const source = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
    if (!source || source.controller !== playerId || (source.powerCounters ?? 0) <= 0) return undefined;

    // 目标必须是非计分基地上的己方随从
    const targets = collectOwnMinions(state.core, playerId).filter(m => 
        m.uid !== selected.minionUid && m.baseIndex !== scoringBaseIndex
    );
    if (targets.length === 0) return { state, events: [] };

    const interaction = createSimpleChoice(
        `giant_ant_under_pressure_choose_target_${timestamp}`,
        playerId,
        '选择其他基地上接收力量指示物的随从',
        buildMinionTargetOptions(targets, { state: state.core, sourcePlayerId: playerId }),
        {
            sourceId: 'giant_ant_under_pressure_choose_target',
            targetType: 'minion',
        },
    );

    const transferContext: TransferContext = {
        sourceMinionUid: selected.minionUid,
        sourceDefId: selected.defId ?? source.defId,
        sourceBaseIndex: selected.baseIndex,
        sourceCounterAmount: source.powerCounters ?? 0,
        reason: 'giant_ant_under_pressure',
    };

    return {
        state: queueInteraction(state, {
            ...interaction,
            data: {
                ...interaction.data,
                continuationContext: transferContext,
            },
        }),
        events: [],
    };
};

const handleUnderPressureChooseTarget: IH = (state, playerId, value, interactionData, _random, timestamp) => {
    const context = interactionData?.continuationContext as TransferContext | undefined;
    if (!context) return undefined;

    const selected = value as { minionUid?: string; baseIndex?: number; defId?: string };
    if (!selected.minionUid || selected.baseIndex === undefined) return undefined;
    if (selected.minionUid === context.sourceMinionUid) return undefined;

    const source = state.core.bases[context.sourceBaseIndex]?.minions.find(m => m.uid === context.sourceMinionUid);
    const target = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
    if (!source || !target || source.controller !== playerId || target.controller !== playerId) return { state, events: [] };

    const maxAmount = source.powerCounters ?? 0;
    if (maxAmount <= 0) return { state, events: [] };
    if (maxAmount === 1) {
        return {
            state,
            events: [
                removePowerCounter(source.uid, context.sourceBaseIndex, 1, 'giant_ant_under_pressure', timestamp),
                addPowerCounter(target.uid, selected.baseIndex, 1, 'giant_ant_under_pressure', timestamp),
            ],
        };
    }

    const chooseAmount = createSimpleChoice(
        `giant_ant_under_pressure_choose_amount_${timestamp}`,
        playerId,
        '承受压力：选择要转移的力量指示物数量',
        [{ id: 'confirm-transfer', label: '确认转移', value: { amount: maxAmount }, _source: 'static' as const }],
        {
            sourceId: 'giant_ant_under_pressure_choose_amount',
            targetType: 'generic',
        },
    );

    return {
        state: queueInteraction(state, {
            ...chooseAmount,
            data: {
                ...chooseAmount.data,
                continuationContext: {
                    ...context,
                    targetMinionUid: target.uid,
                    targetBaseIndex: selected.baseIndex,
                },
                slider: {
                    min: 1,
                    max: maxAmount,
                    step: 1,
                    defaultValue: maxAmount,
                    confirmOptionId: 'confirm-transfer',
                    confirmLabel: '确认转移 {{value}} 个力量指示物',
                    valueLabel: '承受压力：{{value}} / {{max}}',
                },
            },
        }),
        events: [],
    };
};

const handleUnderPressureChooseAmount: IH = (state, playerId, value, interactionData, _random, timestamp) => {
    const context = interactionData?.continuationContext as (TransferContext & { targetMinionUid?: string; targetBaseIndex?: number }) | undefined;
    if (!context || !context.targetMinionUid || context.targetBaseIndex === undefined) return undefined;

    const selected = value as { amount?: number };
    const source = state.core.bases[context.sourceBaseIndex]?.minions.find(m => m.uid === context.sourceMinionUid);
    const target = state.core.bases[context.targetBaseIndex]?.minions.find(m => m.uid === context.targetMinionUid);
    if (!source || !target || source.controller !== playerId || target.controller !== playerId) return { state, events: [] };

    const amount = resolveTransferAmount(selected, source.powerCounters ?? 0);
    if (amount <= 0) return { state, events: [] };

    return {
        state,
        events: [
            removePowerCounter(source.uid, context.sourceBaseIndex, amount, 'giant_ant_under_pressure', timestamp),
            addPowerCounter(target.uid, context.targetBaseIndex, amount, 'giant_ant_under_pressure', timestamp),
        ],
    };
};

const handleWeAreTheChampionsChooseSource: IH = (state, playerId, value, _interactionData, _random, timestamp) => {
    const sourceCtx = _interactionData?.continuationContext as WeAreTheChampionsSourceContext | undefined;
    const selected = value as { minionUid?: string; baseIndex?: number; defId?: string; counterAmount?: number };
    if (!selected.minionUid || selected.baseIndex === undefined) return undefined;

    const source = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
    // 来源离场（计分后）时使用选项快照中的 counterAmount
    const sourceCounterAmount = source?.powerCounters ?? selected.counterAmount ?? 0;
    const allowScoringFallback = !source && sourceCtx?.scoringBaseIndex !== undefined && sourceCtx.scoringBaseIndex === selected.baseIndex;
    if ((!source && !allowScoringFallback) || (source && source.controller !== playerId) || sourceCounterAmount <= 0) return undefined;

    const targets = collectOwnMinions(state.core, playerId).filter(
        m => m.uid !== selected.minionUid,
    );
    if (targets.length === 0) return { state, events: [] };

    const interaction = createSimpleChoice(
        `giant_ant_we_are_the_champions_choose_target_${timestamp}`,
        playerId,
        '选择接收力量指示物的随从',
        buildMinionTargetOptions(targets, { state: state.core, sourcePlayerId: playerId }),
        {
            sourceId: 'giant_ant_we_are_the_champions_choose_target',
            targetType: 'minion',
        },
    );

    const transferContext: TransferContext = {
        sourceMinionUid: selected.minionUid,
        sourceDefId: selected.defId ?? source?.defId ?? 'giant_ant_worker',
        sourceBaseIndex: selected.baseIndex,
        sourceCounterAmount,
        reason: sourceCtx?.reason ?? 'giant_ant_we_are_the_champions',
        scoringBaseIndex: sourceCtx?.scoringBaseIndex,
    };

    return {
        state: queueInteraction(state, {
            ...interaction,
            data: {
                ...interaction.data,
                continuationContext: transferContext,
            },
        }),
        events: [],
    };
};

const handleWeAreTheChampionsChooseTarget: IH = (state, playerId, value, interactionData, _random, timestamp) => {
    const context = interactionData?.continuationContext as TransferContext | undefined;
    if (!context) return undefined;

    const targetSelection = value as { minionUid?: string; baseIndex?: number; defId?: string };
    if (!targetSelection.minionUid || targetSelection.baseIndex === undefined) return undefined;
    if (targetSelection.minionUid === context.sourceMinionUid) return undefined;

    const source = state.core.bases[context.sourceBaseIndex]?.minions.find(m => m.uid === context.sourceMinionUid);
    const target = state.core.bases[targetSelection.baseIndex]?.minions.find(m => m.uid === targetSelection.minionUid);
    const sourceMissingByScoring = !source && context.scoringBaseIndex !== undefined;
    if ((!source && !sourceMissingByScoring) || !target || (source && source.controller !== playerId) || target.controller !== playerId) return undefined;

    const maxAmount = (source?.powerCounters ?? 0) || context.sourceCounterAmount;
    if (maxAmount <= 0) return { state, events: [] };
    if (maxAmount === 1) {
        const events = sourceMissingByScoring || !source
            ? [addPowerCounter(target.uid, targetSelection.baseIndex, 1, context.reason, timestamp)]
            : [
                removePowerCounter(source.uid, context.sourceBaseIndex, 1, context.reason, timestamp),
                addPowerCounter(target.uid, targetSelection.baseIndex, 1, context.reason, timestamp),
            ];
        return {
            state,
            events,
        };
    }

    const chooseAmount = createSimpleChoice(
        `giant_ant_we_are_the_champions_choose_amount_${timestamp}`,
        playerId,
        '我们乃最强：选择要转移的力量指示物数量',
        [{ id: 'confirm-transfer', label: '确认转移', value: { amount: maxAmount }, _source: 'static' as const }],
        {
            sourceId: 'giant_ant_we_are_the_champions_choose_amount',
            targetType: 'generic',
        },
    );

    return {
        state: queueInteraction(state, {
            ...chooseAmount,
            data: {
                ...chooseAmount.data,
                continuationContext: {
                    ...context,
                    targetMinionUid: target.uid,
                    targetBaseIndex: targetSelection.baseIndex,
                },
                slider: {
                    min: 1,
                    max: maxAmount,
                    step: 1,
                    defaultValue: maxAmount,
                    confirmOptionId: 'confirm-transfer',
                    confirmLabel: '确认转移 {{value}} 个力量指示物',
                    valueLabel: '我们乃最强：{{value}} / {{max}}',
                },
            },
        }),
        events: [],
    };
};

const handleWeAreTheChampionsChooseAmount: IH = (state, playerId, value, interactionData, _random, timestamp) => {
    const context = interactionData?.continuationContext as (TransferContext & { targetMinionUid?: string; targetBaseIndex?: number }) | undefined;
    if (!context || !context.targetMinionUid || context.targetBaseIndex === undefined) return undefined;

    const selected = value as { amount?: number; value?: number };
    const source = state.core.bases[context.sourceBaseIndex]?.minions.find(m => m.uid === context.sourceMinionUid);
    const target = state.core.bases[context.targetBaseIndex]?.minions.find(m => m.uid === context.targetMinionUid);
    const sourceMissingByScoring = !source && context.scoringBaseIndex !== undefined;
    if ((!source && !sourceMissingByScoring) || !target || (source && source.controller !== playerId) || target.controller !== playerId) return { state, events: [] };

    const maxAmount = (source?.powerCounters ?? 0) || context.sourceCounterAmount;
    const amount = resolveTransferAmount(selected, maxAmount);
    if (amount <= 0) return { state, events: [] };

    const events = sourceMissingByScoring || !source
        ? [addPowerCounter(target.uid, context.targetBaseIndex, amount, context.reason, timestamp)]
        : [
            removePowerCounter(source.uid, context.sourceBaseIndex, amount, context.reason, timestamp),
            addPowerCounter(target.uid, context.targetBaseIndex, amount, context.reason, timestamp),
        ];

    return {
        state,
        events,
    };
};

const handleHeadlongChooseMinion: IH = (state, playerId, value, _interactionData, _random, timestamp) => {
    const selected = value as { minionUid?: string; baseIndex?: number; defId?: string };
    if (!selected.minionUid || selected.baseIndex === undefined) return undefined;

    const minion = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
    if (!minion || minion.controller !== playerId) return undefined;

    const baseCandidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < state.core.bases.length; i++) {
        if (i === selected.baseIndex) continue;
        const def = getCardDef(state.core.bases[i].defId);
        baseCandidates.push({ baseIndex: i, label: def?.name ?? `基地 ${i + 1}` });
    }

    if (baseCandidates.length === 0) return { state, events: [] };

    const interaction = createSimpleChoice(
        `giant_ant_headlong_base_${timestamp}`,
        playerId,
        '选择要移动到的基地',
        buildBaseTargetOptions(baseCandidates, state.core),
        {
            sourceId: 'giant_ant_headlong_choose_base',
            targetType: 'base',
        },
    );

    return {
        state: queueInteraction(state, {
            ...interaction,
            data: {
                ...interaction.data,
                continuationContext: {
                    minionUid: selected.minionUid,
                    minionDefId: selected.defId ?? minion.defId,
                    fromBaseIndex: selected.baseIndex,
                },
            },
        }),
        events: [],
    };
};

const handleHeadlongChooseBase: IH = (state, playerId, value, interactionData, _random, timestamp) => {
    const context = interactionData?.continuationContext as {
        minionUid: string;
        minionDefId: string;
        fromBaseIndex: number;
    } | undefined;
    if (!context) return undefined;

    const selected = value as { baseIndex?: number };
    if (selected.baseIndex === undefined) return undefined;

    const minion = state.core.bases[context.fromBaseIndex]?.minions.find(m => m.uid === context.minionUid);
    if (!minion || minion.controller !== playerId) return undefined;

    return {
        state,
        events: [
            moveMinion(context.minionUid, context.minionDefId, context.fromBaseIndex, selected.baseIndex, 'giant_ant_headlong', timestamp),
            addPowerCounter(context.minionUid, selected.baseIndex, 2, 'giant_ant_headlong', timestamp),
        ],
    };
};

function registerGiantAntProtections(): void {
    const checker = (ctx: {
        state: SmashUpCore;
        targetBaseIndex: number;
        targetMinion: { controller: PlayerId; powerCounters: number };
        sourcePlayerId: PlayerId;
    }) => {
        if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
        if ((ctx.targetMinion.powerCounters ?? 0) <= 0) return false;

        const base = ctx.state.bases[ctx.targetBaseIndex];
        if (!base) return false;

        return base.ongoingActions.some(
            (o) => o.defId === 'giant_ant_the_show_must_go_on' && o.ownerId === ctx.targetMinion.controller,
        );
    };

    registerProtection('giant_ant_the_show_must_go_on', 'affect', checker as any);
    registerProtection('giant_ant_the_show_must_go_on', 'move', checker as any);
    registerProtection('giant_ant_the_show_must_go_on', 'destroy', checker as any);

    registerTrigger('giant_ant_we_are_the_champions', 'afterScoring', giantAntWeAreTheChampionsAfterScoring);
    registerTrigger('giant_ant_drone', 'onMinionDestroyed', giantAntDronePreventTrigger);
}

function giantAntWeAreTheChampionsAfterScoring(
    ctx: TriggerContext,
): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const { state, baseIndex, now } = ctx;
    if (baseIndex === undefined) return [];

    const armed = (state.pendingAfterScoringSpecials ?? []).filter(
        s => s.sourceDefId === 'giant_ant_we_are_the_champions' && s.baseIndex === baseIndex,
    );
    if (armed.length === 0) return [];

    const events: SmashUpEvent[] = armed.map(s => ({
        type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED,
        payload: {
            sourceDefId: s.sourceDefId,
            playerId: s.playerId,
            baseIndex: s.baseIndex,
        },
        timestamp: now,
    } as SmashUpEvent));

    if (!ctx.matchState) return { events };

    let matchState = ctx.matchState;
    for (const armedEntry of armed) {
        const scoredBase = state.bases[baseIndex];
        if (!scoredBase) continue;
        
        // 检查是否有足够的随从进行转移（至少需要2个随从：来源+目标）
        const allMyMinions = collectOwnMinions(state, armedEntry.playerId);
        if (allMyMinions.length < 2) continue;

        const sources = scoredBase.minions
            .filter(m => m.controller === armedEntry.playerId && (m.powerCounters ?? 0) > 0)
            .map(m => {
                const def = getCardDef(m.defId);
                return {
                    uid: m.uid,
                    defId: m.defId,
                    baseIndex,
                    counterAmount: m.powerCounters ?? 0,
                    label: `${def?.name ?? m.defId}（力量指示物 ${m.powerCounters ?? 0}）`,
                };
            });
        if (sources.length === 0) continue;

        // 手动构建选项（包含 counterAmount 快照），不使用 buildMinionTargetOptions
        // 因为来源是己方随从（无需保护检查），且计分后离场后仍需 counterAmount
        const sourceOptions = sources.map((s, i) => ({
            id: `minion-${i}`,
            label: s.label,
            value: { minionUid: s.uid, baseIndex: s.baseIndex, defId: s.defId, counterAmount: s.counterAmount },
            // 计分后来源随从可能已离场，必须保留快照选项，不能走 field 动态校验
            _source: 'static' as const,
        }));

        const interaction = createSimpleChoice(
            `giant_ant_we_are_the_champions_choose_source_${now}_${armedEntry.playerId}`,
            armedEntry.playerId,
            '我们乃最强：计分后选择转出力量指示物的随从',
            sourceOptions,
            {
                sourceId: 'giant_ant_we_are_the_champions_choose_source',
                // 来源可能已离场，使用通用弹层选择（卡牌模式）而不是棋盘点选
                targetType: 'generic',
            },
        );

        matchState = queueInteraction(matchState, {
            ...interaction,
            data: {
                ...interaction.data,
                continuationContext: {
                    reason: 'giant_ant_we_are_the_champions',
                    scoringBaseIndex: baseIndex,
                } as WeAreTheChampionsSourceContext,
            },
        });
    }

    return { events, matchState };
}

function giantAntDronePreventTrigger(ctx: TriggerContext): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const { state, playerId, triggerMinionUid, triggerMinionDefId, baseIndex, now } = ctx;
    
    if (ctx.reason === 'giant_ant_drone_skip') return [];
    if (!triggerMinionUid || !triggerMinionDefId || baseIndex === undefined) return [];

    const target = state.bases[baseIndex]?.minions.find(m => m.uid === triggerMinionUid);
    if (!target || target.controller !== playerId) return [];

    const drones: { uid: string; baseIndex: number }[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        for (const m of state.bases[i].minions) {
            if (m.defId !== 'giant_ant_drone') continue;
            if (m.controller !== playerId) continue;
            if ((m.powerCounters ?? 0) <= 0) continue;
            drones.push({ uid: m.uid, baseIndex: i });
        }
    }
    if (drones.length === 0) return [];
    if (!ctx.matchState) return [];

    const options = [
        { id: 'skip', label: '不防止消灭', value: { skip: true }, _source: 'static' as const },
        ...drones.map((d, i) => ({
            id: `drone-${i}`,
            label: `移除雄蜂的1个指示物（基地 ${d.baseIndex + 1}）来防止消灭`,
            value: { droneUid: d.uid, droneBaseIndex: d.baseIndex, minionUid: d.uid },
            _source: 'field' as const,
        })),
    ];

    const interaction = createSimpleChoice<any>(
        `giant_ant_drone_prevent_destroy_${now}`,
        playerId,
        '雄蜂：是否移除1个力量指示物来防止该随从被消灭？',
        options,
        {
            sourceId: 'giant_ant_drone_prevent_destroy',
            targetType: 'generic',
            autoResolveIfSingle: false,
        },
    );

    const cc: DronePreventContext = {
        targetMinionUid: triggerMinionUid,
        targetMinionDefId: triggerMinionDefId,
        fromBaseIndex: baseIndex,
        toPlayerId: target.owner,
    };

    const finalInteraction = {
        ...interaction,
        data: {
            ...interaction.data,
            continuationContext: cc,
        },
    };

    return {
        events: [],
        matchState: queueInteraction(ctx.matchState, finalInteraction),
    };
}

function resolveTransferAmount(selected: { amount?: number; value?: number }, maxAmount: number): number {
    const raw = typeof selected.amount === 'number'
        ? selected.amount
        : typeof selected.value === 'number'
            ? selected.value
            : 1;
    const normalized = Math.floor(raw);
    return Math.max(1, Math.min(normalized, maxAmount));
}

function collectOwnMinions(state: SmashUpCore, playerId: PlayerId): MinionCandidate[] {
    const result: MinionCandidate[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        for (const m of state.bases[i].minions) {
            if (m.controller !== playerId) continue;
            const def = getCardDef(m.defId);
            result.push({
                uid: m.uid,
                defId: m.defId,
                baseIndex: i,
                label: def?.name ?? m.defId,
            });
        }
    }
    return result;
}

function collectOwnMinionsWithCounters(state: SmashUpCore, playerId: PlayerId): MinionCandidate[] {
    const result: MinionCandidate[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        for (const m of state.bases[i].minions) {
            if (m.controller !== playerId) continue;
            if ((m.powerCounters ?? 0) <= 0) continue;
            const def = getCardDef(m.defId);
            result.push({
                uid: m.uid,
                defId: m.defId,
                baseIndex: i,
                label: def?.name ?? m.defId,
            });
        }
    }
    return result;
}

function buildDrawEvents(
    core: SmashUpCore,
    playerId: PlayerId,
    count: number,
    random: RandomFn,
    now: number,
): SmashUpEvent[] {
    const player = core.players[playerId];
    if (!player || count <= 0) return [];

    const drawResult = drawCards(player, count, random);
    const events: SmashUpEvent[] = [];

    if (drawResult.reshuffledDeckUids && drawResult.reshuffledDeckUids.length > 0) {
        const reshuffleEvt: DeckReshuffledEvent = {
            type: SU_EVENTS.DECK_RESHUFFLED,
            payload: {
                playerId,
                deckUids: drawResult.reshuffledDeckUids,
            },
            timestamp: now,
        };
        events.push(reshuffleEvt);
    }

    if (drawResult.drawnUids.length > 0) {
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: {
                playerId,
                count: drawResult.drawnUids.length,
                cardUids: drawResult.drawnUids,
            },
            timestamp: now,
        };
        events.push(drawEvt);
    }

    return events;
}
