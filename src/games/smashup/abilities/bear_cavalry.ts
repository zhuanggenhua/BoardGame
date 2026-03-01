/**
 * 大杀四方 - 黑熊骑兵派系能力
 *
 * 主题：消灭对手最弱随从、移动对手随从
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { destroyMinion, grantExtraMinion, moveMinion, getMinionPower, buildMinionTargetOptions, buildBaseTargetOptions, resolveOrPrompt, buildAbilityFeedback } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, MinionOnBase, OngoingDetachedEvent, MinionPlayedEvent } from '../domain/types';
import type { MinionCardDef } from '../domain/types';
import { getCardDef, getBaseDef } from '../data/cards';
import { registerProtection, registerTrigger, isMinionProtected } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, TriggerContext } from '../domain/ongoingEffects';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';

/** 注册黑熊骑兵派系所有能力*/
export function registerBearCavalryAbilities(): void {
    // 黑熊擒抱（行动卡）：每位对手消灭自己最弱随从
    registerAbility('bear_cavalry_bear_hug', 'onPlay', bearCavalryBearHug);
    // 委任（行动卡）：额外打出一个随从
    registerAbility('bear_cavalry_commission', 'onPlay', bearCavalryCommission);
    // 黑熊骑兵（随从onPlay）：移动对手在本基地的一个随从到另一个基地
    registerAbility('bear_cavalry_bear_cavalry', 'onPlay', bearCavalryBearCavalryAbility);
    // 你们已经完蛋（行动卡）：选择有己方随从的基地，移动对手随从
    registerAbility('bear_cavalry_youre_screwed', 'onPlay', bearCavalryYoureScrewed);
    // 与熊同行（行动卡）：移动己方一个随从到其他基地
    registerAbility('bear_cavalry_bear_rides_you', 'onPlay', bearCavalryBearRidesYou);
    // 你们都是美食（行动卡）：移动一个基地上所有对手随从到其他基地
    registerAbility('bear_cavalry_youre_pretty_much_borscht', 'onPlay', bearCavalryYourePrettyMuchBorscht);
    // 黑熊口粮（行动卡）：消灭一个随从或一个已打出的行动卡
    registerAbility('bear_cavalry_bear_necessities', 'onPlay', bearCavalryBearNecessities);

    // === ongoing 效果注册 ===
    // 伊万将军：己方随从不收回能被消灭
    registerProtection('bear_cavalry_general_ivan', 'destroy', bearCavalryGeneralIvanChecker);
    // 极地突击队员：唯一随从时不收回可消灭（+2力量的ongoingModifiers 中注册）
    registerProtection('bear_cavalry_polar_commando', 'destroy', bearCavalryPolarCommandoChecker);
    // 全面优势：保护己方随从不收回被消灭移动/影响
    registerProtection('bear_cavalry_superiority', 'destroy', bearCavalrySuperiorityChecker);
    registerProtection('bear_cavalry_superiority', 'move', bearCavalrySuperiorityChecker);
    registerProtection('bear_cavalry_superiority', 'affect', bearCavalrySuperiorityChecker);
    // 幼熊斥候：对手随从移入时消灭弱?
    registerTrigger('bear_cavalry_cub_scout', 'onMinionMoved', bearCavalryCubScoutTrigger);
    // 制高点：消灭移入的对手随从
    registerTrigger('bear_cavalry_high_ground', 'onMinionMoved', bearCavalryHighGroundTrigger);
}

/** 黑熊擒抱 onPlay：每位其他玩家消灭自己战斗力最低的随从（平局则由拥有者选择） */
function bearCavalryBearHug(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
    // 收集需要交互选择的对手（有平局的）
    const needsChoice: string[] = [];

    for (const opId of opponents) {
        // 收集该对手在所有基地上的随从及力量
        const minions: { minion: MinionOnBase; baseIndex: number; power: number }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            for (const m of ctx.state.bases[i].minions) {
                if (m.controller !== opId) continue;
                minions.push({ minion: m, baseIndex: i, power: getMinionPower(ctx.state, m, i) });
            }
        }
        if (minions.length === 0) continue;

        const minPower = Math.min(...minions.map(m => m.power));
        const weakest = minions.filter(m => m.power === minPower);

        if (weakest.length === 1) {
            // 唯一最弱，直接消灭
            events.push(destroyMinion(
                weakest[0].minion.uid, weakest[0].minion.defId, weakest[0].baseIndex, weakest[0].minion.owner, undefined, 'bear_cavalry_bear_hug', ctx.now
            ));
        } else {
            // 平局：由拥有者选择
            needsChoice.push(opId);
        }
    }

    if (needsChoice.length === 0) return { events };

    // 链式处理：第一个需要选择的对手
    return bearHugProcessNext(ctx, events, needsChoice, 0);
}

