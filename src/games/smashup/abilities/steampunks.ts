/**
 * 大杀四方 - 蒸汽朋克派系能力
 *
 * 主题：战术卡（行动卡）复用、从弃牌堆取回行动卡
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { recoverCardsFromDiscard, grantExtraAction, moveMinion, resolveOrPrompt, buildAbilityFeedback } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, SmashUpCore, CardsDrawnEvent, MinionReturnedEvent, OngoingDetachedEvent, ActionCardDef } from '../domain/types';
import { registerProtection, registerRestriction, registerTrigger, registerInterceptor } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, RestrictionCheckContext, TriggerContext } from '../domain/ongoingEffects';
import { getCardDef, getBaseDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { resolveOnPlay } from '../domain/abilityRegistry';
import { reduce } from '../domain/reduce';

/** 注册蒸汽朋克派系所有能力*/
export function registerSteampunkAbilities(): void {
    // 废物利用（行动卡）：从弃牌堆取回一张行动卡到手牌
    registerAbility('steampunk_scrap_diving', 'onPlay', steampunkScrapDiving);
    // 机械师（随从 onPlay）：从弃牌堆打出一张持续行动卡
    registerAbility('steampunk_mechanic', 'onPlay', steampunkMechanic);
    // 换场（行动卡）：取回一张己?ongoing 行动卡到手牌 + 额外行动
    registerAbility('steampunk_change_of_venue', 'onPlay', steampunkChangeOfVenue);
    // 亚哈船长（talent）：移动到有己方行动卡的基地
    registerAbility('steampunk_captain_ahab', 'talent', steampunkCaptainAhab);

    // === ongoing 效果注册 ===
    // steam_queen: 己方 ongoing 行动卡不受对手影响?
    registerInterceptor('steampunk_steam_queen', steampunkSteamQueenInterceptor);
    // ornate_dome: 打出时摧毁所有其他玩家的战术 + 禁止对手打行动卡到此基地
    registerAbility('steampunk_ornate_dome', 'onPlay', steampunkOrnateDomeOnPlay);
    registerRestriction('steampunk_ornate_dome', 'play_action', steampunkOrnateDomeChecker);
    // difference_engine: 回合结束时控制者多??
    registerTrigger('steampunk_difference_engine', 'onTurnEnd', steampunkDifferenceEngineTrigger);
    // escape_hatch: 随从被消灭时回手牌
    registerTrigger('steampunk_escape_hatch', 'onMinionDestroyed', steampunkEscapeHatchTrigger);
    // zeppelin: 天赋 - 移动随从到此基地或从此基地移动?
    registerAbility('steampunk_zeppelin', 'talent', steampunkZeppelin);
}

