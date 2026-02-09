/**
 * 大杀四方 - 蒸汽朋克派系能力
 *
 * 主题：战术卡（行动卡）复用、从弃牌堆取回行动卡
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { recoverCardsFromDiscard, grantExtraAction, moveMinion, destroyMinion, getMinionPower } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { SmashUpEvent, CardsDrawnEvent, MinionReturnedEvent, OngoingAttachedEvent } from '../domain/types';
import { registerProtection, registerRestriction, registerTrigger } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, RestrictionCheckContext, TriggerContext } from '../domain/ongoingEffects';
import { drawCards } from '../domain/utils';

/** 注册蒸汽朋克派系所有能力 */
export function registerSteampunkAbilities(): void {
    // 废物利用（行动卡）：从弃牌堆取回一张行动卡到手牌
    registerAbility('steampunk_scrap_diving', 'onPlay', steampunkScrapDiving);
    // 机械师（随从 onPlay）：从弃牌堆打出一张持续行动卡
    registerAbility('steampunk_mechanic', 'onPlay', steampunkMechanic);
    // 换场（行动卡）：取回一张己方 ongoing 行动卡到手牌 + 额外行动
    registerAbility('steampunk_change_of_venue', 'onPlay', steampunkChangeOfVenue);
    // 亚哈船长（talent）：移动到有己方行动卡的基地
    registerAbility('steampunk_captain_ahab', 'talent', steampunkCaptainAhab);

    // === ongoing 效果注册 ===
    // steam_queen: 己方 ongoing 行动卡不受对手影响
    registerProtection('steampunk_steam_queen', 'action', steampunkSteamQueenChecker);
    // ornate_dome: 禁止对手打行动卡到此基地
    registerRestriction('steampunk_ornate_dome', 'play_action', steampunkOrnateDomeChecker);
    // difference_engine: 回合结束时控制者多抽1牌
    registerTrigger('steampunk_difference_engine', 'onTurnEnd', steampunkDifferenceEngineTrigger);
    // escape_hatch: 随从被消灭时回手牌
    registerTrigger('steampunk_escape_hatch', 'onMinionDestroyed', steampunkEscapeHatchTrigger);
}

/** 废物利用 onPlay：从弃牌堆取回一张行动卡到手牌（MVP：自动取第一张） */
function steampunkScrapDiving(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 找弃牌堆中的行动卡（排除刚打出的自己）
    const actionInDiscard = player.discard.find(
        c => c.type === 'action' && c.uid !== ctx.cardUid
    );
    if (!actionInDiscard) return { events: [] };

    return {
        events: [recoverCardsFromDiscard(
            ctx.playerId, [actionInDiscard.uid],
            'steampunk_scrap_diving', ctx.now
        )],
    };
}

// steampunk_steam_man (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（按行动卡数+力量）
// steampunk_aggromotive (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（有随从时+5）
// steampunk_rotary_slug_thrower (ongoing) - 已通过 ongoingModifiers 系统实现力量修正（己方随从+2）

// ============================================================================
// ongoing 效果检查器
// ============================================================================

/**
 * steam_queen 保护检查：己方 ongoing 行动卡不受对手行动卡影响
 * 
 * 规则：当 steam_queen 在场时，同基地己方随从不受对手行动卡影响
 */
function steampunkSteamQueenChecker(ctx: ProtectionCheckContext): boolean {
    // steam_queen 保护同基地己方随从
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    // 检查 steam_queen 是否在同基地
    const queenOnBase = base.minions.some(m => m.defId === 'steampunk_steam_queen');
    if (!queenOnBase) return false;
    // 只保护 steam_queen 控制者的随从
    const queenController = base.minions.find(m => m.defId === 'steampunk_steam_queen')?.controller;
    return ctx.targetMinion.controller === queenController && ctx.sourcePlayerId !== queenController;
}

/**
 * ornate_dome 限制检查：禁止对手打行动卡到此基地
 */
function steampunkOrnateDomeChecker(ctx: RestrictionCheckContext): boolean {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return false;
    const dome = base.ongoingActions.find(o => o.defId === 'steampunk_ornate_dome');
    if (!dome) return false;
    // 只限制非拥有者
    return ctx.playerId !== dome.ownerId;
}

/**
 * difference_engine 触发：回合结束时控制者多抽1牌
 */
function steampunkDifferenceEngineTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (const base of ctx.state.bases) {
        for (const m of base.minions) {
            if (m.defId !== 'steampunk_difference_engine') continue;
            if (m.controller !== ctx.playerId) continue;
            const player = ctx.state.players[m.controller];
            if (!player || player.deck.length === 0) continue;
            const drawnUid = player.deck[0].uid;
            const evt: CardsDrawnEvent = {
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: m.controller, count: 1, cardUids: [drawnUid] },
                timestamp: ctx.now,
            };
            events.push(evt);
        }
    }
    return events;
}

/**
 * escape_hatch 触发：己方随从被消灭时回手牌（而非进弃牌堆）
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
    // 只保护 hatch 拥有者的随从
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
 * 机械师 onPlay：从弃牌堆打出一张持续行动卡到基地
 * MVP：自动选弃牌堆中第一张 ongoing 行动卡
 */
function steampunkMechanic(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const ongoingInDiscard = player.discard.find(
        c => c.type === 'action' && c.uid !== ctx.cardUid
    );
    if (!ongoingInDiscard) return { events: [] };

    return {
        events: [recoverCardsFromDiscard(
            ctx.playerId, [ongoingInDiscard.uid],
            'steampunk_mechanic', ctx.now
        )],
    };
}

/**
 * 换场 onPlay：取回一张己方 ongoing 行动卡到手牌 + 额外行动
 * MVP：自动选第一张己方 ongoing 行动卡
 */
function steampunkChangeOfVenue(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // 找己方 ongoing 行动卡
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        const myOngoing = base.ongoingActions.find(o => o.ownerId === ctx.playerId);
        if (myOngoing) {
            // 取回到手牌（通过 ONGOING_DETACHED 事件）
            events.push({
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: myOngoing.uid,
                    defId: myOngoing.defId,
                    ownerId: myOngoing.ownerId,
                    reason: 'steampunk_change_of_venue',
                },
                timestamp: ctx.now,
            });
            break;
        }
    }

    // 额外行动
    events.push(grantExtraAction(ctx.playerId, 'steampunk_change_of_venue', ctx.now));
    return { events };
}

/**
 * 亚哈船长 talent：移动到有己方行动卡的基地
 * MVP：自动选第一个有己方 ongoing 行动卡的其他基地
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