/** 黑熊擒抱：链式处理平局对手选择 */
function bearHugProcessNext(
    ctx: AbilityContext,
    events: SmashUpEvent[],
    opponents: string[],
    idx: number,
): AbilityResult {
    while (idx < opponents.length) {
        const opId = opponents[idx];
        const minions: { uid: string; defId: string; baseIndex: number; owner: string; power: number; label: string }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            for (const m of ctx.state.bases[i].minions) {
                if (m.controller !== opId) continue;
                const power = getMinionPower(ctx.state, m, i);
                minions.push({ uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, power, label: '' });
            }
        }
        if (minions.length === 0) { idx++; continue; }
        const minPower = Math.min(...minions.map(m => m.power));
        const weakest = minions.filter(m => m.power === minPower);
        if (weakest.length <= 1) {
            if (weakest.length === 1) {
                events.push(destroyMinion(weakest[0].uid, weakest[0].defId, weakest[0].baseIndex, weakest[0].owner, undefined, 'bear_cavalry_bear_hug', ctx.now));
            }
            idx++;
            continue;
        }
        // 多个平局：让拥有者选择
        const options = weakest.map(m => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(ctx.state.bases[m.baseIndex].defId);
            const baseName = baseDef?.name ?? `基地 ${m.baseIndex + 1}`;
            return { uid: m.uid, defId: m.defId, baseIndex: m.baseIndex, label: `${name} (力量 ${m.power}) @ ${baseName}` };
        });
        const interaction = createSimpleChoice(
            `bear_cavalry_bear_hug_${opId}_${ctx.now}`, opId,
            '黑熊擒抱：选择要消灭的最弱随从',
            buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }),
            { sourceId: 'bear_cavalry_bear_hug', targetType: 'minion', autoCancelOption: true },
        );
        (interaction.data as any).continuationContext = { opponents, opponentIdx: idx };
        return { events, matchState: queueInteraction(ctx.matchState, interaction) };
    }
    return { events };
}

