/**
 * 大杀四方 - 科学怪人派系能力
 *
 * 主题：+1力量指示物的放置、移除、转移
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addPowerCounter, removePowerCounter, destroyMinion,
    getMinionPower, grantExtraMinion, queueMinionPlayEffect, buildMinionTargetOptions,
    resolveOrPrompt, findMinionOnBases, buildAbilityFeedback,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, MinionOnBase, SmashUpCore } from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { getCardDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';

// ============================================================================
// 注册入口
// ============================================================================

/** 注册科学怪人派系所有能力 */
export function registerFrankensteinAbilities(): void {
    // 随从能力
    registerAbility('frankenstein_lab_assistant', 'onPlay', frankensteinLabAssistant);
    registerAbility('frankenstein_the_monster', 'talent', frankensteinTheMonster);
    registerAbility('frankenstein_herr_doktor', 'talent', frankensteinHerrDoktor);
    registerAbility('frankenstein_igor', 'onDestroy', frankensteinIgorOnDestroy);

    // 行动卡能力
    registerAbility('frankenstein_jolt', 'onPlay', frankensteinJolt);
    registerAbility('frankenstein_its_alive', 'onPlay', frankensteinItsAlive);
    registerAbility('frankenstein_angry_mob', 'onPlay', frankensteinAngryMob);
    registerAbility('frankenstein_body_shop', 'onPlay', frankensteinBodyShop);
    registerAbility('frankenstein_blitzed', 'onPlay', frankensteinBlitzed);

    // ongoing 效果
    registerFrankensteinOngoingEffects();
}

/** 注册科学怪人派系交互处理函数 */
export function registerFrankensteinInteractionHandlers(): void {
    registerInteractionHandler('frankenstein_lab_assistant', handleLabAssistantChoice);
    registerInteractionHandler('frankenstein_herr_doktor', handleHerrDoktorChoice);
    registerInteractionHandler('frankenstein_angry_mob', handleAngryMobChooseMinion);
    registerInteractionHandler('frankenstein_angry_mob_choose_card', handleAngryMobChooseCard);
    registerInteractionHandler('frankenstein_body_shop', handleBodyShopChooseMinion);
    registerInteractionHandler('frankenstein_body_shop_distribute', handleBodyShopDistribute);
    registerInteractionHandler('frankenstein_blitzed_remove', handleBlitzedRemove);
    registerInteractionHandler('frankenstein_blitzed_destroy', handleBlitzedDestroy);
    registerInteractionHandler('frankenstein_igor', handleIgorChooseTarget);
}

// ============================================================================
// 辅助函数
// ============================================================================

/** 获取场上所有己方随从（跨基地） */
function getAllOwnMinions(ctx: AbilityContext): { minion: MinionOnBase; baseIndex: number }[] {
    const result: { minion: MinionOnBase; baseIndex: number }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) result.push({ minion: m, baseIndex: i });
        }
    }
    return result;
}

/** 构建己方随从选项（用于放指示物等，排除指定 uid） */
function buildOwnMinionOptions(
    ctx: AbilityContext,
    excludeUid?: string,
    filter?: (m: MinionOnBase, baseIndex: number) => boolean,
) {
    const minions = getAllOwnMinions(ctx);
    return minions
        .filter(({ minion, baseIndex }) => minion.uid !== excludeUid && (!filter || filter(minion, baseIndex)))
        .map(({ minion, baseIndex }) => {
            const def = getCardDef(minion.defId);
            const power = getMinionPower(ctx.state, minion, baseIndex);
            return {
                uid: minion.uid, defId: minion.defId, baseIndex,
                label: `${def?.name ?? minion.defId} (力量 ${power})`,
            };
        });
}

// ============================================================================
// 随从能力
// ============================================================================

/** 实验室助手 onPlay：在你的另一个随从上放置一个+1力量指示物 */
function frankensteinLabAssistant(ctx: AbilityContext): AbilityResult {
    const candidates = buildOwnMinionOptions(ctx, ctx.cardUid);
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const options = candidates.map((c, i) => ({
        id: `minion-${i}`,
        label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex },
    }));

    return resolveOrPrompt(ctx, options, {
        id: 'frankenstein_lab_assistant',
        title: '选择一个你的随从放置+1力量指示物',
        sourceId: 'frankenstein_lab_assistant',
        targetType: 'minion' as const,
    }, (val) => ({
        events: [addPowerCounter(val.minionUid, val.baseIndex, 1, 'frankenstein_lab_assistant', ctx.now)],
    }));
}

