/**
 * 大杀四方 - 狼人派系能力
 *
 * 主题：临时力量增益（回合结束清零）、消灭低力量随从
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    addTempPower, destroyMinion,
    grantExtraAction, buildMinionTargetOptions,
    resolveOrPrompt, findMinionOnBases, findMinionByAttachedCard, buildAbilityFeedback,
    modifyBreakpoint,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, CardsDrawnEvent, SmashUpCore } from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext } from '../domain/ongoingEffects';
import { getCardDef } from '../data/cards';
import { getEffectivePower, getEffectiveBreakpoint } from '../domain/ongoingModifiers';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { drawCards } from '../domain/utils';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';

// ============================================================================
// 注册入口
// ============================================================================

export function registerWerewolfAbilities(): void {
    // 随从 talent
    registerAbility('werewolf_howler', 'onPlay', werewolfHowler);
    registerAbility('werewolf_teenage_wolf', 'talent', werewolfTeenageWolf);
    // loup_garou 和 pack_alpha 是异能（Special），在 beforeScoring 自动触发
    // 注册在 registerWerewolfOngoingEffects 中

    // 行动卡
    registerAbility('werewolf_frenzy', 'onPlay', werewolfFrenzy);
    registerAbility('werewolf_chew_toy', 'onPlay', werewolfChewToy);
    registerAbility('werewolf_let_the_dog_out', 'onPlay', werewolfLetTheDogOut);

    // ongoing 效果
    registerWerewolfOngoingEffects();
}

export function registerWerewolfInteractionHandlers(): void {
    registerInteractionHandler('werewolf_chew_toy', handleChewToyChooseMinion);
    registerInteractionHandler('werewolf_chew_toy_target', handleChewToyChooseTarget);
    registerInteractionHandler('werewolf_let_the_dog_out', handleLetTheDogOutChooseMinion);
    registerInteractionHandler('werewolf_let_the_dog_out_targets', handleLetTheDogOutChooseTarget);
}

// ============================================================================
// 随从 talent
// ============================================================================

/** 咆哮者 talent：本随从+2力量直到回合结束 */
function werewolfHowler(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    return { events: [addTempPower(found.minion.uid, found.baseIndex, 2, 'werewolf_howler', ctx.now)] };
}

/** 青年狼人 talent：本随从+1力量直到回合结束 */
function werewolfTeenageWolf(ctx: AbilityContext): AbilityResult {
    const found = findMinionOnBases(ctx.state, ctx.cardUid);
    if (!found) return { events: [] };
    return { events: [addTempPower(found.minion.uid, found.baseIndex, 1, 'werewolf_teenage_wolf', ctx.now)] };
}

// loup_garou 和 pack_alpha 异能在 registerWerewolfOngoingEffects 中注册为 beforeScoring 触发器

// ============================================================================
// 行动卡能力
// ============================================================================

/** 狂怒 onPlay：每个己方力量≥4的随从+1力量直到回合结束 */
function werewolfFrenzy(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                const power = getEffectivePower(ctx.state, m, i);
                if (power >= 4) {
                    events.push(addTempPower(m.uid, i, 1, 'werewolf_frenzy', ctx.now));
                }
            }
        }
    }
    return { events };
}

