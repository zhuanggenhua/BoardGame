/**
 * 大杀四方 - 吸血鬼派系能力
 *
 * 主题：消灭低力量随从获取+1力量指示物
 */

import { registerAbility, registerAbilityProgram } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter, addOngoingCardCounter,
    buildMinionTargetOptions,
    findMinionOnBases, buildAbilityFeedback,
    buildBaseTargetOptions,
    buildValidatedDestroyEvents,
    addTempPower,
    addPermanentPower,
    revealAndPickFromDeck,
    buildStandardDrawEventsFromRuntimeContext,
    buildStandardDrawEvents,
    createSkipOption,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { MinionOnBase, SmashUpEvent, SmashUpCore } from '../domain/types';
import { registerTrigger, registerRestriction } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { getCardDef, getMinionDef, getBaseDef } from '../data/cards';
import { getEffectivePower } from '../domain/ongoingModifiers';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import type { MinionPlayedEvent } from '../domain/types';
import type { MatchState, PlayerId } from '../../../engine/types';
import { matchesDefId } from '../domain/utils';
import { buildActionPlayedEvent } from '../domain/actionPlayEvent';
import { buildBuryCardEvents } from '../domain/bury';
import {
    createEffectProgram,
    createPromptProgram,
    executeAbilityProgram,
} from '../domain/abilityRuntime';

type VampirePromptContext = {
    matchState: MatchState<SmashUpCore>;
    playerId: PlayerId;
    now: number;
};

type VampireSourceMinionPromptContext = VampirePromptContext & {
    sourceMinionUid: string;
    sourceBaseIndex: number;
};

type VampireBaseMinionPromptContext = VampirePromptContext & {
    minionUid: string;
    baseIndex: number;
};

type VampireCrackOfDuskPromptContext = VampirePromptContext & {
    cardUid: string;
    defId: string;
};

type VampireCountPodAddCounterPromptContext = VampirePromptContext & {
    targetBaseIndex: number;
};

type VampireBuffetPodPlayPromptContext = VampirePromptContext & {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
};

type VampireMadMonsterPartyPodPlayPromptContext = VampirePromptContext & {
    cardUid: string;
    defId: string;
    ownerId: PlayerId;
    baseIndex: number;
};

type VampireFledglingPodBuryBasePromptContext = VampirePromptContext & {
    cardUid: string;
    fromDiscard: boolean;
    trueOwnerId: PlayerId;
};

type VampireDinnerDatePodPromptContext = VampirePromptContext & {
    attachedMinionUid: string;
    attachedBaseIndex: number;
    sourceCardUid: string;
    sourceDefId: string;
    sourceBaseIndex: number;
};

type VampireCullTheWeakPodPromptContext = VampirePromptContext & {
    discardedCount: number;
    deckEvents: SmashUpEvent[];
    discardUids: string[];
};

type VampireWolfPactPodMinionPromptContext = VampirePromptContext & {
    wolfUid: string;
    wolfBaseIndex: number;
};

type VampireWolfPactPodMinionTargetPromptContext = VampirePromptContext & {
    wolfBaseIndex: number;
};

function createVampirePromptContext<TExtra extends Record<string, unknown> = Record<string, never>>(
    matchState: MatchState<SmashUpCore>,
    playerId: PlayerId,
    now: number,
    extra?: TExtra,
): VampirePromptContext & TExtra {
    return {
        matchState,
        playerId,
        now,
        ...(extra ?? {} as TExtra),
    };
}

function getVampireSourceMinionDefId(
    state: SmashUpCore,
    sourceMinionUid: string,
    sourceBaseIndex: number,
): string | undefined {
    return state.bases[sourceBaseIndex]?.minions.find((minion) => minion.uid === sourceMinionUid)?.defId;
}

// ============================================================================
// 注册入口
// ============================================================================

export function registerVampireAbilities(): void {
    // 随从
    registerAbility('vampire_fledgling_vampire', 'onPlay', vampireFledgling);
    registerAbilityProgram('vampire_heavy_drinker', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vampireHeavyDrinker),
    });
    registerAbilityProgram('vampire_nightstalker', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vampireNightstalker),
    });

    // 行动卡
    registerAbility('vampire_buffet', 'special', vampireBuffetSpecial);
    registerAbilityProgram('vampire_dinner_date', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vampireDinnerDate),
    });
    registerAbilityProgram('vampire_big_gulp', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vampireBigGulp),
    });
    registerAbility('vampire_mad_monster_party', 'onPlay', vampireMadMonsterParty);
    registerAbilityProgram('vampire_cull_the_weak', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vampireCullTheWeak),
    });
    registerAbilityProgram('vampire_crack_of_dusk', 'onPlay', {
        program: createEffectProgram<AbilityContext, SmashUpCore, SmashUpEvent>(vampireCrackOfDusk),
    });

    // ongoing 效果
    registerVampireOngoingEffects();

    // === POD abilities ===
    registerVampirePodAbilities();
    registerVampirePodOngoingEffects();
}

export function registerVampireInteractionHandlers(): void {
    // 吸血鬼派系交互已全部迁移到 ability runtime prompt program。
}

function registerVampirePodAbilities(): void {
    // Minions
    registerAbility('vampire_heavy_drinker_pod', 'onPlay', vampireHeavyDrinkerPod);
    registerAbility('vampire_buffet_pod', 'onPlay', vampireBuffetPod);
    registerAbility('vampire_big_gulp_pod', 'onPlay', vampireBigGulpPod);
    registerAbility('vampire_cull_the_weak_pod', 'onPlay', vampireCullTheWeakPod);
    registerAbility('vampire_crack_of_dusk_pod', 'onPlay', vampireCrackOfDuskPod);
    registerAbility('vampire_dinner_date_pod', 'onPlay', vampireDinnerDatePod);
    registerAbility('vampire_fledgling_vampire_pod', 'onPlay', vampireFledglingVampirePodOnPlay);
    registerAbility('vampire_wolf_pact_pod', 'onPlay', vampireWolfPactPodMinionOnPlay);
    registerAbility('vampire_wolf_pact_pod_action', 'onPlay', vampireWolfPactPodActionOnPlay);

    // Talents
    registerAbility('vampire_the_count_pod', 'talent', {
        execute: vampireCountPodTalent,
        validateUse: (ctx) => ctx.state.bases.some(base => base.minions.length > 0) ? null : '当前没有可选择的随从目标',
    });
    registerAbility('vampire_nightstalker_pod', 'talent', {
        execute: vampireNightstalkerPodTalent,
        validateUse: (ctx) => (ctx.state.destroyedMinionByPlayersThisTurn ?? []).includes(ctx.playerId) ? null : '本回合你还没有消灭过随从',
    });
    registerAbility('vampire_stakeout_pod', 'talent', {
        execute: vampireStakeoutPodTalent,
        validateUse: (ctx) => {
            const decreased = ctx.state.basePowerDecreasedPlayersThisTurn?.[ctx.baseIndex] ?? [];
            return decreased.some(pid => pid !== ctx.playerId) ? null : '本回合还没有其他玩家降低过该基地战力';
        },
    });

    // Specials implemented via triggers after destroy (see ongoing effects)
}

function addPermanentPowerUntilNextTurnStart(
    state: MatchState<SmashUpCore>,
    minionUid: string,
    baseIndex: number,
    amount: number,
    reason: string,
    timestamp: number,
): SmashUpEvent | null {
    if (amount === 0) return null;
    const expiresOnTurnNumber = state.core.turnNumber + state.core.turnOrder.length;
    const event = addPermanentPower(minionUid, baseIndex, amount, reason, timestamp);
    return {
        ...event,
        payload: {
            ...event.payload,
            expiresOnTurnNumber,
        },
    } as any;
}

