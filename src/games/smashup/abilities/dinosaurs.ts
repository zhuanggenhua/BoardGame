/**
 * 大杀四方 - 恐龙派系能力
 *
 * 主题：高力量、消灭低力量随从、力量增强
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { destroyMinion, addPowerCounter, addTempPower, modifyBreakpoint, getMinionPower, buildMinionTargetOptions, buildBaseTargetOptions, resolveOrPrompt, buildAbilityFeedback } from '../domain/abilityHelpers';
import type { SmashUpEvent, SmashUpCore, MinionOnBase, OngoingDetachedEvent, MinionDestroyedEvent, MinionReturnedEvent, CardToDeckBottomEvent } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { getCardDef, getBaseDef } from '../data/cards';
import type { MinionCardDef } from '../domain/types';
import { registerProtection, registerInterceptor } from '../domain/ongoingEffects';
import type { ProtectionCheckContext } from '../domain/ongoingEffects';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import type { MatchState } from '../../../engine/types';

/** 注册恐龙派系所有能力 */
export function registerDinosaurAbilities(): void {
    registerAbility('dino_laser_triceratops', 'onPlay', dinoLaserTriceratops);
    registerAbility('dino_augmentation', 'onPlay', dinoAugmentation);
    registerAbility('dino_howl', 'onPlay', dinoHowl);
    registerAbility('dino_natural_selection', 'onPlay', dinoNaturalSelection);
    registerAbility('dino_survival_of_the_fittest', 'onPlay', dinoSurvivalOfTheFittest);
    // 狂暴：降低基地爆破点
    registerAbility('dino_rampage', 'onPlay', dinoRampage);

    // === ongoing 效果注册 ===
    // 全副武装：拦截影响事件时自毁以保护附着随从
    registerInterceptor('dino_tooth_and_claw', dinoToothAndClawInterceptor);
    registerProtection('dino_tooth_and_claw', 'affect', dinoToothAndClawChecker, { consumable: true });
    // 升级：+2力量（ongoingModifiers 中注册），无消灭保护
    // 野生保护区：保护你在此基地的随从不受其他玩家战术影响
    registerProtection('dino_wildlife_preserve', 'action', dinoWildlifePreserveChecker);
}

// ============================================================================
// 随从能力
// ============================================================================

/** 激光三角龙 onPlay：消灭本基地一个力量≤2的随从 */
function dinoLaserTriceratops(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const targets = base.minions.filter(
        m => m.uid !== ctx.cardUid && getMinionPower(ctx.state, m, ctx.baseIndex) <= 2
    );
    const options = targets.map(t => {
        const def = getCardDef(t.defId) as MinionCardDef | undefined;
        const name = def?.name ?? t.defId;
        const power = getMinionPower(ctx.state, t, ctx.baseIndex);
        return { uid: t.uid, defId: t.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
    });
    // 强制效果：消灭一个力量≤2的随从，单候选自动执行
    return resolveOrPrompt(ctx, buildMinionTargetOptions(options, {
        state: ctx.state,
        sourcePlayerId: ctx.playerId,
        effectType: 'destroy',
    }), {
        id: 'dino_laser_triceratops',
        title: '选择要消灭的力量≤2的随从',
        sourceId: 'dino_laser_triceratops',
        targetType: 'minion',
    }, (value) => ({
        events: [destroyMinion(value.minionUid, value.defId, value.baseIndex, 
            targets.find(t => t.uid === value.minionUid)?.owner ?? ctx.playerId,
            'dino_laser_triceratops', ctx.now)],
    }));
}

// ============================================================================
// 行动卡能力
// ============================================================================

/** 增强 onPlay：一个随从+4力量（直到回合结束，任意随从） */
function dinoAugmentation(ctx: AbilityContext): AbilityResult {
    const allMinions: { uid: string; defId: string; baseIndex: number; power: number }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            allMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, power: getMinionPower(ctx.state, m, i) });
        }
    }
    if (allMinions.length === 0) return { events: [] };
    const options = allMinions.map(entry => {
        const def = getCardDef(entry.defId) as MinionCardDef | undefined;
        const name = def?.name ?? entry.defId;
        const baseDef = getBaseDef(ctx.state.bases[entry.baseIndex].defId);
        const baseName = baseDef?.name ?? `基地 ${entry.baseIndex + 1}`;
        return { uid: entry.uid, defId: entry.defId, baseIndex: entry.baseIndex, label: `${name} (力量 ${entry.power}) @ ${baseName}` };
    });
    const interaction = createSimpleChoice(
        `dino_augmentation_${ctx.now}`, ctx.playerId,
        '选择一个随从获得+4力量（直到回合结束）',
        buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }),
        { sourceId: 'dino_augmentation', targetType: 'minion' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 嚎叫 onPlay：你的全部随从+1力量（直到回合结束） */
function dinoHowl(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                events.push(addTempPower(m.uid, i, 1, 'dino_howl', ctx.now));
            }
        }
    }
    return { events };
}