/** 黑尔博士 talent：在你的另一个随从上放置一个+1力量指示物 */
function frankensteinHerrDoktor(ctx: AbilityContext): AbilityResult {
    const candidates = buildOwnMinionOptions(ctx, ctx.cardUid);
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const options = candidates.map((c, i) => ({
        id: `minion-${i}`,
        label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex },
    }));

    return resolveOrPrompt(ctx, options, {
        id: 'frankenstein_herr_doktor',
        title: '选择一个你的随从放置+1力量指示物',
        sourceId: 'frankenstein_herr_doktor',
        targetType: 'minion' as const,
    }, (val) => ({
        events: [addPowerCounter(val.minionUid, val.baseIndex, 1, 'frankenstein_herr_doktor', ctx.now)],
    }));
}

/** 怪物 talent：从自身移除一个+1力量指示物来额外打出一个随从 */
function frankensteinTheMonster(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found || found.minion.powerModifier < 1) {
        return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
    }
    return {
        events: [
            removePowerCounter(found.minion.uid, found.baseIndex, 1, 'frankenstein_the_monster', ctx.now),
            grantExtraMinion(ctx.playerId, 'frankenstein_the_monster', ctx.now),
        ],
    };
}

/** 科学小怪蛋 onDestroy：本随从被消灭后，在你的一个随从上放+1指示物 */
function frankensteinIgorOnDestroy(ctx: AbilityContext): AbilityResult {
    console.log(`[IGOR] onDestroy entry: cardUid=${ctx.cardUid}, playerId=${ctx.playerId}, baseIndex=${ctx.baseIndex}`);
    const candidates: { uid: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId && m.uid !== ctx.cardUid) {
                const def = getCardDef(m.defId);
                candidates.push({ uid: m.uid, baseIndex: i, label: def?.name ?? m.defId });
            }
        }
    }
    console.log(`[IGOR] candidates=${candidates.length}, allMinions=[${ctx.state.bases.flatMap((b, i) => b.minions.map(m => `${m.defId}(uid=${m.uid},ctrl=${m.controller})@base${i}`)).join(', ')}]`);
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    if (candidates.length === 1) {
        console.log(`[IGOR] single candidate: uid=${candidates[0].uid}, producing POWER_COUNTER_ADDED`);
        return { events: [addPowerCounter(candidates[0].uid, candidates[0].baseIndex, 1, 'frankenstein_igor', ctx.now)] };
    }
    console.log(`[IGOR] multi candidates (${candidates.length}), creating interaction via resolveOrPrompt`);
    const options = candidates.map((c, idx) => ({
        id: `minion-${idx}`, label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex },
    }));
    const result = resolveOrPrompt(ctx, options, {
        id: 'frankenstein_igor',
        title: '选择一个你的随从放置+1力量指示物（科学小怪蛋）',
        sourceId: 'frankenstein_igor',
        targetType: 'minion' as const,
    }, (val) => ({
        events: [addPowerCounter(val.minionUid, val.baseIndex, 1, 'frankenstein_igor', ctx.now)],
    }));
    console.log(`[IGOR] result: events=${result.events.length}, hasMatchState=${!!result.matchState}, eventTypes=[${result.events.map(e => e.type).join(',')}]`);
    return result;
}

/** 震撼 onPlay：在你的每个随从上放置一个+1力量指示物 */
function frankensteinJolt(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                events.push(addPowerCounter(m.uid, i, 1, 'frankenstein_jolt', ctx.now));
            }
        }
    }
    return { events };
}

/** 它活过来了！ onPlay：打出一个额外的随从并在它身上放置一个+1力量指示物 */
function frankensteinItsAlive(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantExtraMinion(ctx.playerId, 'frankenstein_its_alive', ctx.now),
            queueMinionPlayEffect(ctx.playerId, 'addPowerCounter', 1, ctx.now),
        ],
    };
}

// ============================================================================
// 行动卡能力（需要交互）
// ============================================================================

