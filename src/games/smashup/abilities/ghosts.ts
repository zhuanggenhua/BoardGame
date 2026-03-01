/**
 * 大杀四方 - 幽灵派系能力
 *
 * 主题：手牌少时获得增益、弃牌操作?
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { grantExtraMinion, grantExtraAction, destroyMinion, getMinionPower, buildMinionTargetOptions, buildBaseTargetOptions, recoverCardsFromDiscard, buildAbilityFeedback } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { CardsDrawnEvent, VpAwardedEvent, SmashUpEvent, MinionPlayedEvent } from '../domain/types';
import type { MinionCardDef } from '../domain/types';
import { drawCards } from '../domain/utils';
import { registerProtection } from '../domain/ongoingEffects';
import type { ProtectionCheckContext } from '../domain/ongoingEffects';
import { registerDiscardPlayProvider } from '../domain/discardPlayability';
import { getCardDef, getBaseDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';

/** 注册幽灵派系所有能力*/
export function registerGhostAbilities(): void {
    // 幽灵 onPlay：弃一张手牌
    registerAbility('ghost_ghost', 'onPlay', ghostGhost);
    // 招魂（行动卡）：手牌堆?时抽牌??
    registerAbility('ghost_seance', 'onPlay', ghostSeance);
    // 阴暗交易（行动卡）：手牌堆?时获得?VP
    registerAbility('ghost_shady_deal', 'onPlay', ghostShadyDeal);
    // 悄然而至（行动卡）：额外打出一个随从和一个行动
    registerAbility('ghost_ghostly_arrival', 'onPlay', ghostGhostlyArrival);
    // 灵魂（随从onPlay）：弃等量力量的牌消灭一个随从
    registerAbility('ghost_spirit', 'onPlay', ghostSpirit);

    // === ongoing 效果注册 ===
    // ghost_incorporeal: 打出到随从上，持续：该随从不受其他玩家卡牌影响?
    registerProtection('ghost_incorporeal', 'affect', ghostIncorporealChecker);
    // ghost_haunting: 持续：手牌≤2时，本随从不受其他玩家卡牌影响?
    registerProtection('ghost_haunting', 'affect', ghostHauntingChecker);

    // ghost_make_contact: ongoing 卡，附着到对手随从上改变控制权
    registerAbility('ghost_make_contact', 'onPlay', ghostMakeContact);
    // 亡者崛起：弃牌→从弃牌堆打出力?弃牌数的额外随从
    registerAbility('ghost_the_dead_rise', 'onPlay', ghostTheDeadRise);
    // 越过边界：选一个卡名，取回弃牌堆中所有同名随从
    registerAbility('ghost_across_the_divide', 'onPlay', ghostAcrossTheDivide);

    // === 弃牌堆出牌能力注册 ===
    // 幽灵之主：手牌≤2时可从弃牌堆打出（替代正常随从打出，消耗随从额度）
    registerDiscardPlayProvider({
        id: 'ghost_spectre',
        getPlayableCards(core, playerId) {
            const player = core.players[playerId];
            if (!player) return [];
            // 手牌≤2 时才激活
            if (player.hand.length > 2) return [];
            // 需要有随从额度才能打出（"任何你可以打出一个随从的时候"）
            if (player.minionsPlayed >= player.minionLimit) return [];
            const cards = player.discard.filter(c => c.defId === 'ghost_spectre');
            if (cards.length === 0) return [];
            // 返回所有同 defId 的卡牌，用户选哪张都行
            const def = getCardDef('ghost_spectre') as MinionCardDef | undefined;
            return cards.map(card => ({
                card,
                allowedBaseIndices: 'all' as const,
                consumesNormalLimit: true, // 消耗正常随从额度
                sourceId: 'ghost_spectre',
                defId: card.defId,
                power: def?.power ?? 0,
                name: def?.name ?? card.defId,
            }));
        },
    });
}