/** 物竞天择 onPlay：选择你的一个随从，消灭该基地一个力量低于它的随从 */
function dinoNaturalSelection(ctx: AbilityContext): AbilityResult {
    const myMinions: { minion: MinionOnBase; baseIndex: number; power: number }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) {
                const power = getMinionPower(ctx.state, m, i);
                const hasTarget = ctx.state.bases[i].minions.some(
                    t => t.uid !== m.uid && getMinionPower(ctx.state, t, i) < power
                );
                if (hasTarget) {
                    myMinions.push({ minion: m, baseIndex: i, power });
                }
            }
        }
    }
    if (myMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = myMinions.map((entry) => {
        const def = getCardDef(entry.minion.defId) as MinionCardDef | undefined;
        const name = def?.name ?? entry.minion.defId;
        return {
            uid: entry.minion.uid,
            defId: entry.minion.defId,
            baseIndex: entry.baseIndex,
            label: `${name} (力量 ${entry.power})`,
        };
    });
    const interaction = createSimpleChoice(
        `dino_natural_selection_${ctx.now}`, ctx.playerId,
        '选择你的一个随从作为参照', buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }),
        { sourceId: 'dino_natural_selection_choose_mine', targetType: 'minion', autoCancelOption: true }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 适者生存 onPlay：每个基地上，如果存在两个及以上随从且有力量差异，
 * 消灭一个最低力量的随从（平局时由当前玩家选择）
 */
function dinoSurvivalOfTheFittest(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    // 收集需要玩家选择的基地（有多个最低力量随从平局）
    const tieBreakBases: { baseIndex: number; candidates: MinionOnBase[]; minPower: number }[] = [];

    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        if (base.minions.length < 2) continue;
        // 找最低力量
        let minPower = Infinity;
        for (const m of base.minions) {
            const power = getMinionPower(ctx.state, m, i);
            if (power < minPower) minPower = power;
        }
        // 检查是否有更高力量的随从（必须有力量差异）
        const hasHigher = base.minions.some(m => getMinionPower(ctx.state, m, i) > minPower);
        if (!hasHigher) continue;
        // 找所有最低力量随从
        const lowest = base.minions.filter(m => getMinionPower(ctx.state, m, i) === minPower);
        if (lowest.length === 1) {
            // 唯一最低，直接消灭
            events.push(destroyMinion(lowest[0].uid, lowest[0].defId, i, lowest[0].owner, 'dino_survival_of_the_fittest', ctx.now));
        } else {
            // 平局，需要玩家选择
            tieBreakBases.push({ baseIndex: i, candidates: lowest, minPower });
        }
    }

    if (tieBreakBases.length > 0) {
        // 创建第一个平局选择交互，剩余基地通过 continuationContext 链式传递
        const first = tieBreakBases[0];
        const remaining = tieBreakBases.slice(1);
        const options = first.candidates.map(m => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(ctx.state.bases[first.baseIndex].defId);
            const baseName = baseDef?.name ?? `基地 ${first.baseIndex + 1}`;
            return { uid: m.uid, defId: m.defId, baseIndex: first.baseIndex, label: `${name} (力量 ${first.minPower}) @ ${baseName}` };
        });
        const interaction = createSimpleChoice(
            `dino_sotf_tiebreak_${ctx.now}`, ctx.playerId, '选择要消灭的最低力量随从', buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }), { sourceId: 'dino_survival_tiebreak', targetType: 'minion' }
        );
        const remainingData = remaining.map(tb => ({
            baseIndex: tb.baseIndex,
            candidateUids: tb.candidates.map(c => ({ uid: c.uid, defId: c.defId, owner: c.owner })),
            minPower: tb.minPower,
        }));
        return { events, matchState: queueInteraction(ctx.matchState, {
            ...interaction,
            data: { ...interaction.data, continuationContext: { remainingBases: remainingData } },
        }) };
    }

    return { events };
}

