/**
 * 大杀四方 - 巨蚁派系能力
 */

import { registerAbility, registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import type { MinionPlayedEvent } from '../domain/types';
import {
    addPowerCounter,
    addTempPower,
    buildActionCancelRollbackEvents,
    buildAbilityFeedback,
    buildBaseTargetOptions,
    buildFieldSourceActionOptions,
    buildFieldSourceActionPromptConfig,
    buildValidatedDestroyEvents,
    buildValidatedMoveEvents,
    buildMinionTargetOptions,
    createSkipOption,
    removePowerCounter,
    revealAndPickFromDeck,
} from '../domain/abilityHelpers';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { ProtectionChecker, TriggerContext } from '../domain/ongoingEffects';
import { getSmashUpReactionWindowContext } from '../domain/reactionWindowState';
import { getBaseDef, getCardDef } from '../data/cards';
import { drawCards, resolveLiveBaseIndex } from '../domain/utils';
import { SU_EVENTS } from '../domain/types';
import type { CardsDrawnEvent, DeckReshuffledEvent, SmashUpCore, SmashUpEvent } from '../domain/types';
import { type PromptOption } from '../../../engine/systems/InteractionSystem';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import {
    createAbilityRuntimeSimpleChoice,
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';

interface MinionCandidate {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
}

type MinionTargetChoiceValue = { minionUid: string; baseIndex: number; defId: string };
type WhoWantsControlChoiceValue =
    | { skip: true; confirm: true }
    | { skip: true; cancel: true };
type KindOfMagicControlChoiceValue = { skip: true; cancel: true };
type DronePreventChoiceValue =
    | { skip: true }
    | { droneUid: string; droneBaseIndex: number; minionUid: string; minionDefId: string };

type GiantAntPromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

function createGiantAntPromptContext<TExtra extends object>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): GiantAntPromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

function runtimeResultToAbilityResult(
    result: ReturnType<typeof executeAbilityProgram<unknown, SmashUpCore, SmashUpEvent>>,
): AbilityResult {
    return {
        events: result.events,
        ...(result.matchState ? { matchState: result.matchState } : {}),
    };
}

function runtimeResultToTriggerResult(
    result: ReturnType<typeof executeAbilityProgram<unknown, SmashUpCore, SmashUpEvent>>,
    fallbackState: MatchState<SmashUpCore>,
): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    return {
        events: result.events,
        matchState: result.matchState ?? fallbackState,
    };
}

function giantAntSoldierOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: [addPowerCounter(ctx.cardUid, ctx.baseIndex, 2, 'giant_ant_soldier', ctx.now)],
    };
}

function giantAntSoldierPodOnPlay(ctx: AbilityContext): AbilityResult {
    const soldier = ctx.state.bases[ctx.baseIndex]?.minions.find(m => m.uid === ctx.cardUid);
    if (!soldier || soldier.controller !== ctx.playerId) {
        return { events: [] };
    }
    return {
        events: [addPowerCounter(ctx.cardUid, ctx.baseIndex, 2, 'giant_ant_soldier_pod', ctx.now)],
    };
}

function giantAntSoldierTalent(ctx: AbilityContext): AbilityResult {
    const soldier = ctx.state.bases[ctx.baseIndex]?.minions.find(m => m.uid === ctx.cardUid);
    if (!soldier || soldier.controller !== ctx.playerId) return { events: [] };
    if (soldier.powerCounters < 1) {
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
    return runtimeResultToAbilityResult(executeAbilityProgram(
        giantAntSoldierPromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            soldierUid: ctx.cardUid,
            soldierBaseIndex: ctx.baseIndex,
        }),
    ));
}

function giantAntDroneOnPlay(ctx: AbilityContext): AbilityResult {
    return {
        events: [addPowerCounter(ctx.cardUid, ctx.baseIndex, 1, 'giant_ant_drone', ctx.now)],
    };
}

function giantAntDronePodTalent(ctx: AbilityContext): AbilityResult {
    const drone = ctx.state.bases[ctx.baseIndex]?.minions.find(m => m.uid === ctx.cardUid);
    if (!drone || drone.controller !== ctx.playerId) return { events: [] };

    if (drone.powerCounters < 1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
    }

    const drawEvents = buildDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);

    return {
        events: [
            removePowerCounter(ctx.cardUid, ctx.baseIndex, 1, 'giant_ant_drone_pod', ctx.now),
            ...drawEvents,
        ],
    };
}


function giantAntKillerQueenTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(m => m.uid === ctx.cardUid);
    if (!self || self.controller !== ctx.playerId) return { events: [] };

    const playedHere = (ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) > 0;
    if (!playedHere) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    }

    // 只选择本回合打出的己方随从（不包括杀手女皇自己）
    const candidates = ctx.state.bases[ctx.baseIndex]?.minions
        .filter(m => m.controller === ctx.playerId && m.playedThisTurn && m.uid !== ctx.cardUid)
        .map(m => {
            const def = getCardDef(m.defId);
            return { uid: m.uid, defId: m.defId, baseIndex: ctx.baseIndex, label: def?.name ?? m.defId };
        }) ?? [];

    // 没有候选目标时，条件满足但无效果
    if (candidates.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    if (!ctx.matchState) return { events: [] };
    return runtimeResultToAbilityResult(executeAbilityProgram(
        giantAntKillerQueenPromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            queenUid: ctx.cardUid,
            queenBaseIndex: ctx.baseIndex,
        }),
    ));
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
    reason: string;
    promptTitle: string;
}

interface PowerCounterHolderCandidate {
    uid: string;
    defId: string;
    baseIndex: number;
    label: string;
    // 未来可扩展为 'titan' | 'ongoing'
    kind: 'minion';
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

interface SoldierPodTransferContext {
    sourceMinionUid: string;
    sourceBaseIndex: number;
}

interface DronePreventContext {
    targetMinionUid: string;
    targetMinionDefId: string;
    fromBaseIndex: number;
    toPlayerId: PlayerId;
    destroyerId?: PlayerId;
}

interface GimmePodFirstContext {
    firstMinionUid: string;
    firstBaseIndex: number;
}

interface KillerQueenPodContext {
    queenUid: string;
    queenBaseIndex: number;
}

interface WorkerPodReplayContext {
    cardUid: string;
    defId: string;
    fromBaseIndex: number;
}

interface CounterTransferSnapshot {
    uid: string;
    defId: string;
    baseIndex: number;
    counterAmount: number;
}

type HeadlongMoveContext = GiantAntPromptContext & {
    minionUid: string;
    minionDefId: string;
    fromBaseIndex: number;
};

type UnderPressureSourcePromptContext = GiantAntPromptContext & {
    scoringBaseIndex: number;
};

type CounterTransferPromptContext = GiantAntPromptContext & TransferContext;

type CounterTransferAmountPromptContext = GiantAntPromptContext & TransferContext & {
    targetMinionUid: string;
    targetBaseIndex: number;
};

type WeAreTheChampionsLiveSourcePromptContext = GiantAntPromptContext & WeAreTheChampionsSourceContext;

type WeAreTheChampionsSnapshotSourcePromptContext = GiantAntPromptContext & WeAreTheChampionsSourceContext & {
    sourceSnapshots: CounterTransferSnapshot[];
};

export function registerGiantAntAbilities(): void {
    // 基础版
    registerAbility('giant_ant_worker', 'onPlay', giantAntWorker);
    registerAbility('giant_ant_soldier', 'onPlay', giantAntSoldierOnPlay);
    registerAbilityProgram('giant_ant_soldier', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(giantAntSoldierTalent),
        validateUse: (ctx) => {
            const soldier = ctx.state.bases[ctx.baseIndex]?.minions.find(m => m.uid === ctx.cardUid);
            if (!soldier || soldier.controller !== ctx.playerId) return '当前无法发动此天赋';
            if (soldier.powerCounters < 1) return '该随从当前无法发动天赋：没有+1力量指示物';
            const hasOtherMinion = ctx.state.bases.some(base =>
                base.minions.some(minion => minion.uid !== ctx.cardUid),
            );
            return hasOtherMinion ? null : '当前没有可选择的目标';
        },
    });
    registerAbility('giant_ant_drone', 'onPlay', giantAntDroneOnPlay);
    registerAbilityProgram('giant_ant_killer_queen', 'talent', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(giantAntKillerQueenTalent),
        validateUse: (ctx) => {
            const self = ctx.state.bases[ctx.baseIndex]?.minions.find(m => m.uid === ctx.cardUid);
            if (!self || self.controller !== ctx.playerId) return '当前无法发动此天赋';
            const playedHere = (ctx.state.players[ctx.playerId]?.minionsPlayedPerBase?.[ctx.baseIndex] ?? 0) > 0;
            if (!playedHere) return '本回合你还没有在此基地打出过其它随从';
            const hasTarget = ctx.state.bases[ctx.baseIndex]?.minions.some(
                minion => minion.controller === ctx.playerId && minion.playedThisTurn && minion.uid !== ctx.cardUid,
            ) ?? false;
            return hasTarget ? null : '当前没有可选择的目标';
        },
    });

    registerAbility('giant_ant_who_wants_to_live_forever', 'onPlay', giantAntWhoWantsToLiveForever);
    registerAbility('giant_ant_a_kind_of_magic', 'onPlay', giantAntAKindOfMagic);
    registerAbility('giant_ant_we_will_rock_you', 'onPlay', giantAntWeWillRockYou);
    registerAbilityProgram('giant_ant_claim_the_prize', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(giantAntClaimThePrize),
    });
    registerAbilityProgram('giant_ant_under_pressure', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(giantAntUnderPressure),
    });
    registerAbilityProgram('giant_ant_headlong', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(giantAntHeadlong),
    });
    registerAbilityProgram('giant_ant_we_are_the_champions', 'special', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(giantAntWeAreTheChampions),
    });

    // POD 版本
    registerAbility('giant_ant_worker_pod', 'onPlay', giantAntWorker); // 复用基础版
    registerAbility('giant_ant_soldier_pod', 'onPlay', giantAntSoldierPodOnPlay);
    registerAbility('giant_ant_soldier_pod', 'talent', {
        execute: giantAntSoldierPodTalent,
        validateUse: (ctx) => {
            const sources = collectOwnMinionsWithCounters(ctx.state, ctx.playerId);
            if (sources.length === 0) return '当前没有带有+1力量指示物的己方随从';
            const allOwn = collectOwnMinions(ctx.state, ctx.playerId);
            return allOwn.length > 1 ? null : '当前没有可选择的目标';
        },
    });
    registerAbility('giant_ant_drone_pod', 'onPlay', giantAntDroneOnPlay); // 复用基础版
    registerAbility('giant_ant_drone_pod', 'talent', {
        execute: giantAntDronePodTalent,
        validateUse: (ctx) => {
            const drone = ctx.state.bases[ctx.baseIndex]?.minions.find(m => m.uid === ctx.cardUid);
            if (!drone || drone.controller !== ctx.playerId) return '当前无法发动此天赋';
            return drone.powerCounters >= 1 ? null : '该随从当前无法发动天赋：没有+1力量指示物';
        },
    });
    registerAbility('giant_ant_killer_queen_pod', 'talent', giantAntKillerQueenPodTalent);
    registerAbility('giant_ant_who_wants_to_live_forever_pod', 'onPlay', giantAntWhoWantsToLiveForeverPod);
    registerAbility('giant_ant_a_kind_of_magic_pod', 'onPlay', giantAntAKindOfMagicPod);
    registerAbility('giant_ant_we_will_rock_you_pod', 'onPlay', giantAntWeWillRockYouPod);
    registerAbility('giant_ant_gimme_the_prize_pod', 'onPlay', giantAntGimmeThePrizePod);
    registerAbility('giant_ant_under_pressure_pod', 'special', giantAntUnderPressure); // 复用基础版
    registerAbility('giant_ant_headlong_pod', 'onPlay', giantAntHeadlong); // 复用基础版
    registerAbility('giant_ant_we_are_the_champions_pod', 'special', giantAntWeAreTheChampions); // 复用基础版

    registerGiantAntProtections();
}