/** 愤怒的民众 onPlay：选己方随从，逐张选手牌放牌库底，每放一张放一个+1指示物，随时可停 */
function frankensteinAngryMob(ctx: AbilityContext): AbilityResult {
    const candidates = buildOwnMinionOptions(ctx);
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const options = candidates.map((c, i) => ({
        id: `minion-${i}`,
        label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex },
    }));

    return resolveOrPrompt(ctx, options, {
        id: 'frankenstein_angry_mob',
        title: '选择一个你的随从（每放一张手牌到牌库底就放一个+1指示物）',
        sourceId: 'frankenstein_angry_mob',
        targetType: 'minion' as const,
    }, (val) => {
        // 单随从自动选定后，直接进入逐张选牌
        const player = ctx.state.players[ctx.playerId];
        if (!player || player.hand.length === 0) return { events: [] };
        return createAngryMobPickCardStep(ctx.matchState, ctx.playerId, { minionUid: val.minionUid, baseIndex: val.baseIndex }, ctx.now);
    });
}

interface AngryMobCardContext { minionUid: string; baseIndex: number }

function buildAngryMobCardOptions(core: SmashUpCore, playerId: string) {
    const player = core.players[playerId];
    if (!player) return [];
    const cardOptions = player.hand.map((c, i) => {
        const def = getCardDef(c.defId);
        return { id: `card-${i}`, label: `${def?.name ?? c.defId}`, value: { cardUid: c.uid, defId: c.defId } };
    });
    return [
        ...cardOptions,
        { id: 'stop', label: '完成放牌', value: { stop: true }, displayMode: 'button' as const },
    ];
}

function createAngryMobPickCardStep(
    ms: MatchState<SmashUpCore>, playerId: string, context: AngryMobCardContext, now: number,
): AbilityResult {
    const options = buildAngryMobCardOptions(ms.core, playerId);
    const interaction = createSimpleChoice<any>(
        `frankenstein_angry_mob_choose_card_${now}`, playerId,
        '愤怒的民众：选择一张手牌放到牌库底（或完成放牌）',
        options,
        { sourceId: 'frankenstein_angry_mob_choose_card', targetType: 'hand' as const, autoResolveIfSingle: false },
    );
    return {
        events: [],
        matchState: queueInteraction(ms, {
            ...interaction,
            data: {
                ...interaction.data,
                continuationContext: context,
                optionsGenerator: (nextState: { core: SmashUpCore }, _data: any) => {
                    return buildAngryMobCardOptions(nextState.core, playerId);
                },
            },
        }),
    };
}

const handleAngryMobChooseCard: IH = (state, playerId, value, interactionData, _random, now) => {
    const context = interactionData?.continuationContext as AngryMobCardContext | undefined;
    if (!context) return undefined;
    const v = value as { cardUid?: string; defId?: string; stop?: boolean };
    // 点击完成放牌
    if (v.stop) return { state, events: [] };
    if (!v.cardUid) return undefined;
    // 放一张牌到牌库底 + 立即放一个指示物
    const events: SmashUpEvent[] = [
        {
            type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
            payload: { cardUid: v.cardUid, defId: v.defId!, ownerId: playerId, reason: 'frankenstein_angry_mob' },
            timestamp: now,
        } as SmashUpEvent,
        addPowerCounter(context.minionUid, context.baseIndex, 1, 'frankenstein_angry_mob', now),
    ];
    // 手牌还剩卡（当前放的那张还在 state 中未 reduce）
    const player = state.core.players[playerId];
    if (!player || player.hand.length <= 1) return { state, events };
    // 继续选下一张
    const nextInteraction = createSimpleChoice<any>(
        `frankenstein_angry_mob_choose_card_${now}`, playerId,
        '愤怒的民众：选择一张手牌放到牌库底（或完成放牌）',
        buildAngryMobCardOptions(state.core, playerId),
        { sourceId: 'frankenstein_angry_mob_choose_card', targetType: 'hand' as const, autoResolveIfSingle: false },
    );
    return {
        state: queueInteraction(state, {
            ...nextInteraction,
            data: {
                ...nextInteraction.data,
                continuationContext: context,
                optionsGenerator: (nextState: { core: SmashUpCore }, _data: any) => {
                    return buildAngryMobCardOptions(nextState.core, playerId);
                },
            },
        }),
        events,
    };
};