/** 废物利用 onPlay：从弃牌堆取回一张行动卡到手牌*/
function steampunkScrapDiving(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const actionsInDiscard = player.discard.filter(c => c.type === 'action' && c.uid !== ctx.cardUid);
    if (actionsInDiscard.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    const options = actionsInDiscard.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId }, _source: 'discard' as const };
    });
    const interaction = createSimpleChoice(
        `steampunk_scrap_diving_${ctx.now}`, ctx.playerId,
        '选择要从弃牌堆取回的行动卡', options as any[], 'steampunk_scrap_diving',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// steampunk_steam_man (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（按行动卡数+力量的
// steampunk_aggromotive (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（有随从?5?
// steampunk_rotary_slug_thrower (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（己方随从2?

// ============================================================================
// ongoing 效果检查器
// ============================================================================

/**
 * steam_queen 拦截器：己方 ongoing 行动卡不受对手卡牌影响
 *
 * 规则：当 steam_queen 在场时，拥有者的行动卡不能被对手的卡牌影响
 */
function steampunkSteamQueenInterceptor(state: SmashUpCore, event: SmashUpEvent): SmashUpEvent | SmashUpEvent[] | null | undefined {
    if (event.type !== SU_EVENTS.ONGOING_DETACHED) return undefined;
    const payload = (event as OngoingDetachedEvent).payload;
    if (payload.reason?.includes('self_destruct') || payload.reason?.includes('expired')) return undefined;
    for (const base of state.bases) {
        const queen = base.minions.find(m => m.defId === 'steampunk_steam_queen');
        if (!queen) continue;
        const isOwnerAction = base.ongoingActions.some(o => o.uid === payload.cardUid && o.ownerId === queen.controller);
        const isAttachedAction = base.minions.some(m => m.attachedActions.some(a => a.uid === payload.cardUid && a.ownerId === queen.controller));
        if (isOwnerAction || isAttachedAction) {
            return null;
        }
    }
    return undefined;
}

/**
 * ornate_dome 限制检查：禁止对手打行动卡到此基地
 */
function steampunkOrnateDomeChecker(ctx: RestrictionCheckContext): boolean {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return false;
    const dome = base.ongoingActions.find(o => o.defId === 'steampunk_ornate_dome');
    if (!dome) return false;
    // 只限制非拥有者?
    return ctx.playerId !== dome.ownerId;
}

/**
 * ornate_dome onPlay：摧毁所有其他玩家打到这里的战术
 * 描述："打出到基地上。摧毁所有其他玩家打到这里的战术。"
 */
function steampunkOrnateDomeOnPlay(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events };

    // 摧毁基地上所有非己方的 ongoing 行动卡
    for (const ongoing of base.ongoingActions) {
        if (ongoing.ownerId === ctx.playerId) continue;
        // 排除 ornate_dome 自身（刚打出的）
        if (ongoing.defId === 'steampunk_ornate_dome') continue;
        events.push({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: ongoing.uid,
                defId: ongoing.defId,
                ownerId: ongoing.ownerId,
                reason: 'steampunk_ornate_dome_destroy',
            },
            timestamp: ctx.now,
        } as OngoingDetachedEvent);
    }

    // 摧毁基地上随从附着的非己方行动卡
    for (const m of base.minions) {
        for (const a of m.attachedActions) {
            if (a.ownerId === ctx.playerId) continue;
            events.push({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: a.uid,
                    defId: a.defId,
                    ownerId: a.ownerId,
                    reason: 'steampunk_ornate_dome_destroy',
                },
                timestamp: ctx.now,
            } as OngoingDetachedEvent);
        }
    }

    return { events };
}

/**
 * difference_engine 触发：回合结束时控制者多??
 */
/**
 * difference_engine 触发：回合结束时，如果拥有者在此基地有随从，多抽一张牌
 */
function steampunkDifferenceEngineTrigger(ctx: TriggerContext): SmashUpEvent[] {
    // difference_engine 是 ongoing action，在 base.ongoingActions 中查找
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const ongoing of base.ongoingActions) {
            if (ongoing.defId !== 'steampunk_difference_engine') continue;
            if (ongoing.ownerId !== ctx.playerId) continue;
            // 检查拥有者在此基地是否有随从
            const hasMinion = base.minions.some(m => m.controller === ongoing.ownerId);
            if (!hasMinion) continue;
            const player = ctx.state.players[ongoing.ownerId];
            if (!player || player.deck.length === 0) continue;
            const drawnUid = player.deck[0].uid;
            return [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: ongoing.ownerId, count: 1, cardUids: [drawnUid] },
                timestamp: ctx.now,
            } as CardsDrawnEvent];
        }
    }
    return [];
}


/**
 * escape_hatch 触发：己方随从被消灭时回手牌（而非进弃牌堆?
 * 
 * 规则：当 escape_hatch 附着在基地上时，该基地上拥有者的随从被消灭时回手牌
 */
function steampunkEscapeHatchTrigger(ctx: TriggerContext): SmashUpEvent[] {
    if (ctx.baseIndex === undefined || !ctx.triggerMinionUid) return [];
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return [];

    const hatch = base.ongoingActions.find(o => o.defId === 'steampunk_escape_hatch');
    if (!hatch) return [];

    // 找被消灭的随从
    const minion = base.minions.find(m => m.uid === ctx.triggerMinionUid);
    if (!minion) return [];
    // 只保护?hatch 拥有者的随从
    if (minion.controller !== hatch.ownerId) return [];

    const evt: MinionReturnedEvent = {
        type: SU_EVENTS.MINION_RETURNED,
        payload: {
            minionUid: minion.uid,
            minionDefId: minion.defId,
            fromBaseIndex: ctx.baseIndex,
            toPlayerId: minion.owner,
            reason: 'steampunk_escape_hatch',
        },
        timestamp: ctx.now,
    };
    return [evt];
}

// ============================================================================
// 新增能力实现
// ============================================================================

/**
 * 机械臂?onPlay：从弃牌堆打出一张持续行动卡到基地
 */
