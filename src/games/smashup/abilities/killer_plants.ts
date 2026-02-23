/**
 * 大杀四方 - 食人花派系能力
 *
 * 主题：额外出随从、搜索牌库、力量修正
 */

import { registerAbility } from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult } from '../domain/abilityRegistry';
import {
    grantExtraMinion, destroyMinion,
    buildMinionTargetOptions, buildAbilityFeedback,
} from '../domain/abilityHelpers';
import { SU_EVENTS } from '../domain/types';
import type {
    SmashUpEvent, CardsDrawnEvent,
    DeckReorderedEvent, MinionCardDef, OngoingDetachedEvent,
    MinionPlayedEvent, BreakpointModifiedEvent,
} from '../domain/types';
import { registerProtection, registerTrigger } from '../domain/ongoingEffects';
import type { ProtectionCheckContext, TriggerContext, TriggerResult } from '../domain/ongoingEffects';
import { getCardDef, getMinionDef, getBaseDef } from '../data/cards';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from '../domain/abilityInteractionHandlers';

/** 急速生长?onPlay：额外打出一个随从*/
function killerPlantInstaGrow(ctx: AbilityContext): AbilityResult {
    return { events: [grantExtraMinion(ctx.playerId, 'killer_plant_insta_grow', ctx.now)] };
}

/** 野生食人花 onPlay：打出回合 -2 力量（回合结束自动清零） */
function killerPlantWeedEater(ctx: AbilityContext): AbilityResult {
    // 使用临时力量修正（tempPowerModifier），回合结束时 TURN_STARTED 自动清零
    const evt: SmashUpEvent = {
        type: SU_EVENTS.TEMP_POWER_ADDED,
        payload: {
            minionUid: ctx.cardUid,
            baseIndex: ctx.baseIndex,
            amount: -2,
            reason: 'killer_plant_weed_eater',
        },
        timestamp: ctx.now,
    };
    return { events: [evt] };
}

// killer_plant_sleep_spores (ongoing) ?已通过 ongoingModifiers 系统实现力量修正?1力量的
// killer_plant_overgrowth (ongoing) ?已通过 ongoingModifiers 系统实现临界点修正
// killer_plant_entangled (ongoing) ?已通过 ongoingEffects 保护 + 触发系统实现

// ============================================================================
// ongoing 效果检查器
// ============================================================================

/**
 * deep_roots 保护检查：此基地上）?deep_roots 且目标随从属?deep_roots 拥有者时?
 * 不收回可被其他玩家移动或返回手牌
 */
function killerPlantDeepRootsChecker(ctx: ProtectionCheckContext): boolean {
    const base = ctx.state.bases[ctx.targetBaseIndex];
    if (!base) return false;
    const deepRoots = base.ongoingActions.find(a => a.defId === 'killer_plant_deep_roots');
    if (!deepRoots) return false;
    // 只保护?deep_roots 拥有者的随从，且只拦截对手的效果
    return deepRoots.ownerId === ctx.targetMinion.controller
        && ctx.sourcePlayerId !== ctx.targetMinion.controller;
}

/**
 * water_lily 触发：回合开始时控制者抽1?
 */
function killerPlantWaterLilyTrigger(ctx: TriggerContext): SmashUpEvent[] {
    // 规则：每回合只能使用一次浇花睡莲的能力（多张在场也只触发一次）
    for (const base of ctx.state.bases) {
        for (const m of base.minions) {
            if (m.defId !== 'killer_plant_water_lily') continue;
            if (m.controller !== ctx.playerId) continue;
            const player = ctx.state.players[m.controller];
            if (!player || player.deck.length === 0) continue;
            const drawnUid = player.deck[0].uid;
            return [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: m.controller, count: 1, cardUids: [drawnUid] },
                timestamp: ctx.now,
            } as CardsDrawnEvent];
        }
    }
    return [];
}



/**
 * sprout 触发：控制者回合开始时消灭自身 + 搜索牌库力量≤3随从打出到此基地
 * 正确流程：消灭自身 + CARDS_DRAWN + grantExtraMinion + MINION_PLAYED(到sprout所在基地) + 洗牌
 * 多候选时创建交互让玩家选择
 */