export function registerGiantAntInteractionHandlers(): void {
}

function giantAntWorker(ctx: AbilityContext): AbilityResult {
    return {
        events: [addPowerCounter(ctx.cardUid, ctx.baseIndex, 2, 'giant_ant_worker', ctx.now)],
    };
}

const giantAntSoldierPromptProgram = createPromptProgram<GiantAntPromptContext & SoldierTransferContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'giant_ant_soldier_choose_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_soldier_choose_minion_${context.now}`,
        context.playerId,
        '兵蚁：选择要获得 +1 力量指示物的另一个随从',
        buildMinionTargetOptions(
            collectOwnMinions(context.matchState.core, context.playerId)
                .filter(minion => minion.uid !== context.soldierUid),
            { state: context.matchState.core, sourcePlayerId: context.playerId, effectType: 'affect' },
        ),
        {
            sourceId: 'giant_ant_soldier_choose_minion',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_soldier_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        const soldier = state.core.bases[context.soldierBaseIndex]?.minions.find(m => m.uid === context.soldierUid);
        const target = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
        if (!soldier || !target || soldier.controller !== context.playerId || soldier.powerCounters < 1) {
            return { events: [] };
        }
        return {
            events: [
                removePowerCounter(context.soldierUid, context.soldierBaseIndex, 1, 'giant_ant_soldier', timestamp),
                addPowerCounter(target.uid, selected.baseIndex, 1, 'giant_ant_soldier', timestamp),
            ],
        };
    },
});

const giantAntKillerQueenPromptProgram = createPromptProgram<
    GiantAntPromptContext & { queenUid: string; queenBaseIndex: number },
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_killer_queen_choose_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_killer_queen_choose_minion_${context.now}`,
        context.playerId,
        '杀手女皇：选择本回合打到这里的随从（在其和女皇上各放1个指示物）',
        buildMinionTargetOptions(
            (context.matchState.core.bases[context.queenBaseIndex]?.minions ?? [])
                .filter(minion => minion.controller === context.playerId && minion.playedThisTurn && minion.uid !== context.queenUid)
                .map(minion => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex: context.queenBaseIndex,
                    label: getCardDef(minion.defId)?.name ?? minion.defId,
                })),
            { state: context.matchState.core, sourcePlayerId: context.playerId },
        ),
        {
            sourceId: 'giant_ant_killer_queen_choose_minion',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_killer_queen_title',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        const queen = state.core.bases[context.queenBaseIndex]?.minions.find(m => m.uid === context.queenUid);
        const target = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
        if (!queen || !target || queen.controller !== context.playerId || target.controller !== context.playerId) {
            return { events: [] };
        }
        return {
            events: [
                addPowerCounter(target.uid, selected.baseIndex, 1, 'giant_ant_killer_queen', timestamp),
                addPowerCounter(queen.uid, context.queenBaseIndex, 1, 'giant_ant_killer_queen', timestamp),
            ],
        };
    },
});

function buildDronePreventDestroyOptions(
    core: SmashUpCore,
    playerId: PlayerId,
): PromptOption<DronePreventChoiceValue>[] {
    const drones: { uid: string; defId: string; baseIndex: number }[] = [];
    for (let i = 0; i < core.bases.length; i++) {
        for (const minion of core.bases[i].minions) {
            if (minion.defId !== 'giant_ant_drone' && minion.defId !== 'giant_ant_drone_pod') continue;
            if (minion.controller !== playerId || minion.powerCounters <= 0) continue;
            drones.push({ uid: minion.uid, defId: minion.defId, baseIndex: i });
        }
    }
    return [
        createSkipOption('不防止消灭', 'ui.giant_ant_drone_prevent_destroy_skip_option') as PromptOption<DronePreventChoiceValue>,
        ...drones.map((drone, index) => {
            const baseDefId = core.bases[drone.baseIndex]?.defId;
            const baseDef = baseDefId ? getBaseDef(baseDefId) : undefined;
            const baseName = baseDef?.name ?? baseDefId ?? `基地 ${drone.baseIndex + 1}`;
            return {
                id: `drone-${index}`,
                label: `移除雄蜂的1个指示物（${baseName}）来防止消灭`,
                labelKey: 'ui.giant_ant_drone_prevent_destroy_option',
                labelParams: { baseName: baseDef && baseDefId ? `cards.${baseDefId}.name` : baseName },
                value: {
                    droneUid: drone.uid,
                    droneBaseIndex: drone.baseIndex,
                    minionUid: drone.uid,
                    minionDefId: drone.defId,
                },
                _source: 'field' as const,
                displayMode: 'card' as const,
            };
        }),
    ];
}

const giantAntDronePreventDestroyPromptProgram = createPromptProgram<
    GiantAntPromptContext & DronePreventContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_drone_prevent_destroy',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `giant_ant_drone_prevent_destroy_${context.targetMinionUid}_${context.fromBaseIndex}_${context.now}`,
            context.playerId,
            '雄蜂：是否移除1个力量指示物来防止该随从被消灭？',
            buildDronePreventDestroyOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'giant_ant_drone_prevent_destroy',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'snapshot',
                titleKey: 'ui.giant_ant_drone_prevent_destroy_title',
            },
        );
        (interaction.data as Record<string, unknown>).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
        ) => buildDronePreventDestroyOptions(latestState.core, context.playerId);
        return interaction;
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { skip?: boolean; droneUid?: string; droneBaseIndex?: number };
        if (selected.skip) {
            return {
                events: buildValidatedDestroyEvents(state, {
                    minionUid: context.targetMinionUid,
                    minionDefId: context.targetMinionDefId,
                    fromBaseIndex: context.fromBaseIndex,
                    destroyerId: context.destroyerId,
                    reason: 'giant_ant_drone_skip',
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceControllerId: context.playerId,
                    sourceKind: 'nonAction',
                }),
            };
        }
        if (!selected.droneUid || selected.droneBaseIndex === undefined) return { events: [] };

        const drone = state.core.bases[selected.droneBaseIndex]?.minions.find(m => m.uid === selected.droneUid);
        const target = state.core.bases[context.fromBaseIndex]?.minions.find(m => m.uid === context.targetMinionUid);
        if (!drone || !target || drone.controller !== context.playerId || drone.powerCounters <= 0) {
            return {
                events: buildValidatedDestroyEvents(state, {
                    minionUid: context.targetMinionUid,
                    minionDefId: context.targetMinionDefId,
                    fromBaseIndex: context.fromBaseIndex,
                    destroyerId: context.destroyerId,
                    reason: 'giant_ant_drone_skip',
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceControllerId: context.playerId,
                    sourceKind: 'nonAction',
                    targetSnapshot: target
                        ? {
                            ownerId: target.owner,
                            controllerId: target.controller,
                            attachedActions: target.attachedActions,
                            metadata: target.metadata,
                            playedThisTurn: target.playedThisTurn,
                        }
                        : undefined,
                }),
            };
        }

        return {
            events: [removePowerCounter(selected.droneUid, selected.droneBaseIndex, 1, drone.defId, timestamp)],
        };
    },
});

const giantAntClaimThePrizePromptProgram = createPromptProgram<
    GiantAntPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_claim_the_prize',
    buildInteraction: (context) => {
        const options = collectOwnMinions(context.matchState.core, context.playerId).map((minion) => ({
            id: `minion-${minion.uid}`,
            label: minion.label,
            displayMode: 'card' as const,
            _source: 'field' as const,
            value: {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                baseIndex: minion.baseIndex,
                defId: minion.defId,
            },
        }));

        return createAbilityRuntimeSimpleChoice(
            `giant_ant_claim_the_prize_${context.now}`,
            context.playerId,
            '至多选择3个你的随从，每个放置1个力量指示物',
            options,
            {
                sourceId: 'giant_ant_claim_the_prize',
                targetType: 'minion',
                multi: { min: 0, max: Math.min(3, options.length) },
                autoResolveIfSingle: false,
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.giant_ant_claim_the_prize_title',
            },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selections = Array.isArray(value) ? value as Array<{ minionUid?: string; baseIndex?: number }> : [];
        const unique = new Map<string, { minionUid: string; baseIndex: number }>();

        for (const item of selections) {
            if (!item?.minionUid || item.baseIndex === undefined) continue;
            unique.set(item.minionUid, { minionUid: item.minionUid, baseIndex: item.baseIndex });
        }

        const events: SmashUpEvent[] = [];
        for (const item of unique.values()) {
            const minion = state.core.bases[item.baseIndex]?.minions.find(m => m.uid === item.minionUid);
            if (!minion || minion.controller !== context.playerId) continue;
            events.push(addPowerCounter(item.minionUid, item.baseIndex, 1, 'giant_ant_claim_the_prize', timestamp));
        }

        return { events };
    },
});

const giantAntHeadlongChooseBasePromptProgram = createPromptProgram<
    HeadlongMoveContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_headlong_choose_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_headlong_base_${context.now}`,
        context.playerId,
        '选择要移动到的基地',
        buildBaseTargetOptions(
            context.matchState.core.bases
                .map((base, index) => ({
                    baseIndex: index,
                    label: getCardDef(base.defId)?.name ?? `基地 ${index + 1}`,
                }))
                .filter(base => base.baseIndex !== context.fromBaseIndex),
            context.matchState.core,
        ),
        {
            sourceId: 'giant_ant_headlong_choose_base',
            targetType: 'base',
            autoRefresh: 'base',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_headlong_choose_base_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { baseIndex?: number };
        if (selected.baseIndex === undefined) return { events: [] };

        const minion = state.core.bases[context.fromBaseIndex]?.minions.find(m => m.uid === context.minionUid);
        if (!minion || minion.controller !== context.playerId) return { events: [] };

        return {
            events: [
                ...buildValidatedMoveEvents(state, {
                    minionUid: context.minionUid,
                    minionDefId: context.minionDefId,
                    fromBaseIndex: context.fromBaseIndex,
                    toBaseIndex: selected.baseIndex,
                    reason: 'giant_ant_headlong',
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceDefId: 'giant_ant_headlong',
                    sourceControllerId: context.playerId,
                    sourceKind: 'action',
                }),
                addPowerCounter(context.minionUid, selected.baseIndex, 2, 'giant_ant_headlong', timestamp),
            ],
        };
    },
});