/** 尸体商店 onPlay：消灭己方随从，力量数的指示物分配到己方随从 */
function frankensteinBodyShop(ctx: AbilityContext): AbilityResult {
    const candidates = buildOwnMinionOptions(ctx);
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const options = candidates.map((c, i) => ({
        id: `minion-${i}`,
        label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex, defId: c.defId },
    }));

    return resolveOrPrompt(ctx, options, {
        id: 'frankenstein_body_shop',
        title: '选择你要消灭的随从（其力量数的+1指示物将分配到其他随从）',
        sourceId: 'frankenstein_body_shop',
        targetType: 'minion' as const,
    }, (val) => {
        const minion = ctx.state.bases[val.baseIndex]?.minions.find(m => m.uid === val.minionUid);
        if (!minion) return { events: [] };
        const power = getMinionPower(ctx.state, minion, val.baseIndex);
        const events: SmashUpEvent[] = [
            destroyMinion(val.minionUid, val.defId, val.baseIndex, minion.owner, undefined, 'frankenstein_body_shop', ctx.now),
        ];
        if (power <= 0) return { events };
        // 需要创建分配交互
        return createBodyShopDistributeInteraction(ctx, power, val.minionUid, events);
    });
}

/** 创建尸体商店第二步：分配指示物 */
function createBodyShopDistributeInteraction(ctx: AbilityContext, totalCounters: number, excludeUid: string, priorEvents: SmashUpEvent[]): AbilityResult {
    const candidates = buildOwnMinionOptions(ctx, excludeUid);
    if (candidates.length === 0) return { events: priorEvents };
    if (candidates.length === 1) {
        // 只有一个随从，全部指示物给它
        priorEvents.push(addPowerCounter(candidates[0].uid, candidates[0].baseIndex, totalCounters, 'frankenstein_body_shop', ctx.now));
        return { events: priorEvents };
    }
    // 多个候选随从，逐个分配（每次选一个随从放1个指示物）
    const options = candidates.map((c, i) => ({
        id: `minion-${i}`,
        label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex, remaining: totalCounters },
    }));

    const interaction = createSimpleChoice(
        `frankenstein_body_shop_distribute_${ctx.now}`, ctx.playerId,
        `选择随从放置+1指示物（剩余 ${totalCounters} 个）`,
        options,
        { sourceId: 'frankenstein_body_shop_distribute', targetType: 'minion' },
    );
    return { events: priorEvents, matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 闪电攻击 onPlay：逐个点击己方随从移除指示物，然后消灭力量≤移除数的随从 */
function frankensteinBlitzed(ctx: AbilityContext): AbilityResult {
    const withCounters = buildOwnMinionOptions(ctx, undefined, (m) => m.powerModifier > 0);
    if (withCounters.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };

    const blitzedCtx: BlitzedRemoveContext = { removedTotal: 0 };
    const interaction = createBlitzedRemoveInteraction(ctx.matchState, ctx.playerId, blitzedCtx, ctx.now);
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

interface BlitzedRemoveContext { removedTotal: number }

function buildBlitzedRemoveOptions(core: SmashUpCore, playerId: string, removedTotal: number): any[] {
    const candidates: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < core.bases.length; i++) {
        for (const m of core.bases[i].minions) {
            if (m.controller === playerId && m.powerModifier > 0) {
                const def = getCardDef(m.defId);
                candidates.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId}（移除1个，剩余 ${m.powerModifier}）` });
            }
        }
    }
    const minionOptions = buildMinionTargetOptions(candidates, { state: core, sourcePlayerId: playerId });
    return [
        ...minionOptions,
        {
            id: 'done',
            label: removedTotal > 0 ? `完成移除（已移除 ${removedTotal} 个，消灭力量≤${removedTotal} 的随从）` : '跳过（不移除）',
            displayMode: 'button' as const,
            value: { done: true },
        },
    ];
}

function createBlitzedRemoveInteraction(
    ms: MatchState<SmashUpCore>, playerId: string, context: BlitzedRemoveContext, now: number,
) {
    const options = buildBlitzedRemoveOptions(ms.core, playerId, context.removedTotal);
    const interaction = createSimpleChoice<any>(
        `frankenstein_blitzed_remove_${now}`, playerId,
        `闪电攻击：点击随从移除1个指示物（已移除 ${context.removedTotal}）`,
        options,
        { sourceId: 'frankenstein_blitzed_remove', targetType: 'minion', autoResolveIfSingle: false },
    );
    return {
        ...interaction,
        data: {
            ...interaction.data,
            continuationContext: context,
            optionsGenerator: (nextState: { core: SmashUpCore }, data: any) => {
                const cc = (data?.continuationContext as BlitzedRemoveContext | undefined) ?? context;
                return buildBlitzedRemoveOptions(nextState.core, playerId, cc.removedTotal);
            },
        },
    };
}

// ============================================================================
// 交互处理函数
// ============================================================================

type IH = (
    state: MatchState<SmashUpCore>,
    playerId: PlayerId,
    value: unknown,
    interactionData: Record<string, unknown> | undefined,
    random: RandomFn,
    timestamp: number
) => { state: MatchState<SmashUpCore>; events: SmashUpEvent[] } | undefined;

const handleLabAssistantChoice: IH = (state, _pid, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number };
    return { state, events: [addPowerCounter(v.minionUid, v.baseIndex, 1, 'frankenstein_lab_assistant', now)] };
};

const handleHerrDoktorChoice: IH = (state, _pid, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number };
    return { state, events: [addPowerCounter(v.minionUid, v.baseIndex, 1, 'frankenstein_herr_doktor', now)] };
};

const handleAngryMobChooseMinion: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number };
    const player = state.core.players[playerId];
    if (!player || player.hand.length === 0) return { state, events: [] };
    const context: AngryMobCardContext = { minionUid: v.minionUid, baseIndex: v.baseIndex };
    const options = buildAngryMobCardOptions(state.core, playerId);
    const interaction = createSimpleChoice<any>(
        `frankenstein_angry_mob_choose_card_${now}`, playerId,
        '愤怒的民众：选择一张手牌放到牌库底（或完成放牌）',
        options,
        { sourceId: 'frankenstein_angry_mob_choose_card', targetType: 'hand' as const, autoResolveIfSingle: false },
    );
    return {
        state: queueInteraction(state, {
            ...interaction,
            data: {
                ...interaction.data,
                continuationContext: context,
                optionsGenerator: (nextState: { core: SmashUpCore }, _d: any) => {
                    return buildAngryMobCardOptions(nextState.core, playerId);
                },
            },
        }),
        events: [],
    };
};

const handleBodyShopChooseMinion: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number; defId: string };
    const minion = state.core.bases[v.baseIndex]?.minions.find(mi => mi.uid === v.minionUid);
    if (!minion) return undefined;
    const power = getMinionPower(state.core, minion, v.baseIndex);
    const events: SmashUpEvent[] = [
        destroyMinion(v.minionUid, v.defId, v.baseIndex, minion.owner, playerId, 'frankenstein_body_shop', now),
    ];
    if (power <= 0) return { state, events };

    const candidates: { uid: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < state.core.bases.length; i++) {
        for (const mi of state.core.bases[i].minions) {
            if (mi.controller === playerId && mi.uid !== v.minionUid) {
                const def = getCardDef(mi.defId);
                candidates.push({ uid: mi.uid, baseIndex: i, label: def?.name ?? mi.defId });
            }
        }
    }
    if (candidates.length === 0) return { state, events };
    if (candidates.length === 1) {
        events.push(addPowerCounter(candidates[0].uid, candidates[0].baseIndex, power, 'frankenstein_body_shop', now));
        return { state, events };
    }
    const options = candidates.map((c, idx) => ({
        id: `minion-${idx}`, label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex, remaining: power },
    }));
    const interaction = createSimpleChoice(
        `frankenstein_body_shop_distribute_${now}`, playerId,
        `选择随从放置+1指示物（剩余 ${power} 个）`, options,
        { sourceId: 'frankenstein_body_shop_distribute', targetType: 'minion' },
    );
    return { state: queueInteraction(state, interaction), events };
};

const handleBodyShopDistribute: IH = (state, _pid, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number; remaining: number };
    const events: SmashUpEvent[] = [addPowerCounter(v.minionUid, v.baseIndex, 1, 'frankenstein_body_shop', now)];
    const newRemaining = v.remaining - 1;
    if (newRemaining <= 0) return { state, events };
    // 仍有剩余，继续分配
    const candidates: { uid: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < state.core.bases.length; i++) {
        for (const mi of state.core.bases[i].minions) {
            if (mi.controller === _pid) {
                const def = getCardDef(mi.defId);
                candidates.push({ uid: mi.uid, baseIndex: i, label: def?.name ?? mi.defId });
            }
        }
    }
    if (candidates.length === 0) return { state, events };
    if (candidates.length === 1) {
        events.push(addPowerCounter(candidates[0].uid, candidates[0].baseIndex, newRemaining, 'frankenstein_body_shop', now));
        return { state, events };
    }
    const options = candidates.map((c, idx) => ({
        id: `minion-${idx}`, label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex, remaining: newRemaining },
    }));
    const interaction = createSimpleChoice(
        `frankenstein_body_shop_distribute_${now}`, _pid,
        `选择随从放置+1指示物（剩余 ${newRemaining} 个）`, options,
        { sourceId: 'frankenstein_body_shop_distribute', targetType: 'minion' },
    );
    return { state: queueInteraction(state, interaction), events };
};

const handleBlitzedRemove: IH = (state, playerId, value, interactionData, _random, now) => {
    const context = interactionData?.continuationContext as BlitzedRemoveContext | undefined;
    if (!context) return undefined;

    const selected = value as { minionUid?: string; baseIndex?: number; done?: boolean };

    // 点击"完成移除"
    if (selected.done) {
        if (context.removedTotal <= 0) return { state, events: [] };
        const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            for (const mi of state.core.bases[i].minions) {
                const pwr = getMinionPower(state.core, mi, i);
                if (pwr <= context.removedTotal) {
                    const def = getCardDef(mi.defId);
                    targets.push({ uid: mi.uid, defId: mi.defId, baseIndex: i, label: `${def?.name ?? mi.defId} (力量 ${pwr})` });
                }
            }
        }
        if (targets.length === 0) return { state, events: [] };
        const options = buildMinionTargetOptions(targets, { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' });
        if (options.length === 0) return { state, events: [] };
        const interaction = createSimpleChoice(
            `frankenstein_blitzed_destroy_${now}`, playerId,
            `选择要消灭的随从（力量≤${context.removedTotal}）`, options,
            { sourceId: 'frankenstein_blitzed_destroy', targetType: 'minion' },
        );
        return { state: queueInteraction(state, interaction), events: [] };
    }

    // 点击随从移除 1 个指示物
    if (!selected.minionUid || selected.baseIndex === undefined) return undefined;
    const minion = state.core.bases[selected.baseIndex]?.minions.find(m => m.uid === selected.minionUid);
    if (!minion || minion.controller !== playerId || minion.powerModifier <= 0) return undefined;

    const nextContext: BlitzedRemoveContext = { removedTotal: context.removedTotal + 1 };
    const nextInteraction = createBlitzedRemoveInteraction(state, playerId, nextContext, now);
    return {
        state: queueInteraction(state, nextInteraction),
        events: [removePowerCounter(selected.minionUid, selected.baseIndex, 1, 'frankenstein_blitzed', now)],
    };
};

const handleIgorChooseTarget: IH = (state, _pid, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number };
    return { state, events: [addPowerCounter(v.minionUid, v.baseIndex, 1, 'frankenstein_igor', now)] };
};

const handleBlitzedDestroy: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number; defId: string };
    const target = state.core.bases[v.baseIndex]?.minions.find(mi => mi.uid === v.minionUid);
    return {
        state,
        events: [destroyMinion(v.minionUid, v.defId, v.baseIndex, target?.owner ?? playerId, playerId, 'frankenstein_blitzed', now)],
    };
};

// Ongoing 效果注册
// ============================================================================
function registerFrankensteinOngoingEffects(): void {
    // 科学小怪蛋 (igor) ongoing：本随从被弃掉后，在你的一个随从上放+1指示物
    // 消灭场景由 onDestroy 能力处理（registerAbility），这里只处理基地结算弃置
    // 仅在被弃的随从是 Igor 自身时触发
    registerTrigger('frankenstein_igor', 'onMinionDiscardedFromBase', (ctx: TriggerContext) => {
        // 只在被弃的随从是 Igor 自身时触发
        if (ctx.triggerMinionDefId !== 'frankenstein_igor') return [];
        const { state, now, matchState } = ctx;
        // 找到被弃 Igor 的控制者
        const base = state.bases[ctx.baseIndex!];
        const igor = base?.minions.find(m => m.uid === ctx.triggerMinionUid);
        if (!igor) return [];
        const controllerId = igor.controller;
        // 收集该控制者的所有随从（排除被弃基地上的，因为同基地随从都会被弃）
        const candidates: { uid: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.bases.length; i++) {
            if (i === ctx.baseIndex) continue;
            for (const m of state.bases[i].minions) {
                if (m.controller === controllerId) {
                    const def = getCardDef(m.defId);
                    candidates.push({ uid: m.uid, baseIndex: i, label: def?.name ?? m.defId });
                }
            }
        }
        if (candidates.length === 0) return [];
        if (candidates.length === 1) {
            return [addPowerCounter(candidates[0].uid, candidates[0].baseIndex, 1, 'frankenstein_igor', now)];
        }
        if (!matchState) return [addPowerCounter(candidates[0].uid, candidates[0].baseIndex, 1, 'frankenstein_igor', now)];
        const options = candidates.map((c, idx) => ({
            id: `minion-${idx}`, label: c.label,
            value: { minionUid: c.uid, baseIndex: c.baseIndex },
        }));
        const interaction = createSimpleChoice(
            `frankenstein_igor_${controllerId}_${now}`, controllerId,
            '选择一个你的随从放置+1力量指示物（科学小怪蛋）', options,
            { sourceId: 'frankenstein_igor', targetType: 'minion' },
        );
        return { events: [], matchState: queueInteraction(matchState, interaction) };
    });

    // 德国工程学 ongoing：打出随从到此基地后放+1指示物
    registerTrigger('frankenstein_german_engineering', 'onMinionPlayed', (ctx: TriggerContext) => {
        const { state, baseIndex, triggerMinionUid, playerId, now } = ctx;
        if (baseIndex === undefined || !triggerMinionUid) return [];
        const base = state.bases[baseIndex];
        if (!base) return [];
        // 检查此基地是否有德国工程学 ongoing 卡且由该玩家拥有
        const hasGE = base.ongoingActions.some(a => a.defId === 'frankenstein_german_engineering' && a.ownerId === playerId);
        if (!hasGE) return [];
        return [addPowerCounter(triggerMinionUid, baseIndex, 1, 'frankenstein_german_engineering', now)];
    });

    // 死亡境地 ongoing：己方随从在此被消灭后放回手牌（拦截器）
    // 注意：这需要 interceptor 而非 trigger，在随从被消灭时替换为回手牌
    // 简化实现：用 trigger 在消灭后恢复卡牌到手牌
    registerTrigger('frankenstein_grave_situation', 'onMinionDestroyed', (ctx: TriggerContext) => {
        const { state, baseIndex, triggerMinionUid, triggerMinionDefId, playerId, now } = ctx;
        if (baseIndex === undefined || !triggerMinionUid) return [];
        const base = state.bases[baseIndex];
        if (!base) return [];
        const hasGS = base.ongoingActions.some(a => a.defId === 'frankenstein_grave_situation' && a.ownerId === playerId);
        if (!hasGS) return [];
        // 将被消灭的随从从弃牌堆恢复到手牌
        return [{
            type: SU_EVENTS.CARD_RECOVERED_FROM_DISCARD,
            payload: { playerId, cardUids: [triggerMinionUid], reason: 'frankenstein_grave_situation' },
            timestamp: now,
        } as SmashUpEvent];
    });

    // 身体改造 (uberserum) ongoing：回合开始放指示物 + 不可消灭
    registerTrigger('frankenstein_uberserum', 'onTurnStart', (ctx: TriggerContext) => {
        const { state, playerId, now } = ctx;
        const events: SmashUpEvent[] = [];
        for (let i = 0; i < state.bases.length; i++) {
            for (const m of state.bases[i].minions) {
                if (m.controller !== playerId) continue;
                const hasUber = m.attachedActions.some(a => a.defId === 'frankenstein_uberserum');
                if (hasUber) {
                    events.push(addPowerCounter(m.uid, i, 1, 'frankenstein_uberserum', now));
                }
            }
        }
        return events;
    });

    // 身体改造 protection：不可被消灭
    registerProtection('frankenstein_uberserum', 'destroy', (ctx) => {
        const { targetMinion } = ctx;
        return targetMinion.attachedActions.some(a => a.defId === 'frankenstein_uberserum');
    });

    // 它活过来了! 的 +1 指示物现在通过 queueMinionPlayEffect 在 fireMinionPlayedTriggers 中自动消费
}