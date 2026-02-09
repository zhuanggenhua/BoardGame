/**
 * 大杀四方 - 诡术师派系能力
 *
 * 主题：陷阱、干扰对手、消灭随从
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { destroyMinion, getMinionPower } from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { CardsDiscardedEvent, CardsDrawnEvent, OngoingDetachedEvent, SmashUpEvent, LimitModifiedEvent } from '../domain/types';
import { drawCards } from '../domain/utils';
import { registerProtection, registerRestriction, registerTrigger } from '../domain/ongoingEffects';

/** 侏儒 onPlay：消灭力量低于己方随从数量的随从 */
function tricksterGnome(ctx: AbilityContext): AbilityResult {
    const base = ctx.state.bases[ctx.baseIndex];
    if (!base) return { events: [] };
    // 计算己方随从数量（包括刚打出的自己）
    const myMinionCount = base.minions.filter(m => m.controller === ctx.playerId).length + 1;
    const target = base.minions.find(
        m => m.uid !== ctx.cardUid && getMinionPower(ctx.state, m, ctx.baseIndex) < myMinionCount
    );
    if (!target) return { events: [] };
    return {
        events: [destroyMinion(target.uid, target.defId, ctx.baseIndex, target.owner, 'trickster_gnome', ctx.now)],
    };
}

/** 带走宝物 onPlay：每个其他玩家随机弃两张手牌 */
function tricksterTakeTheShinies(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const player = ctx.state.players[pid];
        if (player.hand.length === 0) continue;

        // 随机选择至多2张
        const handCopy = [...player.hand];
        const discardUids: string[] = [];
        const count = Math.min(2, handCopy.length);
        for (let i = 0; i < count; i++) {
            const idx = Math.floor(ctx.random.random() * handCopy.length);
            discardUids.push(handCopy[idx].uid);
            handCopy.splice(idx, 1);
        }

        const evt: CardsDiscardedEvent = {
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: pid, cardUids: discardUids },
            timestamp: ctx.now,
        };
        events.push(evt);
    }
    return { events };
}

/** 幻想破碎 onPlay：消灭一个已打出到随从或基地上的行动卡 */
function tricksterDisenchant(ctx: AbilityContext): AbilityResult {
    // MVP：自动选第一个找到的对手持续行动卡
    // 先搜索基地上的持续行动
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const ongoing of base.ongoingActions) {
            if (ongoing.ownerId !== ctx.playerId) {
                const evt: OngoingDetachedEvent = {
                    type: SU_EVENTS.ONGOING_DETACHED,
                    payload: {
                        cardUid: ongoing.uid,
                        defId: ongoing.defId,
                        ownerId: ongoing.ownerId,
                        reason: 'trickster_disenchant',
                    },
                    timestamp: ctx.now,
                };
                return { events: [evt] };
            }
        }
        // 搜索随从上的附着行动
        for (const m of base.minions) {
            for (const attached of m.attachedActions) {
                if (attached.ownerId !== ctx.playerId) {
                    const evt: OngoingDetachedEvent = {
                        type: SU_EVENTS.ONGOING_DETACHED,
                        payload: {
                            cardUid: attached.uid,
                            defId: attached.defId,
                            ownerId: attached.ownerId,
                            reason: 'trickster_disenchant',
                        },
                        timestamp: ctx.now,
                    };
                    return { events: [evt] };
                }
            }
        }
    }
    return { events: [] };
}

/** 注册诡术师派系所有能力 */
export function registerTricksterAbilities(): void {
    registerAbility('trickster_gnome', 'onPlay', tricksterGnome);
    // 带走宝物（行动卡）：每个对手随机弃两张手牌
    registerAbility('trickster_take_the_shinies', 'onPlay', tricksterTakeTheShinies);
    // 幻想破碎（行动卡）：消灭一个已打出的行动卡
    registerAbility('trickster_disenchant', 'onPlay', tricksterDisenchant);
    // 小妖精 onDestroy：被消灭后抽1张牌 + 对手随机弃1张牌
    registerAbility('trickster_gremlin', 'onDestroy', tricksterGremlinOnDestroy);
    // 沉睡印记（行动卡）：对手下回合不能打行动
    registerAbility('trickster_mark_of_sleep', 'onPlay', tricksterMarkOfSleep);

    // 注册 ongoing 拦截器
    registerTricksterOngoingEffects();
}