const giantAntHeadlongChooseMinionPromptProgram = createPromptProgram<
    GiantAntPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_headlong_choose_minion',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_headlong_minion_${context.now}`,
        context.playerId,
        '选择要移动的己方随从',
        buildMinionTargetOptions(
            collectOwnMinions(context.matchState.core, context.playerId),
            { state: context.matchState.core, sourcePlayerId: context.playerId },
        ),
        {
            sourceId: 'giant_ant_headlong_choose_minion',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_headlong_choose_minion_title',
        },
    ),
    onResolve: ({ state, context, value }) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };

        const minion = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
        if (!minion || minion.controller !== context.playerId) return { events: [] };

        return {
            events: [],
            context: {
                ...context,
                minionUid: selected.minionUid,
                minionDefId: selected.defId ?? minion.defId,
                fromBaseIndex: selected.baseIndex,
            },
            nextProgram: giantAntHeadlongChooseBasePromptProgram,
        };
    },
});

const giantAntUnderPressureChooseAmountPromptProgram = createPromptProgram<
    CounterTransferAmountPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_under_pressure_choose_amount',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `giant_ant_under_pressure_choose_amount_${context.now}`,
            context.playerId,
            '承受压力：选择要转移的力量指示物数量',
            [{
                id: 'confirm-transfer',
                label: '确认转移',
                labelKey: 'ui.giant_ants_transfer_counters_confirm',
                labelParams: { value: context.sourceCounterAmount },
                value: { amount: context.sourceCounterAmount, value: context.sourceCounterAmount },
                displayMode: 'button' as const,
            }],
            {
                sourceId: 'giant_ant_under_pressure_choose_amount',
                targetType: 'button',
                titleKey: 'ui.giant_ant_under_pressure_choose_amount_title',
            },
        );
        (interaction.data as Record<string, unknown>).slider = {
            min: 1,
            max: context.sourceCounterAmount,
            step: 1,
            defaultValue: context.sourceCounterAmount,
            confirmOptionId: 'confirm-transfer',
            confirmLabelKey: 'ui.giant_ants_transfer_counters_confirm',
            valueLabelKey: 'ui.giant_ants_under_pressure_value_label',
        };
        return interaction;
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { amount?: number; value?: number };
        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(m => m.uid === context.sourceMinionUid);
        const target = state.core.bases[context.targetBaseIndex]?.minions.find(m => m.uid === context.targetMinionUid);
        if (!source || !target || source.controller !== context.playerId || target.controller !== context.playerId) {
            return { events: [] };
        }

        const amount = resolveTransferAmount(selected, source.powerCounters);
        if (amount <= 0) return { events: [] };

        return {
            events: [
                removePowerCounter(source.uid, context.sourceBaseIndex, amount, 'giant_ant_under_pressure', timestamp),
                addPowerCounter(target.uid, context.targetBaseIndex, amount, 'giant_ant_under_pressure', timestamp),
            ],
        };
    },
});

const giantAntUnderPressureChooseTargetPromptProgram = createPromptProgram<
    CounterTransferPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_under_pressure_choose_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_under_pressure_choose_target_${context.now}`,
        context.playerId,
        '选择其他基地上接收力量指示物的随从',
        buildMinionTargetOptions(
            collectOwnMinions(context.matchState.core, context.playerId).filter(
                minion => minion.uid !== context.sourceMinionUid && minion.baseIndex !== context.scoringBaseIndex,
            ),
            { state: context.matchState.core, sourcePlayerId: context.playerId },
        ),
        {
            sourceId: 'giant_ant_under_pressure_choose_target',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_under_pressure_choose_target_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        if (selected.minionUid === context.sourceMinionUid) return { events: [] };

        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(m => m.uid === context.sourceMinionUid);
        const target = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
        if (!source || !target || source.controller !== context.playerId || target.controller !== context.playerId) {
            return { events: [] };
        }

        const maxAmount = source.powerCounters;
        if (maxAmount <= 0) return { events: [] };
        if (maxAmount === 1) {
            return {
                events: [
                    removePowerCounter(source.uid, context.sourceBaseIndex, 1, 'giant_ant_under_pressure', timestamp),
                    addPowerCounter(target.uid, selected.baseIndex, 1, 'giant_ant_under_pressure', timestamp),
                ],
            };
        }

        return {
            events: [],
            context: {
                ...context,
                sourceCounterAmount: maxAmount,
                targetMinionUid: target.uid,
                targetBaseIndex: selected.baseIndex,
            },
            nextProgram: giantAntUnderPressureChooseAmountPromptProgram,
        };
    },
});

const giantAntUnderPressureChooseSourcePromptProgram = createPromptProgram<
    UnderPressureSourcePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_under_pressure_choose_source',
    buildInteraction: (context) => {
        const scoringBase = context.matchState.core.bases[context.scoringBaseIndex];
        const sources = (scoringBase?.minions ?? [])
            .filter(minion => minion.controller === context.playerId && minion.powerCounters > 0)
            .map(minion => ({
                uid: minion.uid,
                baseIndex: context.scoringBaseIndex,
                defId: minion.defId,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量指示物 ${minion.powerCounters}）`,
            }));

        return createAbilityRuntimeSimpleChoice(
            `giant_ant_under_pressure_choose_source_${context.now}`,
            context.playerId,
            '选择计分基地上要转出力量指示物的随从',
            sources.flatMap(source => buildFieldSourceActionOptions({
                type: 'minion',
                uid: source.uid,
                defId: source.defId,
                baseIndex: source.baseIndex,
                label: source.label,
            })),
            buildFieldSourceActionPromptConfig({
                sourceId: 'giant_ant_under_pressure_choose_source',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.giant_ant_under_pressure_choose_source_title',
            }),
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };

        const source = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
        if (!source || source.controller !== context.playerId || source.powerCounters <= 0) return { events: [] };

        const targets = collectOwnMinions(state.core, context.playerId).filter(
            minion => minion.uid !== selected.minionUid && minion.baseIndex !== context.scoringBaseIndex,
        );
        if (targets.length === 0) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
        }

        return {
            events: [],
            context: {
                ...context,
                sourceMinionUid: selected.minionUid,
                sourceDefId: selected.defId ?? source.defId,
                sourceBaseIndex: selected.baseIndex,
                sourceCounterAmount: source.powerCounters,
                reason: 'giant_ant_under_pressure',
                scoringBaseIndex: context.scoringBaseIndex,
            },
            nextProgram: giantAntUnderPressureChooseTargetPromptProgram,
        };
    },
});