function registerVampirePodOngoingEffects(): void {
    const sourceIsDestroyer = (ctx: TriggerContext) =>
        ctx.destroyerId !== undefined && ctx.sourceControllerId === ctx.destroyerId;

    // The Count POD: after any minion destroyed, you may place a +1 counter on a minion at its base.
    registerTrigger('vampire_the_count_pod', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, baseIndex, now } = ctx;
        if (baseIndex === undefined) return [];
        const base = state.bases[baseIndex];
        if (!base) return [];
        if (!ctx.matchState) return [];

        if (base.minions.length === 0) return [];
        const sourceControllerId = ctx.sourceControllerId as PlayerId | undefined;
        if (ctx.sourceCardUid && sourceControllerId) {
            return executeAbilityProgram(
                vampireCountPodAddCounterPromptProgram,
                createVampirePromptContext(ctx.matchState, sourceControllerId, now, {
                    targetBaseIndex: baseIndex,
                }),
            ) as any;
        }

        // 规则：任意基地上的 The Count POD 都可在“被消灭随从所在基地”放置指示物。
        // direct caller 可能没有 source provenance；保留旧扫描 fallback。
        const counts = state.bases.flatMap(
            b => b.minions.filter(m => matchesDefId(m.defId, 'vampire_the_count_pod')),
        );
        if (counts.length === 0) return [];

        let matchState = ctx.matchState;
        for (const count of counts) {
            const result = executeAbilityProgram(
                vampireCountPodAddCounterPromptProgram,
                createVampirePromptContext(matchState, count.controller, now, {
                    targetBaseIndex: baseIndex,
                }),
            );
            matchState = result.matchState ?? matchState;
        }
        return { events: [], matchState } as any;
    }, {
        optional: true,
        perInstance: true,
        playerContext: 'sourceController',
    });

    const getProjectedDinnerDateHostPower = (
        ctx: TriggerContext,
        minion: MinionOnBase,
        baseIndex: number,
    ): number => {
        const currentPower = getEffectivePower(ctx.state, minion, baseIndex);
        if (ctx.affectType !== 'power_change') return currentPower;

        type PowerChangePayload = { minionUid?: string; baseIndex?: number; amount?: number };
        const payload = ctx.affectEvent && 'payload' in ctx.affectEvent
            ? ctx.affectEvent.payload as PowerChangePayload
            : undefined;
        const targetsThisMinion = !payload?.minionUid || payload.minionUid === minion.uid;
        const targetsThisBase = payload?.baseIndex === undefined || payload.baseIndex === baseIndex;
        if (targetsThisMinion && targetsThisBase && typeof payload?.amount === 'number') {
            switch (ctx.affectEvent?.type) {
                case SU_EVENTS.POWER_COUNTER_ADDED:
                case SU_EVENTS.TEMP_POWER_ADDED:
                case SU_EVENTS.PERMANENT_POWER_ADDED:
                    return currentPower + payload.amount;
                case SU_EVENTS.POWER_COUNTER_REMOVED:
                    return currentPower - Math.abs(payload.amount);
                default:
                    break;
            }
        }

        return typeof ctx.counterDelta === 'number'
            ? currentPower + ctx.counterDelta
            : currentPower;
    };

    const canTriggerVampireDinnerDatePod = (ctx: TriggerContext): boolean => {
        const { state, baseIndex, triggerMinionUid } = ctx;
        if (baseIndex === undefined || !triggerMinionUid) return false;
        const base = state.bases[baseIndex];
        if (!base) return false;
        const minion = base.minions.find(m => m.uid === triggerMinionUid);
        if (!minion) return false;
        const attachment = minion.attachedActions.find(a =>
            a.defId === 'vampire_dinner_date_pod'
            && (!ctx.sourceCardUid || a.uid === ctx.sourceCardUid)
        );
        if (!attachment) return false;
        return getProjectedDinnerDateHostPower(ctx, minion, baseIndex) <= 0;
    };

    // Dinner Date POD：被附着随从若力量变为 0，则将其消灭。
    registerTrigger('vampire_dinner_date_pod', 'onMinionAffected', (ctx: TriggerContext) => {
        const { state, baseIndex, triggerMinionUid, now } = ctx;
        if (baseIndex === undefined || !triggerMinionUid) return [];
        const base = state.bases[baseIndex];
        if (!base) return [];
        const minion = base.minions.find(m => m.uid === triggerMinionUid);
        if (!minion) return [];
        const attachment = minion.attachedActions.find(a =>
            a.defId === 'vampire_dinner_date_pod'
            && (!ctx.sourceCardUid || a.uid === ctx.sourceCardUid)
        );
        if (!attachment) return [];
        if (getEffectivePower(state, minion, baseIndex) > 0) return [];
        const destroyerId = (attachment.metadata?.sourceControllerId as PlayerId | undefined) ?? attachment.ownerId;
        return buildValidatedDestroyEvents(state, {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            fromBaseIndex: baseIndex,
            destroyerId,
            reason: 'vampire_dinner_date_pod',
            now,
            sourcePlayerId: ((attachment.metadata?.sourcePlayerId as PlayerId | undefined)
                ?? (attachment.metadata?.sourceControllerId as PlayerId | undefined)
                ?? attachment.ownerId),
            sourceCardUid: attachment.uid,
            sourceDefId: attachment.defId,
            sourceControllerId: (attachment.metadata?.sourceControllerId as PlayerId | undefined) ?? attachment.ownerId,
            sourceBaseIndex: baseIndex,
        });
    }, {
        canTrigger: canTriggerVampireDinnerDatePod,
        perInstance: true,
        playerContext: 'sourceController',
    });

    // Buffet POD: after you destroy a minion, you may play Buffet from hand (draw 2).
    registerTrigger('vampire_buffet_pod', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, now } = ctx;
        const destroyerId = (ctx as any).destroyerId as PlayerId | undefined;
        if (!destroyerId) return [];
        const p = state.players[destroyerId];
        const buffet = p.hand.find(c => c.defId === 'vampire_buffet_pod');
        if (!buffet) return [];
        const result = executeAbilityProgram(
            vampireBuffetPodPlayPromptProgram,
            createVampirePromptContext(ctx.matchState!, destroyerId, now, {
                cardUid: buffet.uid,
                defId: buffet.defId,
                ownerId: buffet.owner as PlayerId,
            }),
        );
        return { events: result.events, matchState: result.matchState ?? ctx.matchState! } as any;
    }, {
        optional: true,
        global: true,
        playerContext: 'sourceController',
        canTrigger: sourceIsDestroyer,
    });

    // Mad Monster Party POD: after you destroy a minion, choose its base and place +1 counter on each of your minions there.
    registerTrigger('vampire_mad_monster_party_pod', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const destroyerId = (ctx as any).destroyerId as PlayerId | undefined;
        if (!destroyerId) return [];
        const baseIndex = ctx.baseIndex;
        if (baseIndex === undefined) return [];
        const p = ctx.state.players[destroyerId];
        const card = p.hand.find(c => c.defId === 'vampire_mad_monster_party_pod');
        if (!card) return [];
        const result = executeAbilityProgram(
            vampireMadMonsterPartyPodPlayPromptProgram,
            createVampirePromptContext(ctx.matchState!, destroyerId, ctx.now, {
                cardUid: card.uid,
                defId: card.defId,
                ownerId: card.owner as PlayerId,
                baseIndex,
            }),
        );
        return { events: result.events, matchState: result.matchState ?? ctx.matchState! } as any;
    }, {
        optional: true,
        global: true,
        playerContext: 'sourceController',
        canTrigger: sourceIsDestroyer,
    });

    // Fledgling Vampire POD: after you destroy another minion, you may bury this card from hand or discard on any base.
    registerTrigger('vampire_fledgling_vampire_pod', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, destroyerId, now } = ctx;
        if (!destroyerId) return [];
        const p = state.players[destroyerId];
        if (!p) return [];
        const inHand = p.hand.filter(c => c.defId === 'vampire_fledgling_vampire_pod');
        const inDiscard = p.discard.filter(c => c.defId === 'vampire_fledgling_vampire_pod');
        if (inHand.length === 0 && inDiscard.length === 0) return [];

        const result = executeAbilityProgram(
            vampireFledglingPodBurySourcePromptProgram,
            createVampirePromptContext(ctx.matchState!, destroyerId, now),
        );
        return { events: result.events, matchState: result.matchState ?? ctx.matchState! } as any;
    }, {
        optional: true,
        global: true,
        playerContext: 'sourceController',
        canTrigger: sourceIsDestroyer,
    });

    // Stakeout POD restriction: block minions power>=3 when active
    registerRestriction('vampire_stakeout_pod', 'play_minion', (rctx) => {
        const blocks = rctx.state.stakeoutPodBlocks ?? [];
        const power = (rctx.extra?.basePower as number | undefined) ?? 0;
        if (power < 3) return false;
        return blocks.some(block => block.baseIndex === rctx.baseIndex && rctx.playerId !== block.ownerId);
    }, {
    });
}

// ============================================================================
// 随从能力
// ============================================================================

function vampireFledglingVampirePodOnPlay(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    const playedFrom = (found.minion.metadata?.playedFrom as string | undefined) ?? 'hand';
    if (playedFrom === 'hand') return { events: [] };
    return { events: [addPowerCounter(found.minion.uid, found.baseIndex, 1, 'vampire_fledgling_vampire_pod', ctx.now)] };
}

/** 新生吸血鬼 onPlay：如果对手在这里力量更高，本随从+1指示物 */
function vampireFledgling(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    let myTotal = 0, maxOpponent = 0;
    for (const m of ctx.state.bases[found.baseIndex].minions) {
        const power = getEffectivePower(ctx.state, m, found.baseIndex);
        if (m.controller === ctx.playerId) myTotal += power;
    }
    const opponentTotals = new Map<string, number>();
    for (const m of ctx.state.bases[found.baseIndex].minions) {
        if (m.controller === ctx.playerId) continue;
        opponentTotals.set(m.controller, (opponentTotals.get(m.controller) ?? 0) + getEffectivePower(ctx.state, m, found.baseIndex));
    }
    for (const total of opponentTotals.values()) {
        if (total > maxOpponent) maxOpponent = total;
    }
    if (maxOpponent > myTotal) {
        return { events: [addPowerCounter(found.minion.uid, found.baseIndex, 1, 'vampire_fledgling_vampire', ctx.now)] };
    }
    return { events: [] };
}