function killerPlantSproutTrigger(ctx: TriggerContext): TriggerResult {
    const events: SmashUpEvent[] = [];
    let matchState = ctx.matchState;
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            if (m.defId !== 'killer_plant_sprout') continue;
            if (m.controller !== ctx.playerId) continue;
            // 记住 sprout 所在基地索引（消灭前）
            const sproutBaseIndex = i;
            // 消灭自身
            events.push(destroyMinion(m.uid, m.defId, i, m.owner, undefined, 'killer_plant_sprout', ctx.now));
            // 搜索牌库中力量≤3的随从
            const player = ctx.state.players[m.controller];
            if (!player) continue;
            const eligible = player.deck.filter(c => {
                if (c.type !== 'minion') return false;
                const def = getMinionDef(c.defId);
                return def !== undefined && def.power <= 3;
            });
            if (eligible.length === 0) {
                // 牌库中无符合条件的随从，规则仍要求重洗牌库
                events.push(buildDeckReshuffle(player, m.controller, [], ctx.now));
                events.push(buildAbilityFeedback(m.controller, 'feedback.deck_search_no_match', ctx.now));
                continue;
            }
            if (eligible.length === 1) {
                // 只有一个候选，自动选择：直接打出到 sprout 所在基地
                const card = eligible[0];
                const def = getMinionDef(card.defId);
                const power = def?.power ?? 0;
                events.push(
                    { type: SU_EVENTS.CARDS_DRAWN, payload: { playerId: m.controller, count: 1, cardUids: [card.uid] }, timestamp: ctx.now } as CardsDrawnEvent,
                    grantExtraMinion(m.controller, 'killer_plant_sprout', ctx.now),
                );
                const playedEvt: MinionPlayedEvent = {
                    type: SU_EVENTS.MINION_PLAYED,
                    payload: { playerId: m.controller, cardUid: card.uid, defId: card.defId, baseIndex: sproutBaseIndex, power },
                    timestamp: ctx.now,
                };
                events.push(playedEvt);
                events.push(buildDeckReshuffle(player, m.controller, [card.uid], ctx.now));
            } else if (matchState) {
                // 多候选：创建交互让玩家选择
                const options = eligible.map((c, idx) => {
                    const def = getMinionDef(c.defId);
                    return { id: `minion-${idx}`, label: `${def?.name ?? c.defId} (力量 ${def?.power ?? '?'})`, value: { cardUid: c.uid, defId: c.defId } };
                });
                options.push({ id: 'skip', label: '跳过', value: { skip: true } } as any);
                const interaction = createSimpleChoice(
                    `killer_plant_sprout_search_${m.uid}_${ctx.now}`, m.controller,
                    '嫩芽：选择一个力量≤3的随从打出（可跳过）', options as any[], 'killer_plant_sprout_search',
                );
                // 传递 sprout 所在基地索引，交互处理器需要用它来锁定目标基地
                (interaction.data as any).continuationContext = { baseIndex: sproutBaseIndex };
                matchState = queueInteraction(matchState, interaction);
            } else {
                // 无 matchState 回退：自动选第一个（测试环境等）
                const card = eligible[0];
                const def = getMinionDef(card.defId);
                const power = def?.power ?? 0;
                events.push(
                    { type: SU_EVENTS.CARDS_DRAWN, payload: { playerId: m.controller, count: 1, cardUids: [card.uid] }, timestamp: ctx.now } as CardsDrawnEvent,
                    grantExtraMinion(m.controller, 'killer_plant_sprout', ctx.now),
                );
                const playedEvt: MinionPlayedEvent = {
                    type: SU_EVENTS.MINION_PLAYED,
                    payload: { playerId: m.controller, cardUid: card.uid, defId: card.defId, baseIndex: sproutBaseIndex, power },
                    timestamp: ctx.now,
                };
                events.push(playedEvt);
                events.push(buildDeckReshuffle(player, m.controller, [card.uid], ctx.now));
            }
        }
    }
    return { events, matchState };
}


/**
 * choking_vines 触发：回合开始时消灭附着了?choking_vines 的随从
 */
function killerPlantChokingVinesTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        for (const m of base.minions) {
            const attached = m.attachedActions.find(a => a.defId === 'killer_plant_choking_vines');
            if (!attached) continue;
            if (attached.ownerId !== ctx.playerId) continue;
            // 消灭附着的随从
            events.push(destroyMinion(m.uid, m.defId, i, m.owner, undefined, 'killer_plant_choking_vines', ctx.now));
        }
    }
    return events;
}

// ============================================================================
// 新增能力实现
// ============================================================================