const giantAntWeAreTheChampionsChooseAmountPromptProgram = createPromptProgram<
    CounterTransferAmountPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_we_are_the_champions_choose_amount',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `giant_ant_we_are_the_champions_choose_amount_${context.now}`,
            context.playerId,
            '我们乃最强：选择要转移的力量指示物数量',
            [{
                id: 'confirm-transfer',
                label: '确认转移',
                labelKey: 'ui.giant_ants_transfer_counters_confirm',
                labelParams: { value: context.sourceCounterAmount },
                value: { amount: context.sourceCounterAmount, value: context.sourceCounterAmount },
                displayMode: 'button' as const,
            }],
            {
                sourceId: 'giant_ant_we_are_the_champions_choose_amount',
                targetType: 'button',
                titleKey: 'ui.giant_ant_we_are_the_champions_choose_amount_title',
            },
        );
        (interaction.data as Record<string, unknown>).slider = {
            min: 1,
            max: context.sourceCounterAmount,
            step: 1,
            defaultValue: context.sourceCounterAmount,
            confirmOptionId: 'confirm-transfer',
            confirmLabelKey: 'ui.giant_ants_transfer_counters_confirm',
            valueLabelKey: 'ui.giant_ants_we_are_the_champions_value_label',
        };
        return interaction;
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { amount?: number; value?: number };
        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(m => m.uid === context.sourceMinionUid);
        const target = state.core.bases[context.targetBaseIndex]?.minions.find(m => m.uid === context.targetMinionUid);
        const sourceMissingByScoring = !source && context.scoringBaseIndex !== undefined;
        if ((!source && !sourceMissingByScoring) || !target || (source && source.controller !== context.playerId) || target.controller !== context.playerId) {
            return { events: [] };
        }

        const maxAmount = source?.powerCounters ?? context.sourceCounterAmount;
        const amount = resolveTransferAmount(selected, maxAmount);
        if (amount <= 0) return { events: [] };

        return {
            events: sourceMissingByScoring || !source
                ? [addPowerCounter(target.uid, context.targetBaseIndex, amount, context.reason, timestamp)]
                : [
                    removePowerCounter(source.uid, context.sourceBaseIndex, amount, context.reason, timestamp),
                    addPowerCounter(target.uid, context.targetBaseIndex, amount, context.reason, timestamp),
                ],
        };
    },
});

const giantAntWeAreTheChampionsChooseTargetPromptProgram = createPromptProgram<
    CounterTransferPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_we_are_the_champions_choose_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_we_are_the_champions_choose_target_${context.now}`,
        context.playerId,
        '选择接收力量指示物的随从',
        buildMinionTargetOptions(
            collectOwnMinions(context.matchState.core, context.playerId).filter(minion => minion.uid !== context.sourceMinionUid),
            { state: context.matchState.core, sourcePlayerId: context.playerId },
        ),
        {
            sourceId: 'giant_ant_we_are_the_champions_choose_target',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_we_are_the_champions_choose_target_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        if (selected.minionUid === context.sourceMinionUid) return { events: [] };

        const source = state.core.bases[context.sourceBaseIndex]?.minions.find(m => m.uid === context.sourceMinionUid);
        const target = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
        const sourceMissingByScoring = !source && context.scoringBaseIndex !== undefined;
        if ((!source && !sourceMissingByScoring) || !target || (source && source.controller !== context.playerId) || target.controller !== context.playerId) {
            return { events: [] };
        }

        const maxAmount = source?.powerCounters ?? context.sourceCounterAmount;
        if (maxAmount <= 0) return { events: [] };
        if (maxAmount === 1) {
            return {
                events: sourceMissingByScoring || !source
                    ? [addPowerCounter(target.uid, selected.baseIndex, 1, context.reason, timestamp)]
                    : [
                        removePowerCounter(source.uid, context.sourceBaseIndex, 1, context.reason, timestamp),
                        addPowerCounter(target.uid, selected.baseIndex, 1, context.reason, timestamp),
                    ],
            };
        }

        return {
            events: [],
            context: {
                ...context,
                sourceCounterAmount: maxAmount,
                targetMinionUid: target.uid,
                targetBaseIndex: selected.baseIndex,
            },
            nextProgram: giantAntWeAreTheChampionsChooseAmountPromptProgram,
        };
    },
});

const giantAntWeAreTheChampionsChooseSourcePromptProgram = createPromptProgram<
    WeAreTheChampionsLiveSourcePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_we_are_the_champions_choose_source',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_we_are_the_champions_choose_source_${context.now}_${context.playerId}`,
        context.playerId,
        '我们乃最强：选择转出力量指示物的随从',
        (context.matchState.core.bases[context.scoringBaseIndex]?.minions ?? [])
            .filter(minion => minion.controller === context.playerId && minion.powerCounters > 0)
            .flatMap(minion => buildFieldSourceActionOptions({
                type: 'minion',
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.scoringBaseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId}（力量指示物 ${minion.powerCounters}）`,
            }, { counterAmount: minion.powerCounters })),
        buildFieldSourceActionPromptConfig({
            sourceId: 'giant_ant_we_are_the_champions_choose_source',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_we_are_the_champions_choose_source_title',
        }),
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string; counterAmount?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };

        const source = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
        const sourceCounterAmount = source?.powerCounters ?? selected.counterAmount ?? 0;
        if (!source || source.controller !== context.playerId || sourceCounterAmount <= 0) return { events: [] };

        const targets = collectOwnMinions(state.core, context.playerId).filter(minion => minion.uid !== selected.minionUid);
        if (targets.length === 0) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
        }

        return {
            events: [],
            context: {
                ...context,
                sourceMinionUid: selected.minionUid,
                sourceDefId: selected.defId ?? source.defId,
                sourceBaseIndex: selected.baseIndex,
                sourceCounterAmount,
                reason: context.reason,
                scoringBaseIndex: context.scoringBaseIndex,
            },
            nextProgram: giantAntWeAreTheChampionsChooseTargetPromptProgram,
        };
    },
});

const giantAntWeAreTheChampionsChooseSnapshotSourcePromptProgram = createPromptProgram<
    WeAreTheChampionsSnapshotSourcePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_we_are_the_champions_choose_snapshot_source',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_we_are_the_champions_choose_source_${context.now}_${context.playerId}`,
        context.playerId,
        '我们乃最强：计分后选择转出力量指示物的随从',
        context.sourceSnapshots.map((snapshot, index) => ({
            id: `minion-${index}`,
            label: `${getCardDef(snapshot.defId)?.name ?? snapshot.defId}（力量指示物 ${snapshot.counterAmount}）`,
            value: {
                minionUid: snapshot.uid,
                minionDefId: snapshot.defId,
                baseIndex: snapshot.baseIndex,
                defId: snapshot.defId,
                counterAmount: snapshot.counterAmount,
            },
            _source: 'static' as const,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'giant_ant_we_are_the_champions_choose_snapshot_source',
            targetType: 'generic',
            titleKey: 'ui.giant_ant_we_are_the_champions_choose_snapshot_source_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string; counterAmount?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };

        const source = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
        const sourceCounterAmount = source?.powerCounters ?? selected.counterAmount ?? 0;
        const allowScoringFallback = !source && context.scoringBaseIndex === selected.baseIndex;
        if ((!source && !allowScoringFallback) || (source && source.controller !== context.playerId) || sourceCounterAmount <= 0) {
            return { events: [] };
        }

        const targets = collectOwnMinions(state.core, context.playerId).filter(minion => minion.uid !== selected.minionUid);
        if (targets.length === 0) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
        }

        return {
            events: [],
            context: {
                ...context,
                sourceMinionUid: selected.minionUid,
                sourceDefId: selected.defId ?? source?.defId ?? 'giant_ant_worker',
                sourceBaseIndex: selected.baseIndex,
                sourceCounterAmount,
                reason: context.reason,
                scoringBaseIndex: context.scoringBaseIndex,
            },
            nextProgram: giantAntWeAreTheChampionsChooseTargetPromptProgram,
        };
    },
});

const giantAntWhoWantsToLiveForeverPromptProgram = createPromptProgram<
    GiantAntPromptContext & WhoWantsContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_who_wants_to_live_forever',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `giant_ant_who_wants_to_live_forever_${context.now}`,
            context.playerId,
            `无人想要永生：点击随从移除1个力量指示物（已移除 ${context.removedTotal}）`,
            buildWhoWantsToLiveForeverOptions(context.matchState.core, context.playerId, context.removedTotal),
            {
                sourceId: 'giant_ant_who_wants_to_live_forever',
                targetType: 'minion',
                autoResolveIfSingle: false,
                responseValidationMode: 'live',
                titleKey: 'ui.giant_ant_who_wants_to_live_forever_title',
                titleParams: { removedTotal: context.removedTotal },
            },
        );
        (interaction.data as Record<string, unknown>).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
        ) => buildWhoWantsToLiveForeverOptions(latestState.core, context.playerId, context.removedTotal);
        return interaction;
    },
    onResolve: ({ state, context, value, random, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string; confirm?: boolean; cancel?: boolean; skip?: boolean };

        if (selected.cancel) {
            const restoreEvents = Object.values(context.removedByMinion)
                .filter(item => item.count > 0)
                .map(item => addPowerCounter(item.minionUid, item.baseIndex, item.count, 'giant_ant_who_wants_to_live_forever', timestamp));
            return {
                events: buildActionCancelRollbackEvents(
                    context.playerId,
                    context.actionCardUid,
                    'giant_ant_who_wants_to_live_forever',
                    timestamp,
                    restoreEvents,
                ),
            };
        }

        if (selected.confirm) {
            if (context.removedTotal <= 0) return { events: [] };
            return { events: buildDrawEvents(state.core, context.playerId, context.removedTotal, random, timestamp) };
        }

        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };

        const minion = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
        if (!minion || minion.controller !== context.playerId || minion.powerCounters <= 0) {
            return { events: [] };
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

        return {
            events: [removePowerCounter(selected.minionUid, selected.baseIndex, 1, 'giant_ant_who_wants_to_live_forever', timestamp)],
            context: {
                ...context,
                removedByMinion: {
                    ...context.removedByMinion,
                    [selected.minionUid]: updatedSnapshot,
                },
                removedTotal: context.removedTotal + 1,
            },
            nextProgram: giantAntWhoWantsToLiveForeverPromptProgram,
        };
    },
});

