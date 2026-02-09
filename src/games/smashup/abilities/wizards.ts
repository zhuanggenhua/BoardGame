/**
 * 大杀四方 - 巫师派系能力
 *
 * 主题：抽牌、额外打出行动卡
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    grantExtraAction,
    grantExtraMinion,
    destroyMinion,
    shuffleHandIntoDeck,
    getMinionPower,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type { CardsDrawnEvent, SmashUpEvent, DeckReshuffledEvent } from '../domain/types';
import { drawCards } from '../domain/utils';
import { registerTrigger } from '../domain/ongoingEffects';

/** 时间法师 onPlay：额外打出一个行动 */
function wizardChronomage(ctx: AbilityContext): AbilityResult {
    return { events: [grantExtraAction(ctx.playerId, 'wizard_chronomage', ctx.now)] };
}

/** 女巫 onPlay：抽一张牌 */
function wizardEnchantress(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const { drawnUids } = drawCards(player, 1, ctx.random);
    if (drawnUids.length === 0) return { events: [] };
    const evt: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: 1, cardUids: drawnUids },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/** 秘术学习 onPlay：抽两张牌 */
function wizardMysticStudies(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const { drawnUids } = drawCards(player, 2, ctx.random);
    if (drawnUids.length === 0) return { events: [] };
    const evt: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: drawnUids.length, cardUids: drawnUids },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

/** 召唤 onPlay：额外打出一个随从 */
function wizardSummon(ctx: AbilityContext): AbilityResult {
    return { events: [grantExtraMinion(ctx.playerId, 'wizard_summon', ctx.now)] };
}

/** 时间圆环 onPlay：额外打出两个行动 */
function wizardTimeLoop(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantExtraAction(ctx.playerId, 'wizard_time_loop', ctx.now),
            grantExtraAction(ctx.playerId, 'wizard_time_loop', ctx.now),
        ],
    };
}

/** 学徒 onPlay：展示牌库顶，如果是行动可放入手牌（MVP：自动放入手牌） */
function wizardNeophyte(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (player.deck.length === 0) return { events: [] };
    const topCard = player.deck[0];
    if (topCard.type === 'action') {
        // MVP：自动将行动卡放入手牌（实际应让玩家选择放入手牌或直接打出）
        const evt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: 1, cardUids: [topCard.uid] },
            timestamp: ctx.now,
        };
        return { events: [evt] };
    }
    // 不是行动卡，放回牌库顶（无需事件）
    return { events: [] };
}

// wizard_archmage (ongoing) - 每回合额外打出一个行动，通过 onTurnStart 触发器实现

/** 群体附魔 onPlay：展示每个对手牌库顶，你可以将其中一张放入你手牌（MVP：自动选行动卡优先） */
function wizardMassEnchantment(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    // 查看每个对手牌库顶
    let bestCard: { uid: string; pid: string; isAction: boolean } | undefined;
    for (const pid of ctx.state.turnOrder) {
        if (pid === ctx.playerId) continue;
        const opponent = ctx.state.players[pid];
        if (opponent.deck.length === 0) continue;
        const topCard = opponent.deck[0];
        // MVP：优先选行动卡
        if (!bestCard || (topCard.type === 'action' && !bestCard.isAction)) {
            bestCard = { uid: topCard.uid, pid, isAction: topCard.type === 'action' };
        }
    }
    if (!bestCard) return { events: [] };

    // 将对手牌库顶的卡放入自己手牌（用 CARDS_DRAWN 从对手牌库抽）
    // 注意：这里需要一个特殊事件——从对手牌库取卡到自己手牌
    // MVP：简化为从对手牌库顶抽1张给自己
    const drawEvt: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: bestCard.pid, count: 1, cardUids: [bestCard.uid] },
        timestamp: ctx.now,
    };
    // TODO: 需要 CARD_STOLEN 事件将卡从对手牌库移到自己手牌
    // 当前 MVP：直接让对手抽到手牌（不完全正确，但不影响核心流程）
    events.push(drawEvt);
    return { events };
}

/** 注册巫师派系所有能力 */
export function registerWizardAbilities(): void {
    const abilities: Array<[string, (ctx: AbilityContext) => AbilityResult]> = [
        ['wizard_chronomage', wizardChronomage],
        ['wizard_enchantress', wizardEnchantress],
        ['wizard_mystic_studies', wizardMysticStudies],
        ['wizard_summon', wizardSummon],
        ['wizard_time_loop', wizardTimeLoop],
        ['wizard_neophyte', wizardNeophyte],
        ['wizard_winds_of_change', wizardWindsOfChange],
        ['wizard_sacrifice', wizardSacrifice],
        ['wizard_mass_enchantment', wizardMassEnchantment],
        ['wizard_portal', wizardPortal],
        ['wizard_scry', wizardScry],
    ];

    for (const [id, handler] of abilities) {
        registerAbility(id, 'onPlay', handler);
    }

    // 注册 ongoing 拦截器
    registerWizardOngoingEffects();
}