/** 狂暴 onPlay：将一个基地的爆破点降低等同于你在该基地的随从总力量（直到回合结束） */
function dinoRampage(ctx: AbilityContext): AbilityResult {
    // 选择一个有己方随从的基地
    const baseCandidates: { baseIndex: number; myPower: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const myPower = ctx.state.bases[i].minions
            .filter(m => m.controller === ctx.playerId)
            .reduce((sum, m) => sum + getMinionPower(ctx.state, m, i), 0);
        if (myPower > 0) {
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            baseCandidates.push({ baseIndex: i, myPower, label: `${baseName} (降低 ${myPower} 爆破点)` });
        }
    }
    // 数据驱动：强制效果，单候选自动执行
    return resolveOrPrompt(ctx, buildBaseTargetOptions(baseCandidates, ctx.state), {
        id: 'dino_rampage',
        title: '选择要降低爆破点的基地',
        sourceId: 'dino_rampage',
        targetType: 'base',
    }, (value) => {
        const target = baseCandidates.find(c => c.baseIndex === value.baseIndex)!;
        return { events: [modifyBreakpoint(target.baseIndex, -target.myPower, 'dino_rampage', ctx.now)] };
    });
}

// ============================================================================
// 交互处理函数注册
// ============================================================================

/** 注册恐龙派系的交互解决处理函数 */
export function registerDinosaurInteractionHandlers(): void {
    // 激光三角龙：选择目标后消灭
    registerInteractionHandler('dino_laser_triceratops', (state, _playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return { state, events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, 'dino_laser_triceratops', timestamp)] };
    });

    // 增强：选择目标后加临时力量（回合结束清零）
    registerInteractionHandler('dino_augmentation', (state, _playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        return { state, events: [addTempPower(minionUid, baseIndex, 4, 'dino_augmentation', timestamp)] };
    });

    // 物竞天择第一步：选择己方随从后，链式选择目标
    registerInteractionHandler('dino_natural_selection_choose_mine', (state, playerId, value, _iData, _random, timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const myMinion = base.minions.find(m => m.uid === minionUid);
        if (!myMinion) return undefined;
        const myPower = getMinionPower(state.core, myMinion, baseIndex);
        const targets: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (const m of base.minions) {
            if (m.uid === myMinion.uid) continue;
            const power = getMinionPower(state.core, m, baseIndex);
            if (power < myPower) {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                targets.push({ uid: m.uid, defId: m.defId, baseIndex, label: `${name} (力量 ${power})` });
            }
        }
        if (targets.length === 0) return undefined;
        const next = createSimpleChoice(
            `dino_natural_selection_target_${timestamp}`, playerId, '选择要消灭的随从', buildMinionTargetOptions(targets, { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' }), { sourceId: 'dino_natural_selection_choose_target', targetType: 'minion' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { baseIndex } } }), events: [] };
    });

    // 物竞天择第二步：选择目标后消灭
    registerInteractionHandler('dino_natural_selection_choose_target', (state, _playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        return { state, events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, 'dino_natural_selection', timestamp)] };
    });

    // 适者生存平局选择（支持多基地链式交互）
    registerInteractionHandler('dino_survival_tiebreak', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const events: SmashUpEvent[] = [destroyMinion(target.uid, target.defId, baseIndex, target.owner, 'dino_survival_of_the_fittest', timestamp)];

        // 检查是否有剩余基地需要平局选择
        const ctx = iData?.continuationContext as { remainingBases?: { baseIndex: number; candidateUids: { uid: string; defId: string; owner: string }[]; minPower: number }[] } | undefined;
        const remaining = ctx?.remainingBases ?? [];
        if (remaining.length > 0) {
            const next = remaining[0];
            const rest = remaining.slice(1);
            const options = next.candidateUids.map(c => {
                const def = getCardDef(c.defId) as MinionCardDef | undefined;
                const name = def?.name ?? c.defId;
                const baseDef = getBaseDef(state.core.bases[next.baseIndex]?.defId ?? '');
                const baseName = baseDef?.name ?? `基地 ${next.baseIndex + 1}`;
                return { uid: c.uid, defId: c.defId, baseIndex: next.baseIndex, label: `${name} (力量 ${next.minPower}) @ ${baseName}` };
            });
            const interaction = createSimpleChoice(
                `dino_sotf_tiebreak_${timestamp}`, playerId, '选择要消灭的最低力量随从', buildMinionTargetOptions(options, { state: state.core, sourcePlayerId: playerId, effectType: 'destroy' }), { sourceId: 'dino_survival_tiebreak', targetType: 'minion' }
                );
            return { state: queueInteraction(state, { ...interaction, data: { ...interaction.data, continuationContext: { remainingBases: rest } } }), events };
        }

        return { state, events };
    });

    // 狂暴：选择基地后降低爆破点
    registerInteractionHandler('dino_rampage', (state, playerId, value, _iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const myPower = base.minions
            .filter(m => m.controller === playerId)
            .reduce((sum, m) => sum + getMinionPower(state.core, m, baseIndex), 0);
        if (myPower <= 0) return { state, events: [] };
        return { state, events: [modifyBreakpoint(baseIndex, -myPower, 'dino_rampage', timestamp)] };
    });
}