const giantAntAKindOfMagicDistributePromptProgram = createPromptProgram<
    GiantAntPromptContext & KindOfMagicContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_a_kind_of_magic_distribute',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `giant_ant_a_kind_of_magic_${context.now}`,
            context.playerId,
            `${context.promptTitle}：将力量指示物重新分配（剩余 ${context.remaining}）`,
            buildAKindOfMagicOptions(context.matchState.core, context.playerId),
            {
                sourceId: 'giant_ant_a_kind_of_magic_distribute',
                targetType: 'minion',
                autoResolveIfSingle: false,
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: context.reason === 'giant_ant_a_kind_of_magic_pod'
                    ? 'ui.giant_ant_a_kind_of_magic_pod_distribute_title'
                    : 'ui.giant_ant_a_kind_of_magic_distribute_title',
                titleParams: { remaining: context.remaining },
            },
        );
        (interaction.data as Record<string, unknown>).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
        ) => buildAKindOfMagicOptions(latestState.core, context.playerId);
        return interaction;
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string; cancel?: boolean; skip?: boolean };

        if (selected.cancel) {
            const removeDistributedEvents = Object.values(context.distributedByMinion)
                .filter(item => item.count > 0)
                .map(item => removePowerCounter(item.minionUid, item.baseIndex, item.count, `${context.reason}_cancel`, timestamp));

            const restoreEvents = context.removedSnapshots
                .filter(item => item.count > 0)
                .map(item => addPowerCounter(item.minionUid, item.baseIndex, item.count, `${context.reason}_cancel`, timestamp));

            return {
                events: buildActionCancelRollbackEvents(
                    context.playerId,
                    context.actionCardUid,
                    context.reason,
                    timestamp,
                    [...removeDistributedEvents, ...restoreEvents],
                ),
            };
        }

        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        if (context.remaining <= 0) return { events: [] };

        const target = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
        if (!target || target.controller !== context.playerId) return { events: [] };

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

        const nextContext = {
            ...context,
            remaining: context.remaining - 1,
            distributedByMinion: {
                ...context.distributedByMinion,
                [selected.minionUid]: nextDistributed,
            },
        };

        return nextContext.remaining <= 0
            ? {
                events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, context.reason, timestamp)],
            }
            : {
                events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, context.reason, timestamp)],
                context: nextContext,
                nextProgram: giantAntAKindOfMagicDistributePromptProgram,
            };
    },
});

const giantAntWeWillRockYouPodPromptProgram = createPromptProgram<
    GiantAntPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_we_will_rock_you_pod_choose_base',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_we_will_rock_you_pod_base_${context.now}`,
        context.playerId,
        '摇滚万岁 POD：选择一个基地（该基地上己方随从按力量指示物数获得临时+力量）',
        buildBaseTargetOptions(
            context.matchState.core.bases.map((base, index) => ({
                baseIndex: index,
                label: getCardDef(base.defId)?.name ?? `基地 ${index + 1}`,
            })),
            context.matchState.core,
        ),
        {
            sourceId: 'giant_ant_we_will_rock_you_pod_choose_base',
            targetType: 'base',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_we_will_rock_you_pod_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { baseIndex?: number };
        if (selected.baseIndex === undefined) return { events: [] };
        const base = state.core.bases[selected.baseIndex];
        if (!base) return { events: [] };

        const events: SmashUpEvent[] = [];
        for (const minion of base.minions) {
            if (minion.controller !== context.playerId) continue;
            if (minion.powerCounters <= 0) continue;
            events.push(addTempPower(minion.uid, selected.baseIndex, minion.powerCounters, 'giant_ant_we_will_rock_you_pod', timestamp));
        }
        return { events };
    },
});

const giantAntGimmeThePrizePodSecondPromptProgram = createPromptProgram<
    GiantAntPromptContext & GimmePodFirstContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_gimme_the_prize_pod_second',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_gimme_the_prize_pod_second_${context.now}`,
        context.playerId,
        'Gimme the Prize POD：选择第二个随从（获得+1力量指示物）',
        buildMinionTargetOptions(
            collectOwnMinions(context.matchState.core, context.playerId)
                .filter((minion) => minion.uid !== context.firstMinionUid),
            { state: context.matchState.core, sourcePlayerId: context.playerId },
        ),
        {
            sourceId: 'giant_ant_gimme_the_prize_pod_second',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_gimme_the_prize_pod_second_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        if (selected.minionUid === context.firstMinionUid) return { events: [] };

        const second = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!second || second.controller !== context.playerId) return { events: [] };

        return {
            events: [addPowerCounter(second.uid, selected.baseIndex, 1, 'giant_ant_gimme_the_prize_pod', timestamp)],
        };
    },
});

const giantAntGimmeThePrizePodFirstPromptProgram = createPromptProgram<
    GiantAntPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_gimme_the_prize_pod_first',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_gimme_the_prize_pod_first_${context.now}`,
        context.playerId,
        'Gimme the Prize POD：选择第一个随从（获得+2力量指示物）',
        collectOwnMinions(context.matchState.core, context.playerId).map((minion) => ({
            id: `minion-${minion.uid}`,
            label: minion.label,
            displayMode: 'card' as const,
            _source: 'field' as const,
            value: { minionUid: minion.uid, minionDefId: minion.defId, baseIndex: minion.baseIndex, defId: minion.defId },
        })),
        {
            sourceId: 'giant_ant_gimme_the_prize_pod_first',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_gimme_the_prize_pod_first_title',
            autoResolveIfSingle: false,
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };

        const first = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!first || first.controller !== context.playerId) return { events: [] };

        const events: SmashUpEvent[] = [
            addPowerCounter(first.uid, selected.baseIndex, 2, 'giant_ant_gimme_the_prize_pod', timestamp),
        ];

        const hasSecondTarget = collectOwnMinions(state.core, context.playerId).some(
            (minion) => minion.uid !== selected.minionUid,
        );
        if (!hasSecondTarget) {
            return { events };
        }

        return {
            events,
            context: {
                ...context,
                firstMinionUid: selected.minionUid,
                firstBaseIndex: selected.baseIndex,
            },
            nextProgram: giantAntGimmeThePrizePodSecondPromptProgram,
        };
    },
});

const giantAntSoldierPodChooseTargetPromptProgram = createPromptProgram<
    GiantAntPromptContext & SoldierPodTransferContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_soldier_pod_choose_target',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_soldier_pod_choose_target_${context.now}`,
        context.playerId,
        '兵蚁 POD：选择接收力量指示物的随从',
        buildMinionTargetOptions(
            collectOwnMinions(context.matchState.core, context.playerId)
                .filter((minion) => minion.uid !== context.sourceMinionUid),
            { state: context.matchState.core, sourcePlayerId: context.playerId, effectType: 'affect' },
        ),
        {
            sourceId: 'giant_ant_soldier_pod_choose_target',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_soldier_pod_choose_target_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };
        if (selected.minionUid === context.sourceMinionUid) return { events: [] };

        const source = state.core.bases[context.sourceBaseIndex]?.minions.find((minion) => minion.uid === context.sourceMinionUid);
        const target = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!source || !target || source.controller !== context.playerId || target.controller !== context.playerId) {
            return { events: [] };
        }
        if (source.powerCounters <= 0) return { events: [] };

        return {
            events: [
                removePowerCounter(source.uid, context.sourceBaseIndex, 1, 'giant_ant_soldier_pod', timestamp),
                addPowerCounter(target.uid, selected.baseIndex, 1, 'giant_ant_soldier_pod', timestamp),
            ],
        };
    },
});