/** 渴血鬼 talent：消灭己方一个随从来给自己+1指示物 */
function vampireHeavyDrinker(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    const hasTargets = ctx.state.bases.some(base =>
        base.minions.some(minion => minion.controller === ctx.playerId && minion.uid !== found.minion.uid),
    );
    if (!hasTargets) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(
        vampireHeavyDrinkerPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceMinionUid: found.minion.uid,
            sourceBaseIndex: found.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

/** 夜行者 onPlay：消灭同基地力量≤2的随从，本随从+1指示物 */
function vampireNightstalker(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    const hasTargets = ctx.state.bases[found.baseIndex].minions.some(minion =>
        minion.uid !== found.minion.uid && getEffectivePower(ctx.state, minion, found.baseIndex) <= 2,
    );
    if (!hasTargets) return { events: [] };
    const result = executeAbilityProgram(
        vampireNightstalkerPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceMinionUid: found.minion.uid,
            sourceBaseIndex: found.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

// ============================================================================
// 行动卡能力
// ============================================================================

/** 自助餐 special：ARM 延迟到计分后触发 */
function vampireBuffetSpecial(ctx: AbilityContext): AbilityResult {
    return {
        events: [{
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED,
            payload: {
                sourceDefId: 'vampire_buffet',
                playerId: ctx.playerId,
                baseIndex: ctx.baseIndex,
                cardUid: ctx.cardUid,
            },
            timestamp: ctx.now,
        } as SmashUpEvent],
    };
}

/** 晚餐约会 onPlay：选己方随从+1指示物，然后消灭同基地力量≤2随从 */
function vampireDinnerDate(ctx: AbilityContext): AbilityResult {
    const hasOwnMinions = ctx.state.bases.some(base => base.minions.some(minion => minion.controller === ctx.playerId));
    if (!hasOwnMinions) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(
        vampireDinnerDatePromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

/** 一大口 onPlay：消灭一个力量≤4的随从（可跳过） */
function vampireBigGulp(ctx: AbilityContext): AbilityResult {
    const hasTargets = ctx.state.bases.some((base, baseIndex) =>
        base.minions.some(minion => getEffectivePower(ctx.state, minion, baseIndex) <= 4),
    );
    if (!hasTargets) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(
        vampireBigGulpPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

/** 疯狂怪物派对 onPlay：没有+1指示物的己方随从各放一个 */
function vampireMadMonsterParty(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId && m.powerCounters === 0) {
                events.push(addPowerCounter(m.uid, i, 1, 'vampire_mad_monster_party', ctx.now));
            }
        }
    }
    return { events };
}

/** 剔除弱者 onPlay：选己方随从，弃手牌随从卡，每弃1张+1指示物 */
function vampireCullTheWeak(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const hasOwnMinions = ctx.state.bases.some(base => base.minions.some(minion => minion.controller === ctx.playerId));
    if (!hasOwnMinions) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const minionCardsInHand = player.hand.filter(c => c.type === 'minion');
    if (minionCardsInHand.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_minion_cards_in_hand', ctx.now)] };
    const result = executeAbilityProgram(
        vampireCullTheWeakPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

/** 破晓 onPlay：从弃牌堆打出力量≤2随从并+1指示物 */
function vampireCrackOfDusk(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const candidates = player.discard.filter(c => {
        if (c.type !== 'minion') return false;
        const def = getCardDef(c.defId);
        return def && def.type === 'minion' && (def as { power: number }).power <= 2;
    });
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(
        vampireCrackOfDuskPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

// 剔除弱者 多选辅助
// ============================================================================

interface CullTheWeakCardContext {
    minionUid: string;
    baseIndex: number;
}

function buildCullTheWeakCardOptions(core: SmashUpCore, playerId: string) {
    const player = core.players[playerId];
    if (!player) return [];
    const cardOptions = player.hand
        .filter(c => c.type === 'minion')
        .map((c, i) => {
            const def = getCardDef(c.defId);
            return {
                id: `card-${i}`,
                label: `${def?.name ?? c.defId}`,
                value: { cardUid: c.uid, defId: c.defId },
                _source: 'hand' as const,
                displayMode: 'card' as const,
            };
        });
    return [
        ...cardOptions,
        { id: 'stop', label: '停止弃置并结算', labelKey: 'ui.vampire_cull_the_weak_stop_option', value: { stop: true }, displayMode: 'button' as const },
    ];
}

function createCullTheWeakCardInteraction(
    ms: MatchState<SmashUpCore>,
    playerId: string,
    context: CullTheWeakCardContext,
    now: number,
) {
    const options = buildCullTheWeakCardOptions(ms.core, playerId);
    const interaction = createSimpleChoice<any>(
        `vampire_cull_the_weak_choose_card_${now}`,
        playerId,
        '剔除弱者：点击手牌中的随从卡弃置（每弃一张+1指示物），或点击停止结算',
        options,
        {
            sourceId: 'vampire_cull_the_weak_choose_card',
            targetType: 'hand' as const,
            autoResolveIfSingle: false,
            titleKey: 'ui.vampire_cull_the_weak_choose_card_title',
        },
    );

    return {
        ...interaction,
        data: {
            ...interaction.data,
            continuationContext: context,
            optionsGenerator: (nextState: { core: SmashUpCore }) => buildCullTheWeakCardOptions(nextState.core, playerId),
        },
    };
}

// ============================================================================
// 声明式 runtime prompt 程序
// ============================================================================

const vampireHeavyDrinkerPromptProgram = createPromptProgram<VampireSourceMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_heavy_drinker',
    buildInteraction: (context) => {
        const targets: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];
        for (let baseIndex = 0; baseIndex < context.matchState.core.bases.length; baseIndex += 1) {
            for (const minion of context.matchState.core.bases[baseIndex].minions) {
                if (minion.controller !== context.playerId || minion.uid === context.sourceMinionUid) continue;
                const def = getCardDef(minion.defId);
                targets.push({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex,
                    label: def?.name ?? minion.defId,
                });
            }
        }

        return createSimpleChoice(
            `vampire_heavy_drinker_${context.now}`,
            context.playerId,
            '选择要消灭的己方随从（本随从+1指示物）',
            [
                ...targets.map((target, index) => ({
                    id: `minion-${index}`,
                    label: `消灭 ${target.label}`,
                    value: {
                        minionUid: target.uid,
                        minionDefId: target.defId,
                        defId: target.defId,
                        baseIndex: target.baseIndex,
                        baseDefId: context.matchState.core.bases[target.baseIndex]?.defId,
                    },
                    _source: 'field' as const,
                    displayMode: 'card' as const,
                })),
                createSkipOption('跳过（不消灭）', 'ui.vampire_skip_destroy_option') as any,
            ] as any[],
            { sourceId: 'vampire_heavy_drinker', targetType: 'minion', titleKey: 'ui.vampire_heavy_drinker_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as {
            minionUid?: string;
            minionDefId?: string;
            defId?: string;
            baseIndex?: number;
        } | undefined;
        const selectedMinionDefId = selected?.minionDefId ?? selected?.defId;
        if (!selected?.minionUid || !selectedMinionDefId || selected.baseIndex === undefined) return { events: [] };
        const sourceDefId = getVampireSourceMinionDefId(state.core, context.sourceMinionUid, context.sourceBaseIndex);
        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selectedMinionDefId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: context.playerId,
            reason: 'vampire_heavy_drinker',
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceCardUid: context.sourceMinionUid,
            sourceDefId,
            sourceControllerId: context.playerId,
            sourceBaseIndex: context.sourceBaseIndex,
        });
        if (destroyEvents.length === 0) return { events: [] };
        return {
            events: [
                ...destroyEvents,
                addPowerCounter(context.sourceMinionUid, context.sourceBaseIndex, 1, 'vampire_heavy_drinker', timestamp + 1),
            ],
        };
    },
});

const vampireNightstalkerPromptProgram = createPromptProgram<VampireSourceMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_nightstalker',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.sourceBaseIndex];
        const targets = (base?.minions ?? [])
            .filter(minion =>
                minion.uid !== context.sourceMinionUid
                && getEffectivePower(context.matchState.core, minion, context.sourceBaseIndex) <= 2,
            )
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.sourceBaseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} (力量 ${getEffectivePower(context.matchState.core, minion, context.sourceBaseIndex)})`,
            }));

        return createSimpleChoice(
            `vampire_nightstalker_${context.now}`,
            context.playerId,
            '选择要消灭的力量≤2随从（本随从+1指示物）',
            [
                ...buildMinionTargetOptions(targets, {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    effectType: 'destroy',
                }),
                createSkipOption('跳过（不消灭）', 'ui.vampire_skip_destroy_option') as any,
            ] as any[],
            { sourceId: 'vampire_nightstalker', targetType: 'minion', titleKey: 'ui.vampire_nightstalker_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined) return { events: [] };
        const sourceDefId = getVampireSourceMinionDefId(state.core, context.sourceMinionUid, context.sourceBaseIndex);
        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selected.defId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: context.playerId,
            reason: 'vampire_nightstalker',
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceCardUid: context.sourceMinionUid,
            sourceDefId,
            sourceControllerId: context.playerId,
            sourceBaseIndex: context.sourceBaseIndex,
        });
        if (destroyEvents.length === 0) return { events: [] };
        return {
            events: [
                ...destroyEvents,
                addPowerCounter(context.sourceMinionUid, context.sourceBaseIndex, 1, 'vampire_nightstalker', timestamp + 1),
            ],
        };
    },
});

const vampireDinnerDateTargetPromptProgram = createPromptProgram<VampireBaseMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_dinner_date_target',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.baseIndex];
        const targets = (base?.minions ?? [])
            .filter(minion =>
                minion.uid !== context.minionUid
                && getEffectivePower(context.matchState.core, minion, context.baseIndex) <= 2,
            )
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.baseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} (力量 ${getEffectivePower(context.matchState.core, minion, context.baseIndex)})`,
            }));

        return createSimpleChoice(
            `vampire_dinner_date_target_${context.now}`,
            context.playerId,
            '选择要消灭的力量≤2随从',
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'destroy',
            }),
            { sourceId: 'vampire_dinner_date_target', targetType: 'minion', titleKey: 'ui.vampire_dinner_date_target_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined) return { events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: context.playerId,
                reason: 'vampire_dinner_date',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: 'vampire_dinner_date',
                sourceControllerId: context.playerId,
                sourceKind: 'action',
            }),
        };
    },
});