/** 小妖精 onDestroy：被消灭后抽1张牌 + 每个对手随机弃1张牌 */
function tricksterGremlinOnDestroy(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // 抽1张牌
    const player = ctx.state.players[ctx.playerId];
    if (player && player.deck.length > 0) {
        const { drawnUids } = drawCards(player, 1, ctx.random);
        if (drawnUids.length > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: ctx.playerId, count: 1, cardUids: drawnUids },
                timestamp: ctx.now,
            } as CardsDrawnEvent);
        }
    }

    // 每个对手随机弃1张牌
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];
        if (!opponent || opponent.hand.length === 0) continue;
        const idx = Math.floor(ctx.random.random() * opponent.hand.length);
        const discardUid = opponent.hand[idx].uid;
        events.push({
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId: pid, cardUids: [discardUid] },
            timestamp: ctx.now,
        } as CardsDiscardedEvent);
    }

    return { events };
}

/**
 * 沉睡印记 onPlay：对手下回合不能打行动卡
 * MVP：通过 LIMIT_MODIFIED 将对手行动额度设为 -1（下回合重置时恢复）
 */
function tricksterMarkOfSleep(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    // 选择一个对手（MVP：选手牌最多的对手）
    let targetPid: string | undefined;
    let maxHand = -1;
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const hand = ctx.state.players[pid].hand.length;
        if (hand > maxHand) {
            maxHand = hand;
            targetPid = pid;
        }
    }
    if (!targetPid) return { events: [] };

    // 将对手行动额度减为 0（当前回合生效，下回合重置）
    const currentLimit = ctx.state.players[targetPid].actionLimit;
    if (currentLimit > 0) {
        events.push({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                playerId: targetPid,
                limitType: 'action' as const,
                delta: -currentLimit,
                reason: 'trickster_mark_of_sleep',
            },
            timestamp: ctx.now,
        } as LimitModifiedEvent);
    }
    return { events };
}

// ============================================================================
// Ongoing 拦截器注册
// ============================================================================