const giantAntSoldierPodChooseSourcePromptProgram = createPromptProgram<
    GiantAntPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_soldier_pod_choose_source',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_soldier_pod_choose_source_${context.now}`,
        context.playerId,
        '兵蚁 POD：选择要移出力量指示物的随从',
        collectOwnMinionsWithCounters(context.matchState.core, context.playerId)
            .flatMap(source => buildFieldSourceActionOptions({
                type: 'minion',
                uid: source.uid,
                defId: source.defId,
                baseIndex: source.baseIndex,
                label: source.label,
            })),
        buildFieldSourceActionPromptConfig({
            sourceId: 'giant_ant_soldier_pod_choose_source',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_soldier_pod_choose_source_title',
        }),
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };

        const source = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!source || source.controller !== context.playerId || source.powerCounters <= 0) {
            return { events: [] };
        }

        const hasTarget = collectOwnMinions(state.core, context.playerId).some(
            (minion) => minion.uid !== selected.minionUid,
        );
        if (!hasTarget) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
        }

        return {
            events: [],
            context: {
                ...context,
                sourceMinionUid: selected.minionUid,
                sourceBaseIndex: selected.baseIndex,
            },
            nextProgram: giantAntSoldierPodChooseTargetPromptProgram,
        };
    },
});

const giantAntKillerQueenPodPromptProgram = createPromptProgram<
    GiantAntPromptContext & KillerQueenPodContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_killer_queen_pod_choose',
    buildInteraction: (context) => {
        const playedThisTurn = (context.matchState.core.bases[context.queenBaseIndex]?.minions ?? [])
            .filter((minion) => minion.controller === context.playerId && minion.playedThisTurn && minion.uid !== context.queenUid)
            .map((minion, index) => ({
                id: `minion-${index}`,
                label: `选择 ${getCardDef(minion.defId)?.name ?? minion.defId}（在该随从和杀手女皇上各放1个指示物）`,
                labelKey: 'ui.giant_ant_killer_queen_pod_add_counters_option',
                labelParams: { minionName: getCardDef(minion.defId)?.name ?? minion.defId },
                value: {
                    action: 'add_counters',
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    baseIndex: context.queenBaseIndex,
                    defId: minion.defId,
                },
                _source: 'field' as const,
                displayMode: 'card' as const,
            }));

        return createAbilityRuntimeSimpleChoice(
            `giant_ant_killer_queen_pod_choose_${context.now}`,
            context.playerId,
            '杀手女皇 POD：选择一个效果',
            [
                {
                    id: 'search_deck',
                    label: '从牌库顶翻牌直到找到力量≤1的随从并抽到手牌',
                    labelKey: 'ui.giant_ant_killer_queen_pod_search_deck_option',
                    value: { action: 'search_deck' },
                    _source: 'static' as const,
                    displayMode: 'button' as const,
                },
                ...playedThisTurn,
            ],
            {
                sourceId: 'giant_ant_killer_queen_pod_choose',
                targetType: 'minion',
                autoRefresh: 'field',
                responseValidationMode: 'live',
                titleKey: 'ui.giant_ant_killer_queen_pod_title',
            },
        );
    },
    onResolve: ({ state, context, value, random, timestamp }) => {
        const selected = value as { action?: string; minionUid?: string; baseIndex?: number };

        if (selected.action === 'search_deck') {
            const { events: revealEvents, picked } = revealAndPickFromDeck({
                state: state.core,
                playerId: context.playerId,
                predicate: (card) => {
                    if (card.type !== 'minion') return false;
                    const def = getCardDef(card.defId);
                    if (!def || def.type !== 'minion') return false;
                    return (def as any).power <= 1;
                },
                maxPick: 1,
                missTarget: 'deck_bottom',
                revealTo: context.playerId,
                reason: 'giant_ant_killer_queen_pod_search',
                now: timestamp,
                random,
            });

            const events: SmashUpEvent[] = [...revealEvents];
            const player = state.core.players[context.playerId];
            if (player && player.deck.length > 0) {
                const shuffled = random.shuffle([...player.deck]);
                events.push({
                    type: SU_EVENTS.DECK_REORDERED,
                    payload: {
                        playerId: context.playerId,
                        deckUids: shuffled.map((card) => card.uid),
                    },
                    timestamp,
                } as SmashUpEvent);
            }
            if (picked.length === 0) {
                events.push(buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp));
            }
            return { events };
        }

        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };

        const queen = state.core.bases[context.queenBaseIndex]?.minions.find((minion) => minion.uid === context.queenUid);
        const target = state.core.bases[selected.baseIndex]?.minions.find((minion) => minion.uid === selected.minionUid);
        if (!queen || !target || queen.controller !== context.playerId || target.controller !== context.playerId) {
            return { events: [] };
        }

        return {
            events: [
                addPowerCounter(target.uid, selected.baseIndex, 1, 'giant_ant_killer_queen_pod', timestamp),
                addPowerCounter(queen.uid, context.queenBaseIndex, 1, 'giant_ant_killer_queen_pod', timestamp),
            ],
        };
    },
});

const giantAntWhoWantsToLiveForeverPodSearchPromptProgram = createPromptProgram<
    GiantAntPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_who_wants_to_live_forever_pod_search',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_who_wants_to_live_forever_pod_search_${context.now}`,
        context.playerId,
        '从牌库选择一张牌放到牌库顶（不展示）',
        (context.matchState.core.players[context.playerId]?.deck ?? []).map((card, index) => ({
            id: `deck-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'deck' as const,
            displayMode: 'card' as const,
        })),
        {
            sourceId: 'giant_ant_who_wants_to_live_forever_pod_search',
            targetType: 'generic',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_who_wants_to_live_forever_pod_search_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { cardUid?: string; defId?: string };
        if (!selected.cardUid || !selected.defId) return { events: [] };

        const player = state.core.players[context.playerId];
        if (!player) return { events: [] };

        const card = player.deck.find((entry) => entry.uid === selected.cardUid);
        if (!card) return { events: [] };
        const ownerId = card.owner;

        return {
            events: [{
                type: SU_EVENTS.CARD_TO_DECK_TOP,
                payload: {
                    cardUid: selected.cardUid,
                    defId: card.defId,
                    ownerId,
                    ...(ownerId !== context.playerId ? { sourcePlayerId: context.playerId } : {}),
                    reason: 'giant_ant_who_wants_to_live_forever_pod',
                },
                timestamp,
            } as SmashUpEvent],
        };
    },
});

const giantAntWhoWantsToLiveForeverPodDestroyPromptProgram = createPromptProgram<
    GiantAntPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_who_wants_to_live_forever_pod_destroy',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_who_wants_to_live_forever_pod_destroy_${context.now}`,
        context.playerId,
        '无人想要永生 POD：选择要消灭的一个己方随从',
        collectOwnMinions(context.matchState.core, context.playerId).map((minion) => ({
            id: `minion-${minion.uid}`,
            label: minion.label,
            displayMode: 'card' as const,
            _source: 'field' as const,
            value: { minionUid: minion.uid, minionDefId: minion.defId, baseIndex: minion.baseIndex, defId: minion.defId },
        })),
        {
            sourceId: 'giant_ant_who_wants_to_live_forever_pod_destroy',
            targetType: 'minion',
            autoRefresh: 'field',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_who_wants_to_live_forever_pod_destroy_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number; defId?: string };
        if (!selected.minionUid || selected.baseIndex === undefined) return { events: [] };

        const minion = state.core.bases[selected.baseIndex]?.minions.find((entry) => entry.uid === selected.minionUid);
        if (!minion || minion.controller !== context.playerId) return { events: [] };

        const events: SmashUpEvent[] = buildValidatedDestroyEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selected.defId ?? minion.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: context.playerId,
            reason: 'giant_ant_who_wants_to_live_forever_pod',
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceDefId: 'giant_ant_who_wants_to_live_forever_pod',
            sourceControllerId: context.playerId,
            sourceKind: 'action',
        });

        const hasDeck = (state.core.players[context.playerId]?.deck.length ?? 0) > 0;
        if (!hasDeck) {
            return { events };
        }

        return {
            events,
            context,
            nextProgram: giantAntWhoWantsToLiveForeverPodSearchPromptProgram,
        };
    },
});