const vampireDinnerDatePromptProgram = createPromptProgram<VampirePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_dinner_date',
    buildInteraction: (context) => {
        const ownMinions = context.matchState.core.bases.flatMap((base, baseIndex) =>
            base.minions
                .filter(minion => minion.controller === context.playerId)
                .map((minion, index) => ({
                    id: `minion-${baseIndex}-${index}`,
                    label: getCardDef(minion.defId)?.name ?? minion.defId,
                    value: {
                        minionUid: minion.uid,
                        minionDefId: minion.defId,
                        defId: minion.defId,
                        baseIndex,
                        baseDefId: base.defId,
                    },
                    _source: 'field' as const,
                    displayMode: 'card' as const,
                })),
        );
        return createSimpleChoice(
            `vampire_dinner_date_${context.now}`,
            context.playerId,
            '选择你的随从放置+1指示物（然后消灭同基地力量≤2随从）',
            ownMinions as any[],
            { sourceId: 'vampire_dinner_date', targetType: 'minion', titleKey: 'ui.vampire_dinner_date_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const source = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!source) return { events: [] };

        const events: SmashUpEvent[] = [
            addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'vampire_dinner_date', timestamp),
        ];
        const hasDestroyTargets = state.core.bases[selected.baseIndex]?.minions.some(minion =>
            minion.uid !== selected.minionUid
            && getEffectivePower(state.core, minion, selected.baseIndex!) <= 2,
        );
        if (!hasDestroyTargets) return { events };
        return {
            events,
            context: createVampirePromptContext(state, context.playerId, timestamp, {
                minionUid: selected.minionUid,
                baseIndex: selected.baseIndex,
            }),
            nextProgram: vampireDinnerDateTargetPromptProgram,
        };
    },
});

const vampireBigGulpPromptProgram = createPromptProgram<VampirePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_big_gulp',
    buildInteraction: (context) => {
        const targets = context.matchState.core.bases.flatMap((base, baseIndex) =>
            base.minions
                .filter(minion => getEffectivePower(context.matchState.core, minion, baseIndex) <= 4)
                .map((minion) => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex,
                    label: `${getCardDef(minion.defId)?.name ?? minion.defId} (力量 ${getEffectivePower(context.matchState.core, minion, baseIndex)})`,
                })),
        );
        return createSimpleChoice(
            `vampire_big_gulp_${context.now}`,
            context.playerId,
            '选择要消灭的力量≤4随从（可跳过）',
            [
                ...buildMinionTargetOptions(targets, {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    effectType: 'destroy',
                }),
                createSkipOption() as any,
            ] as any[],
            { sourceId: 'vampire_big_gulp', targetType: 'minion', titleKey: 'ui.vampire_big_gulp_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined) return { events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: context.playerId,
                reason: 'vampire_big_gulp',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: 'vampire_big_gulp',
                sourceControllerId: context.playerId,
                sourceKind: 'action',
            }),
        };
    },
});

const vampireCullTheWeakChooseCardPromptProgram = createPromptProgram<VampireBaseMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_cull_the_weak_choose_card',
    buildInteraction: (context) => createCullTheWeakCardInteraction(
        context.matchState,
        context.playerId,
        { minionUid: context.minionUid, baseIndex: context.baseIndex },
        context.now,
    ),
    onResolve: ({ state, context, playerId, value, timestamp }) => {
        const selected = value as { cardUid?: string; stop?: boolean } | undefined;
        if (selected?.stop) return { events: [] };
        if (!selected?.cardUid) return { events: [] };

        const events: SmashUpEvent[] = [
            {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId, cardUids: [selected.cardUid] },
                timestamp,
            } as SmashUpEvent,
            addPowerCounter(context.minionUid, context.baseIndex, 1, 'vampire_cull_the_weak', timestamp),
        ];
        const remainingMinions = (state.core.players[playerId]?.hand ?? [])
            .filter(card => card.type === 'minion' && card.uid !== selected.cardUid)
            .length;
        if (remainingMinions <= 0) return { events };

        return {
            events,
            context: createVampirePromptContext(state, context.playerId, timestamp, {
                minionUid: context.minionUid,
                baseIndex: context.baseIndex,
            }),
            nextProgram: vampireCullTheWeakChooseCardPromptProgram,
        };
    },
});

const vampireCullTheWeakPromptProgram = createPromptProgram<VampirePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_cull_the_weak',
    buildInteraction: (context) => {
        const ownMinions = context.matchState.core.bases.flatMap((base, baseIndex) =>
            base.minions
                .filter(minion => minion.controller === context.playerId)
                .map((minion, index) => ({
                    id: `minion-${baseIndex}-${index}`,
                    label: getCardDef(minion.defId)?.name ?? minion.defId,
                    value: {
                        minionUid: minion.uid,
                        minionDefId: minion.defId,
                        defId: minion.defId,
                        baseIndex,
                        baseDefId: base.defId,
                    },
                    _source: 'field' as const,
                    displayMode: 'card' as const,
                })),
        );
        return createSimpleChoice(
            `vampire_cull_the_weak_${context.now}`,
            context.playerId,
            '选择你的随从（弃手牌随从卡来放指示物）',
            ownMinions as any[],
            { sourceId: 'vampire_cull_the_weak', targetType: 'minion', titleKey: 'ui.vampire_cull_the_weak_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        const minionCards = state.core.players[context.playerId]?.hand.filter(card => card.type === 'minion') ?? [];
        if (minionCards.length === 0) return { events: [] };
        return {
            events: [],
            context: createVampirePromptContext(state, context.playerId, timestamp, {
                minionUid: selected.minionUid,
                baseIndex: selected.baseIndex,
            }),
            nextProgram: vampireCullTheWeakChooseCardPromptProgram,
        };
    },
});

const vampireCrackOfDuskBasePromptProgram = createPromptProgram<VampireCrackOfDuskPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_crack_of_dusk_base',
    buildInteraction: (context) => createSimpleChoice(
        `vampire_crack_of_dusk_base_${context.now}`,
        context.playerId,
        '选择要打出随从的基地',
        buildBaseTargetOptions(
            context.matchState.core.bases.map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? `基地 #${baseIndex + 1}`,
            })),
            context.matchState.core,
        ),
        { sourceId: 'vampire_crack_of_dusk_base', targetType: 'base', titleKey: 'ui.vampire_choose_play_base_title' },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) return { events: [] };
        const cardInDiscard = state.core.players[context.playerId]?.discard.find(card => card.uid === context.cardUid);
        if (!cardInDiscard) return { events: [] };
        const minionDef = getMinionDef(context.defId);
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId: context.playerId,
                cardUid: context.cardUid,
                defId: context.defId,
                baseIndex: selected.baseIndex,
                ownerId: cardInDiscard.owner,
                power: minionDef?.power ?? 0,
                fromDiscard: true,
            } as any,
            timestamp,
        };
        return {
            events: [
                playedEvt,
                addPowerCounter(context.cardUid, selected.baseIndex, 1, 'vampire_crack_of_dusk', timestamp + 1),
            ],
        };
    },
});