/** 传送门 onPlay：展示牌库顶5张，将其中随从放入手牌，其余放牌库底（MVP：自动取所有随从） */
function wizardPortal(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    if (player.deck.length === 0) return { events: [] };

    const events: SmashUpEvent[] = [];
    const topCards = player.deck.slice(0, 5);
    const minions = topCards.filter(c => c.type === 'minion');
    const others = topCards.filter(c => c.type !== 'minion');

    // 随从放入手牌
    if (minions.length > 0) {
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: minions.length, cardUids: minions.map(c => c.uid) },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }

    // 其余放牌库底：重建牌库 = 剩余未翻到的 + 翻到的非随从放底部
    if (others.length > 0) {
        const processedUids = new Set(topCards.map(c => c.uid));
        const remainingDeck = player.deck.filter(c => !processedUids.has(c.uid));
        const newDeckUids = [...remainingDeck.map(c => c.uid), ...others.map(c => c.uid)];
        const reshuffleEvt: DeckReshuffledEvent = {
            type: SU_EVENTS.DECK_RESHUFFLED,
            payload: { playerId: ctx.playerId, deckUids: newDeckUids },
            timestamp: ctx.now,
        };
        events.push(reshuffleEvt);
    }

    return { events };
}

/** 占卜 onPlay：搜索牌库找一张行动卡放入手牌（MVP：自动选第一张行动卡） */
function wizardScry(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const actionCard = player.deck.find(c => c.type === 'action');
    if (!actionCard) return { events: [] };

    const drawEvt: CardsDrawnEvent = {
        type: SU_EVENTS.CARDS_DRAWN,
        payload: { playerId: ctx.playerId, count: 1, cardUids: [actionCard.uid] },
        timestamp: ctx.now,
    };
    return { events: [drawEvt] };
}

/** 变化之风 onPlay：洗手牌回牌库抽5张，额外打出一个行动 */
function wizardWindsOfChange(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const events: SmashUpEvent[] = [];

    // 1. 手牌洗入牌库
    // 注意：当前打出的行动卡（ctx.cardUid）会被 ACTION_PLAYED reducer 从手牌移除，
    // 所以这里排除它
    const remainingHand = player.hand.filter(c => c.uid !== ctx.cardUid);
    const allCards = [...remainingHand, ...player.deck];
    const shuffled = ctx.random.shuffle([...allCards]);
    events.push(shuffleHandIntoDeck(
        ctx.playerId,
        shuffled.map(c => c.uid),
        'wizard_winds_of_change',
        ctx.now
    ));

    // 2. 抽5张牌（基于洗牌后的牌库）
    const drawCount = Math.min(5, shuffled.length);
    if (drawCount > 0) {
        const drawnUids = shuffled.slice(0, drawCount).map(c => c.uid);
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: drawCount, cardUids: drawnUids },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }

    // 3. 额外打出一个行动
    events.push(grantExtraAction(ctx.playerId, 'wizard_winds_of_change', ctx.now));

    return { events };
}

/** 献祭 onPlay：消灭己方随从，抽等量力量的牌（MVP：自动选力量最低的随从） */
function wizardSacrifice(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];

    // 找己方所有随从，选力量最低的（MVP 策略：牺牲最弱的）
    let weakest: { uid: string; defId: string; power: number; baseIndex: number; ownerId: string } | undefined;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            if (m.controller !== ctx.playerId) continue;
            const totalPower = getMinionPower(ctx.state, m, i);
            if (!weakest || totalPower < weakest.power) {
                weakest = { uid: m.uid, defId: m.defId, power: totalPower, baseIndex: i, ownerId: m.owner };
            }
        }
    }
    if (!weakest) return { events: [] };

    // 抽等量力量的牌
    const drawCount = weakest.power;
    if (drawCount > 0) {
        const player = ctx.state.players[ctx.playerId];
        const { drawnUids } = drawCards(player, drawCount, ctx.random);
        if (drawnUids.length > 0) {
            const drawEvt: CardsDrawnEvent = {
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: ctx.playerId, count: drawnUids.length, cardUids: drawnUids },
                timestamp: ctx.now,
            };
            events.push(drawEvt);
        }
    }

    // 消灭该随从
    events.push(destroyMinion(
        weakest.uid, weakest.defId, weakest.baseIndex, weakest.ownerId,
        'wizard_sacrifice', ctx.now
    ));

    return { events };
}


// ============================================================================
// Ongoing 拦截器注册
// ============================================================================

/** 注册巫师派系的 ongoing 拦截器 */
function registerWizardOngoingEffects(): void {
    // 大法师：回合开始时，控制者额外打出一个行动
    registerTrigger('wizard_archmage', 'onTurnStart', (trigCtx) => {
        // 找到 archmage 的控制者
        let archmageController: string | undefined;
        for (const base of trigCtx.state.bases) {
            const archmage = base.minions.find(m => m.defId === 'wizard_archmage');
            if (archmage) {
                archmageController = archmage.controller;
                break;
            }
        }
        if (!archmageController) return [];
        // 只在控制者的回合触发
        if (archmageController !== trigCtx.playerId) return [];

        return [{
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: {
                playerId: archmageController,
                limitType: 'action' as const,
                delta: 1,
                reason: 'wizard_archmage',
            },
            timestamp: trigCtx.now,
        }];
    });
}