/** 咀嚼玩具 onPlay：选己方随从，消灭同基地比它力量低的一个随从 */
function werewolfChewToy(ctx: AbilityContext): AbilityResult {
    const ownMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                const def = getCardDef(m.defId);
                const power = getEffectivePower(ctx.state, m, i);
                ownMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId} (力量 ${power})` });
            }
        }
    }
    if (ownMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const options = ownMinions.map((c, i) => ({
        id: `minion-${i}`, label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex, defId: c.defId },
    }));

    return resolveOrPrompt(ctx, options, {
        id: 'werewolf_chew_toy', title: '选择你的一个随从（消灭同基地比它力量低的随从）',
        sourceId: 'werewolf_chew_toy', targetType: 'minion' as const,
    }, (val) => createChewToyTargetInteraction(ctx, val.minionUid, val.baseIndex));
}

function createChewToyTargetInteraction(ctx: AbilityContext, minionUid: string, baseIndex: number): AbilityResult {
    const minion = ctx.state.bases[baseIndex]?.minions.find(m => m.uid === minionUid);
    if (!minion) return { events: [] };
    const myPower = getEffectivePower(ctx.state, minion, baseIndex);
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (const m of ctx.state.bases[baseIndex].minions) {
        if (m.uid === minionUid) continue;
        const power = getEffectivePower(ctx.state, m, baseIndex);
        if (power < myPower) {
            const def = getCardDef(m.defId);
            targets.push({ uid: m.uid, defId: m.defId, baseIndex, label: `${def?.name ?? m.defId} (力量 ${power})` });
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = buildMinionTargetOptions(targets, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' });
    if (options.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.all_protected', ctx.now)] };

    return resolveOrPrompt(ctx, options, {
        id: 'werewolf_chew_toy_target', title: '选择要消灭的随从',
        sourceId: 'werewolf_chew_toy_target', targetType: 'minion' as const,
    }, (val) => ({
        events: [destroyMinion(val.minionUid, val.defId, val.baseIndex, ctx.state.bases[val.baseIndex]?.minions.find(m => m.uid === val.minionUid)?.owner ?? ctx.playerId, ctx.playerId, 'werewolf_chew_toy', ctx.now)],
    }));
}

/** 关门放狗 onPlay：选己方随从，消灭力量总和≤其力量的随从 */
function werewolfLetTheDogOut(ctx: AbilityContext): AbilityResult {
    const ownMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                const def = getCardDef(m.defId);
                const power = getEffectivePower(ctx.state, m, i);
                ownMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId} (力量 ${power})` });
            }
        }
    }
    if (ownMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const options = ownMinions.map((c, i) => ({
        id: `minion-${i}`, label: c.label,
        value: { minionUid: c.uid, baseIndex: c.baseIndex, defId: c.defId },
    }));

    return resolveOrPrompt(ctx, options, {
        id: 'werewolf_let_the_dog_out', title: '选择你的一个随从（消灭力量总和≤其力量的随从们）',
        sourceId: 'werewolf_let_the_dog_out', targetType: 'minion' as const,
    }, (val) => {
        const minion = ctx.state.bases[val.baseIndex]?.minions.find(m => m.uid === val.minionUid);
        if (!minion) return { events: [] };
        const myPower = getEffectivePower(ctx.state, minion, val.baseIndex);
        return buildLetTheDogOutTargetInteraction(ctx.state, ctx.playerId, ctx.now, ctx.matchState, myPower, val.minionUid);
    });
}