/**
 * 金星捕蝇草 talent：搜索牌库打出力量≤2随从到此基地
 * 正确流程：CARDS_DRAWN(牌库→手牌) + grantExtraMinion(额度) + MINION_PLAYED(手牌→此基地) + 洗牌
 */
function killerPlantVenusManTrap(ctx: AbilityContext): AbilityResult {
    const player = ctx.state.players[ctx.playerId];
    const eligible = player.deck.filter(c => {
        if (c.type !== 'minion') return false;
        const def = getMinionDef(c.defId);
        return def !== undefined && def.power <= 2;
    });
    if (eligible.length === 0) {
        // 牌库中无符合条件的随从，规则仍要求重洗牌库
        return { events: [
            buildDeckReshuffle(player, ctx.playerId, [], ctx.now),
            buildAbilityFeedback(ctx.playerId, 'feedback.deck_search_no_match', ctx.now),
        ] };
    }
    if (eligible.length === 1) {
        // 只有一个候选，自动选择：直接打出到此基地
        const card = eligible[0];
        const def = getMinionDef(card.defId);
        const power = def?.power ?? 0;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId: ctx.playerId, cardUid: card.uid, defId: card.defId, baseIndex: ctx.baseIndex, power },
            timestamp: ctx.now,
        };
        return {
            events: [
                { type: SU_EVENTS.CARDS_DRAWN, payload: { playerId: ctx.playerId, count: 1, cardUids: [card.uid] }, timestamp: ctx.now } as CardsDrawnEvent,
                grantExtraMinion(ctx.playerId, 'killer_plant_venus_man_trap', ctx.now),
                playedEvt,
                buildDeckReshuffle(player, ctx.playerId, [card.uid], ctx.now),
            ],
        };
    }
    // 多个候选，Prompt 选择
    const options = eligible.map((c, idx) => {
        const def = getMinionDef(c.defId);
        return { id: `minion-${idx}`, label: `${def?.name ?? c.defId} (力量 ${def?.power ?? '?'})`, value: { cardUid: c.uid, defId: c.defId } };
    });
    const interaction = createSimpleChoice(
        `killer_plant_venus_man_trap_search_${ctx.now}`, ctx.playerId,
        '维纳斯捕食者：选择一个效果力量≤2的随从打出到此基地', options as any[], 'killer_plant_venus_man_trap_search',
    );
    (interaction.data as any).continuationContext = { baseIndex: ctx.baseIndex };
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 出芽生殖 onPlay：选择场上一个随从，搜索牌库同名卡加入手牌
 */
function killerPlantBudding(ctx: AbilityContext): AbilityResult {
    // 收集场上所有随从作为候选?
    const candidates: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        for (const m of ctx.state.bases[i].minions) {
            const def = getCardDef(m.defId) as MinionCardDef | undefined;
            const name = def?.name ?? m.defId;
            const baseDef = getBaseDef(ctx.state.bases[i].defId);
            const baseName = baseDef?.name ?? `基地 ${i + 1}`;
            candidates.push({ uid: m.uid, defId: m.defId, baseIndex: i, label: `${name} @ ${baseName}` });
        }
    }
    if (candidates.length === 0) return { events: [] };
    // Prompt 选择场上随从
    const interaction = createSimpleChoice(
        `killer_plant_budding_choose_${ctx.now}`, ctx.playerId,
        '出芽生殖：选择一个场上的随从',
        buildMinionTargetOptions(candidates, { state: ctx.state, sourcePlayerId: ctx.playerId, effectType: 'destroy' }),
        { sourceId: 'killer_plant_budding_choose', targetType: 'minion', autoCancelOption: true },
    );
    return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
}

/**
 * 绽放 onPlay：额外打出至多三个同名随从
 */
function killerPlantBlossom(ctx: AbilityContext): AbilityResult {
    return {
        events: [
            grantExtraMinion(ctx.playerId, 'killer_plant_blossom', ctx.now, undefined, { sameNameOnly: true }),
            grantExtraMinion(ctx.playerId, 'killer_plant_blossom', ctx.now, undefined, { sameNameOnly: true }),
            grantExtraMinion(ctx.playerId, 'killer_plant_blossom', ctx.now, undefined, { sameNameOnly: true }),
        ],
    };
}