/** 幽灵 onPlay：弃一张手牌*/
function ghostGhost(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const discardable = player.hand.filter(c => c.uid !== ctx.cardUid);
    
    if (discardable.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };
    
    // 先生成初始选项（基于当前状态）
    const initialOptions = discardable.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId }, _source: 'hand' as const };
    });
    const skipOption = { id: 'skip', label: '跳过', value: { skip: true } };
    
    const allOptions = [...initialOptions, skipOption];
    
    const pid = ctx.playerId;
    const playedCardUid = ctx.cardUid;
    const interaction = createSimpleChoice(
        `ghost_ghost_${ctx.now}`,
        pid,
        '选择要弃掉的手牌（可跳过）',
        allOptions as any[],
        { sourceId: 'ghost_ghost', targetType: 'hand' },
    );
    
    // 手牌弃牌类交互：使用 optionsGenerator 动态生成选项
    // 确保队列中等待时手牌变化后选项正确（如同时触发鬼屋弃牌）
    (interaction.data as any).optionsGenerator = (state: any) => {
        const p = state.core?.players?.[pid];
        if (!p || !p.hand || p.hand.length === 0) return [skipOption];
        const cards = p.hand.filter((c: any) => c.uid !== playedCardUid);
        if (cards.length === 0) return [skipOption];
        const opts = cards.map((c: any, i: number) => {
            const def = getCardDef(c.defId);
            return { id: `card-${i}`, label: def?.name ?? c.defId, value: { cardUid: c.uid, defId: c.defId } };
        });
        return [...opts, skipOption];
    };
    
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 招魂 onPlay：手牌≤2时抽牌??*/
function ghostSeance(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 打出行动卡后手牌会减1，所以用当前手牌堆?1判断
    const handAfterPlay = player.hand.length - 1;
    if (handAfterPlay > 2) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    const drawCount = Math.max(0, 5 - handAfterPlay);
    if (drawCount === 0) return { events: [] };
    const { drawnUids } = drawCards(player, drawCount, ctx.random);
    if (drawnUids.length === 0) return { events: [] };
    const evt: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: drawnUids.length, cardUids: drawnUids },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/** 阴暗交易 onPlay：手牌≤2时获得?VP */
function ghostShadyDeal(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const handAfterPlay = player.hand.length - 1;
    if (handAfterPlay > 2) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    const evt: VpAwardedEvent = {
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.playerId, amount: 1, reason: 'ghost_shady_deal' },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/** 悄然而至 onPlay：额外打出一个随从和一个行动*/
function ghostGhostlyArrival(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantExtraMinion(ctx.playerId, 'ghost_ghostly_arrival', ctx.now),
            grantExtraAction(ctx.playerId, 'ghost_ghostly_arrival', ctx.now),
        ],
    };
}

// ghost_haunting (ongoing) - 已通过 ongoingModifiers 系统实现力量修正?3 力量部分）?
//   不受影响部分通过 ghost_incorporeal protection 实现（注册在 registerGhostAbilities 中）
// ghost_door_to_the_beyond (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（手牌≤2时同基地己方随从+2?

/**
 * ghost_incorporeal 保护检查：ghost_haunting 附着的随从不受其他玩家卡牌影响?
 * 
 * 规则：附着了?ghost_haunting 的随从不受其他玩家卡牌影响?
 * 实现：检查目标随从是否附着了?ghost_haunting，且攻击者不是随从控制者?
 */
function ghostIncorporealChecker(ctx: ProtectionCheckContext): boolean {
    // 检查目标随从是否附着了?ghost_incorporeal
    const hasIncorporeal = ctx.targetMinion.attachedActions.some(a => a.defId === 'ghost_incorporeal');
    if (!hasIncorporeal) return false;
    // 只保护不受其他玩家影响?
    return ctx.sourcePlayerId !== ctx.targetMinion.controller;
}

/**
 * ghost_haunting 保护检查：手牌堆?时，不散阴魂本随从不受其他玩家卡牌影响?
 */
function ghostHauntingChecker(ctx: ProtectionCheckContext): boolean {
    if (ctx.targetMinion.defId !== 'ghost_haunting') return false;
    if (ctx.sourcePlayerId === ctx.targetMinion.controller) return false;
    const player = ctx.state.players[ctx.targetMinion.controller];
    if (!player) return false;
    return player.hand.length <= 2;
}

/**
 * ghost_make_contact onPlay：控制对手一个随从
 * 前置条件：你只能在本卡是你的唯一手牌时打出它
 *
 * 注意：控制权转移由 ONGOING_ATTACHED 的 reduce 逻辑自动完成（reducer.ts 中 defId === 'ghost_make_contact' 分支）。
 * 打出时 UI 层已通过 ongoing-minion 模式让玩家选择了目标随从（targetMinionUid），
 * 无需再弹交互——只需验证前置条件即可。
 */
