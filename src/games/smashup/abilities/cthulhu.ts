/**
 * 大杀四方 - 克苏鲁之仆派系能力
 *
 * 主题：疯狂卡操控、弃牌堆回收、额外行动
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import { SU_EVENTS } from '../domain/types';
import { MADNESS_CARD_DEF_ID } from '../domain/types';
import type {
    SmashUpEvent,
    CardsDrawnEvent,
    VpAwardedEvent,
    MinionCardDef,
    CardToDeckBottomEvent,
    BaseClearedEvent,
    BaseReplacedEvent,
} from '../domain/types';
import { getCardDef, getBaseDef } from '../data/cards';
import {
    drawMadnessCards, grantExtraAction, destroyMinion,
    returnMadnessCard, getMinionPower, buildMinionTargetOptions,
    addPowerCounter, addTempPower, revealAndPickFromDeck,
    buildAbilityFeedback,
} from '../domain/abilityHelpers';
import { registerTrigger } from '../domain/ongoingEffects';
import type { TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';
import { getPlayerLabel } from '../domain/utils';

/** 注册克苏鲁之仆派系所有能力*/
export function registerCthulhuAbilities(): void {
    // 强制招募（行动卡）：弃牌堆力量≤3随从放牌库顶
    registerAbility('cthulhu_recruit_by_force', 'onPlay', cthulhuRecruitByForce);
    // 再次降临（行动卡）：弃牌堆行动卡洗回牌库
    registerAbility('cthulhu_it_begins_again', 'onPlay', cthulhuItBeginsAgain);
    // 克苏鲁的馈赠（行动卡）：从牌库顶?张行动卡放入手牌
    registerAbility('cthulhu_fhtagn', 'onPlay', cthulhuFhtagn);
    // 暗中低语（行动卡）：?张疯狂卡 + 2个额外行动
    registerAbility('cthulhu_whispers_in_darkness', 'onPlay', cthulhuWhispersInDarkness);
    // 测言已破（行动卡）：?张疯狂卡 + 1VP
    registerAbility('cthulhu_seal_is_broken', 'onPlay', cthulhuSealIsBroken);
    // 疯狂卡?onPlay：抽2张卡 ?返回疯狂牌堆
    registerAbility('special_madness', 'onPlay', madnessOnPlay);
    // 腐化（行动卡）：?张疯狂卡 + 消灭一个随从（MVP：自动选最弱对手随从）
    registerAbility('cthulhu_corruption', 'onPlay', cthulhuCorruption);
    // 疯狂释放（行动卡）：弃任意数量疯狂卡，每?= ??+ 额外行动
    registerAbility('cthulhu_madness_unleashed', 'onPlay', cthulhuMadnessUnleashed);
    // 星之眷族（随从talent）：将手中疯狂卡转给对手
    registerAbility('cthulhu_star_spawn', 'talent', cthulhuStarSpawn);
    // 仆人（随从talent）：消灭自身 + 弃牌堆行动卡放牌库顶
    registerAbility('cthulhu_servitor', 'talent', cthulhuServitor);

    // === ongoing 效果注册 ===
    // 克苏鲁祭坛：打出随从时额外打出一张战术?
    registerTrigger('cthulhu_altar', 'onMinionPlayed', cthulhuAltarTrigger);
    // 深化目标：回合结束时条件获VP
    registerTrigger('cthulhu_furthering_the_cause', 'onTurnEnd', cthulhuFurtheringTheCauseTrigger);
    // 天选之人：基地计分前抽疑狂卡?2力量
    registerTrigger('cthulhu_chosen', 'beforeScoring', cthulhuChosenBeforeScoring);
    // 完成仪式：回合开始时清场并换基地
    registerTrigger('cthulhu_complete_the_ritual', 'onTurnStart', cthulhuCompleteTheRitualTrigger);
}