/** 注册食人花派系所有能力*/
export function registerKillerPlantAbilities(): void {
    // 急速生长（行动卡）：额外打出一个随从
    registerAbility('killer_plant_insta_grow', 'onPlay', killerPlantInstaGrow);
    // 野生食人花（随从）：打出回合-2力量
    registerAbility('killer_plant_weed_eater', 'onPlay', killerPlantWeedEater);
    // 金星捕蝇草（talent）：搜索牌库打出力量的随从
    registerAbility('killer_plant_venus_man_trap', 'talent', killerPlantVenusManTrap);
    // 发芽（行动卡）：搜索牌库打出同名随从
    registerAbility('killer_plant_budding', 'onPlay', killerPlantBudding);
    // 绽放（行动卡）：额外打出3个随从
    registerAbility('killer_plant_blossom', 'onPlay', killerPlantBlossom);

    // === ongoing 效果注册 ===
    // deep_roots: 保护随从不收回被移动
    registerProtection('killer_plant_deep_roots', 'move', killerPlantDeepRootsChecker);
    // water_lily: 回合开始时控制者抽1?
    registerTrigger('killer_plant_water_lily', 'onTurnStart', killerPlantWaterLilyTrigger);
    // sprout: 回合开始时消灭自身 + 搜索打出随从
    registerTrigger('killer_plant_sprout', 'onTurnStart', killerPlantSproutTrigger);
    // choking_vines: 回合开始时消灭此基地上力量最低的随从
    registerTrigger('killer_plant_choking_vines', 'onTurnStart', killerPlantChokingVinesTrigger);
    // overgrowth: 回合开始时将本基地临界点降低到0（通过 tempBreakpointModifiers，回合结束自动清零）
    registerTrigger('killer_plant_overgrowth', 'onTurnStart', killerPlantOvergrowthTrigger);
    // entangled: 有己方随从的基地上的随从不收回可被移动?
    registerProtection('killer_plant_entangled', 'move', killerPlantEntangledChecker);
    // entangled: 控制者回合开始时消灭本卡
    registerTrigger('killer_plant_entangled', 'onTurnStart', killerPlantEntangledDestroyTrigger);
}

// ============================================================================
// 藤蔓缠绕 ongoing 效果
// ============================================================================

// ============================================================================
// 牌库洗牌辅助
// ============================================================================

/** 构建牌库洗牌事件（排除已抽出的卡牌） */
function buildDeckReshuffle(
    player: { deck: { uid: string }[] },
    playerId: string,
    drawnUids: string[],
    now: number,
): DeckReorderedEvent {
    const drawnSet = new Set(drawnUids);
    const remaining = player.deck.filter(c => !drawnSet.has(c.uid)).map(c => c.uid);
    return {
        type: SU_EVENTS.DECK_REORDERED,
        payload: { playerId, deckUids: remaining },
        timestamp: now,
    };
}

// ============================================================================
// 交互解决处理函数
// ============================================================================