/** 委任 onPlay：选择手牌随从打出到基地，然后移动该基地上对手随从 */
function bearCavalryCommission(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const handMinions = player.hand.filter(c => c.type === 'minion');
    if (handMinions.length === 0) {
        // 无手牌随从，仍给额外额度（保持原有行为）
        return { events: [grantExtraMinion(ctx.playerId, 'bear_cavalry_commission', ctx.now)] };
    }

    // 让玩家选择要打出的手牌随从
    const options = handMinions.map((c, i) => {
        const def = getCardDef(c.defId) as MinionCardDef | undefined;
        const name = def?.name ?? c.defId;
        const power = def?.power ?? 0;
        return { id: `hand-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, power }, _source: 'hand' as const };
    });
    const interaction = createSimpleChoice(
        `bear_cavalry_commission_choose_minion_${ctx.now}`, ctx.playerId,
        '委任：选择要额外打出的随从', options as any[], { sourceId: 'bear_cavalry_commission_choose_minion', targetType: 'hand' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// ongoing 效果检查器与触发器
// ============================================================================

/** 伊万将军保护检查：控制者的随从不收回能被消灭*/
function bearCavalryGeneralIvanChecker(ctx: ProtectionCheckContext): boolean {
    for (const base of ctx.state.bases) {
        const ivan = base.minions.find(m => m.defId === 'bear_cavalry_general_ivan');
        if (ivan && ivan.controller === ctx.targetMinion.controller) {
            if (ctx.targetMinion.uid === ivan.uid) continue;
            if (ctx.sourcePlayerId !== ctx.targetMinion.controller) return true;
        }
    }
    return false;
}

/** 极地突击队员保护检查：基地上唯一己方随从时不收回可消灭*/
function bearCavalryPolarCommandoChecker(ctx: ProtectionCheckContext): boolean {
    if (ctx.targetMinion.defId !== 'bear_cavalry_polar_commando') return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    const myMinionCount = base.minions.filter(m => m.controller === ctx.targetMinion.controller).length;
    return myMinionCount === 1;
}

/** 全面优势保护检查：保护基地上己方随从不收回被其他玩家消灭移动/影响 */
function bearCavalrySuperiorityChecker(ctx: ProtectionCheckContext): boolean {
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    return base.ongoingActions.some(
        a => a.defId === 'bear_cavalry_superiority' && a.ownerId === ctx.targetMinion.controller
    );
}

/** 幼熊斥候触发：对手随从移入时，若力量低于斥候则消灭 */
function bearCavalryCubScoutTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const destBaseIndex = ctx.baseIndex;
    if (destBaseIndex === undefined || !ctx.triggerMinionUid) return events;
    const destBase = ctx.state.bases[destBaseIndex];
    if (!destBase) return events;

    // 找到被移动的随从（还在原基地上）
    let movedMinion: MinionOnBase | undefined;
    let movedBaseIndex = -1;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const found = ctx.state.bases[i].minions.find(m => m.uid === ctx.triggerMinionUid);
        if (found) { movedMinion = found; movedBaseIndex = i; break; }
    }
    if (!movedMinion) return events;

    for (const scout of destBase.minions) {
        if (scout.defId !== 'bear_cavalry_cub_scout') continue;
        if (scout.controller === movedMinion.controller) continue;
        const scoutPower = getMinionPower(ctx.state, scout, destBaseIndex);
        const movedPower = getMinionPower(ctx.state, movedMinion, movedBaseIndex);
        if (movedPower < scoutPower) {
            events.push(destroyMinion(
                movedMinion.uid, movedMinion.defId, destBaseIndex, movedMinion.owner, undefined, 'bear_cavalry_cub_scout', ctx.now
            ));
            break;
        }
    }
    return events;
}

/** 制高点触发：有己方随从时消灭移入的对手随从*/
function bearCavalryHighGroundTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const destBaseIndex = ctx.baseIndex;
    if (destBaseIndex === undefined || !ctx.triggerMinionUid) return events;
    const destBase = ctx.state.bases[destBaseIndex];
    if (!destBase) return events;

    let movedMinion: MinionOnBase | undefined;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const found = ctx.state.bases[i].minions.find(m => m.uid === ctx.triggerMinionUid);
        if (found) { movedMinion = found; break; }
    }
    if (!movedMinion) return events;

    for (const ongoing of destBase.ongoingActions) {
        if (ongoing.defId !== 'bear_cavalry_high_ground') continue;
        if (ongoing.ownerId === movedMinion.controller) continue;
        const ownerHasMinion = destBase.minions.some(m => m.controller === ongoing.ownerId);
        if (!ownerHasMinion) continue;
        events.push(destroyMinion(
            movedMinion.uid, movedMinion.defId, destBaseIndex, movedMinion.owner, undefined, 'bear_cavalry_high_ground', ctx.now
        ));
        break;
    }
    return events;
}

/** 黑熊骑兵 onPlay：移动对手在本基地的一个随从到另一个基地*/
function bearCavalryBearCavalryAbility(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    const opponentMinions = base.minions.filter(m => {
        // 过滤：1) 不是自己的随从 2) 不是自己
        if (m.controller === ctx.playerId || m.uid === ctx.cardUid) return false;
        return true;
    });
    if (opponentMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    // 找目标基地
    const otherBases = ctx.state.bases.map((b, i) => i).filter(i => i !== ctx.baseIndex);
    if (otherBases.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    // 选择随从（第一步）- buildMinionTargetOptions 会自动过滤受保护的随从
    const options = buildMinionTargetOptions(
        opponentMinions.map(m => {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const power = getMinionPower(ctx.state, m, ctx.baseIndex);
            return { uid: m.uid, defId: m.defId, baseIndex: ctx.baseIndex, label: `${name} (力量 ${power})` };
        }),
        {
            state: ctx.state,
            sourcePlayerId: ctx.playerId,
            effectType: 'affect', // 移动效果属于 'affect' 类型
        }
    );
    if (options.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    
    const interaction = createSimpleChoice(
        `bear_cavalry_bear_cavalry_choose_minion_${ctx.now}`, ctx.playerId,
        '选择要移动的对手随从', options, { sourceId: 'bear_cavalry_bear_cavalry_choose_minion', targetType: 'minion' },
    );
    (interaction.data as any).continuationContext = { fromBaseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 你们已经完蛋 onPlay：选择有己方随从的基地→选择对手随从→移动到其他基地 */
function bearCavalryYoureScrewed(ctx: AbilityContext): AbilityResult {
    // 找有己方随从且有对手随从的基地
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const hasMyMinion = ctx.state.bases[i].minions.some(m => m.controller === ctx.playerId);
        // 检查是否有对手随从（保护检查延迟到 buildMinionTargetOptions）
        const hasOpponentMinion = ctx.state.bases[i].minions.some(m => m.controller !== ctx.playerId);
        if (hasMyMinion && hasOpponentMinion) {
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
    }
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const interaction = createSimpleChoice(
        `bear_cavalry_youre_screwed_choose_base_${ctx.now}`, ctx.playerId,
        '选择有己方随从的基地', buildBaseTargetOptions(candidates, ctx.state),
        { sourceId: 'bear_cavalry_youre_screwed_choose_base', targetType: 'base', autoCancelOption: true }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 与熊同行 onPlay：选择己方一个随从移动到其他基地 */
function bearCavalryBearRidesYou(ctx: AbilityContext): AbilityResult {
    const myMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            const power = getMinionPower(ctx.state, m, i);
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            myMinions.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${name} (力量 ${power}) @ ${baseName}` });
        }
    }
    if (myMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const options = myMinions.map(m => ({ uid: m.uid, defId: m.defId, baseIndex: m.baseIndex, label: m.label }));
    const interaction = createSimpleChoice(
        `bear_cavalry_bear_rides_you_choose_minion_${ctx.now}`, ctx.playerId, '选择要移动的己方随从', buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId }), { sourceId: 'bear_cavalry_bear_rides_you_choose_minion', targetType: 'minion' }
        );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 你们都是美食 onPlay：选择有己方随从的基地→选择目标基地，移动所有对手随从*/