const vampireCrackOfDuskPromptProgram = createPromptProgram<VampirePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_crack_of_dusk',
    buildInteraction: (context) => {
        const discard = context.matchState.core.players[context.playerId]?.discard ?? [];
        const options = discard
            .filter(card => {
                if (card.type !== 'minion') return false;
                const def = getCardDef(card.defId);
                return !!def && def.type === 'minion' && (def as { power: number }).power <= 2;
            })
            .map((card, index) => ({
                id: `card-${index}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            }));
        return createSimpleChoice(
            `vampire_crack_of_dusk_${context.now}`,
            context.playerId,
            '从弃牌堆选择力量≤2的随从打出（+1指示物）',
            options as any[],
            { sourceId: 'vampire_crack_of_dusk', targetType: 'generic', titleKey: 'ui.vampire_crack_of_dusk_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { cardUid?: string; defId?: string } | undefined;
        if (!selected?.cardUid || !selected.defId) return { events: [] };
        const stillInDiscard = state.core.players[context.playerId]?.discard.some(card => card.uid === selected.cardUid);
        if (!stillInDiscard) return { events: [] };
        return {
            events: [],
            context: createVampirePromptContext(state, context.playerId, timestamp, {
                cardUid: selected.cardUid,
                defId: selected.defId,
            }),
            nextProgram: vampireCrackOfDuskBasePromptProgram,
        };
    },
});

const vampireCountPodAddCounterPromptProgram = createPromptProgram<VampireCountPodAddCounterPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_the_count_pod_add_counter',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.targetBaseIndex];
        const options = (base?.minions ?? []).map((minion, index) => ({
            id: `minion-${index}`,
            label: getCardDef(minion.defId)?.name ?? minion.defId,
            value: {
                minionUid: minion.uid,
                minionDefId: minion.defId,
                defId: minion.defId,
                baseIndex: context.targetBaseIndex,
                baseDefId: base?.defId,
            },
            _source: 'field' as const,
            displayMode: 'card' as const,
        }));
        return createSimpleChoice(
            `vampire_the_count_pod_add_counter_${context.playerId}_${context.now}`,
            context.playerId,
            '吸血鬼伯爵：你可以在该基地的一个随从上放置+1战斗力指示物',
            [
                ...options,
                createSkipOption() as any,
            ] as any[],
            { sourceId: 'vampire_the_count_pod_add_counter', targetType: 'minion', titleKey: 'ui.vampire_the_count_pod_add_counter_title' },
        );
    },
    onResolve: ({ value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'vampire_the_count_pod', timestamp)],
        };
    },
});

const vampireBuffetPodPlayPromptProgram = createPromptProgram<VampireBuffetPodPlayPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_buffet_pod_play',
    buildInteraction: (context) => createSimpleChoice(
        `vampire_buffet_pod_${context.playerId}_${context.now}`,
        context.playerId,
        '自助餐：你可以打出此牌（抽两张牌）',
        [
            { id: 'play', label: '打出自助餐', labelKey: 'ui.vampire_buffet_pod_play_option', value: { play: true }, displayMode: 'button' as const },
            { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: { skip: true }, displayMode: 'button' as const },
        ] as any[],
        { sourceId: 'vampire_buffet_pod_play', targetType: 'button', displayCard: { defId: context.defId, cardUid: context.cardUid }, titleKey: 'ui.vampire_buffet_pod_play_title' },
    ),
    onResolve: (args) => {
        const { state, context, value, playerId, timestamp } = args;
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const events: SmashUpEvent[] = [
            buildActionPlayedEvent({
                playerId,
                cardUid: context.cardUid,
                defId: context.defId,
                ownerId: context.ownerId,
                isExtraAction: true,
                timestamp,
            }) as any,
        ];
        events.push(...buildStandardDrawEventsFromRuntimeContext(args, playerId, 2));
        return { events };
    },
});

const vampireMadMonsterPartyPodPlayPromptProgram = createPromptProgram<VampireMadMonsterPartyPodPlayPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_mad_monster_party_pod_play',
    buildInteraction: (context) => createSimpleChoice(
        `vampire_mad_monster_party_pod_${context.playerId}_${context.now}`,
        context.playerId,
        '疯狂怪物派对：你可以打出此牌（选择被消灭随从的基地）',
        [
            { id: 'play', label: '打出疯狂怪物派对', labelKey: 'ui.vampire_mad_monster_party_pod_play_option', value: { play: true }, displayMode: 'button' as const },
            { id: 'skip', label: '跳过', labelKey: 'ui.skip', value: { skip: true }, displayMode: 'button' as const },
        ] as any[],
        { sourceId: 'vampire_mad_monster_party_pod_play', targetType: 'button', displayCard: { defId: context.defId, cardUid: context.cardUid }, titleKey: 'ui.vampire_mad_monster_party_pod_play_title' },
    ),
    onResolve: ({ state, context, value, playerId, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const base = state.core.bases[context.baseIndex];
        if (!base) return { events: [] };
        const events: SmashUpEvent[] = [
            buildActionPlayedEvent({
                playerId,
                cardUid: context.cardUid,
                defId: context.defId,
                ownerId: context.ownerId,
                isExtraAction: true,
                targetBaseIndex: context.baseIndex,
                timestamp,
            }) as any,
        ];
        for (const minion of base.minions) {
            if (minion.controller === playerId) {
                events.push(addPowerCounter(minion.uid, context.baseIndex, 1, 'vampire_mad_monster_party_pod', timestamp));
            }
        }
        return { events };
    },
});

const vampireFledglingPodBuryBasePromptProgram = createPromptProgram<VampireFledglingPodBuryBasePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_fledgling_vampire_pod_bury_base',
    buildInteraction: (context) => createSimpleChoice(
        `vampire_fledgling_vampire_pod_bury_base_${context.now}`,
        context.playerId,
        '选择要埋葬到的基地',
        buildBaseTargetOptions(
            context.matchState.core.bases.map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? `基地 #${baseIndex + 1}`,
            })),
            context.matchState.core,
        ),
        { sourceId: 'vampire_fledgling_vampire_pod_bury_base', targetType: 'base', titleKey: 'ui.vampire_bury_base_title' },
    ),
    onResolve: ({ context, value, playerId, random, timestamp }) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) return { events: [] };
        return {
            events: buildBuryCardEvents({
                core: context.matchState.core,
                matchState: context.matchState,
                playerId,
                cardUid: context.cardUid,
                defId: 'vampire_fledgling_vampire_pod',
                baseIndex: selected.baseIndex,
                trueOwnerId: context.trueOwnerId,
                buriedFrom: context.fromDiscard ? 'discard' : 'hand',
                reason: 'vampire_fledgling_vampire_pod',
                random,
                now: timestamp,
            }),
        };
    },
});

const vampireFledglingPodBurySourcePromptProgram = createPromptProgram<VampirePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_fledgling_vampire_pod_bury_source',
    buildInteraction: (context) => {
        const player = context.matchState.core.players[context.playerId];
        const options = [
            ...(player?.hand ?? [])
                .filter(card => card.defId === 'vampire_fledgling_vampire_pod')
                .map((card, index) => ({
                    id: `hand-${index}`,
                    label: '从手牌埋葬',
                    labelKey: 'ui.vampire_fledgling_vampire_pod_bury_from_hand_option',
                    value: { cardUid: card.uid, defId: card.defId, fromDiscard: false },
                    _source: 'hand' as const,
                    displayMode: 'card' as const,
                })),
            ...(player?.discard ?? [])
                .filter(card => card.defId === 'vampire_fledgling_vampire_pod')
                .map((card, index) => ({
                    id: `discard-${index}`,
                    label: '从弃牌堆埋葬',
                    labelKey: 'ui.vampire_fledgling_vampire_pod_bury_from_discard_option',
                    value: { cardUid: card.uid, defId: card.defId, fromDiscard: true },
                    _source: 'discard' as const,
                    displayMode: 'card' as const,
                })),
            createSkipOption() as any,
        ];
        return createSimpleChoice(
            `vampire_fledgling_vampire_pod_bury_${context.playerId}_${context.now}`,
            context.playerId,
            '新生吸血鬼：你可以埋葬这张牌到任意基地',
            options as any[],
            { sourceId: 'vampire_fledgling_vampire_pod_bury_source', targetType: 'generic', titleKey: 'ui.vampire_fledgling_vampire_pod_bury_source_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as { cardUid?: string; fromDiscard?: boolean } | undefined;
        if (!selected?.cardUid) return { events: [] };
        const player = state.core.players[context.playerId];
        const selectedCard = [
            ...(player?.hand ?? []),
            ...(player?.discard ?? []),
        ].find(card => card.uid === selected.cardUid);
        return {
            events: [],
            context: createVampirePromptContext(state, context.playerId, timestamp, {
                cardUid: selected.cardUid,
                fromDiscard: !!selected.fromDiscard,
                trueOwnerId: (selectedCard?.owner as PlayerId | undefined) ?? context.playerId,
            }),
            nextProgram: vampireFledglingPodBuryBasePromptProgram,
        };
    },
});

const vampireHeavyDrinkerPodPromptProgram = createPromptProgram<VampireSourceMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_heavy_drinker_pod',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.sourceBaseIndex];
        const hereTargets = (base?.minions ?? [])
            .filter(minion =>
                minion.uid !== context.sourceMinionUid
                && getEffectivePower(context.matchState.core, minion, context.sourceBaseIndex) <= 2,
            )
            .map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex: context.sourceBaseIndex,
                label: `${getCardDef(minion.defId)?.name ?? minion.defId} (战斗力 ${getEffectivePower(context.matchState.core, minion, context.sourceBaseIndex)})`,
            }));
        const otherOwnTargets = context.matchState.core.bases.flatMap((currentBase, baseIndex) =>
            currentBase.minions
                .filter(minion => minion.controller === context.playerId && minion.uid !== context.sourceMinionUid)
                .map((minion) => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex,
                    label: getCardDef(minion.defId)?.name ?? minion.defId,
                })),
        );
        return createSimpleChoice(
            `vampire_heavy_drinker_pod_${context.now}`,
            context.playerId,
            '海量酒鬼：选择要消灭的随从（本随从放置两个+1战斗力指示物）',
            [
                ...buildMinionTargetOptions(hereTargets, {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    effectType: 'destroy',
                }).map((option) => ({
                    ...option,
                    id: `here-${option.id}`,
                })),
                ...otherOwnTargets.map((target, index) => ({
                    id: `own-${index}`,
                    label: `消灭：${target.label}`,
                    value: {
                        minionUid: target.uid,
                        minionDefId: target.defId,
                        defId: target.defId,
                        baseIndex: target.baseIndex,
                        baseDefId: context.matchState.core.bases[target.baseIndex]?.defId,
                    },
                    _source: 'field' as const,
                    displayMode: 'card' as const,
                })),
                createSkipOption('跳过（不消灭）', 'ui.vampire_skip_destroy_option') as any,
            ] as any[],
            { sourceId: 'vampire_heavy_drinker_pod', targetType: 'minion', titleKey: 'ui.vampire_heavy_drinker_pod_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as {
            minionUid?: string;
            minionDefId?: string;
            defId?: string;
            baseIndex?: number;
        } | undefined;
        const selectedMinionDefId = selected?.minionDefId ?? selected?.defId;
        if (!selected?.minionUid || !selectedMinionDefId || selected.baseIndex === undefined) return { events: [] };
        const sourceDefId = getVampireSourceMinionDefId(state.core, context.sourceMinionUid, context.sourceBaseIndex);
        const destroyEvents = buildValidatedDestroyEvents(state, {
            minionUid: selected.minionUid,
            minionDefId: selectedMinionDefId,
            fromBaseIndex: selected.baseIndex,
            destroyerId: context.playerId,
            reason: 'vampire_heavy_drinker_pod',
            now: timestamp,
            sourcePlayerId: context.playerId,
            sourceCardUid: context.sourceMinionUid,
            sourceDefId,
            sourceControllerId: context.playerId,
            sourceBaseIndex: context.sourceBaseIndex,
        });
        if (destroyEvents.length === 0) return { events: [] };
        return {
            events: [
                ...destroyEvents,
                addPowerCounter(context.sourceMinionUid, context.sourceBaseIndex, 2, 'vampire_heavy_drinker_pod', timestamp),
            ],
        };
    },
});