/** 注册食人花派系的交互解决处理函数 */
export function registerKillerPlantInteractionHandlers(): void {
    registerInteractionHandler('killer_plant_venus_man_trap_search', (state, playerId, value, iData, _random, timestamp) => {
        const { cardUid, defId } = value as { cardUid: string; defId: string };
        const player = state.core.players[playerId];
        // 从 continuationContext 获取锁定的目标基地
        const contCtx = (iData as any)?.continuationContext as { baseIndex: number } | undefined;
        const baseIndex = contCtx?.baseIndex ?? 0;
        const def = getMinionDef(defId);
        const power = def?.power ?? 0;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid, defId, baseIndex, power },
            timestamp,
        };
        return { state, events: [
            { type: SU_EVENTS.CARDS_DRAWN, payload: { playerId, count: 1, cardUids: [cardUid] }, timestamp } as CardsDrawnEvent,
            grantExtraMinion(playerId, 'killer_plant_venus_man_trap', timestamp),
            playedEvt,
            buildDeckReshuffle(player, playerId, [cardUid], timestamp),
        ] };
    });

    registerInteractionHandler('killer_plant_sprout_search', (state, playerId, value, iData, _random, timestamp) => {
        if (value && (value as any).skip) {
            // 跳过选择，规则仍要求重洗牌库
            const player = state.core.players[playerId];
            return { state, events: [
                buildDeckReshuffle(player, playerId, [], timestamp),
                buildAbilityFeedback(playerId, 'feedback.deck_search_skipped', timestamp),
            ] };
        }
        const { cardUid, defId } = value as { cardUid: string; defId: string };
        const player = state.core.players[playerId];
        // 从 continuationContext 获取 sprout 所在基地索引
        const contCtx = (iData as any)?.continuationContext as { baseIndex: number } | undefined;
        const baseIndex = contCtx?.baseIndex ?? 0;
        const def = getMinionDef(defId);
        const power = def?.power ?? 0;
        const playedEvt: MinionPlayedEvent = {
            type: SU_EVENTS.MINION_PLAYED,
            payload: { playerId, cardUid, defId, baseIndex, power },
            timestamp,
        };
        return { state, events: [
            { type: SU_EVENTS.CARDS_DRAWN, payload: { playerId, count: 1, cardUids: [cardUid] }, timestamp } as CardsDrawnEvent,
            grantExtraMinion(playerId, 'killer_plant_sprout', timestamp),
            playedEvt,
            buildDeckReshuffle(player, playerId, [cardUid], timestamp),
        ] };
    });

    registerInteractionHandler('killer_plant_budding_choose', (state, playerId, value, _iData, _random, timestamp) => {
        // 检查取消标记
        if ((value as any).__cancel__) return { state, events: [] };
        
        const { minionUid } = value as { minionUid: string; baseIndex: number };
        let chosenDefId = '';
        for (const base of state.core.bases) {
            const found = base.minions.find(m => m.uid === minionUid);
            if (found) { chosenDefId = found.defId; break; }
        }
        if (!chosenDefId) return { state, events: [] };
        const player = state.core.players[playerId];
        const sameNameCard = player.deck.find(c => c.defId === chosenDefId);
        if (!sameNameCard) {
            // 牌库中未找到同名卡，规则仍要求重洗牌库
            return { state, events: [
                buildDeckReshuffle(player, playerId, [], timestamp),
                buildAbilityFeedback(playerId, 'feedback.deck_search_no_match', timestamp),
            ] };
        }
        return { state, events: [
            { type: SU_EVENTS.CARDS_DRAWN, payload: { playerId, count: 1, cardUids: [sameNameCard.uid] }, timestamp } as CardsDrawnEvent,
            buildDeckReshuffle(player, playerId, [sameNameCard.uid], timestamp),
        ] };
    });
}

/**
 * 过度生长触发：控制者回合开始时，将本基地临界点降低到0
 * 通过 BREAKPOINT_MODIFIED 事件写入 tempBreakpointModifiers（回合结束自动清零）
 */
function killerPlantOvergrowthTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        // 统计属于当前回合玩家的过度生长张数（多张叠加）
        const count = base.ongoingActions.filter(
            a => a.defId === 'killer_plant_overgrowth' && a.ownerId === ctx.playerId
        ).length;
        if (count === 0) continue;
        const baseDef = getBaseDef(base.defId);
        if (!baseDef) continue;
        // 每张降低一个完整临界点，总计降低 count * breakpoint
        const delta = -baseDef.breakpoint * count;
        events.push({
            type: SU_EVENTS.BREAKPOINT_MODIFIED,
            payload: { baseIndex: i, delta, reason: 'killer_plant_overgrowth' },
            timestamp: ctx.now,
        } as BreakpointModifiedEvent);
    }
    return events;
}

/** 藤蔓缠绕保护检查：有己方随从的基地上的所有随从不收回可被移动 */
function killerPlantEntangledChecker(ctx: ProtectionCheckContext): boolean {
    for (const base of ctx.state.bases) {
        const entangled = base.ongoingActions.find(a => a.defId === 'killer_plant_entangled');
        if (!entangled) continue;
        // 检查?entangled 拥有者在目标随从所在基地是否有随从
        const ownerHasMinion = ctx.state.bases[ctx.targetBaseIndex].minions.some(
            m => m.controller === entangled.ownerId
        );
        if (ownerHasMinion) return true;
    }
    return false;
}

/** 藤蔓缠绕触发：控制者回合开始时消灭本卡 */
function killerPlantEntangledDestroyTrigger(ctx: TriggerContext): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < ctx.state.bases.length; i++) {
        const base = ctx.state.bases[i];
        const entangled = base.ongoingActions.find(a => a.defId === 'killer_plant_entangled');
        if (!entangled) continue;
        if (entangled.ownerId !== ctx.playerId) continue;
        events.push({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: {
                cardUid: entangled.uid,
                defId: entangled.defId,
                ownerId: entangled.ownerId,
                reason: 'killer_plant_entangled_self_destruct',
            },
            timestamp: ctx.now,
        } as OngoingDetachedEvent);
    }
    return events;
}