function steampunkMechanic(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 机械师只能选择打出到基地上的持续行动卡（不包括打出到随从上的）
    const actionsInDiscard = player.discard.filter(c => {
        if (c.type !== 'action' || c.uid === ctx.cardUid) return false;
        const def = getCardDef(c.defId) as ActionCardDef | undefined;
        // 排除 ongoingTarget === 'minion' 的持续行动卡
        if (def?.subtype === 'ongoing' && def.ongoingTarget === 'minion') return false;
        return true;
    });
    if (actionsInDiscard.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };
    const options = actionsInDiscard.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId }, _source: 'discard' as const };
    });
    const interaction = createSimpleChoice(
        `steampunk_mechanic_${ctx.now}`, ctx.playerId,
        '选择要从弃牌堆打出的行动卡', options as any[],
        { sourceId: 'steampunk_mechanic', autoCancelOption: true },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 换场 onPlay：取回一张己?ongoing 行动卡到手牌 + 额外行动
 */
function steampunkChangeOfVenue(ctx: AbilityContext): AbilityResult {
    // 收集所有己?ongoing 行动?
    const myOngoings: { uid: string; defId: string; ownerId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const o of base.ongoingActions) {
            if (o.ownerId === ctx.playerId) {
                const def = getCardDef(o.defId);
                const name = def?.name ?? o.defId;
                myOngoings.push({ uid: o.uid, defId: o.defId, ownerId: o.ownerId, baseIndex: i, label: name });
            }
        }
    }
    if (myOngoings.length === 0) {
        // 没有 ongoing 行动卡，仍给额外行动
        return { events: [grantExtraAction(ctx.playerId, 'steampunk_change_of_venue', ctx.now)] };
    }
    const options = myOngoings.map((o, i) => ({
        id: `ongoing-${i}`, label: o.label, value: { cardUid: o.uid, defId: o.defId, ownerId: o.ownerId }, _source: 'ongoing' as const,
    }));
    const interaction = createSimpleChoice(
        `steampunk_change_of_venue_${ctx.now}`, ctx.playerId,
        '选择要取回的持续行动卡', options as any[],
        { sourceId: 'steampunk_change_of_venue', targetType: 'ongoing' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 亚哈船长 talent：移动该随从到一个附属有你的战术的基地上。
 * 多个候选基地时让玩家选择
 */
function steampunkCaptainAhab(ctx: AbilityContext): AbilityResult {
    // 找 captain_ahab 当前所在基地
    let currentBaseIndex = -1;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (ctx.state.bases[i].minions.some(m => m.uid === ctx.cardUid)) {
            currentBaseIndex = i;
            break;
        }
    }
    if (currentBaseIndex === -1) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    // 找有己方 ongoing 行动卡的其他基地
    const candidates: { baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (i === currentBaseIndex) continue;
        const base = ctx.state.bases[i];
        if (base.ongoingActions.some(o => o.ownerId === ctx.playerId)) {
            const baseDef = getBaseDef(base.defId);
            candidates.push({ baseIndex: i, label: baseDef?.name ?? `基地 ${i + 1}` });
        }
    }
    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    // 单候选自动执行，多候选让玩家选择
    return resolveOrPrompt<{ baseIndex: number }>(ctx,
        candidates.map(c => ({ id: `base-${c.baseIndex}`, label: c.label, value: { baseIndex: c.baseIndex }, _source: 'base' as const })),
        { id: 'steampunk_captain_ahab', title: '选择要移动到的基地', sourceId: 'steampunk_captain_ahab', targetType: 'base' },
        (value) => ({
            events: [moveMinion(ctx.cardUid, ctx.defId, currentBaseIndex, value.baseIndex, 'steampunk_captain_ahab', ctx.now)],
        }),
    );
}


/**
 * 齐柏林飞艇?talent：从另一个基地移动一个你的随从到这里，或从这里移动到另一个基地
 */
function steampunkZeppelin(ctx: AbilityContext): AbilityResult {
    // 找到 zeppelin 所在基地
    let zepBaseIndex = -1;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (ctx.state.bases[i].ongoingActions.some(o => o.uid === ctx.cardUid)) {
            zepBaseIndex = i;
            break;
        }
    }
    if (zepBaseIndex === -1) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const zepBase = ctx.state.bases[zepBaseIndex];
    const candidates: { id: string; label: string; value: { minionUid: string; minionDefId: string; fromBase: number; toBase: number } }[] = [];

    // 方向A：从其他基地移动到这?
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (i === zepBaseIndex) continue;
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            const def = getCardDef(m.defId);
            const name = def?.name ?? m.defId;
            candidates.push({
                id: `from-${i}-${m.uid}`,
                label: `${name} ?此基地`,
                value: { minionUid: m.uid, minionDefId: m.defId, fromBase: i, toBase: zepBaseIndex },
            });
        }
    }

    // 方向B：从这里移动到其他基地
    for (const m of zepBase.minions) {
        if (m.controller !== ctx.playerId) continue;
        const mDef = getCardDef(m.defId);
        const mName = mDef?.name ?? m.defId;
        for (let i = 0; i < ctx.state.bases.length; i++) {
            if (i === zepBaseIndex) continue;
            const bDef = getBaseDef(ctx.state.bases[i].defId);
            const bName = bDef?.name ?? `基地${i}`;
            candidates.push({
                id: `to-${i}-${m.uid}`,
                label: `${mName} ?${bName}`,
                value: { minionUid: m.uid, minionDefId: m.defId, fromBase: zepBaseIndex, toBase: i },
            });
        }
    }

    if (candidates.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const interaction = createSimpleChoice(
        `steampunk_zeppelin_${ctx.now}`, ctx.playerId,
        '选择要移动的随从', candidates as any[],
        { sourceId: 'steampunk_zeppelin', targetType: 'generic' },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// Prompt 继续函数
// ============================================================================

/** 注册蒸汽朋克派系的交互解决处理函数 */
export function registerSteampunkInteractionHandlers(): void {
    registerInteractionHandler('steampunk_captain_ahab', (state, _playerId, value, _iData, _random, timestamp) => {
        // resolveOrPrompt 创建的交互，value 包含 baseIndex
        const { baseIndex } = value as { baseIndex: number };
        // 找到 captain_ahab 当前所在基地
        let currentBaseIndex = -1;
        let captainUid = '';
        let captainDefId = '';
        for (let i = 0; i < state.core.bases.length; i++) {
            const ahab = state.core.bases[i].minions.find(m => m.defId === 'steampunk_captain_ahab');
            if (ahab) { currentBaseIndex = i; captainUid = ahab.uid; captainDefId = ahab.defId; break; }
        }
        if (currentBaseIndex === -1) return { state, events: [] };
        return { state, events: [moveMinion(captainUid, captainDefId, currentBaseIndex, baseIndex, 'steampunk_captain_ahab', timestamp)] };
    });

    registerInteractionHandler('steampunk_scrap_diving', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as { cardUid: string };
        return { state, events: [recoverCardsFromDiscard(playerId, [cardUid], 'steampunk_scrap_diving', timestamp)] };
    });

    registerInteractionHandler('steampunk_mechanic', (state, playerId, value, _iData, random, timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { cardUid, defId } = value as { cardUid: string; defId?: string };
        const card = state.core.players[playerId].discard.find(c => c.uid === cardUid);
        const cardDefId = defId ?? card?.defId ?? '';
        const def = getCardDef(cardDefId) as ActionCardDef | undefined;

        // ongoing 卡需要选择附着目标基地 → 创建后续交互
        if (def?.subtype === 'ongoing') {
            const baseOptions = state.core.bases.map((base, i) => {
                const baseDef = getBaseDef(base.defId);
                const name = baseDef?.name ?? base.defId;
                return { id: `base-${i}`, label: name, value: { baseIndex: i }, _source: 'base' as const };
            });
            const interaction = createSimpleChoice(
                `steampunk_mechanic_target_${timestamp}`, playerId,
                '选择要将行动卡打出到的基地', baseOptions, { sourceId: 'steampunk_mechanic_target', targetType: 'base' },
            );
            const extended = {
                ...interaction,
                data: { ...interaction.data, continuationContext: { cardUid, defId: cardDefId } },
            };
            // 先恢复到手牌（后续 ACTION_PLAYED 需要从手牌移除）
            return {
                state: queueInteraction(state, extended),
                events: [recoverCardsFromDiscard(playerId, [cardUid], 'steampunk_mechanic', timestamp)],
            };
        }

        // standard 行动卡：恢复到手牌→立刻打出（不消耗行动额度）
        const events: SmashUpEvent[] = [
            recoverCardsFromDiscard(playerId, [cardUid], 'steampunk_mechanic', timestamp),
            { type: SU_EVENTS.ACTION_PLAYED, payload: { playerId, cardUid, defId: cardDefId }, timestamp } as SmashUpEvent,
            { type: SU_EVENTS.LIMIT_MODIFIED, payload: { playerId, limitType: 'action', delta: 1 }, timestamp } as SmashUpEvent,
        ];
        // 执行 onPlay 能力
        const executor = resolveOnPlay(cardDefId);
        if (executor) {
            let simCore = state.core;
            for (const evt of events) { simCore = reduce(simCore, evt); }
            const ctx: AbilityContext = {
                state: simCore, matchState: { ...state, core: simCore },
                playerId, cardUid, defId: cardDefId, baseIndex: 0, random, now: timestamp,
            };
            const result = executor(ctx);
            events.push(...result.events);
            if (result.matchState) return { state: result.matchState, events };
        }
        return { state, events };
    });

    registerInteractionHandler('steampunk_change_of_venue', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid: ongoingUid, defId, ownerId } = value as { cardUid: string; defId: string; ownerId: string };
        const cardDef = getCardDef(defId) as ActionCardDef | undefined;
        // 从基地/随从上移除 ongoing 卡（ONGOING_DETACHED 会把卡放入弃牌堆）
        const detachEvt = { type: SU_EVENTS.ONGOING_DETACHED, payload: { cardUid: ongoingUid, defId, ownerId, reason: 'steampunk_change_of_venue' }, timestamp };
        // 从弃牌堆恢复到手牌（为后续 ACTION_PLAYED 准备）
        const recoverEvt = recoverCardsFromDiscard(playerId, [ongoingUid], 'steampunk_change_of_venue', timestamp);

        // ongoing 卡需要选择新的附着目标
        if (cardDef?.subtype === 'ongoing') {
            const ongoingTarget = cardDef.ongoingTarget ?? 'base';
            if (ongoingTarget === 'minion') {
                // 附着到随从的 ongoing 卡：需要选择目标随从
                const minionOptions: { id: string; label: string; value: { baseIndex: number; minionUid: string } }[] = [];
                for (let i = 0; i < state.core.bases.length; i++) {
                    for (const m of state.core.bases[i].minions) {
                        if (m.controller === playerId) {
                            const mDef = getCardDef(m.defId);
                            minionOptions.push({ id: m.uid, label: mDef?.name ?? m.defId, value: { baseIndex: i, minionUid: m.uid } });
                        }
                    }
                }
                if (minionOptions.length === 0) {
                    // 没有可附着的随从，仍给额外行动
                    return { state, events: [detachEvt as SmashUpEvent, recoverEvt, grantExtraAction(playerId, 'steampunk_change_of_venue', timestamp)] };
                }
                const interaction = createSimpleChoice(
                    `steampunk_cov_target_${timestamp}`, playerId,
                    '选择要将行动卡附着到的随从', minionOptions, { sourceId: 'steampunk_change_of_venue_target', targetType: 'minion' },
                );
                const extended = { ...interaction, data: { ...interaction.data, continuationContext: { cardUid: ongoingUid, defId } } };
                return { state: queueInteraction(state, extended), events: [detachEvt as SmashUpEvent, recoverEvt] };
            }
            // 附着到基地的 ongoing 卡
            const baseOptions = state.core.bases.map((base, i) => {
                const baseDef = getBaseDef(base.defId);
                return { id: `base-${i}`, label: baseDef?.name ?? base.defId, value: { baseIndex: i }, _source: 'base' as const };
            });
            const interaction = createSimpleChoice(
                `steampunk_cov_target_${timestamp}`, playerId,
                '选择要将行动卡打出到的基地', baseOptions, { sourceId: 'steampunk_change_of_venue_target', targetType: 'base' },
            );
            const extended = { ...interaction, data: { ...interaction.data, continuationContext: { cardUid: ongoingUid, defId } } };
            return { state: queueInteraction(state, extended), events: [detachEvt as SmashUpEvent, recoverEvt] };
        }

        // standard 行动卡：直接打出
        const events: SmashUpEvent[] = [
            detachEvt as SmashUpEvent,
            recoverEvt,
            { type: SU_EVENTS.ACTION_PLAYED, payload: { playerId, cardUid: ongoingUid, defId }, timestamp } as SmashUpEvent,
            { type: SU_EVENTS.LIMIT_MODIFIED, payload: { playerId, limitType: 'action', delta: 1 }, timestamp } as SmashUpEvent,
        ];
        const executor = resolveOnPlay(defId);
        if (executor) {
            let simCore = state.core;
            for (const evt of events) { simCore = reduce(simCore, evt); }
            const ctx: AbilityContext = {
                state: simCore, matchState: { ...state, core: simCore },
                playerId, cardUid: ongoingUid, defId, baseIndex: 0, random: _random, now: timestamp,
            };
            const result = executor(ctx);
            events.push(...result.events);
            if (result.matchState) return { state: result.matchState, events };
        }
        return { state, events };
    });

    registerInteractionHandler('steampunk_zeppelin', (state, _playerId, value, _iData, _random, timestamp) => {
        const { minionUid, minionDefId, fromBase, toBase } = value as { minionUid: string; minionDefId: string; fromBase: number; toBase: number };
        return { state, events: [moveMinion(minionUid, minionDefId, fromBase, toBase, 'steampunk_zeppelin', timestamp)] };
    });

    // 机械师：ongoing 卡选择附着目标基地后打出
    registerInteractionHandler('steampunk_mechanic_target', (state, playerId, value, iData, random, timestamp) => {
        const { baseIndex } = value as { baseIndex: number; minionUid?: string };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; defId: string };
        if (!ctx) return { state, events: [] };
        const { cardUid, defId } = ctx;
        const events: SmashUpEvent[] = [
            { type: SU_EVENTS.ACTION_PLAYED, payload: { playerId, cardUid, defId }, timestamp } as SmashUpEvent,
            { type: SU_EVENTS.ONGOING_ATTACHED, payload: { cardUid, defId, ownerId: playerId, targetType: 'base', targetBaseIndex: baseIndex }, timestamp } as SmashUpEvent,
            { type: SU_EVENTS.LIMIT_MODIFIED, payload: { playerId, limitType: 'action', delta: 1 }, timestamp } as SmashUpEvent,
        ];
        // 执行 ongoing 卡的 onPlay 能力（如果有）
        const executor = resolveOnPlay(defId);
        if (executor) {
            let simCore = state.core;
            for (const evt of events) { simCore = reduce(simCore, evt); }
            const abilityCtx: AbilityContext = {
                state: simCore, matchState: { ...state, core: simCore },
                playerId, cardUid, defId, baseIndex, random, now: timestamp,
            };
            const result = executor(abilityCtx);
            events.push(...result.events);
            if (result.matchState) return { state: result.matchState, events };
        }
        return { state, events };
    });

    // 集结号角：ongoing 卡选择新附着目标后打出
    registerInteractionHandler('steampunk_change_of_venue_target', (state, playerId, value, iData, random, timestamp) => {
        const { baseIndex, minionUid } = value as { baseIndex: number; minionUid?: string };
        const ctx = (iData as any)?.continuationContext as { cardUid: string; defId: string };
        if (!ctx) return { state, events: [] };
        const { cardUid, defId } = ctx;
        const targetType = minionUid ? 'minion' : 'base';
        const events: SmashUpEvent[] = [
            { type: SU_EVENTS.ACTION_PLAYED, payload: { playerId, cardUid, defId }, timestamp } as SmashUpEvent,
            { type: SU_EVENTS.ONGOING_ATTACHED, payload: { cardUid, defId, ownerId: playerId, targetType, targetBaseIndex: baseIndex, ...(minionUid ? { targetMinionUid: minionUid } : {}) }, timestamp } as SmashUpEvent,
            { type: SU_EVENTS.LIMIT_MODIFIED, payload: { playerId, limitType: 'action', delta: 1 }, timestamp } as SmashUpEvent,
        ];
        const executor = resolveOnPlay(defId);
        if (executor) {
            let simCore = state.core;
            for (const evt of events) { simCore = reduce(simCore, evt); }
            const abilityCtx: AbilityContext = {
                state: simCore, matchState: { ...state, core: simCore },
                playerId, cardUid, defId, baseIndex, targetMinionUid: minionUid, random, now: timestamp,
            };
            const result = executor(abilityCtx);
            events.push(...result.events);
            if (result.matchState) return { state: result.matchState, events };
        }
        return { state, events };
    });
}