const vampireCountPodTalentPromptProgram = createPromptProgram<VampirePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_the_count_pod_talent',
    buildInteraction: (context) => {
        const targets = context.matchState.core.bases.flatMap((base, baseIndex) =>
            base.minions.map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            })),
        );
        return createSimpleChoice(
            `vampire_the_count_pod_talent_${context.now}`,
            context.playerId,
            '吸血鬼伯爵：选择一个随从直到你的下回合开始时-1战斗力',
            [
                ...buildMinionTargetOptions(targets, {
                    state: context.matchState.core,
                    sourcePlayerId: context.playerId,
                    effectType: 'affect',
                }),
                createSkipOption() as any,
            ] as any[],
            { sourceId: 'vampire_the_count_pod_talent', targetType: 'minion', titleKey: 'ui.vampire_the_count_pod_talent_title' },
        );
    },
    onResolve: ({ state, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        const powerEvent = addPermanentPowerUntilNextTurnStart(
            state,
            selected.minionUid,
            selected.baseIndex,
            -1,
            'vampire_the_count_pod',
            timestamp,
        );
        if (!powerEvent) return { events: [] };
        return {
            events: [powerEvent],
        };
    },
});

const vampireBigGulpPodPromptProgram = createPromptProgram<VampirePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_big_gulp_pod',
    buildInteraction: (context) => {
        const targets = context.matchState.core.bases.flatMap((base, baseIndex) =>
            base.minions
                .filter(minion => getEffectivePower(context.matchState.core, minion, baseIndex) <= 4)
                .map((minion) => ({
                    uid: minion.uid,
                    defId: minion.defId,
                    baseIndex,
                    label: `${getCardDef(minion.defId)?.name ?? minion.defId} (战斗力 ${getEffectivePower(context.matchState.core, minion, baseIndex)})`,
                })),
        );
        return createSimpleChoice(
            `vampire_big_gulp_pod_${context.now}`,
            context.playerId,
            '选择要消灭的战斗力≤4的随从',
            buildMinionTargetOptions(targets, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'destroy',
            }),
            { sourceId: 'vampire_big_gulp_pod', targetType: 'minion', titleKey: 'ui.vampire_big_gulp_pod_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { minionUid?: string; defId?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || !selected.defId || selected.baseIndex === undefined) return { events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        return {
            events: buildValidatedDestroyEvents(state, {
                minionUid: selected.minionUid,
                minionDefId: selected.defId,
                fromBaseIndex: selected.baseIndex,
                destroyerId: context.playerId,
                reason: 'vampire_big_gulp_pod',
                now: timestamp,
                sourcePlayerId: context.playerId,
                sourceDefId: 'vampire_big_gulp_pod',
                sourceControllerId: context.playerId,
                sourceKind: 'action',
            }),
        };
    },
});

const vampireCullTheWeakPodPromptProgram = createPromptProgram<VampireCullTheWeakPodPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_cull_the_weak_pod',
    buildInteraction: (context) => {
        const minions = context.matchState.core.bases.flatMap((base, baseIndex) =>
            base.minions.map((minion) => ({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
            })),
        );
        return createSimpleChoice(
            `vampire_cull_the_weak_pod_${context.now}`,
            context.playerId,
            '剔除弱者：选择一个随从放置+1战斗力指示物（每弃1张随从放1个）',
            buildMinionTargetOptions(minions, {
                state: context.matchState.core,
                sourcePlayerId: context.playerId,
                effectType: 'affect',
            }) as any,
            { sourceId: 'vampire_cull_the_weak_pod', targetType: 'minion', titleKey: 'ui.vampire_cull_the_weak_pod_title' },
        );
    },
    onResolve: ({ context, value, playerId, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const events: SmashUpEvent[] = [...context.deckEvents];
        events.push({
            type: SU_EVENTS.CARDS_MILLED,
            payload: { playerId, count: context.discardUids.length, cardUids: context.discardUids },
            timestamp,
        } as any);
        for (let index = 0; index < context.discardedCount; index += 1) {
            events.push(addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'vampire_cull_the_weak_pod', timestamp));
        }
        return { events };
    },
});

const vampireCrackOfDuskPodBasePromptProgram = createPromptProgram<VampireCrackOfDuskPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_crack_of_dusk_pod_base',
    buildInteraction: (context) => createSimpleChoice(
        `vampire_crack_of_dusk_pod_base_${context.now}`,
        context.playerId,
        '选择要打出随从的基地',
        buildBaseTargetOptions(
            context.matchState.core.bases.map((base, baseIndex) => ({
                baseIndex,
                label: getBaseDef(base.defId)?.name ?? `基地 #${baseIndex + 1}`,
            })),
            context.matchState.core,
        ),
        { sourceId: 'vampire_crack_of_dusk_pod_base', targetType: 'base', titleKey: 'ui.vampire_choose_play_base_title' },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { baseIndex?: number } | undefined;
        if (selected?.baseIndex === undefined) return { events: [] };
        const cardInDiscard = state.core.players[context.playerId]?.discard.find(card => card.uid === context.cardUid);
        if (!cardInDiscard) return { events: [] };
        const minionDef = getMinionDef(context.defId);
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: {
                playerId: context.playerId,
                cardUid: context.cardUid,
                defId: context.defId,
                baseIndex: selected.baseIndex,
                ownerId: cardInDiscard.owner,
                power: minionDef?.power ?? 0,
                fromDiscard: true,
                consumesNormalLimit: false,
            } as any,
            timestamp,
        };
        return {
            events: [
                playedEvt,
                addPowerCounter(context.cardUid, selected.baseIndex, 1, 'vampire_crack_of_dusk_pod', timestamp + 1),
            ],
        };
    },
});

const vampireCrackOfDuskPodPromptProgram = createPromptProgram<VampirePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_crack_of_dusk_pod',
    buildInteraction: (context) => {
        const discard = context.matchState.core.players[context.playerId]?.discard ?? [];
        const options = discard
            .filter(card => {
                if (card.type !== 'minion') return false;
                const def = getCardDef(card.defId);
                return !!def && def.type === 'minion' && (def as { power: number }).power <= 2;
            })
            .map((card, index) => ({
                id: `card-${index}`,
                label: getCardDef(card.defId)?.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                _source: 'discard' as const,
                displayMode: 'card' as const,
            }));
        return createSimpleChoice(
            `vampire_crack_of_dusk_pod_${context.now}`,
            context.playerId,
            '从弃牌堆选择力量≤2的随从打出（+1指示物，不占用普通随从次数）',
            options as any[],
            { sourceId: 'vampire_crack_of_dusk_pod', targetType: 'generic', titleKey: 'ui.vampire_crack_of_dusk_pod_title' },
        );
    },
    onResolve: ({ state, context, value, timestamp }) => {
        const selected = value as { cardUid?: string; defId?: string } | undefined;
        if (!selected?.cardUid || !selected.defId) return { events: [] };
        const stillInDiscard = state.core.players[context.playerId]?.discard.some(card => card.uid === selected.cardUid);
        if (!stillInDiscard) return { events: [] };
        return {
            events: [],
            context: createVampirePromptContext(state, context.playerId, timestamp, {
                cardUid: selected.cardUid,
                defId: selected.defId,
            }),
            nextProgram: vampireCrackOfDuskPodBasePromptProgram,
        };
    },
});