const giantAntWorkerPodReplayPromptProgram = createPromptProgram<
    GiantAntPromptContext & WorkerPodReplayContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'giant_ant_worker_pod_replay',
    buildInteraction: (context) => createAbilityRuntimeSimpleChoice(
        `giant_ant_worker_pod_replay_${context.now}`,
        context.playerId,
        '工蚁 POD：是否从弃牌堆将其打到另一个基地？',
        [
            {
                id: 'skip',
                label: '跳过',
                labelKey: 'ui.giant_ant_worker_pod_replay_skip_option',
                value: { baseIndex: -1 },
                displayMode: 'button' as const,
            },
            ...buildBaseTargetOptions(
                context.matchState.core.bases
                    .map((base, index) => ({
                        baseIndex: index,
                        label: getCardDef(base.defId)?.name ?? `基地 ${index + 1}`,
                    }))
                    .filter((base) => base.baseIndex !== context.fromBaseIndex),
                context.matchState.core,
            ),
        ],
        {
            sourceId: 'giant_ant_worker_pod_replay',
            targetType: 'base',
            responseValidationMode: 'live',
            titleKey: 'ui.giant_ant_worker_pod_replay_title',
        },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { skip?: boolean; baseIndex?: number; baseDefId?: string };
        if (selected.skip || selected.baseIndex === undefined || selected.baseIndex < 0) {
            return { events: [] };
        }

        const player = state.core.players[context.playerId];
        if (!player) return { events: [] };

        const cardInDiscard = player.discard.find((card) => card.uid === context.cardUid);
        if (!cardInDiscard) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.condition_not_met', timestamp)] };
        }

        const def = getCardDef(context.defId);
        const power = def && def.type === 'minion' ? def.power : 0;
        const chosenBaseIndex = resolveLiveBaseIndex(state.core, selected.baseIndex, selected.baseDefId);
        if (chosenBaseIndex === undefined) {
            return { events: [buildAbilityFeedback(context.playerId, 'feedback.no_valid_targets', timestamp)] };
        }

        return {
            events: [{
                type: SU_EVENTS.MINION_PLAYED,
                payload: {
                    playerId: context.playerId,
                    cardUid: context.cardUid,
                    defId: context.defId,
                    baseIndex: chosenBaseIndex,
                    power,
                    fromDiscard: true,
                    ownerId: cardInDiscard.owner,
                    consumesNormalLimit: false,
                    discardPlaySourceId: 'giant_ant_worker_pod',
                },
                timestamp,
            } as MinionPlayedEvent],
        };
    },
});

function giantAntWhoWantsToLiveForever(ctx: AbilityContext): AbilityResult {
    const hasAnyCounter = collectOwnMinionsWithCounters(ctx.state, ctx.playerId).length > 0;
    if (!hasAnyCounter) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
    }

    return runtimeResultToAbilityResult(executeAbilityProgram(
        giantAntWhoWantsToLiveForeverPromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            actionCardUid: ctx.cardUid,
            removedByMinion: {},
            removedTotal: 0,
        }),
    ));
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

    const runtimeResult = executeAbilityProgram(
        giantAntAKindOfMagicDistributePromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            actionCardUid: ctx.cardUid,
            remaining: total,
            removedSnapshots: snapshots,
            distributedByMinion: {},
            reason: 'giant_ant_a_kind_of_magic',
            promptTitle: '如同魔法',
        }),
    );

    return {
        events: [...removeEvents, ...runtimeResult.events],
        matchState: runtimeResult.matchState,
    };
}

function giantAntAKindOfMagicPod(ctx: AbilityContext): AbilityResult {
    // 通过统一的“指示物持有者”抽象收集己方所有带力量指示物的卡牌（当前仅随从）
    const holders = collectOwnPowerCounterHolders(ctx.state, ctx.playerId);
    if (holders.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
    }

    // “your cards” 至少要有两张牌，否则无法在牌之间转移
    const allOwn = collectOwnMinions(ctx.state, ctx.playerId);
    if (allOwn.length <= 1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const snapshots = holders.map((h) => ({
        minionUid: h.uid,
        defId: h.defId,
        baseIndex: h.baseIndex,
        count: ctx.state.bases[h.baseIndex]?.minions.find(x => x.uid === h.uid)?.powerCounters ?? 0,
    })).filter(item => item.count > 0);

    const total = snapshots.reduce((sum, item) => sum + item.count, 0);
    if (total <= 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
    }

    const removeEvents = snapshots.map(item =>
        removePowerCounter(item.minionUid, item.baseIndex, item.count, 'giant_ant_a_kind_of_magic_pod', ctx.now),
    );

    const runtimeResult = executeAbilityProgram(
        giantAntAKindOfMagicDistributePromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            actionCardUid: ctx.cardUid,
            remaining: total,
            removedSnapshots: snapshots,
            distributedByMinion: {},
            reason: 'giant_ant_a_kind_of_magic_pod',
            promptTitle: '如同魔法 POD',
        }),
    );

    return {
        events: [...removeEvents, ...runtimeResult.events],
        matchState: runtimeResult.matchState,
    };
}

function giantAntWeWillRockYou(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            if (m.powerCounters <= 0) continue;
            events.push(addTempPower(m.uid, i, m.powerCounters, 'giant_ant_we_will_rock_you', ctx.now));
        }
    }
    return { events };
}

function giantAntWeWillRockYouPod(ctx: AbilityContext): AbilityResult {
    if (ctx.state.bases.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    return runtimeResultToAbilityResult(executeAbilityProgram(
        giantAntWeWillRockYouPodPromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    ));
}

function giantAntClaimThePrize(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    return runtimeResultToAbilityResult(executeAbilityProgram(
        giantAntClaimThePrizePromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    ));
}

function giantAntGimmeThePrizePod(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);
    if (ownMinions.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    if (!ctx.matchState) return { events: [] };
    return runtimeResultToAbilityResult(executeAbilityProgram(
        giantAntGimmeThePrizePodFirstPromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    ));
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
        .filter(m => m.controller === ctx.playerId && m.powerCounters > 0)
        .map(m => {
            const def = getCardDef(m.defId);
            return {
                uid: m.uid,  // buildMinionTargetOptions 需要 uid 字段
                baseIndex: scoringBaseIndex,
                defId: m.defId,
                label: `${def?.name ?? m.defId}（力量指示物 ${m.powerCounters}）`,
            };
        });

    if (sources.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
    }

    const targetExists = collectOwnMinions(ctx.state, ctx.playerId).some(minion => minion.baseIndex !== scoringBaseIndex);
    if (!targetExists) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    return runtimeResultToAbilityResult(executeAbilityProgram(
        giantAntUnderPressureChooseSourcePromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now, { scoringBaseIndex }),
    ));
}

function giantAntWeAreTheChampions(ctx: AbilityContext): AbilityResult {
    const reactionWindow = getSmashUpReactionWindowContext(ctx.matchState);
    const isInAfterScoringWindow = reactionWindow?.windowType === 'afterScoring';

    if (isInAfterScoringWindow) {
        // 在响应窗口中：立即执行（不生成 ARMED 事件）
        // 捕获当前基地上己方有力量指示物的随从
        const base = ctx.state.bases[ctx.baseIndex];
        const sources = base?.minions
            .filter(m => m.controller === ctx.playerId && m.powerCounters > 0)
            .map(m => ({
                uid: m.uid,
                defId: m.defId,
                baseIndex: ctx.baseIndex,
                counterAmount: m.powerCounters,
            })) ?? [];

        if (sources.length === 0) {
            // 没有符合条件的随从
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
        }

        // 检查是否有足够的随从进行转移（至少需要2个随从：来源+目标）
        const allMyMinions = collectOwnMinions(ctx.state, ctx.playerId);
        if (allMyMinions.length < 2) {
            return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
        }
        return runtimeResultToAbilityResult(executeAbilityProgram(
            giantAntWeAreTheChampionsChooseSourcePromptProgram,
            createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
                reason: ctx.defId,
                scoringBaseIndex: ctx.baseIndex,
            }),
        ));
    }
    
    // 不在响应窗口中：生成 ARMED 事件（原有逻辑）
    // 捕获当前基地上己方有力量指示物的随从快照
    const base = ctx.state.bases[ctx.baseIndex];
    const sources = base?.minions
        .filter(m => m.controller === ctx.playerId && m.powerCounters > 0)
        .map(m => ({
            uid: m.uid,
            defId: m.defId,
            baseIndex: ctx.baseIndex,
            counterAmount: m.powerCounters,
        })) ?? [];

    return {
        events: [{
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
            payload: {
                sourceDefId: ctx.defId,
                playerId: ctx.playerId,
                baseIndex: ctx.baseIndex,
                cardUid: ctx.cardUid,
                // 保存随从快照，供 afterScoring 使用（计分后随从已离场）
                minionSnapshots: sources,
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

    return runtimeResultToAbilityResult(executeAbilityProgram(
        giantAntHeadlongChooseMinionPromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    ));
}

function buildWhoWantsToLiveForeverOptions(
    core: SmashUpCore,
    playerId: PlayerId,
    removedTotal: number,
): PromptOption<MinionTargetChoiceValue | WhoWantsControlChoiceValue>[] {
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
            labelKey: removedTotal > 0
                ? 'ui.giant_ant_who_wants_to_live_forever_confirm_draw_option'
                : 'ui.giant_ant_who_wants_to_live_forever_confirm_no_draw_option',
            ...(removedTotal > 0 ? { labelParams: { removedTotal } } : {}),
            displayMode: 'button' as const,
            value: { skip: true, confirm: true },
        },
        {
            id: 'cancel',
            label: '取消并撤回此牌',
            labelKey: 'ui.giant_ant_cancel_and_withdraw_option',
            displayMode: 'button' as const,
            value: { skip: true, cancel: true },
        },
    ];
}

function buildAKindOfMagicOptions(core: SmashUpCore, playerId: PlayerId): PromptOption<MinionTargetChoiceValue | KindOfMagicControlChoiceValue>[] {
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
            labelKey: 'ui.giant_ant_cancel_and_withdraw_option',
            displayMode: 'button' as const,
            value: { skip: true, cancel: true },
        },
    ];
}

// ============================================================================
// POD 版本能力函数
// ============================================================================