/** 强制招募 onPlay：将弃牌堆中力量≤3的随从放到牌库顶（玩家选择任意数量） */
function cthulhuRecruitByForce(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];

    // 从弃牌堆找力量≤3的随从
    const eligibleMinions = player.discard.filter(c => {
        if (c.type !== 'minion') return false;
        const def = getCardDef(c.defId);
        return def && def.type === 'minion' && (def as MinionCardDef).power <= 3;
    });

    if (eligibleMinions.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };

    // 创建多选交互让玩家选择任意数量
    const options = eligibleMinions.map((c, i) => {
        const def = getCardDef(c.defId) as MinionCardDef | undefined;
        const name = def?.name ?? c.defId;
        const power = def?.power ?? 0;
        return { id: `minion-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, minionDefId: c.defId }, _source: 'discard' as const };
    });
    const interaction = createSimpleChoice(
        `cthulhu_recruit_by_force_${ctx.now}`, ctx.playerId,
        '选择要放到牌库顶的随从（任意数量，可跳过）', [...options, { id: 'skip', label: '跳过', value: { skip: true } }] as any[],
        { sourceId: 'cthulhu_recruit_by_force', multi: { min: 0, max: eligibleMinions.length } },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 再次降临 onPlay：将弃牌堆中任意数量的行动卡洗回牌库（MVP：全部洗回） */
function cthulhuItBeginsAgain(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const actionsInDiscard = player.discard.filter(c => c.type === 'action');
    if (actionsInDiscard.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.discard_empty', ctx.now)] };

    // "任意数量的战术"：玩家选择要洗回牌库的行动卡（min:0 允许不选）
    const options = actionsInDiscard.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `action-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId }, _source: 'discard' as const };
    });
    const interaction = createSimpleChoice(
        `cthulhu_it_begins_again_${ctx.now}`, ctx.playerId,
        '选择要洗回牌库的战术（任意数量，可跳过）', [...options, { id: 'skip', label: '跳过', value: { skip: true } }],
        { sourceId: 'cthulhu_it_begins_again', multi: { min: 0, max: actionsInDiscard.length } },
    );
    // 手动提供 optionsGenerator：从弃牌堆过滤行动卡（保留 skip 选项）
    (interaction.data as any).optionsGenerator = (state: any) => {
        const p = state.core.players[ctx.playerId];
        const actions = p.discard.filter((c: any) => c.type === 'action');
        const opts = actions.map((c: any, i: number) => {
            const def = getCardDef(c.defId);
            const name = def?.name ?? c.defId;
            return { id: `action-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId } };
        });
        return [...opts, { id: 'skip', label: '跳过', value: { skip: true } }];
    };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 克苏鲁的馈赠 onPlay：从牌库顶搜索直到找到2张行动卡，放入手牌，其余放牌库底 */
function cthulhuFhtagn(ctx: AbilityContext): AbilityResult {
    const { events } = revealAndPickFromDeck({
        player: ctx.state.players[ctx.playerId],
        playerId: ctx.playerId,
        predicate: card => card.type === 'action',
        maxPick: 2,
        revealTo: 'all', // 规则："依次展示卡牌"，公开给所有人看
        reason: 'cthulhu_fhtagn',
        now: ctx.now,
    });
    return { events };
}

/** 暗中低语 onPlay：抽1张疯狂卡 + 获得2个额外行动*/
function cthulhuWhispersInDarkness(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'cthulhu_whispers_in_darkness', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    events.push(grantExtraAction(ctx.playerId, 'cthulhu_whispers_in_darkness', ctx.now));
    events.push(grantExtraAction(ctx.playerId, 'cthulhu_whispers_in_darkness', ctx.now));
    return { events };
}

/** 封印已破 onPlay：抽1张疯狂卡 + 获得1VP */
function cthulhuSealIsBroken(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'cthulhu_seal_is_broken', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    const vpEvt: VpAwardedEvent = {
        type: SU_EVENTS.VP_AWARDED,
        payload: { playerId: ctx.playerId, amount: 1, reason: 'cthulhu_seal_is_broken' },
        timestamp: ctx.now,
    };
    events.push(vpEvt);
    return { events };
}

/** 腐化 onPlay：抽1张疯狂卡 + 消灭一个随从*/
function cthulhuCorruption(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const madnessEvt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'cthulhu_corruption', ctx.now);
    if (madnessEvt) events.push(madnessEvt);
    // 收集所有对手随从
    const targets: { uid: string; defId: string; baseIndex: number; ownerId: string; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            // 可以选择任意玩家的随从（包括己方）
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const power = getMinionPower(ctx.state, m, i);
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            targets.push({ uid: m.uid, defId: m.defId, baseIndex: i, ownerId: m.owner, label: `${name} (力量 ${power}) @ ${baseName}` });
        }
    }
    if (targets.length === 0) return { events };
    // Prompt 选择
    const options = targets.map(t => ({ uid: t.uid, defId: t.defId, baseIndex: t.baseIndex, label: t.label }));
    const interaction = createSimpleChoice(
        `cthulhu_corruption_${ctx.now}`, ctx.playerId,
        '选择要消灭的随从',
        buildMinionTargetOptions(options, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
        { sourceId: 'cthulhu_corruption', targetType: 'minion' },
    );
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 疑狂释放 onPlay：弃掉手中任意数量的疑狂卡，每张 = ?张牌 + 额外行动
 * 
 * - 无疑狂卡时无效果
 * - 只有1张疑狂卡时自动弃掉?
 * - 多张疑狂卡时创建 Prompt 让玩家选择弃几张（多选，最?张）
 */
function cthulhuMadnessUnleashed(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    // 排除当前打出的卡，找手中的疑狂卡
    const madnessInHand = player.hand.filter(
        c => c.defId === MADNESS_CARD_DEF_ID && c.uid !== ctx.cardUid
    );
    if (madnessInHand.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };

    // Prompt 选择弃几?
    const options = madnessInHand.map((c, i) => ({
        id: `madness-${i}`,
        label: `疑狂卡?${i + 1}`,
        value: { cardUid: c.uid, defId: c.defId },
    }));
    const interaction = createSimpleChoice(
        `cthulhu_madness_unleashed_${ctx.now}`, ctx.playerId,
        '选择要弃掉的疑狂卡（任意数量，可跳过）', [...options, { id: 'skip', label: '跳过', value: { skip: true } }] as any[],
        { sourceId: 'cthulhu_madness_unleashed', multi: { min: 0, max: madnessInHand.length } },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/** 弃疯狂卡并抽牌?额外行动（辅助函数） */
function discardMadnessAndDraw(
    ctx: AbilityContext,
    madnessUids: string[]
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];

    // 返回疯狂卡到疯狂牌库
    for (const uid of madnessUids) {
        events.push(returnMadnessCard(ctx.playerId, uid, 'cthulhu_madness_unleashed', ctx.now));
    }

    // 每张疯狂卡?= ?张牌 + 1个额外行动
    const drawCount = Math.min(madnessUids.length, player.deck.length);
    if (drawCount > 0) {
        const drawnUids = player.deck.slice(0, drawCount).map(c => c.uid);
        const drawEvt: CardsDrawnEvent = {
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId: ctx.playerId, count: drawCount, cardUids: drawnUids },
            timestamp: ctx.now,
        };
        events.push(drawEvt);
    }
    for (let i = 0; i < madnessUids.length; i++) {
        events.push(grantExtraAction(ctx.playerId, 'cthulhu_madness_unleashed', ctx.now));
    }
    return events;
}

// ============================================================================
// 完成仪式 ongoing 触发器?
// ============================================================================

/**
 * 完成仪式 onTurnStart：拥有者回合开始时?
 * 将基地上所有随从和战术放回拥有者牌库底?
 * 然后将基地与基地牌库顶的卡交?
 */
function cthulhuCompleteTheRitualTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        const ritual = base.ongoingActions.find(
            a => a.defId === 'cthulhu_complete_the_ritual' && a.ownerId === ctx.playerId
        );
        if (!ritual) continue;

        // 1. 将所有随从放回拥有者牌库底
        for (const m of base.minions) {
            events.push({
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: m.uid,
                    defId: m.defId,
                    ownerId: m.owner,
                    reason: 'cthulhu_complete_the_ritual',
                },
                timestamp: ctx.now,
            } as CardToDeckBottomEvent);
        }

        // 2. 将所?ongoing 行动卡放回拥有者牌库底（包括仪式本身）
        for (const ongoing of base.ongoingActions) {
            events.push({
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: ongoing.uid,
                    defId: ongoing.defId,
                    ownerId: ongoing.ownerId,
                    reason: 'cthulhu_complete_the_ritual',
                },
                timestamp: ctx.now,
            } as CardToDeckBottomEvent);
        }

        // 3. 移除旧基地（BASE_CLEARED 清除基地上的随从/ongoing 并移除基地）
        events.push({
            type: SU_EVENTS.BASE_CLEARED,
            payload: { baseIndex: i, baseDefId: base.defId },
            timestamp: ctx.now,
        } as BaseClearedEvent);

        // 4. 插入新基地（从基地牌库顶?
        if (ctx.state.baseDeck.length > 0) {
            events.push({
                type: SU_EVENTS.BASE_REPLACED,
                payload: {
                    baseIndex: i,
                    oldBaseDefId: base.defId,
                    newBaseDefId: ctx.state.baseDeck[0],
                },
                timestamp: ctx.now,
            } as BaseReplacedEvent);
        }

        // 只处理第一个找到的仪式（卡片只有?张）
        break;
    }
    return events;
}

/**
 * 天选之人 beforeScoring：你可以抽一张疯狂卡，该随从获得+2力量直到回合结束。
 * 
 * 规则：任何基地计分前都可触发（不限于所在基地），每次计分每个天选之人只触发一次。
 * 描述含"你可以"：需要玩家确认是否触发（抽疯狂卡是代价）。
 */
function cthulhuChosenBeforeScoring(ctx: TriggerContext): TriggerResult {
    if (ctx.baseIndex === undefined) return { events: [] };

    // 收集所有基地上的天选之人
    const chosenList: { uid: string; controller: string; baseIndex: number }[] = [];
    for (let bi = 0; bi < ctx.state.bases.length; bi++) {
        const base = ctx.state.bases[bi];
        for (const m of base.minions) {
            if (m.defId !== 'cthulhu_chosen') continue;
            chosenList.push({ uid: m.uid, controller: m.controller, baseIndex: bi });
        }
    }
    if (chosenList.length === 0) return { events: [] };

    // 无 matchState 时回退自动执行
    if (!ctx.matchState) {
        const events: SmashUpEvent[] = [];
        for (const c of chosenList) {
            const madnessEvt = drawMadnessCards(c.controller, 1, ctx.state, 'cthulhu_chosen', ctx.now);
            if (madnessEvt) events.push(madnessEvt);
            events.push(addTempPower(c.uid, c.baseIndex, 2, 'cthulhu_chosen', ctx.now));
        }
        return { events };
    }

    // 链式处理：为第一个天选之人创建确认交互
    const first = chosenList[0];
    const remaining = chosenList.slice(1);
    
    const interaction = createSimpleChoice(
        `cthulhu_chosen_confirm_${ctx.now}`, first.controller,
        '神选者：是否抽一张疯狂卡来获得+2力量？',
        [
            { id: 'yes', label: '是（抽疯狂卡，+2力量）', value: { activate: true, uid: first.uid, baseIndex: first.baseIndex, controller: first.controller }, displayMode: 'button' as const, baseDefId: ctx.state.bases[first.baseIndex]?.defId },
            { id: 'no', label: '否（不触发）', value: { activate: false }, displayMode: 'button' as const, baseDefId: ctx.state.bases[first.baseIndex]?.defId },
        ],
        'cthulhu_chosen_confirm'
        );
    const ms = queueInteraction(ctx.matchState, {
        ...interaction,
        data: { ...interaction.data, continuationContext: { remaining } },
    });
    return { events: [], matchState: ms };
}

// ============================================================================
// ongoing 效果触发器?
// ============================================================================

/** 克苏鲁祭坛触发：打出随从时额外打出一张战术?*/
function cthulhuAltarTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const baseIndex = ctx.baseIndex;
    if (baseIndex === undefined) return events;
    const base = ctx.state.bases[baseIndex];
    if (!base) return events;
    for (const ongoing of base.ongoingActions) {
        if (ongoing.defId !== 'cthulhu_altar') continue;
        if (ongoing.ownerId !== ctx.playerId) continue;
        events.push(grantExtraAction(ctx.playerId, 'cthulhu_altar', ctx.now));
    }
    return events;
}

/** 深化目标触发：回合结束时检查本回合是否有对手随从在此基地被消灭，若是则获得 1VP */
function cthulhuFurtheringTheCauseTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    const destroyed = ctx.state.turnDestroyedMinions ?? [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const ongoing of base.ongoingActions) {
            if (ongoing.defId !== 'cthulhu_furthering_the_cause') continue;
            // 检查本回合是否有对手随从在此基地被消灭
            const hasDestroyedOpponent = destroyed.some(
                d => d.baseIndex === i && d.owner !== ongoing.ownerId
            );
            if (hasDestroyedOpponent) {
                events.push({
                    type: SU_EVENTS.VP_AWARDED,
                    payload: { playerId: ongoing.ownerId, amount: 1, reason: 'cthulhu_furthering_the_cause' },
                    timestamp: ctx.now,
                } as VpAwardedEvent);
            }
        }
    }
    return events;
}

/** 疯狂卡?onPlay：抽2张卡 ?将本卡返回疯狂牌堆（2? Prompt?*/
function madnessOnPlay(ctx: AbilityContext): AbilityResult {
    const options = [
        { id: 'draw', label: '抽两张卡', value: { action: 'draw' } },
        { id: 'return', label: '返回疯狂牌堆', value: { action: 'return' } },
    ];
    const interaction = createSimpleChoice(
        `special_madness_${ctx.now}`, ctx.playerId,
        '疯狂卡：选择一个效果', options as any[], 'special_madness',
    );
    (interaction.data as any).continuationContext = { cardUid: ctx.cardUid };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 星之眷族 talent：将手中一张疯狂卡转给另一个玩家
 * 
 * 手中无疯狂卡时无效果
 * 创建 Prompt 让玩家选择目标玩家，可以取消
 */
function cthulhuStarSpawn(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const madnessInHand = player.hand.filter(c => c.defId === MADNESS_CARD_DEF_ID);
    if (madnessInHand.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.hand_empty', ctx.now)] };

    const opponents = ctx.state.turnOrder.filter(pid => pid !== ctx.playerId);
    if (opponents.length === 0) return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_valid_targets', ctx.now)] };

    const madnessCard = madnessInHand[0];

    // 使用 autoCancelOption 自动添加取消选项
    const options = opponents.map((pid, i) => ({
        id: `player-${i}`,
        label: getPlayerLabel(pid),
        value: { targetPlayerId: pid, madnessUid: madnessCard.uid },
    }));
    
    const interaction = createSimpleChoice(
        `cthulhu_star_spawn_${ctx.now}`, ctx.playerId,
        '选择要给予疯狂卡的玩家', options as any[],
        { sourceId: 'cthulhu_star_spawn', autoCancelOption: true },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 仆人 talent：消灭自身，从弃牌堆选一张行动卡放到牌库底
 * 
 * 弃牌堆无行动卡时仍消灭自身（天赋效果"?消灭本卡"?.."，消灭是前置条件）?
 * 只有1张时自动选择，多张时创建 Prompt
 */
function cthulhuServitor(ctx: AbilityContext): AbilityResult {
    const events: SmashUpEvent[] = [];
    const player = ctx.state.players[ctx.playerId];

    // 消灭自身
    events.push(destroyMinion(
        ctx.cardUid, ctx.defId, ctx.baseIndex, ctx.playerId, undefined, 'cthulhu_servitor', ctx.now
    ));

    // 从弃牌堆找行动卡
    const actionsInDiscard = player.discard.filter(c => c.type === 'action');
    if (actionsInDiscard.length === 0) return { events };

    // Prompt 选择
    const options = actionsInDiscard.map((c, i) => {
        const def = getCardDef(c.defId);
        const name = def?.name ?? c.defId;
        return { id: `action-${i}`, label: name, value: { cardUid: c.uid, defId: c.defId }, _source: 'discard' as const };
    });
    const interaction = createSimpleChoice(
        `cthulhu_servitor_${ctx.now}`, ctx.playerId,
        '选择放回牌库顶的行动卡', options as any[], 'cthulhu_servitor',
    );
    return { events, matchState: queueInteraction(ctx.matchState, interaction) };
}

// Prompt 继续函数
// ============================================================================

/** 注册克苏鲁之仆派系的交互解决处理函数 */
export function registerCthulhuInteractionHandlers(): void {
    // 重新开始：玩家选择任意数量的行动卡洗回牌库
    registerInteractionHandler('cthulhu_it_begins_again', (state, playerId, value, _iData, random, timestamp) => {
        const selectedCards = Array.isArray(value) ? value : (value ? [value] : []);
        if (selectedCards.length === 0) return { state, events: [] };
        const cardUids = selectedCards.map((v: any) => v.cardUid).filter(Boolean) as string[];
        if (cardUids.length === 0) return { state, events: [] };
        const player = state.core.players[playerId];
        const selectedUidSet = new Set(cardUids);
        const actionsFromDiscard = player.discard.filter(c => selectedUidSet.has(c.uid));
        const newDeck = [...player.deck, ...actionsFromDiscard];
        const shuffled = random.shuffle([...newDeck]);
        return { state, events: [{
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: shuffled.map(c => c.uid) },
            timestamp,
        }] };
    });

    registerInteractionHandler('cthulhu_corruption', (state, _playerId, value, _iData, _random, timestamp) => {
        const { minionUid, baseIndex } = value as { minionUid: string; baseIndex: number };
        const base = state.core.bases[baseIndex];
        if (!base) return { state, events: [] };
        const target = base.minions.find(m => m.uid === minionUid);
        if (!target) return { state, events: [] };
        return { state, events: [destroyMinion(target.uid, target.defId, baseIndex, target.owner, playerId, 'cthulhu_corruption', timestamp)] };
    });

    registerInteractionHandler('cthulhu_servitor', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as { cardUid: string };
        const player = state.core.players[playerId];
        if (!player) return { state, events: [] };
        const actionCard = player.discard.find(c => c.uid === cardUid);
        if (!actionCard) return { state, events: [] };
        // DECK_REORDERED：将弃牌堆中的行动卡放到牌库顶，reducer 会自动从弃牌堆移除
        const newDeckUids = [actionCard.uid, ...player.deck.map(c => c.uid)];
        return { state, events: [{
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: newDeckUids },
            timestamp,
        }] };
    });

    registerInteractionHandler('cthulhu_star_spawn', (state, playerId, value, _iData, _random, timestamp) => {
        // 检查是否取消（框架自动添加的取消选项）
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { targetPlayerId, madnessUid } = value as { targetPlayerId?: string; madnessUid?: string };
        
        // 正常执行：转移疯狂卡
        if (!targetPlayerId || !madnessUid) return { state, events: [] };
        
        const events: SmashUpEvent[] = [];
        events.push(returnMadnessCard(playerId, madnessUid, 'cthulhu_star_spawn', timestamp));
        const drawEvt = drawMadnessCards(targetPlayerId, 1, state.core, 'cthulhu_star_spawn', timestamp);
        if (drawEvt) events.push(drawEvt);
        return { state, events };
    });

    registerInteractionHandler('special_madness', (state, playerId, value, iData, _random, timestamp) => {
        const { action } = value as { action: 'draw' | 'return' };
        const ctx = (iData as any)?.continuationContext as { cardUid: string };
        if (!ctx) return { state, events: [] };
        if (action === 'return') {
            return { state, events: [returnMadnessCard(playerId, ctx.cardUid, 'special_madness', timestamp)] };
        }
        const player = state.core.players[playerId];
        const drawCount = Math.min(2, player.deck.length);
        if (drawCount === 0) return { state, events: [] };
        const drawnUids = player.deck.slice(0, drawCount).map(c => c.uid);
        return { state, events: [{
            type: SU_EVENTS.CARDS_DRAWN,
            payload: { playerId, count: drawCount, cardUids: drawnUids },
            timestamp,
        } as CardsDrawnEvent] };
    });

    // 强制招募：玩家选择任意数量的随从放到牌库顶
    registerInteractionHandler('cthulhu_recruit_by_force', (state, playerId, value, _iData, _random, timestamp) => {
        const selectedCards = Array.isArray(value) ? value : (value ? [value] : []);
        if (selectedCards.length === 0) return { state, events: [] };
        const cardUids = selectedCards.map((v: any) => v.cardUid).filter(Boolean) as string[];
        if (cardUids.length === 0) return { state, events: [] };
        const player = state.core.players[playerId];
        // 从弃牌堆取出选中的卡放到牌库顶
        const selectedFromDiscard = cardUids
            .map(uid => player.discard.find(c => c.uid === uid))
            .filter(Boolean);
        // DECK_REORDERED：选中的弃牌堆卡放牌库顶，reducer 会自动从弃牌堆移除
        const newDeck = [...selectedFromDiscard, ...player.deck];
        return { state, events: [{
            type: SU_EVENTS.DECK_REORDERED,
            payload: { playerId, deckUids: newDeck.map(c => c!.uid) },
            timestamp,
        }] };
    });

    registerInteractionHandler('cthulhu_madness_unleashed', (state, playerId, value, _iData, _random, timestamp) => {
        const selectedCards = value as Array<{ cardUid: string }>;
        if (!Array.isArray(selectedCards) || selectedCards.length === 0) return { state, events: [] };
        const madnessUids = selectedCards.map(v => v.cardUid).filter(Boolean) as string[];
        if (madnessUids.length === 0) return { state, events: [] };
        const events: SmashUpEvent[] = [];
        const player = state.core.players[playerId];
        for (const uid of madnessUids) {
            events.push(returnMadnessCard(playerId, uid, 'cthulhu_madness_unleashed', timestamp));
        }
        const drawCount = Math.min(madnessUids.length, player.deck.length);
        if (drawCount > 0) {
            const drawnUids = player.deck.slice(0, drawCount).map(c => c.uid);
            events.push({ type: SU_EVENTS.CARDS_DRAWN, payload: { playerId, count: drawCount, cardUids: drawnUids }, timestamp } as CardsDrawnEvent);
        }
        for (let i = 0; i < madnessUids.length; i++) {
            events.push(grantExtraAction(playerId, 'cthulhu_madness_unleashed', timestamp));
        }
        return { state, events };
    });

    // 天选之人确认：玩家选择是否触发（链式处理多个天选之人）
    registerInteractionHandler('cthulhu_chosen_confirm', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { activate: boolean; uid?: string; baseIndex?: number; controller?: string };
        const events: SmashUpEvent[] = [];

        if (selected.activate && selected.uid && selected.baseIndex !== undefined && selected.controller) {
            // 抽一张疯狂卡
            const madnessEvt = drawMadnessCards(selected.controller, 1, state.core, 'cthulhu_chosen', timestamp);
            if (madnessEvt) events.push(madnessEvt);
            // +2 临时力量
            events.push(addTempPower(selected.uid, selected.baseIndex, 2, 'cthulhu_chosen', timestamp));
        }

        // 检查是否有剩余天选之人需要处理
        const ctx = iData?.continuationContext as { remaining?: { uid: string; controller: string; baseIndex: number }[] } | undefined;
        const remaining = ctx?.remaining ?? [];
        if (remaining.length > 0) {
            const next = remaining[0];
            const rest = remaining.slice(1);
            
            const interaction = createSimpleChoice(
                `cthulhu_chosen_confirm_${timestamp}`, next.controller,
                '神选者：是否抽一张疯狂卡来获得+2力量？',
                [
                    { id: 'yes', label: '是（抽疯狂卡，+2力量）', value: { activate: true, uid: next.uid, baseIndex: next.baseIndex, controller: next.controller }, displayMode: 'button' as const, baseDefId: state.core.bases[next.baseIndex]?.defId },
                    { id: 'no', label: '否（不触发）', value: { activate: false }, displayMode: 'button' as const, baseDefId: state.core.bases[next.baseIndex]?.defId },
                ],
                'cthulhu_chosen_confirm'
                );
            return {
                state: queueInteraction(state, {
                    ...interaction,
                    data: { ...interaction.data, continuationContext: { remaining: rest } },
                }),
                events,
            };
        }

        return { state, events };
    });
}