// ============================================================================
// ongoing 效果
// ============================================================================

// 雷克斯王：无能力（纯力量7）
// 装甲剑龙 (ongoing) - 已通过 ongoingModifiers 系统实现力量修正
// 战斗迅猛龙 (ongoing) - 已通过 ongoingModifiers 系统实现力量修正
// 升级 (ongoing) - 已通过 ongoingModifiers 系统实现 +2 力量修正

/**
 * 全副武装事件拦截器：当附着随从被影响时，自毁此卡以阻止影响
 * 规则：如果一个能力将会影响该随从，消灭本卡，那个能力将不会影响该随从
 * 拦截：MINION_DESTROYED / MINION_RETURNED / CARD_TO_DECK_BOTTOM
 */
function dinoToothAndClawInterceptor(state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | SmashUpEvent[] | null | undefined {
    let targetUid: string | undefined;
    let fromBaseIndex: number | undefined;
    let ownerId: string | undefined;

    if (event.type === SU_EVENTS.MINION_DESTROYED) {
        const payload = (event as MinionDestroyedEvent).payload;
        targetUid = payload.minionUid;
        fromBaseIndex = payload.fromBaseIndex;
        ownerId = payload.ownerId;
    } else if (event.type === SU_EVENTS.MINION_RETURNED) {
        const payload = (event as MinionReturnedEvent).payload;
        targetUid = payload.minionUid;
        fromBaseIndex = payload.fromBaseIndex;
        // MINION_RETURNED 没有 ownerId，需要从基地上查找
        const base = state.bases[fromBaseIndex];
        const minion = base?.minions.find(m => m.uid === targetUid);
        ownerId = minion?.owner;
    } else if (event.type === SU_EVENTS.CARD_TO_DECK_BOTTOM) {
        const payload = (event as CardToDeckBottomEvent).payload;
        // CARD_TO_DECK_BOTTOM 的 cardUid 可能是随从
        targetUid = payload.cardUid;
        ownerId = payload.ownerId;
        // 需要在所有基地中查找该随从
        for (let i = 0; i < state.bases.length; i++) {
            if (state.bases[i].minions.some(m => m.uid === targetUid)) {
                fromBaseIndex = i;
                break;
            }
        }
    } else {
        return undefined;
    }

    if (targetUid === undefined || fromBaseIndex === undefined) return undefined;
    const base = state.bases[fromBaseIndex];
    if (!base) return undefined;
    const target = base.minions.find(m => m.uid === targetUid);
    if (!target) return undefined;
    const toothCard = target.attachedActions.find(a => a.defId === 'dino_tooth_and_claw');
    if (!toothCard) return undefined;
    // 只拦截其他玩家发起的影响（reason 中不含自身控制者的操作）
    // 简化判断：如果事件的 ownerId 就是随从控制者，不拦截（自毁等）
    if (ownerId === target.controller) return undefined;
    // 自毁全副武装，阻止影响
    const detachEvt: OngoingDetachedEvent = {
        type: SU_EVENTS.ONGOING_DETACHED,
        payload: {
            cardUid: toothCard.uid,
            defId: toothCard.defId,
            ownerId: toothCard.ownerId,
            reason: 'dino_tooth_and_claw_self_destruct',
        },
        timestamp: event.timestamp,
    };
    return [detachEvt]; // 替换原事件为自毁事件，随从存活
}

/** 全副武装保护检查：附着了此卡的随从不受其他玩家影响（affect 类型） */
function dinoToothAndClawChecker(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    return ctx.targetMinion.attachedActions.some(a => a.defId === 'dino_tooth_and_claw');
}

/** 野生保护区保护检查：该基地上你的随从不受其他玩家战术影响 */
function dinoWildlifePreserveChecker(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    // 检查该基地上是否有 wildlife_preserve ongoing 卡，且卡的拥有者是被保护随从的控制者
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.ongoingActions.some(
        a => a.defId === 'dino_wildlife_preserve' && a.ownerId === ctx.targetMinion.controller
    );
}