function bearCavalryYourePrettyMuchBorscht(ctx: AbilityContext): AbilityResult {
    // 找有己方随从且有对手随从的基地
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const hasMyMinion = ctx.state.bases[i].minions.some(m => m.controller === ctx.playerId);
        const hasOpponentMinion = ctx.state.bases[i].minions.some(m => m.controller !== ctx.playerId);
        if (hasMyMinion && hasOpponentMinion) {
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
    }
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    const interaction = createSimpleChoice(
        `bear_cavalry_borscht_choose_from_${ctx.now}`, ctx.playerId,
        '选择基地（移动所有对手随从）', buildBaseTargetOptions(candidates, ctx.state),
        { sourceId: 'bear_cavalry_borscht_choose_from', targetType: 'base', autoCancelOption: true }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 黑熊口粮 onPlay：消灭一个随从或一个已打出的行动卡 */
function bearCavalryBearNecessities(ctx: AbilityContext): AbilityResult {
    // 收集所有可消灭的对手随从
    const minionTargets: { uid: string; defId: string; baseIndex: number; owner: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller === ctx.playerId) continue;
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const power = getMinionPower(ctx.state, m, i);
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            minionTargets.push({ uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, label: `[随从] ${name} (力量 ${power}) @ ${baseName}` });
        }
    }
    // 收集所有可消灭的对手行动卡
    const actionTargets: { uid: string; defId: string; ownerId: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        const baseDef = getBaseDef(base.defId);
        const baseName = baseDef?.name ?? `基地 ${i + 1}`;
        for (const o of base.ongoingActions) {
            if (o.ownerId !== ctx.playerId) {
                const def = getCardDef(o.defId);
                const name = def?.name ?? o.defId;
                actionTargets.push({ uid: o.uid, defId: o.defId, ownerId: o.ownerId, label: `[行动] ${name} @ ${baseName}` });
            }
        }
        for (const m of base.minions) {
            for (const a of m.attachedActions) {
                if (a.ownerId !== ctx.playerId) {
                    const def = getCardDef(a.defId);
                    const name = def?.name ?? a.defId;
                    actionTargets.push({ uid: a.uid, defId: a.defId, ownerId: a.ownerId, label: `[行动] ${name}` });
                }
            }
        }
    }
    const allTargets = [...minionTargets, ...actionTargets];
    if (allTargets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    // 数据驱动：强制效果，单候选自动执行（混合随从和行动卡，用 generic）
    type BearNecessitiesValue = { type: 'minion'; uid: string; defId: string; baseIndex: number; owner: string } | { type: 'action'; uid: string; defId: string; ownerId: string };
    const options = allTargets.map((t, i) => ({
        id: `target-${i}`,
        label: t.label,
        value: ('owner' in t
            ? { type: 'minion' as const, uid: t.uid, defId: t.defId, baseIndex: (t as typeof minionTargets[0]).baseIndex, owner: (t as typeof minionTargets[0]).owner }
            : { type: 'action' as const, uid: t.uid, defId: t.defId, ownerId: (t as typeof actionTargets[0]).ownerId }) as BearNecessitiesValue,
    }));
    return resolveOrPrompt<BearNecessitiesValue>(ctx, options, {
        id: 'bear_cavalry_bear_necessities',
        title: '选择要消灭的随从或行动卡',
        sourceId: 'bear_cavalry_bear_necessities',
        targetType: 'generic',
    }, (value) => {
        if (value.type === 'minion') {
            return { events: [destroyMinion(value.uid, value.defId, value.baseIndex, value.owner, undefined, 'bear_cavalry_bear_necessities', ctx.now)] };
        }
        return { events: [{ type: SU_EVENTS.ONGOING_DETACHED, payload: { cardUid: value.uid, defId: value.defId, ownerId: value.ownerId, reason: 'bear_cavalry_bear_necessities' }, timestamp: ctx.now } as OngoingDetachedEvent] };
    });
}


// ============================================================================
// Prompt 继续函数
// ============================================================================

/** 注册黑熊骑兵派系的交互解决处理函数 */
export function registerBearCavalryInteractionHandlers(): void {
    // 黑熊擒抱：平局时拥有者选择消灭哪个（链式处理多个对手）
    registerInteractionHandler('bear_cavalry_bear_hug', (state, playerId, value, iData, _random, timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return { state, events: [] };
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return { state, events: [] };
        const events: SmashUpEvent[] = [destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'bear_cavalry_bear_hug', timestamp)];

        // 链式处理下一个对手
        const ctx = (iData as any)?.continuationContext as { opponents: string[]; opponentIdx: number } | undefined;
        if (!ctx) return { state, events };
        const nextIdx = ctx.opponentIdx + 1;
        if (nextIdx >= ctx.opponents.length) return { state, events };

        // 查找下一个需要选择的对手
        for (let i = nextIdx; i < ctx.opponents.length; i++) {
            const opId = ctx.opponents[i];
            const minions: { uid: string; defId: string; baseIndex: number; owner: string; power: number }[] = [];
            for (let bi = 0; bi < state.core.bases.length; bi++) {
                for (const m of state.core.bases[bi].minions) {
                    if (m.controller !== opId) continue;
                    minions.push({ uid: m.uid, defId: m.defId, baseIndex: bi, owner: m.owner, power: getMinionPower(state.core, m, bi) });
                }
            }
            if (minions.length === 0) continue;
            const minPower = Math.min(...minions.map(m => m.power));
            const weakest = minions.filter(m => m.power === minPower);
            if (weakest.length <= 1) {
                if (weakest.length === 1) {
                    events.push(destroyMinion(weakest[0].uid, weakest[0].defId, weakest[0].baseIndex, weakest[0].owner, playerId, 'bear_cavalry_bear_hug', timestamp));
                }
                continue;
            }
            // 多个平局：创建交互
            const options = weakest.map(m => {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const baseDef = getBaseDef(state.core.bases[m.baseIndex].defId);
                const baseName = baseDef?.name ?? `基地 ${m.baseIndex + 1}`;
                return { uid: m.uid, defId: m.defId, baseIndex: m.baseIndex, label: `${name} (力量 ${m.power}) @ ${baseName}` };
            });
            const interaction = createSimpleChoice(
                `bear_cavalry_bear_hug_${opId}_${timestamp}`, opId,
                '黑熊擒抱：选择要消灭的最弱随从', buildMinionTargetOptions(options, { state: state.core, sourcePlayerId: opId }),
                { sourceId: 'bear_cavalry_bear_hug', targetType: 'minion', autoCancelOption: true }
            );
            (interaction.data as any).continuationContext = { opponents: ctx.opponents, opponentIdx: i };
            return { state: queueInteraction(state, interaction), events };
        }

        return { state, events };
    });

    // 委任第一步：选择手牌随从后→选择目标基地
    registerInteractionHandler('bear_cavalry_commission_choose_minion', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
        const baseCandidates = state.core.bases.map((b, i) => {
            const baseDef = getBaseDef(b.defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        if (baseCandidates.length === 1) {
            // 只有一个基地，直接打出并进入移动步骤
            const baseIndex = baseCandidates[0].baseIndex;
            const playedEvt: MinionPlayedEvent = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: { playerId, cardUid, defId, baseIndex, baseDefId: state.core.bases[baseIndex].defId, power },
                timestamp,
            };
            // 检查该基地是否有对手随从可移动（保护检查在 buildMinionTargetOptions 中）
            const opponentMinions = state.core.bases[baseIndex].minions.filter(m => m.controller !== playerId);
            if (opponentMinions.length === 0) {
                return { state, events: [playedEvt] };
            }
            // 创建移动交互
            const moveOptions = buildMinionTargetOptions(
                opponentMinions.map(m => {
                    const mDef = getCardDef(m.defId) as MinionCardDef | undefined;
                    const name = mDef?.name ?? m.defId;
                    const pw = getMinionPower(state.core, m, baseIndex);
                    return { uid: m.uid, defId: m.defId, baseIndex, label: `${name} (力量 ${pw})` };
                }),
                {
                    state: state.core,
                    sourcePlayerId: playerId,
                    effectType: 'affect',
                }
            );
            if (moveOptions.length === 0) {
                return { state, events: [playedEvt] };
            }
            const next = createSimpleChoice(
                `bear_cavalry_commission_move_minion_${timestamp}`, playerId,
                '委任：选择要移动的对手随从', moveOptions, { sourceId: 'bear_cavalry_commission_move_minion', targetType: 'minion' },
            );
            return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { fromBaseIndex: baseIndex } } }), events: [playedEvt] };
        }
        const next = createSimpleChoice(
            `bear_cavalry_commission_choose_base_${timestamp}`, playerId, '委任：选择打出随从的基地', buildBaseTargetOptions(baseCandidates, state.core), { sourceId: 'bear_cavalry_commission_choose_base', targetType: 'base' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { cardUid, defId, power } } }), events: [] };
    });

    // 委任第二步：选择基地后打出随从并进入移动步骤
    registerInteractionHandler('bear_cavalry_commission_choose_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; defId: string; power: number };
        if (!ctx) return undefined;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid: ctx.cardUid, defId: ctx.defId, baseIndex, baseDefId: state.core.bases[baseIndex].defId, power: ctx.power },
            timestamp,
        };
        // 检查该基地是否有对手随从可移动（保护检查在 buildMinionTargetOptions 中）
        const opponentMinions = state.core.bases[baseIndex].minions.filter(m => m.controller !== playerId);
        if (opponentMinions.length === 0) {
            return { state, events: [playedEvt] };
        }
        const moveOptions = buildMinionTargetOptions(
            opponentMinions.map(m => {
                const mDef = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = mDef?.name ?? m.defId;
                const pw = getMinionPower(state.core, m, baseIndex);
                return { uid: m.uid, defId: m.defId, baseIndex, label: `${name} (力量 ${pw})` };
            }),
            {
                state: state.core,
                sourcePlayerId: playerId,
                effectType: 'affect',
            }
        );
        if (moveOptions.length === 0) {
            return { state, events: [playedEvt] };
        }
        const next = createSimpleChoice(
            `bear_cavalry_commission_move_minion_${timestamp}`, playerId,
            '委任：选择要移动的对手随从', moveOptions, { sourceId: 'bear_cavalry_commission_move_minion', targetType: 'minion' },
        );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { fromBaseIndex: baseIndex } } }), events: [playedEvt] };
    });

    // 委任第三步：选择对手随从后→选择目标基地
    registerInteractionHandler('bear_cavalry_commission_move_minion', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex: fromBase } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[fromBase];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const otherBases = state.core.bases.map((_b, i) => i).filter(i => i !== fromBase);
        if (otherBases.length === 0) return undefined;
        if (otherBases.length === 1) {
            return { state, events: [moveMinion(minionUid, target.defId, fromBase, otherBases[0], 'bear_cavalry_commission', timestamp)] };
        }
        const options = otherBases.map(i => {
            const baseDef = getBaseDef(state.core.bases[i].defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        const next = createSimpleChoice(
            `bear_cavalry_commission_move_dest_${timestamp}`, playerId, '委任：选择移动到的基地', buildBaseTargetOptions(options, state.core), { sourceId: 'bear_cavalry_commission_move_dest', targetType: 'base' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase } } }), events: [] };
    });

    // 委任第四步：选择目标基地后移动
    registerInteractionHandler('bear_cavalry_commission_move_dest', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number };
        if (!ctx) return undefined;
        return { state, events: [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBase, toBase, 'bear_cavalry_commission', timestamp)] };
    });

    // 黑熊骑兵第一步：选择随从后，链式选择目标基地
    registerInteractionHandler('bear_cavalry_bear_cavalry_choose_minion', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex: fromBase } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[fromBase];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const otherBases = state.core.bases.map((_b, i) => i).filter(i => i !== fromBase);
        if (otherBases.length === 0) return undefined;
        const options = otherBases.map(i => {
            const baseDef = getBaseDef(state.core.bases[i].defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        const next = createSimpleChoice(
            `bear_cavalry_bear_cavalry_choose_base_${timestamp}`, playerId, '选择要移动到的基地', buildBaseTargetOptions(options, state.core), { sourceId: 'bear_cavalry_bear_cavalry_choose_base', targetType: 'base' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase } } }), events: [] };
    });

    // 黑熊骑兵第二步：选择基地后移动
    registerInteractionHandler('bear_cavalry_bear_cavalry_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number };
        if (!ctx) return undefined;
        return { state, events: [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBase, toBase, 'bear_cavalry_bear_cavalry', timestamp)] };
    });

    // 黑熊口粮：选择目标后消灭
    registerInteractionHandler('bear_cavalry_bear_necessities', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { type: string; uid: string; defId: string; baseIndex?: number; owner?: string; ownerId?: string };
        if (selected.type === 'minion') {
            return { state, events: [destroyMinion(selected.uid, selected.defId, selected.baseIndex!, selected.owner!, playerId, 'bear_cavalry_bear_necessities', timestamp)] };
        }
        return { state, events: [{ type: SU_EVENTS.ONGOING_DETACHED, payload: { cardUid: selected.uid, defId: selected.defId, ownerId: selected.ownerId!, reason: 'bear_cavalry_bear_necessities' }, timestamp }] };
    });

    // 你们已经完蛋：选择基地后→链式选择对手随从
    registerInteractionHandler('bear_cavalry_youre_screwed_choose_base', (state, playerId, value, _iData, _random, timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { baseIndex } = value as { baseIndex: number };
        const opponentMinions = state.core.bases[baseIndex].minions.filter(m => m.controller !== playerId);
        if (opponentMinions.length === 0) return { state, events: [] };
        const options = buildMinionTargetOptions(
            opponentMinions.map(m => {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const power = getMinionPower(state.core, m, baseIndex);
                return { uid: m.uid, defId: m.defId, baseIndex, label: `${name} (力量 ${power})` };
            }),
            {
                state: state.core,
                sourcePlayerId: playerId,
                effectType: 'affect',
            }
        );
        if (options.length === 0) return { state, events: [] };
        const next = createSimpleChoice(
            `bear_cavalry_youre_screwed_choose_minion_${timestamp}`, playerId,
            '选择要移动的对手随从', options, { sourceId: 'bear_cavalry_youre_screwed_choose_minion', targetType: 'minion' },
        );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { fromBaseIndex: baseIndex } } }), events: [] };
    });

    // 你们已经完蛋：选择随从后→链式选择目标基地
    registerInteractionHandler('bear_cavalry_youre_screwed_choose_minion', (state, playerId, value, iData, _random, timestamp) => {
        const { minionUid, baseIndex: fromBase } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[fromBase];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const otherBases = state.core.bases.map((_: any, i: number) => i).filter((i: number) => i !== fromBase);
        if (otherBases.length === 0) return undefined;
        const options = otherBases.map((i: number) => {
            const baseDef = getBaseDef(state.core.bases[i].defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        const next = createSimpleChoice(
            `bear_cavalry_youre_screwed_choose_dest_${timestamp}`, playerId, '选择目标基地', buildBaseTargetOptions(options, state.core), { sourceId: 'bear_cavalry_youre_screwed_choose_dest', targetType: 'base' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase } } }), events: [] };
    });

    registerInteractionHandler('bear_cavalry_youre_screwed_choose_dest', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number };
        if (!ctx) return undefined;
        return { state, events: [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBase, toBase, 'bear_cavalry_youre_screwed', timestamp)] };
    });

    // 与熊同行：选择随从后→链式选择目标基地
    registerInteractionHandler('bear_cavalry_bear_rides_you_choose_minion', (state, playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex: fromBase } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[fromBase];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const otherBases = state.core.bases.map((_: any, i: number) => i).filter((i: number) => i !== fromBase);
        if (otherBases.length === 0) return undefined;
        const options = otherBases.map((i: number) => {
            const baseDef = getBaseDef(state.core.bases[i].defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        const next = createSimpleChoice(
            `bear_cavalry_bear_rides_you_choose_base_${timestamp}`, playerId, '选择目标基地', buildBaseTargetOptions(options, state.core), { sourceId: 'bear_cavalry_bear_rides_you_choose_base', targetType: 'base' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { minionUid, minionDefId: target.defId, fromBase } } }), events: [] };
    });

    registerInteractionHandler('bear_cavalry_bear_rides_you_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: toBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { minionUid: string; minionDefId: string; fromBase: number };
        if (!ctx) return undefined;
        return { state, events: [moveMinion(ctx.minionUid, ctx.minionDefId, ctx.fromBase, toBase, 'bear_cavalry_bear_rides_you', timestamp)] };
    });

    // 你们都是美食：选择来源基地后→链式选择目标基地
    registerInteractionHandler('bear_cavalry_borscht_choose_from', (state, playerId, value, _iData, _random, timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { baseIndex: fromBase } = value as { baseIndex: number };
        const destBases: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            if (i === fromBase) continue;
            const baseDef = getBaseDef(state.core.bases[i].defId);
            destBases.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
        if (destBases.length === 0) return { state, events: [] };
        const next = createSimpleChoice(
            `bear_cavalry_borscht_choose_dest_${timestamp}`, playerId, '选择目标基地（移动对手随从到此处）', buildBaseTargetOptions(destBases, state.core), { sourceId: 'bear_cavalry_borscht_choose_dest', targetType: 'base' }
            );
        return { state: queueInteraction(state, { ...next, data: { ...next.data, continuationContext: { fromBase } } }), events: [] };
    });

    registerInteractionHandler('bear_cavalry_borscht_choose_dest', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex: destBase } = value as { baseIndex: number };
        const ctx = (iData as any)?.continuationContext as { fromBase: number };
        if (!ctx) return undefined;
        const events: SmashUpEvent[] = [];
        // 移动所有对手随从（保护检查自动应用）
        const opponentMinions = state.core.bases[ctx.fromBase].minions.filter(m => m.controller !== playerId);
        for (const m of opponentMinions) {
            // 检查保护（手动检查，因为这里不是构建选项而是批量移动）
            if (isMinionProtected(state.core, m, ctx.fromBase, playerId, 'affect')) continue;
            events.push(moveMinion(m.uid, m.defId, ctx.fromBase, destBase, 'bear_cavalry_youre_pretty_much_borscht', timestamp));
        }
        return { state, events };
    });
}