const vampireDinnerDatePodPromptProgram = createPromptProgram<VampireDinnerDatePodPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_dinner_date_pod',
    buildInteraction: (context) => {
        const ownMinions = context.matchState.core.bases.flatMap((base, baseIndex) =>
            base.minions
                .filter(minion => minion.controller === context.playerId)
                .map((minion, index) => ({
                    id: `minion-${baseIndex}-${index}`,
                    label: getCardDef(minion.defId)?.name ?? minion.defId,
                    value: {
                        minionUid: minion.uid,
                        minionDefId: minion.defId,
                        defId: minion.defId,
                        baseIndex,
                        baseDefId: base.defId,
                    },
                    _source: 'field' as const,
                    displayMode: 'card' as const,
                })),
        );
        return createSimpleChoice(
            `vampire_dinner_date_pod_${context.now}`,
            context.playerId,
            '晚餐约会：选择你的一个随从放置两个+1战斗力指示物',
            buildMinionTargetOptions(
                ownMinions.map((option) => ({
                    uid: option.value.minionUid,
                    defId: context.matchState.core.bases[option.value.baseIndex].minions.find(minion => minion.uid === option.value.minionUid)?.defId ?? '',
                    baseIndex: option.value.baseIndex,
                    label: option.label,
                })),
                { state: context.matchState.core, sourcePlayerId: context.playerId, effectType: 'affect' },
            ) as any,
            { sourceId: 'vampire_dinner_date_pod', targetType: 'minion', titleKey: 'ui.vampire_dinner_date_pod_title' },
        );
    },
    onResolve: ({ state, context, value, playerId, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const events: SmashUpEvent[] = [addPowerCounter(selected.minionUid, selected.baseIndex, 2, 'vampire_dinner_date_pod', timestamp)];
        const attachedBase = state.core.bases[context.attachedBaseIndex];
        const attachedMinion = attachedBase?.minions.find(minion => minion.uid === context.attachedMinionUid);
        if (!attachedMinion) return { events };
        const effectiveNow = getEffectivePower(state.core, attachedMinion, context.attachedBaseIndex);
        const hasDinnerDateAttached = attachedMinion.attachedActions.some(action => action.defId === 'vampire_dinner_date_pod');
        const projectedPower = hasDinnerDateAttached ? effectiveNow : effectiveNow - 2;
        if (projectedPower > 0) return { events };
        return {
            events: [
                ...events,
                ...buildValidatedDestroyEvents(state.core, {
                    minionUid: attachedMinion.uid,
                    minionDefId: attachedMinion.defId,
                    fromBaseIndex: context.attachedBaseIndex,
                    destroyerId: playerId,
                    reason: 'vampire_dinner_date_pod',
                    now: timestamp,
                    sourcePlayerId: context.playerId,
                    sourceCardUid: context.sourceCardUid,
                    sourceDefId: context.sourceDefId,
                    sourceControllerId: context.playerId,
                    sourceBaseIndex: context.sourceBaseIndex,
                }),
            ],
        };
    },
});

const vampireWolfPactPodMinionTargetPromptProgram = createPromptProgram<VampireWolfPactPodMinionTargetPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_wolf_pact_pod_minion_target',
    buildInteraction: (context) => {
        const base = context.matchState.core.bases[context.wolfBaseIndex];
        const recipients = (base?.minions ?? [])
            .filter(minion => minion.controller === context.playerId)
            .map((minion, index) => ({
                id: `recipient-${index}`,
                label: getCardDef(minion.defId)?.name ?? minion.defId,
                value: {
                    minionUid: minion.uid,
                    minionDefId: minion.defId,
                    defId: minion.defId,
                    baseIndex: context.wolfBaseIndex,
                    baseDefId: base?.defId,
                },
                _source: 'field' as const,
                displayMode: 'card' as const,
            }));
        return createSimpleChoice(
            `vampire_wolf_pact_pod_minion_target_${context.now}`,
            context.playerId,
            '狼之契约：选择在该基地的另一个你的随从放置+1战斗力指示物',
            recipients as any[],
            { sourceId: 'vampire_wolf_pact_pod_minion_target', targetType: 'minion', titleKey: 'ui.vampire_wolf_pact_pod_minion_target_title' },
        );
    },
    onResolve: ({ value, timestamp }) => {
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        return {
            events: [addPowerCounter(selected.minionUid, selected.baseIndex, 1, 'vampire_wolf_pact_pod', timestamp)],
        };
    },
});

const vampireWolfPactPodMinionPromptProgram = createPromptProgram<VampireWolfPactPodMinionPromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_wolf_pact_pod_minion',
    buildInteraction: (context) => createSimpleChoice(
        `vampire_wolf_pact_pod_minion_${context.now}`,
        context.playerId,
        '狼之契约（随从）：选择一个随从直到你下回合开始时-1战斗力',
        [
            ...buildMinionTargetOptions(
                context.matchState.core.bases.flatMap((base, baseIndex) =>
                    base.minions.map(minion => ({
                        uid: minion.uid,
                        defId: minion.defId,
                        baseIndex,
                        label: getCardDef(minion.defId)?.name ?? minion.defId,
                    })),
                ),
                { state: context.matchState.core, sourcePlayerId: context.playerId, effectType: 'affect' },
            ),
            createSkipOption() as any,
        ] as any[],
        { sourceId: 'vampire_wolf_pact_pod_minion', targetType: 'minion', titleKey: 'ui.vampire_wolf_pact_pod_minion_title' },
    ),
    onResolve: ({ state, context, value, timestamp }) => {
        if ((value as { skip?: boolean } | undefined)?.skip) return { events: [] };
        const selected = value as { minionUid?: string; baseIndex?: number } | undefined;
        if (!selected?.minionUid || selected.baseIndex === undefined) return { events: [] };
        const target = state.core.bases[selected.baseIndex]?.minions.find(minion => minion.uid === selected.minionUid);
        if (!target) return { events: [] };
        const base = state.core.bases[context.wolfBaseIndex];
        if (!base) return { events: [] };
        const recipients = base.minions.filter(minion => minion.controller === context.playerId && minion.uid !== context.wolfUid);
        if (recipients.length === 0) return { events: [] };
        const powerEvent = addPermanentPowerUntilNextTurnStart(
            state,
            selected.minionUid,
            selected.baseIndex,
            -1,
            'vampire_wolf_pact_pod',
            timestamp,
        );
        if (!powerEvent) return { events: [] };
        return {
            events: [powerEvent],
            context: createVampirePromptContext(state, context.playerId, timestamp, {
                wolfBaseIndex: context.wolfBaseIndex,
            }),
            nextProgram: vampireWolfPactPodMinionTargetPromptProgram,
        };
    },
});

const vampireWolfPactPodActionPromptProgram = createPromptProgram<VampirePromptContext, SmashUpCore, SmashUpEvent>({
    sourceId: 'vampire_wolf_pact_pod_action',
    buildInteraction: (context) => {
        const player = context.matchState.core.players[context.playerId];
        const options = (player?.discard ?? []).map((card, index) => ({
            id: `card-${index}`,
            label: getCardDef(card.defId)?.name ?? card.defId,
            value: { cardUid: card.uid, defId: card.defId },
            _source: 'discard' as const,
            displayMode: 'card' as const,
        }));
        return createSimpleChoice(
            `vampire_wolf_pact_pod_action_${context.now}`,
            context.playerId,
            '狼之契约（战术）：选择弃牌堆的一张卡洗入牌库',
            options as any[],
            { sourceId: 'vampire_wolf_pact_pod_action', targetType: 'generic', titleKey: 'ui.vampire_wolf_pact_pod_action_title' },
        );
    },
    onResolve: ({ state, value, playerId, random, timestamp }) => {
        const selected = value as { cardUid?: string } | undefined;
        if (!selected?.cardUid) return { events: [] };
        const player = state.core.players[playerId];
        const card = player?.discard.find(entry => entry.uid === selected.cardUid);
        if (!card) return { events: [] };
        const ownerId = state.core.players[card.owner] ? card.owner : playerId;
        const owner = state.core.players[ownerId];
        const newDeckUids = random.shuffle([...owner.deck.map(entry => entry.uid), card.uid]);
        return {
            events: [{
                type: SU_EVENTS.DECK_REORDERED,
                payload: {
                    playerId: ownerId,
                    deckUids: newDeckUids,
                    ...(ownerId !== playerId ? { sourcePlayerId: playerId } : {}),
                },
                timestamp,
            } as any],
        };
    },
});

// ============================================================================
// 交互处理函数（POD / 非 runtime 残留）
// ============================================================================

// ============================================================================
// POD implementations
// ============================================================================