function ghostMakeContact(ctx: AbilityContext): AbilityResult {
    // 前置条件：本卡必须是唯一手牌（打出后手牌为空）
    const player = ctx.state.players[ctx.playerId];
    const otherHandCards = player.hand.filter(c => c.uid !== ctx.cardUid);
    if (otherHandCards.length > 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.condition_not_met', ctx.now)] };
    // 控制权转移已由 reducer 的 ONGOING_ATTACHED 处理，此处无需额外操作
    return { events: [] };
}

/**
 * 灵魂 onPlay：选择一个随从，弃等量力量的手牌来消灭它
 */
function ghostSpirit(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const discardable = player.hand.filter(c => c.uid !== ctx.cardUid);
    if (discardable.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };

    // 找所有可消灭的随从（力量 ≤ 可弃手牌数，不限所有者）
    // 描述：「选择一个随从。你可以弃置等同于该随从力量数量的卡来消灭它。」
    const targets: { uid: string; defId: string; baseIndex: number; owner: string; power: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.uid === ctx.cardUid) continue; // 排除灵魂自身
            const power = getMinionPower(ctx.state, m, i);
            if (power <= discardable.length) {
                const def = getCardDef(m.defId) as MinionCardDef | undefined;
                const name = def?.name ?? m.defId;
                const baseDef = getBaseDef(ctx.state.bases[i].defId);
                const baseName = baseDef?.name ?? `基地 ${i + 1}`;
                targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, owner: m.owner, power, label: `${name} (力量 ${power}, 需要?${power} 张牌) @ ${baseName}` });
            }
        }
    }
    if (targets.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };
    // Prompt 选择（包含取消选项）
    const options = targets.map(t => ({ uid: t.uid, defId: t.defId, baseIndex: t.baseIndex, label: t.label }));
    const interaction = createSimpleChoice(
        `ghost_spirit_${ctx.now}`, ctx.playerId,
        '选择要消灭的随从（需弃等量力量的手牌）', buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
        { sourceId: 'ghost_spirit', targetType: 'minion', autoCancelOption: true }
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// 亡者崛起：弃任意数量牌→从弃牌堆打出力?弃牌数的额外随从
// ============================================================================

/** 亡者崛起?onPlay：Prompt 选择弃牌数量 */
function ghostTheDeadRise(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const discardable = player.hand.filter(c => c.uid !== ctx.cardUid);
    if (discardable.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };
    // 检查弃牌堆中有没有随从可打出（至少力量<1，即力量0的也不行，需力量<弃牌数）
    // 先让玩家选弃几张）?
    const options = discardable.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId }, _source: 'hand' as const };
    });
    const interaction = createSimpleChoice(
        `ghost_the_dead_rise_discard_${ctx.now}`, ctx.playerId,
        '亡者崛起：选择要弃掉的手牌', [...options, { id: 'skip', label: '跳过', value: { skip: true } }] as any[], 'ghost_the_dead_rise_discard',
        undefined, { min: 0, max: discardable.length },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// 越过边界：选一个卡名，取回弃牌堆中所有同名随从
// ============================================================================

/** 越过边界 onPlay：按 defId 分组弃牌堆随从，选一组取?*/
function ghostAcrossTheDivide(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const minionsInDiscard = player.discard.filter(c => c.type === 'minion');
    if (minionsInDiscard.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    // ?defId 分组
    const groups = new Map<string, { defId: string; uids: string[]; name: string }>();
    for (const c of minionsInDiscard) {
        if (!groups.has(c.defId)) {
            const def = getCardDef(c.defId);
            groups.set(c.defId, { defId: c.defId, uids: [], name: def?.name ?? c.defId });
        }
        groups.get(c.defId)!.uids.push(c.uid);
    }
    const groupList = Array.from(groups.values());
    const options = groupList.map((g, i) => ({
        id: `group-${i}`, label: `${g.name} (×${g.uids.length})`, value: { defId: g.defId },
    }));
    const interaction = createSimpleChoice(
        `ghost_across_the_divide_${ctx.now}`, ctx.playerId,
        '越过边界：选择一个卡名（取回所有同名随从）', options as any[],
        { sourceId: 'ghost_across_the_divide', autoCancelOption: true },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// Prompt 继续函数
// ============================================================================

/** 注册幽灵派系的交互解决处理函数 */
export function registerGhostInteractionHandlers(): void {
    // 幽灵：选择弃哪张手牌（可跳过）
    registerInteractionHandler('ghost_ghost', (state, playerId, value, _iData, _random, timestamp) => {
        if (value && (value as any).skip) return { state, events: [] };
        const { cardUid } = value as { cardUid: string };
        return { state, events: [{
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: [cardUid] },
            timestamp,
        }] };
    });

    // 灵魂：选择目标后→链式创建弃牌确认交互（"你可以"=可跳过）
    registerInteractionHandler('ghost_spirit', (state, playerId, value, _iData, _random, timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return undefined;
        const power = getMinionPower(state.core, target, baseIndex);
        const player = state.core.players[playerId];
        const discardable = player.hand.filter(c => c.uid !== minionUid);
        
        // 手牌不够弃→无法消灭，直接跳过（不创建交互）
        if (discardable.length < power) {
            return { state, events: [] };
        }
        
        // 力量为 0 → 无需弃牌直接消灭（但仍需确认"你可以"）
        if (power === 0) {
            const base = state.core.bases[baseIndex];
            const targetMinion = base.minions.find(m => m.uid === minionUid);
            const confirmInteraction = createSimpleChoice(
                `ghost_spirit_confirm_${timestamp}`, playerId,
                `是否消灭该随从？（力量 0，无需弃牌）`,
                [
                    { id: 'yes', label: '消灭', value: { confirm: true, minionUid, minionDefId: targetMinion?.defId, baseIndex, baseDefId: base.defId } },
                    { id: 'no', label: '跳过', value: { confirm: false, minionDefId: targetMinion?.defId } },
                ], { sourceId: 'ghost_spirit_confirm', targetType: 'minion' }
                );
            return { state: queueInteraction(state, confirmInteraction), events: [] };
        }
        
        // 力量>0 → 让玩家选择弃哪些牌（多选，恰好 power 张，或者不选任何牌跳过）
        const cardOptions = discardable.map((c, i) => {
            const def = getCardDef(c.defId);
            const name = def?.name ?? c.defId;
            return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId }, _source: 'hand' as const };
        });
        // 使用 min=0 允许不选（跳过），max=power 限制上限
        // 但在 handler 中只接受 0 张（跳过）或 power 张（执行）
        const skipOption = { id: 'skip', label: '跳过', value: { skip: true } };
        const discardInteraction = createSimpleChoice(
            `ghost_spirit_discard_${timestamp}`, playerId,
            `选择 ${power} 张手牌弃置来消灭该随从（可跳过）`,
            [...cardOptions, skipOption] as any[],
            { sourceId: 'ghost_spirit_discard', multi: { min: 0, max: power } },
        );
        return {
            state: queueInteraction(state, {
                ...discardInteraction,
                data: { ...discardInteraction.data, continuationContext: { minionUid, baseIndex, requiredCount: power } },
            }),
            events: [],
        };
    });

    // 灵魂弃牌确认：玩家选择了弃哪些牌（或跳过）
    registerInteractionHandler('ghost_spirit_discard', (state, playerId, value, iData, _random, timestamp) => {
        const ctx = iData?.continuationContext as { minionUid: string; baseIndex: number; requiredCount: number } | undefined;
        if (!ctx) return undefined;
        
        // 多选模式：value 可能是数组或单个对象
        const selected = Array.isArray(value) ? value : value ? [value] : [];
        const cardUids = selected.map((v: any) => v.cardUid).filter(Boolean) as string[];
        
        // 只接受两种情况：
        // 1. 选择 0 张卡牌 → 跳过（不执行效果）
        // 2. 选择恰好 power 张卡牌 → 执行效果
        // 其他情况（1-2 张等部分选择）→ 拒绝（返回 undefined 让系统提示错误）
        if (cardUids.length === 0) {
            // 跳过
            return { state, events: [] };
        }
        
        if (cardUids.length !== ctx.requiredCount) {
            // 部分选择，拒绝
            return undefined;
        }
        
        // 执行效果：弃牌并消灭随从
        const base = state.core.bases[ctx.baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === ctx.minionUid);
        if (!target) return { state, events: [] };
        const events: SmashUpEvent[] = [
            { type: SU_EVENTS.CARDS_DISCARDED, payload: { playerId, cardUids }, timestamp },
            destroyMinion(target.uid, target.defId, ctx.baseIndex, target.owner, playerId, 'ghost_spirit', timestamp),
        ];
        return { state, events };
    });

    // 灵魂力量0确认：是否消灭（无需弃牌）
    registerInteractionHandler('ghost_spirit_confirm', (state, playerId, value, _iData, _random, timestamp) => {
        const { confirm, minionUid, baseIndex } = value as { confirm: boolean; minionUid?: string; baseIndex?: number };
        if (!confirm || minionUid === undefined || baseIndex === undefined) return { state, events: [] };
        const base = state.core.bases[baseIndex];
        if (!base) return undefined;
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return { state, events: [] };
        return { state, events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'ghost_spirit', timestamp)] };
    });

    // 亡者崛起：多选弃牌后→链式选择弃牌堆中力量<弃牌数的随从（可跳过）
    registerInteractionHandler('ghost_the_dead_rise_discard', (state, playerId, value, _iData, _random, timestamp) => {
        const selectedCards = Array.isArray(value) ? value as Array<{ cardUid: string }> : [];
        // min:0 允许不选，空数组 = 跳过
        if (selectedCards.length === 0) return { state, events: [] };
        const discardUids = selectedCards.map(v => v.cardUid);
        const discardCount = discardUids.length;
        const events: SmashUpEvent[] = [{
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: discardUids },
            timestamp,
        }];
        const player = state.core.players[playerId];
        // 注意：CARDS_DISCARDED 事件还未 reduce，刚弃的牌仍在 hand 中，需要合并：
        // 1. 原弃牌堆中已有的随从
        // 2. 本次刚弃掉的手牌中的随从（从 hand 中找 discardUids 对应的牌）
        const justDiscarded = player.hand.filter(c => discardUids.includes(c.uid));
        const allDiscardMinions = [...player.discard, ...justDiscarded];
        const eligible = allDiscardMinions.filter(c => {
            if (c.type !== 'minion') return false;
            const def = getCardDef(c.defId) as MinionCardDef | undefined;
            return def !== undefined && def.power < discardCount;
        });
        if (eligible.length === 0) return { state, events };
        const skipOption = { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const };
        const options = eligible.map((c, i) => {
            const def = getCardDef(c.defId) as MinionCardDef | undefined;
            const name = def?.name ?? c.defId;
            const power = def?.power ?? 0;
            return { id: `card-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, power }, _source: 'discard' as const };
        });
        const next = createSimpleChoice(
            `ghost_the_dead_rise_play_${timestamp}`, playerId,
            `选择力量<${discardCount}的随从从弃牌堆打出（可跳过）`, [...options, skipOption] as any[], 'ghost_the_dead_rise_play',
        );
        return { state: queueInteraction(state, next), events };
    });

    // 亡者崛起：选择随从后，链式选择基地
    registerInteractionHandler('ghost_the_dead_rise_play', (state, playerId, value, _iData, _random, timestamp) => {
        // 跳过
        if ((value as any)?.skip) return { state, events: [] };
        const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
        // 只有一个基地时直接打出
        if (state.core.bases.length === 1) {
            const playedEvt: MinionPlayedEvent = {
                type: SU_EVENTS.MINION_PLAYED,
                payload: { playerId, cardUid, defId, baseIndex: 0, baseDefId: ctx.state.bases[0].defId, power, fromDiscard: true },
                timestamp,
            };
            return { state, events: [
                grantExtraMinion(playerId, 'ghost_the_dead_rise', timestamp),
                playedEvt,
            ] };
        }
        // 多个基地时让玩家选择
        const baseCandidates = state.core.bases.map((b, i) => {
            const baseDef = getBaseDef(b.defId);
            return { baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` };
        });
        const next = createSimpleChoice(
            `ghost_the_dead_rise_base_${timestamp}`, playerId,
            '亡者崛起：选择打出随从的基地', buildBaseTargetOptions(baseCandidates, state.core),
            { sourceId: 'ghost_the_dead_rise_base', targetType: 'base' },
            );
        return {
            state: queueInteraction(state, {
                ...next,
                data: { ...next.data, continuationContext: { cardUid, defId, power } },
            }),
            events: [],
        };
    });

    // 亡者崛起：选择基地后打出随从
    registerInteractionHandler('ghost_the_dead_rise_base', (state, playerId, value, iData, _random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number };
        const ctx = iData?.continuationContext as { cardUid: string; defId: string; power: number } | undefined;
        if (!ctx) return undefined;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid: ctx.cardUid, defId: ctx.defId, baseIndex, power: ctx.power, fromDiscard: true },
            timestamp,
        };
        return { state, events: [
            grantExtraMinion(playerId, 'ghost_the_dead_rise', timestamp),
            playedEvt,
        ] };
    });

    // 越过边界：选卡名后取回所有同名随从
    registerInteractionHandler('ghost_across_the_divide', (state, playerId, value, _iData, _random, timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { defId } = value as { defId: string };
        const player = state.core.players[playerId];
        const sameNameMinions = player.discard.filter(c => c.type === 'minion' && c.defId === defId);
        if (sameNameMinions.length === 0) return { state, events: [] };
        return { state, events: [recoverCardsFromDiscard(playerId, sameNameMinions.map(c => c.uid), 'ghost_across_the_divide', timestamp)] };
    });

    // （已删除旧的"幽灵之主"交互处理器——现在通过 PLAY_MINION fromDiscard 命令直接打出）
}