/** 注册诡术师派系的 ongoing 拦截器 */
function registerTricksterOngoingEffects(): void {
    // 小矮妖：其他玩家打出力量更低的随从到同基地时消灭该随从
    registerTrigger('trickster_leprechaun', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        // 找到 leprechaun 所在基地
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const leprechaun = base.minions.find(m => m.defId === 'trickster_leprechaun');
            if (!leprechaun) continue;
            // 只在同基地触发
            if (i !== trigCtx.baseIndex) continue;
            // 只对其他玩家触发
            if (leprechaun.controller === trigCtx.playerId) continue;
            // 检查打出的随从力量是否低于 leprechaun
            const lepPower = getMinionPower(trigCtx.state, leprechaun, i);
            const triggerMinion = base.minions.find(m => m.uid === trigCtx.triggerMinionUid);
            if (!triggerMinion) continue;
            const trigPower = getMinionPower(trigCtx.state, triggerMinion, i);
            if (trigPower < lepPower) {
                return [{
                    type: SU_EVENTS.MINION_DESTROYED,
                    payload: {
                        minionUid: trigCtx.triggerMinionUid,
                        minionDefId: trigCtx.triggerMinionDefId,
                        fromBaseIndex: i,
                        ownerId: trigCtx.playerId,
                        reason: 'trickster_leprechaun',
                    },
                    timestamp: trigCtx.now,
                }];
            }
        }
        return [];
    });

    // 布朗尼：被对手行动影响时，对手弃两张牌
    registerTrigger('trickster_brownie', 'onMinionPlayed', (trigCtx) => {
        // 简化实现：当对手在 brownie 所在基地打出随从时触发弃牌
        if (!trigCtx.triggerMinionUid || trigCtx.baseIndex === undefined) return [];
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const brownie = base.minions.find(m => m.defId === 'trickster_brownie');
            if (!brownie || i !== trigCtx.baseIndex) continue;
            if (brownie.controller === trigCtx.playerId) continue;
            // 对手弃两张牌
            const opponent = trigCtx.state.players[trigCtx.playerId];
            if (!opponent || opponent.hand.length === 0) continue;
            const discardCount = Math.min(2, opponent.hand.length);
            const discardUids: string[] = [];
            const handCopy = [...opponent.hand];
            for (let j = 0; j < discardCount; j++) {
                const idx = Math.floor(trigCtx.random.random() * handCopy.length);
                discardUids.push(handCopy[idx].uid);
                handCopy.splice(idx, 1);
            }
            return [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: trigCtx.playerId, cardUids: discardUids },
                timestamp: trigCtx.now,
            }];
        }
        return [];
    });

    // 迷雾笼罩：此基地上可额外打出一个随从（回合开始时给额外额度）
    registerTrigger('trickster_enshrouding_mist', 'onTurnStart', (trigCtx) => {
        // 找到 enshrouding_mist 的拥有者
        for (const base of trigCtx.state.bases) {
            const mist = base.ongoingActions.find(o => o.defId === 'trickster_enshrouding_mist');
            if (!mist) continue;
            // 只在拥有者的回合触发
            if (mist.ownerId !== trigCtx.playerId) continue;
            return [{
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: {
                    playerId: mist.ownerId,
                    limitType: 'minion' as const,
                    delta: 1,
                    reason: 'trickster_enshrouding_mist',
                },
                timestamp: trigCtx.now,
            }];
        }
        return [];
    });

    // 藏身处：保护同基地己方随从不受对手行动卡影响
    registerProtection('trickster_hideout', 'action', (ctx) => {
        // 检查目标随从是否附着了 hideout，或同基地有 hideout ongoing
        if (ctx.targetMinion.attachedActions.some(a => a.defId === 'trickster_hideout')) {
            return ctx.targetMinion.controller !== ctx.sourcePlayerId;
        }
        // 也检查基地上的 ongoing
        const base = ctx.state.bases[ctx.targetBaseIndex];
        if (base?.ongoingActions.some(o => o.defId === 'trickster_hideout')) {
            return ctx.targetMinion.controller !== ctx.sourcePlayerId;
        }
        return false;
    });

    // 火焰陷阱：其他玩家打出随从到此基地时消灭该随从
    registerTrigger('trickster_flame_trap', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || !trigCtx.triggerMinionDefId || trigCtx.baseIndex === undefined) return [];
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const trap = base.ongoingActions.find(o => o.defId === 'trickster_flame_trap');
            if (!trap || i !== trigCtx.baseIndex) continue;
            // 只对其他玩家触发
            if (trap.ownerId === trigCtx.playerId) continue;
            return [{
                type: SU_EVENTS.MINION_DESTROYED,
                payload: {
                    minionUid: trigCtx.triggerMinionUid,
                    minionDefId: trigCtx.triggerMinionDefId,
                    fromBaseIndex: i,
                    ownerId: trigCtx.playerId,
                    reason: 'trickster_flame_trap',
                },
                timestamp: trigCtx.now,
            }];
        }
        return [];
    });

    // 封路：指定派系不能打出随从到此基地
    registerRestriction('trickster_block_the_path', 'play_minion', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return false;
        const blockAction = base.ongoingActions.find(o => o.defId === 'trickster_block_the_path');
        if (!blockAction) return false;
        // 只限制对手
        if (blockAction.ownerId === ctx.playerId) return false;
        // MVP：限制所有对手打出随从到此基地（完整版需要 Prompt 选择派系）
        return true;
    });

    // 付笛手的钱：对手打出随从后弃一张牌
    registerTrigger('trickster_pay_the_piper', 'onMinionPlayed', (trigCtx) => {
        if (!trigCtx.triggerMinionUid || trigCtx.baseIndex === undefined) return [];
        for (let i = 0; i < trigCtx.state.bases.length; i++) {
            const base = trigCtx.state.bases[i];
            const piper = base.ongoingActions.find(o => o.defId === 'trickster_pay_the_piper');
            if (!piper || i !== trigCtx.baseIndex) continue;
            // 只对其他玩家触发
            if (piper.ownerId === trigCtx.playerId) continue;
            // 对手随机弃一张牌
            const opponent = trigCtx.state.players[trigCtx.playerId];
            if (!opponent || opponent.hand.length === 0) continue;
            const idx = Math.floor(trigCtx.random.random() * opponent.hand.length);
            return [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: trigCtx.playerId, cardUids: [opponent.hand[idx].uid] },
                timestamp: trigCtx.now,
            }];
        }
        return [];
    });
}