function vampireHeavyDrinkerPod(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    const base = ctx.state.bases[found.baseIndex];
    if (!base) return { events: [] };

    const hereTargets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (const m of base.minions) {
        if (m.uid === ctx.cardUid) continue;
        const power = getEffectivePower(ctx.state, m, found.baseIndex);
        if (power <= 2) {
            const def = getCardDef(m.defId);
            hereTargets.push({ uid: m.uid, defId: m.defId, baseIndex: found.baseIndex, label: `${def?.name ?? m.defId} (战斗力 ${power})` });
        }
    }
    const otherOwnTargets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            if (m.uid === ctx.cardUid) continue;
            const def = getCardDef(m.defId);
            otherOwnTargets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId}` });
        }
    }
    if (hereTargets.length === 0 && otherOwnTargets.length === 0) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }
    const result = executeAbilityProgram(
        vampireHeavyDrinkerPodPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            sourceMinionUid: found.minion.uid,
            sourceBaseIndex: found.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function vampireCountPodTalent(ctx: AbilityContext): AbilityResult {
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const def = getCardDef(m.defId);
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId}` });
        }
    }
    if (targets.length === 0) return { events: [] };
    const result = executeAbilityProgram(
        vampireCountPodTalentPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function vampireBuffetPod(ctx: AbilityContext): AbilityResult {
    return { events: buildStandardDrawEvents(ctx.state, ctx.playerId, 2, ctx.random, ctx.now) };
}

function vampireNightstalkerPodTalent(ctx: AbilityContext): AbilityResult {
    const hasDestroyed = (ctx.state.destroyedMinionByPlayersThisTurn ?? []).includes(ctx.playerId);
    if (!hasDestroyed) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const events: SmashUpEvent[] = buildStandardDrawEvents(ctx.state, ctx.playerId, 1, ctx.random, ctx.now);
    events.push(addTempPower(ctx.cardUid, ctx.baseIndex, 2, 'vampire_nightstalker_pod', ctx.now));
    return { events };
}

function vampireBigGulpPod(ctx: AbilityContext): AbilityResult {
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const p = getEffectivePower(ctx.state, m, i);
            if (p <= 4) {
                const def = getCardDef(m.defId);
                targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId} (战斗力 ${p})` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(
        vampireBigGulpPodPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function vampireCullTheWeakPod(ctx: AbilityContext): AbilityResult {
    // Engine limitation: no full deck browse UI. We approximate by searching until 2 minions found, discard them, then place counters.
    const picked = revealAndPickFromDeck({
        state: ctx.state,
        random: ctx.random,
        playerId: ctx.playerId,
        predicate: (c) => c.type === 'minion',
        maxPick: 2,
        revealTo: ctx.playerId,
        reason: 'vampire_cull_the_weak_pod',
        now: ctx.now,
    });
    if (picked.picked.length === 0) return { events: [] };
    // Choose target minion to receive counters (one per discarded minion)
    const myMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const def = getCardDef(m.defId);
            myMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: def?.name ?? m.defId });
        }
    }
    const result = executeAbilityProgram(
        vampireCullTheWeakPodPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            discardedCount: picked.picked.length,
            deckEvents: picked.events,
            discardUids: picked.picked.map(card => card.uid),
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function vampireCrackOfDuskPod(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const candidates = player.discard.filter(c => {
        if (c.type !== 'minion') return false;
        const def = getCardDef(c.defId);
        return def && def.type === 'minion' && (def as { power: number }).power <= 2;
    });
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const result = executeAbilityProgram(
        vampireCrackOfDuskPodPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function vampireDinnerDatePod(ctx: AbilityContext): AbilityResult {
    // When played as ongoing on a minion: choose one of your minions to receive two counters; attached minion -2 power.
    if (!ctx.targetMinionUid) return { events: [] };
    const own: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            const def = getCardDef(m.defId);
            own.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: def?.name ?? m.defId });
        }
    }
    const result = executeAbilityProgram(
        vampireDinnerDatePodPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            attachedMinionUid: ctx.targetMinionUid,
            attachedBaseIndex: ctx.baseIndex,
            sourceCardUid: ctx.cardUid,
            sourceDefId: ctx.defId,
            sourceBaseIndex: ctx.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function vampireWolfPactPodMinionOnPlay(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    const hasOtherOwnMinionHere = !!base?.minions.some(m => m.controller === ctx.playerId && m.uid !== ctx.cardUid);
    if (!hasOtherOwnMinionHere) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    }

    const result = executeAbilityProgram(
        vampireWolfPactPodMinionPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now, {
            wolfUid: ctx.cardUid,
            wolfBaseIndex: ctx.baseIndex,
        }),
    );
    return { events: result.events, matchState: result.matchState };
}

function vampireWolfPactPodActionOnPlay(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (!player || player.discard.length === 0) return { events: [] };
    const result = executeAbilityProgram(
        vampireWolfPactPodActionPromptProgram,
        createVampirePromptContext(ctx.matchState, ctx.playerId, ctx.now),
    );
    return { events: result.events, matchState: result.matchState };
}

function vampireStakeoutPodTalent(ctx: AbilityContext): AbilityResult {
    // Find base where this ongoing is attached
    const baseIndex = ctx.baseIndex;
    const base = ctx.state.bases[baseIndex];
    if (!base) return { events: [] };
    const decreased = ctx.state.basePowerDecreasedPlayersThisTurn?.[baseIndex] ?? [];
    const hasOther = decreased.some(pid => pid !== ctx.playerId);
    if (!hasOther) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const expires = ctx.state.turnNumber + ctx.state.turnOrder.length;
    const events: SmashUpEvent[] = [
        {
            type: SU_EVENTS.STAKEOUT_POD_BLOCK_ADDED,
            payload: { baseIndex, ownerId: ctx.playerId, expiresOnTurnNumber: expires, reason: 'vampire_stakeout_pod' },
            timestamp: ctx.now,
        } as any,
    ];
    return { events };
}
// ============================================================================
// Ongoing 效果注册
// ============================================================================

function registerVampireOngoingEffects(): void {
    // 吸血鬼伯爵 ongoing：对手随从被消灭后+1指示物
    registerTrigger('vampire_the_count', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, triggerMinionUid, now } = ctx;
        if (!triggerMinionUid) return [];
        const destroyedControllerId = ctx.triggerMinion?.controller ?? ctx.controllerId ?? ctx.playerId;
        const events: SmashUpEvent[] = [];
        for (let i = 0; i < state.bases.length; i++) {
            for (const m of state.bases[i].minions) {
                if (matchesDefId(m.defId, 'vampire_the_count') && m.controller !== destroyedControllerId) {
                    events.push(addPowerCounter(m.uid, i, 1, 'vampire_the_count', now));
                }
            }
        }
        return events;
    });

    // 投机主义 ongoing(minion)：对手随从被消灭后+1指示物
    registerTrigger('vampire_opportunist', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, now } = ctx;
        const destroyedControllerId = ctx.triggerMinion?.controller ?? ctx.controllerId ?? ctx.playerId;
        const events: SmashUpEvent[] = [];
        for (let i = 0; i < state.bases.length; i++) {
            for (const m of state.bases[i].minions) {
                if (m.controller === destroyedControllerId) continue;
                const opportunistCount = m.attachedActions.filter(a =>
                    matchesDefId(a.defId, 'vampire_opportunist'),
                ).length;
                for (let index = 0; index < opportunistCount; index += 1) {
                    events.push(addPowerCounter(m.uid, i, 1, 'vampire_opportunist', now));
                }
            }
        }
        return events;
    }, {
    });

    // 召唤狼群 ongoing(base)：回合开始在本卡上放+1力量指示物
    registerTrigger('vampire_summon_wolves', 'onTurnStart', (ctx: TriggerContext) => {
        const { state, playerId, now } = ctx;
        if (ctx.sourceCardUid) {
            const candidateBases = ctx.sourceBaseIndex !== undefined
                ? [{ base: state.bases[ctx.sourceBaseIndex], baseIndex: ctx.sourceBaseIndex }]
                : state.bases.map((base, baseIndex) => ({ base, baseIndex }));
            for (const candidate of candidateBases) {
                const ongoing = candidate.base?.ongoingActions.find((oa) =>
                    oa.uid === ctx.sourceCardUid && matchesDefId(oa.defId, 'vampire_summon_wolves'));
                if (!ongoing) continue;
                const ongoingControllerId = (ongoing.metadata?.sourceControllerId as PlayerId | undefined) ?? ongoing.ownerId;
                if (ongoingControllerId !== playerId) return [];
                return [addOngoingCardCounter(
                    ongoing.uid,
                    candidate.baseIndex,
                    1,
                    'vampire_summon_wolves',
                    now,
                ) as unknown as SmashUpEvent];
            }
            return [];
        }

        const events: SmashUpEvent[] = [];
        for (let i = 0; i < state.bases.length; i++) {
            for (const oa of state.bases[i].ongoingActions) {
                const ongoingControllerId = (oa.metadata?.sourceControllerId as PlayerId | undefined) ?? oa.ownerId;
                if (matchesDefId(oa.defId, 'vampire_summon_wolves') && ongoingControllerId === playerId) {
                    events.push(addOngoingCardCounter(oa.uid, i, 1, 'vampire_summon_wolves', now) as unknown as SmashUpEvent);
                }
            }
        }
        return events;
    }, {
        perInstance: true,
        playerContext: 'sourceController',
    });

    // 自助餐 special：基地计分后如果打出者是赢家（排名第一），己方所有随从+1指示物
    // 使用 ARMED → afterScoring 延迟触发机制
    registerTrigger('vampire_buffet', 'afterScoring', (ctx: TriggerContext) => {
        const { state, baseIndex, rankings, now } = ctx;
        if (baseIndex === undefined || !rankings || rankings.length === 0) return [];

        const armed = (state.pendingAfterScoringSpecials ?? []).filter(
            s => s.sourceDefId === 'vampire_buffet' && s.baseIndex === baseIndex,
        );
        if (armed.length === 0) return [];

        const events: SmashUpEvent[] = armed.map(s => ({
            type: SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED,
            payload: { sourceDefId: s.sourceDefId, playerId: s.playerId, baseIndex: s.baseIndex, baseDefId: ctx.state.bases[s.baseIndex].defId  },
            timestamp: now,
        } as SmashUpEvent));

        for (const entry of armed) {
            // 只有排名第一（赢家）才触发效果
            if (rankings[0].playerId !== entry.playerId) continue;

            // 给所有基地上的己方随从加指示物（包括计分基地）
            for (let i = 0; i < state.bases.length; i++) {
                for (const m of state.bases[i].minions) {
                    if (m.controller === entry.playerId) {
                        events.push(addPowerCounter(m.uid, i, 1, 'vampire_buffet', now));
                    }
                }
            }
        }
        return events;
    }, {
        playerContext: 'sourceController',
    });
}