/** 构建放狗目标选择交互 */
function buildLetTheDogOutTargetInteraction(
    state: SmashUpCore, playerId: string, now: number, matchState: any,
    budget: number, sourceUid: string,
): AbilityResult {
    const targets = buildMinionTargetOptions(
        collectLetTheDogOutTargets(state, budget, sourceUid),
        { state, sourcePlayerId: playerId, effectType: 'destroy' },
    ).map(o => ({
        ...o,
        value: { ...o.value, budget, sourceUid },
    }));

    if (targets.length === 0) return { events: [] };
    const options = [...targets];
    options.push({ id: 'done', label: `完成选择（剩余预算 ${budget}）`, value: { done: true, budget, sourceUid }, displayMode: 'button' as const } as any);
    const interaction = createSimpleChoice(
        `werewolf_let_the_dog_out_targets_${now}`, playerId,
        `选择要消灭的随从（力量预算剩余 ${budget}）`, options,
        { sourceId: 'werewolf_let_the_dog_out_targets', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(matchState, interaction) };
}

function collectLetTheDogOutTargets(state: SmashUpCore, budget: number, sourceUid: string) {
    const results: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        for (const m of state.bases[i].minions) {
            if (m.uid === sourceUid) continue;
            const power = getEffectivePower(state, m, i);
            if (power <= budget) {
                const def = getCardDef(m.defId);
                results.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${def?.name ?? m.defId} (力量 ${power})` });
            }
        }
    }
    return results;
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

const handleChewToyChooseMinion: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number };

    const minion = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!minion) return undefined;
    const myPower = getEffectivePower(state.core, minion, v.baseIndex);
    const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (const m of state.core.bases[v.baseIndex].minions) {
        if (m.uid === v.minionUid) continue;
        const power = getEffectivePower(state.core, m, v.baseIndex);
        if (power < myPower) {
            const def = getCardDef(m.defId);
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: v.baseIndex, label: `${def?.name ?? m.defId} (力量 ${power})` });
        }
    }
    if (targets.length === 0) return { state, events: [] };
    const options = buildMinionTargetOptions(targets, { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' });
    if (options.length === 0) return { state, events: [] };

    const interaction = createSimpleChoice(
        `werewolf_chew_toy_target_${now}`, playerId,
        '选择要消灭的随从', options,
        { sourceId: 'werewolf_chew_toy_target', targetType: 'minion' },
    );
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleChewToyChooseTarget: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number; defId: string };

    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    return {
        state,
        events: [destroyMinion(v.minionUid, v.defId, v.baseIndex, target?.owner ?? playerId, playerId, 'werewolf_chew_toy', now)],
    };
};

const handleLetTheDogOutChooseMinion: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid: string; baseIndex: number };
    const minion = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    if (!minion) return undefined;
    const myPower = getEffectivePower(state.core, minion, v.baseIndex);
    const targets = collectLetTheDogOutTargets(state.core, myPower, v.minionUid);
    if (targets.length === 0) return { state, events: [] };
    const options = buildMinionTargetOptions(targets, { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' })
        .map(o => ({
            ...o,
            value: { ...o.value, budget: myPower, sourceUid: v.minionUid },
        }));
    if (options.length === 0) return { state, events: [] };
    const allOptions = [...options];
    allOptions.push({ id: 'done', label: `完成选择（剩余预算 ${myPower}）`, value: { done: true, budget: myPower, sourceUid: v.minionUid }, displayMode: 'button' as const } as any);
    const interaction = createSimpleChoice(
        `werewolf_let_the_dog_out_targets_${now}`, playerId,
        `选择要消灭的随从（力量预算剩余 ${myPower}）`, allOptions,
        { sourceId: 'werewolf_let_the_dog_out_targets', targetType: 'minion' },
    );
    return { state: queueInteraction(state, interaction), events: [] };
};

const handleLetTheDogOutChooseTarget: IH = (state, playerId, value, _data, _random, now) => {
    const v = value as { minionUid?: string; defId?: string; baseIndex?: number; done?: boolean; budget: number; sourceUid: string };
    if (v.done) return { state, events: [] };
    if (!v.minionUid || !v.defId || v.baseIndex === undefined) return { state, events: [] };
    const target = state.core.bases[v.baseIndex]?.minions.find(m => m.uid === v.minionUid);
    const targetPower = target ? getEffectivePower(state.core, target, v.baseIndex) : 0;
    const events: SmashUpEvent[] = [
        destroyMinion(v.minionUid, v.defId, v.baseIndex, target?.owner ?? playerId, playerId, 'werewolf_let_the_dog_out', now),
    ];
    const newBudget = v.budget - targetPower;
    if (newBudget <= 0) return { state, events };
    // 检查是否还有可消灭目标
    const remaining = collectLetTheDogOutTargets(state.core, newBudget, v.sourceUid)
        .filter(t => t.uid !== v.minionUid);
    if (remaining.length === 0) return { state, events };
    const options = buildMinionTargetOptions(remaining, { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' })
        .map(o => ({
            ...o,
            value: { ...o.value, budget: newBudget, sourceUid: v.sourceUid },
        }));
    if (options.length === 0) return { state, events };
    const allOptions = [...options];
    allOptions.push({ id: 'done', label: `完成选择（剩余预算 ${newBudget}）`, value: { done: true, budget: newBudget, sourceUid: v.sourceUid }, displayMode: 'button' as const } as any);
    const interaction = createSimpleChoice(
        `werewolf_let_the_dog_out_targets_${now}`, playerId,
        `选择要消灭的随从（力量预算剩余 ${newBudget}）`, allOptions,
        { sourceId: 'werewolf_let_the_dog_out_targets', targetType: 'minion' },
    );
    return { state: queueInteraction(state, interaction), events };
};

// ============================================================================
// Ongoing 效果注册
// ============================================================================

function registerWerewolfOngoingEffects(): void {
    // 狼人 异能（Special）：基地计分前自身+2力量直到回合结束
    registerTrigger('werewolf_loup_garou', 'beforeScoring', (ctx: TriggerContext) => {
        const { state, baseIndex, now } = ctx;
        if (baseIndex === undefined) return [];
        const events: SmashUpEvent[] = [];
        for (const m of state.bases[baseIndex].minions) {
            if (m.defId === 'werewolf_loup_garou') {
                events.push(addTempPower(m.uid, baseIndex, 2, 'werewolf_loup_garou', now));
            }
        }
        return events;
    });

    // 阿尔法狼群 异能（Special）：基地计分前同基地己方所有随从+1力量直到回合结束
    registerTrigger('werewolf_pack_alpha', 'beforeScoring', (ctx: TriggerContext) => {
        const { state, baseIndex, now } = ctx;
        if (baseIndex === undefined) return [];
        const events: SmashUpEvent[] = [];
        for (const m of state.bases[baseIndex].minions) {
            if (m.defId !== 'werewolf_pack_alpha') continue;
            const controller = m.controller;
            for (const ally of state.bases[baseIndex].minions) {
                if (ally.controller === controller) {
                    events.push(addTempPower(ally.uid, baseIndex, 1, 'werewolf_pack_alpha', now));
                }
            }
        }
        return events;
    });

    // 制造恐慌 ongoing：回合开始时若你力量最高，爆破点降到0
    registerTrigger('werewolf_marking_territory', 'onTurnStart', (ctx: TriggerContext) => {
        const { state, playerId, now } = ctx;
        for (let i = 0; i < state.bases.length; i++) {
            const base = state.bases[i];
            const hasMT = base.ongoingActions.some(a => a.defId === 'werewolf_marking_territory' && a.ownerId === playerId);
            if (!hasMT) continue;
            let myTotal = 0;
            let maxOther = 0;
            for (const m of base.minions) {
                const power = getEffectivePower(state, m, i);
                if (m.controller === playerId) myTotal += power;
                else maxOther = Math.max(maxOther, power);
            }
            // 需要"比其他玩家有更高的总力量"
            // 计算各对手在此基地的总力量
            const opponentTotals = new Map<string, number>();
            for (const m of base.minions) {
                if (m.controller === playerId) continue;
                opponentTotals.set(m.controller, (opponentTotals.get(m.controller) ?? 0) + getEffectivePower(state, m, i));
            }
            let isHighest = true;
            for (const total of opponentTotals.values()) {
                if (total >= myTotal) { isHighest = false; break; }
            }
            if (isHighest && myTotal > 0) {
                const currentBp = getEffectiveBreakpoint(state, i);
                if (currentBp > 0) {
                    return [modifyBreakpoint(i, -currentBp, 'werewolf_marking_territory', now)];
                }
            }
        }
        return [];
    });

    // 势不可挡 ongoing(minion)：本随从不可被消灭
    registerProtection('werewolf_unstoppable', 'destroy', (ctx) => {
        return ctx.targetMinion.attachedActions.some(a => a.defId === 'werewolf_unstoppable');
    });

    // 狼群领袖 ongoing(minion)+talent：如果本随从力量最高，额外打出行动
    registerAbility('werewolf_leader_of_the_pack', 'talent', (ctx: AbilityContext): AbilityResult => {
        const found = findMinionByAttachedCard(ctx.state, ctx.cardUid);
        if (!found) return { events: [] };
        const myPower = getEffectivePower(ctx.state, found.minion, found.baseIndex);
        let isHighest = true;
        for (const m of ctx.state.bases[found.baseIndex].minions) {
            if (m.uid === found.minion.uid) continue;
            if (getEffectivePower(ctx.state, m, found.baseIndex) >= myPower) {
                isHighest = false; break;
            }
        }
        if (!isHighest) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.not_highest_power', ctx.now)] };
        return { events: [grantExtraAction(ctx.playerId, 'werewolf_leader_of_the_pack', ctx.now)] };
    });

    // 月之触 ongoing(minion)+talent：如果本随从力量最高，抽一张牌
    registerAbility('werewolf_moontouched', 'talent', (ctx: AbilityContext): AbilityResult => {
        const found = findMinionByAttachedCard(ctx.state, ctx.cardUid);
        if (!found) return { events: [] };
        const myPower = getEffectivePower(ctx.state, found.minion, found.baseIndex);
        let isHighest = true;
        for (const m of ctx.state.bases[found.baseIndex].minions) {
            if (m.uid === found.minion.uid) continue;
            if (getEffectivePower(ctx.state, m, found.baseIndex) >= myPower) {
                isHighest = false; break;
            }
        }
        if (!isHighest) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.not_highest_power', ctx.now)] };
        const player = ctx.state.players[ctx.playerId];
        if (!player || player.deck.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.deck_empty', ctx.now)] };
        const { drawnUids } = drawCards(player, 1, ctx.random);
        if (drawnUids.length === 0) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: ctx.playerId, count: 1, cardUids: drawnUids },
                timestamp: ctx.now,
            } as CardsDrawnEvent],
        };
    });
}