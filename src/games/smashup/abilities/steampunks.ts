/**
 * 大杀四方 - 蒸汽朋克派系能力
 *
 * 主题：战术卡（行动卡）复用、从弃牌堆取回行动卡
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { recoverCardsFromDiscard, grantExtraAction, moveMinion } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, SmashUpCore, CardsDrawnEvent, MinionReturnedEvent, OngoingDetachedEvent } from '../domain/types';
import { registerProtection, registerRestriction, registerTrigger, registerInterceptor } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, RestrictionCheckContext, TriggerContext } from '../domain/ongoingEffects';
import { getCardDef, getBaseDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';

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
    // ornate_dome: 禁止对手打行动卡到此基地
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
    if (actionsInDiscard.length === 0) return { events: [] };
    const options = actionsInDiscard.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } };
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
    const actionsInDiscard = player.discard.filter(c => c.type === 'action' && c.uid !== ctx.cardUid);
    if (actionsInDiscard.length === 0) return { events: [] };
    const options = actionsInDiscard.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `card-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } };
    });
    const interaction = createSimpleChoice(
        `steampunk_mechanic_${ctx.now}`, ctx.playerId,
        '选择要从弃牌堆打出的行动卡', options as any[], 'steampunk_mechanic',
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
        id: `ongoing-${i}`, label: o.label, value: { cardUid: o.uid, defId: o.defId, ownerId: o.ownerId },
    }));
    const interaction = createSimpleChoice(
        `steampunk_change_of_venue_${ctx.now}`, ctx.playerId,
        '选择要取回的持续行动卡', options as any[], 'steampunk_change_of_venue',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 亚哈船长 talent：移动到有己方行动卡的基地
 * MVP：自动选第一个有己方 ongoing 行动卡的其他基地
 */
function steampunkCaptainAhab(ctx: AbilityContext): AbilityResult {
    // ?captain_ahab 当前所在基地
    let currentBaseIndex = -1;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (ctx.state.bases[i].minions.some(m => m.uid === ctx.cardUid)) {
            currentBaseIndex = i;
            break;
        }
    }
    if (currentBaseIndex === -1) return { events: [] };

    // 找有己方 ongoing 行动卡的其他基地
    for (let i = 0; i < ctx.state.bases.length; i++) {
        if (i === currentBaseIndex) continue;
        const base = ctx.state.bases[i];
        if (base.ongoingActions.some(o => o.ownerId === ctx.playerId)) {
            return {
                events: [moveMinion(ctx.cardUid, ctx.defId, currentBaseIndex, i, 'steampunk_captain_ahab', ctx.now)],
            };
        }
    }
    return { events: [] };
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
    if (zepBaseIndex === -1) return { events: [] };

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

    if (candidates.length === 0) return { events: [] };

    const interaction = createSimpleChoice(
        `steampunk_zeppelin_${ctx.now}`, ctx.playerId,
        '选择要移动的随从', candidates as any[], 'steampunk_zeppelin',
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

// ============================================================================
// Prompt 继续函数
// ============================================================================

/** 注册蒸汽朋克派系的交互解决处理函数 */
export function registerSteampunkInteractionHandlers(): void {
    registerInteractionHandler('steampunk_scrap_diving', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as { cardUid: string };
        return { state, events: [recoverCardsFromDiscard(playerId, [cardUid], 'steampunk_scrap_diving', timestamp)] };
    });

    registerInteractionHandler('steampunk_mechanic', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as { cardUid: string };
        // 从弃牌堆取回到手牌 + 额外行动（模拟"打出弃牌堆行动卡"）
        return { state, events: [
            recoverCardsFromDiscard(playerId, [cardUid], 'steampunk_mechanic', timestamp),
            grantExtraAction(playerId, 'steampunk_mechanic', timestamp),
        ] };
    });

    registerInteractionHandler('steampunk_change_of_venue', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid, defId, ownerId } = value as { cardUid: string; defId: string; ownerId: string };
        return { state, events: [
            { type: SU_EVENTS.ONGOING_DETACHED, payload: { cardUid, defId, ownerId, reason: 'steampunk_change_of_venue' }, timestamp },
            grantExtraAction(playerId, 'steampunk_change_of_venue', timestamp),
        ] };
    });

    registerInteractionHandler('steampunk_zeppelin', (state, _playerId, value, _iData, _random, timestamp) => {
        const { minionUid, minionDefId, fromBase, toBase } = value as { minionUid: string; minionDefId: string; fromBase: number; toBase: number };
        return { state, events: [moveMinion(minionUid, minionDefId, fromBase, toBase, 'steampunk_zeppelin', timestamp)] };
    });
}