function giantAntSoldierPodTalent(ctx: AbilityContext): AbilityResult {
    // 收集有指示物的己方随从（可作为来源）
    const sources = collectOwnMinionsWithCounters(ctx.state, ctx.playerId);
    if (sources.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
    }

    // 收集所有己方随从（可作为目标）
    const allOwn = collectOwnMinions(ctx.state, ctx.playerId);
    if (allOwn.length <= 1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    return runtimeResultToAbilityResult(executeAbilityProgram(
        giantAntSoldierPodChooseSourcePromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    ));
}

function giantAntKillerQueenPodTalent(ctx: AbilityContext): AbilityResult {
    const self = ctx.state.bases[ctx.baseIndex]?.minions.find(m => m.uid === ctx.cardUid);
    if (!self || self.controller !== ctx.playerId) return { events: [] };

    return runtimeResultToAbilityResult(executeAbilityProgram(
        giantAntKillerQueenPodPromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            queenUid: ctx.cardUid,
            queenBaseIndex: ctx.baseIndex,
        }),
    ));
}

function giantAntWhoWantsToLiveForeverPod(ctx: AbilityContext): AbilityResult {
    const ownMinions = collectOwnMinions(ctx.state, ctx.playerId);

    // 若场上没有己方随从，仍然可以按勘误搜索牌库
    if (ownMinions.length === 0) {
        const player = ctx.state.players[ctx.playerId];
        if (!player || player.deck.length === 0) {
            return { events: [] };
        }

        return runtimeResultToAbilityResult(executeAbilityProgram(
            giantAntWhoWantsToLiveForeverPodSearchPromptProgram,
            createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now),
        ));
    }
    return runtimeResultToAbilityResult(executeAbilityProgram(
        giantAntWhoWantsToLiveForeverPodDestroyPromptProgram,
        createGiantAntPromptContext(ctx.matchState, ctx.playerId, ctx.now),
    ));
}

function giantAntWorkerPodReplayTrigger(
    ctx: TriggerContext,
): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const { state, playerId, triggerMinionUid, triggerMinionDefId, baseIndex, now } = ctx;

    if (ctx.timing === 'onMinionDiscardedFromBase' && isDestroyPipelineDiscardTrigger(ctx)) return [];
    if (triggerMinionDefId !== 'giant_ant_worker_pod') return [];
    if (!triggerMinionUid || baseIndex === undefined) return [];
    if (!ctx.matchState) return [];
    if (state.bases.length < 2) return [];

    const minion = ctx.triggerMinion
        ?? state.bases[baseIndex]?.minions.find(m => m.uid === triggerMinionUid);
    if (!minion) return [];
    if (minion.controller !== playerId) return [];
    if (minion.powerCounters > 0) return [];

    const baseCandidates = state.bases.filter((_base, index) => index !== baseIndex);
    if (baseCandidates.length === 0) return [];

    return runtimeResultToTriggerResult(executeAbilityProgram(
        giantAntWorkerPodReplayPromptProgram,
        createGiantAntPromptContext(ctx.matchState, playerId, now, {
            cardUid: triggerMinionUid,
            defId: 'giant_ant_worker_pod',
            fromBaseIndex: baseIndex,
        }),
    ), ctx.matchState);
}

function isDestroyPipelineDiscardTrigger(ctx: TriggerContext): boolean {
    return typeof ctx.sourceEventId === 'string' && ctx.sourceEventId.startsWith('minion-discarded-from-base:');
}

function registerGiantAntProtections(): void {
    const checker: ProtectionChecker = ctx => {
        if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
        if (ctx.targetMinion.powerCounters <= 0) return false;

        const base = ctx.state.bases[ctx.targetBaseIndex];
        if (!base) return false;

        return base.ongoingActions.some(
            (o) => (o.defId === 'giant_ant_the_show_must_go_on' || o.defId === 'giant_ant_the_show_must_go_on_pod')
                && (((o.metadata?.sourceControllerId as string | undefined) ?? o.ownerId) === ctx.targetMinion.controller),
        );
    };

    // 基础版 Protection
    registerProtection('giant_ant_the_show_must_go_on', 'affect', checker as any);
    registerProtection('giant_ant_the_show_must_go_on', 'move', checker as any);
    registerProtection('giant_ant_the_show_must_go_on', 'destroy', checker as any);

    // POD 版本 Protection
    registerProtection('giant_ant_the_show_must_go_on_pod', 'affect', checker as any);
    registerProtection('giant_ant_the_show_must_go_on_pod', 'move', checker as any);
    registerProtection('giant_ant_the_show_must_go_on_pod', 'destroy', checker as any);

    // 触发器
    registerTrigger('giant_ant_we_are_the_champions', 'afterScoring', giantAntWeAreTheChampionsAfterScoring, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });
    registerTrigger('giant_ant_we_are_the_champions_pod', 'afterScoring', giantAntWeAreTheChampionsAfterScoring, {
        perInstance: true,
        sourceScope: 'triggerBase',
        playerContext: 'sourceController',
    });
    registerTrigger('giant_ant_drone', 'onMinionDestroyed', giantAntDronePreventTrigger, {
        phase: 'replacement',
    });
    registerTrigger('giant_ant_drone_pod', 'onMinionDestroyed', giantAntDronePreventTrigger, {
        phase: 'replacement',
    }); // POD 版本复用基础版触发器
    // Worker POD：离场进入弃牌堆（消灭 / 基地计分弃置）且当时无指示物时，可从弃牌堆额外打出到另一基地
    registerTrigger('giant_ant_worker_pod', 'onMinionDestroyed', giantAntWorkerPodReplayTrigger, {
    });
    registerTrigger('giant_ant_worker_pod', 'onMinionDiscardedFromBase', giantAntWorkerPodReplayTrigger, {
    });
}

function giantAntWeAreTheChampionsAfterScoring(
    ctx: TriggerContext,
): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const { state, baseIndex, now, sourceCardUid } = ctx;
    if (baseIndex === undefined) return [];

    const armedEntry = (state.pendingAfterScoringSpecials ?? []).find(
        s => (s.sourceDefId === 'giant_ant_we_are_the_champions' || s.sourceDefId === 'giant_ant_we_are_the_champions_pod')
            && s.baseIndex === baseIndex
            && s.cardUid === sourceCardUid,
    );
    if (!armedEntry) return [];

    const events: SmashUpEvent[] = [{
        type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED,
        payload: {
            sourceDefId: armedEntry.sourceDefId,
            playerId: armedEntry.playerId,
            baseIndex: armedEntry.baseIndex,
            cardUid: armedEntry.cardUid,
        },
        timestamp: now,
    } as SmashUpEvent];

    if (!ctx.matchState) return { events };

    let matchState = ctx.matchState;
    {
        // 检查是否有足够的随从进行转移（至少需要2个随从：来源+目标）
        const allMyMinions = collectOwnMinions(state, armedEntry.playerId);
        if (allMyMinions.length < 2) return { events, matchState };

        // 使用快照中的随从（计分后随从已离场）
        const sources = armedEntry.minionSnapshots ?? [];
        if (sources.length === 0) return { events, matchState };
        const runtimeResult = executeAbilityProgram(
            giantAntWeAreTheChampionsChooseSnapshotSourcePromptProgram,
            createGiantAntPromptContext(matchState, armedEntry.playerId, now, {
                reason: armedEntry.sourceDefId,
                scoringBaseIndex: baseIndex,
                sourceSnapshots: sources,
            }),
        );
        matchState = runtimeResult.matchState ?? matchState;
    }

    return { events, matchState };
}

function giantAntDronePreventTrigger(ctx: TriggerContext): SmashUpEvent[] | { events: SmashUpEvent[]; matchState?: MatchState<SmashUpCore> } {
    const { state, playerId, triggerMinionUid, triggerMinionDefId, baseIndex, now } = ctx;
    
    if (ctx.reason === 'giant_ant_drone_skip') return [];
    if (!triggerMinionUid || !triggerMinionDefId || baseIndex === undefined) return [];

    const target = state.bases[baseIndex]?.minions.find(m => m.uid === triggerMinionUid);
    if (!target || target.controller !== playerId) return [];

    if (buildDronePreventDestroyOptions(state, playerId).length <= 1) return [];
    if (!ctx.matchState) return [];
    return runtimeResultToTriggerResult(executeAbilityProgram(
        giantAntDronePreventDestroyPromptProgram,
        createGiantAntPromptContext(ctx.matchState, playerId, now, {
            targetMinionUid: triggerMinionUid,
            targetMinionDefId: triggerMinionDefId,
            fromBaseIndex: baseIndex,
            toPlayerId: target.owner,
            destroyerId: ctx.destroyerId,
        }),
    ), ctx.matchState);
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
            if (m.powerCounters <= 0) continue;
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

function collectOwnPowerCounterHolders(core: SmashUpCore, playerId: PlayerId): PowerCounterHolderCandidate[] {
    const result: PowerCounterHolderCandidate[] = [];
    for (let i = 0; i < core.bases.length; i++) {
        for (const m of core.bases[i].minions) {
            if (m.controller !== playerId) continue;
            if (m.powerCounters <= 0) continue;
            const def = getCardDef(m.defId);
            result.push({
                uid: m.uid,
                defId: m.defId,
                baseIndex: i,
                label: def?.name ?? m.defId,
                kind: 'minion',
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
