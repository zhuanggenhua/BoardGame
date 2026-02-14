/**
 * 大杀四方 - 基地能力触发系统
 *
 * 基地能力按触发时机分类，通过注册表模式实现。
 * FlowHooks 在对应时机调用 triggerBaseAbilities() 获取事件。
 */

import type { PlayerId, MatchState } from '../../../engine/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    VpAwardedEvent,
    CardsDrawnEvent,
    CardsDiscardedEvent,

    LimitModifiedEvent,
    CardToDeckBottomEvent,
    MinionOnBase,
    MinionReturnedEvent,
    BaseDeckReorderedEvent,
} from './types';
import { SU_EVENTS } from './types';
import { getEffectivePower } from './ongoingModifiers';
import { drawMadnessCards, destroyMinion, moveMinion, buildBaseTargetOptions } from './abilityHelpers';
import { getCardDef, getBaseDef } from '../data/cards';
import { createSimpleChoice, queueInteraction, type PromptOption } from '../../../engine/systems/InteractionSystem';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import { registerExpansionBaseAbilities, registerExpansionBaseInteractionHandlers } from './baseAbilities_expansion';
import { isBaseAbilitySuppressed } from './ongoingEffects';

// ============================================================================
// 类型定义
// ============================================================================

/** 基地能力触发时机 */
export type BaseTriggerTiming =
    | 'onMinionPlayed'    // 随从入场时
    | 'beforeScoring'     // 记分前
    | 'afterScoring'      // 记分后
    | 'onTurnStart'       // 回合开始时
    | 'onActionPlayed';   // 行动卡打出时

/** 基地能力执行上下文 */
export interface BaseAbilityContext {
    state: SmashUpCore;
    /** 完整的 match 状态，用于调用 queueInteraction */
    matchState?: MatchState<SmashUpCore>;
    baseIndex: number;
    baseDefId: string;
    playerId: PlayerId;
    /** onMinionPlayed 时：刚打出的随从 */
    minionUid?: string;
    minionDefId?: string;
    minionPower?: number;
    /** onMinionDestroyed 时：消灭者 ID（如果有） */
    destroyerId?: PlayerId;
    /** onMinionDestroyed 时：被消灭随从的控制者 */
    controllerId?: PlayerId;
    /** afterScoring 时：排名信息 */
    rankings?: { playerId: PlayerId; power: number; vp: number }[];
    /** onActionPlayed 时：行动卡目标基地 */
    actionTargetBaseIndex?: number;
    /** onActionPlayed 时：行动卡目标随从（附着行动卡时有值） */
    actionTargetMinionUid?: string;
    now: number;
}

/** 基地能力执行结果 */
export interface BaseAbilityResult {
    events: SmashUpEvent[];
    /** 如果能力创建了 Interaction，返回更新后的 matchState */
    matchState?: MatchState<SmashUpCore>;
}

/** 基地能力执行函数签名 */
export type BaseAbilityExecutor = (ctx: BaseAbilityContext) => BaseAbilityResult;

function getContinuationContext<T>(
    interactionData: Record<string, unknown> | undefined,
): T | undefined {
    if (!interactionData) return undefined;
    return interactionData.continuationContext as T | undefined;
}

// ============================================================================
// 注册表
// ============================================================================

/** 内部存储：baseDefId 到 Map<BaseTriggerTiming, BaseAbilityExecutor> */
const baseAbilityRegistry = new Map<string, Map<BaseTriggerTiming, BaseAbilityExecutor>>();

/** 注册一个基地能力 */
export function registerBaseAbility(
    baseDefId: string,
    timing: BaseTriggerTiming,
    executor: BaseAbilityExecutor
): void {
    let timingMap = baseAbilityRegistry.get(baseDefId);
    if (!timingMap) {
        timingMap = new Map();
        baseAbilityRegistry.set(baseDefId, timingMap);
    }
    timingMap.set(timing, executor);
}

/** 触发指定基地在指定时机的能力 */
export function triggerBaseAbility(
    baseDefId: string,
    timing: BaseTriggerTiming,
    ctx: BaseAbilityContext
): BaseAbilityResult {
    // 检查基地能力是否被压制（如 alien_jammed_signal）
    if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) return { events: [] };
    const executor = baseAbilityRegistry.get(baseDefId)?.get(timing);
    if (!executor) return { events: [] };
    return executor(ctx);
}

/** 触发所有基地在指定时机的能力 */
export function triggerAllBaseAbilities(
    timing: BaseTriggerTiming,
    state: SmashUpCore,
    playerId: PlayerId,
    now: number,
    /** 在 onMinionPlayed 时需要 */
    minionContext?: { baseIndex: number; minionUid: string; minionDefId: string; minionPower: number },
    matchState?: MatchState<SmashUpCore>,
): BaseAbilityResult {
    const events: SmashUpEvent[] = [];
    let ms = matchState;
    for (let i = 0; i < state.bases.length; i++) {
        const base = state.bases[i];
        // onMinionPlayed 只触发随从所在基地
        if (timing === 'onMinionPlayed' && minionContext && i !== minionContext.baseIndex) {
            continue;
        }
        const ctx: BaseAbilityContext = {
            state,
            matchState: ms,
            baseIndex: i,
            baseDefId: base.defId,
            playerId,
            minionUid: minionContext?.minionUid,
            minionDefId: minionContext?.minionDefId,
            minionPower: minionContext?.minionPower,
            now,
        };
        const result = triggerBaseAbility(base.defId, timing, ctx);
        events.push(...result.events);
        if (result.matchState) ms = result.matchState;
    }
    return { events, matchState: ms };
}

/** 检查基地是否有指定时机的能力 */
export function hasBaseAbility(baseDefId: string, timing: BaseTriggerTiming): boolean {
    return baseAbilityRegistry.get(baseDefId)?.has(timing) ?? false;
}

/** 清空注册表（测试用） */
export function clearBaseAbilityRegistry(): void {
    baseAbilityRegistry.clear();
    extendedRegistry.clear();
}

/** 获取注册表大小（调试用） */
export function getBaseAbilityRegistrySize(): number {
    let count = 0;
    for (const timingMap of baseAbilityRegistry.values()) {
        count += timingMap.size;
    }
    for (const timingMap of extendedRegistry.values()) {
        count += timingMap.size;
    }
    return count;
}

// ============================================================================
// 扩展触发时机：随从被消灭时
// ============================================================================

export type ExtendedBaseTrigger = BaseTriggerTiming | 'onMinionDestroyed';

/** 扩展注册表：支持 onMinionDestroyed */
const extendedRegistry = new Map<string, Map<string, BaseAbilityExecutor>>();

export function registerExtended(baseDefId: string, timing: string, executor: BaseAbilityExecutor): void {
    let timingMap = extendedRegistry.get(baseDefId);
    if (!timingMap) {
        timingMap = new Map();
        extendedRegistry.set(baseDefId, timingMap);
    }
    timingMap.set(timing, executor);
}

/** 触发扩展时机（如 onMinionDestroyed） */
export function triggerExtendedBaseAbility(
    baseDefId: string,
    timing: string,
    ctx: BaseAbilityContext
): BaseAbilityResult {
    // 扩展触发同样遵循基地能力压制（如 alien_jammed_signal）
    if (isBaseAbilitySuppressed(ctx.state, ctx.baseIndex)) return { events: [] };
    const executor = extendedRegistry.get(baseDefId)?.get(timing);
    if (!executor) return { events: [] };
    return executor(ctx);
}

// ============================================================================
// 基地能力注册（所有可 Prompt 实现的基地）
// ============================================================================

/** 注册所有基地能力（幂等） */
/** 注册所有基地能力（幂等） */
export function registerBaseAbilities(): void {

    // === 基础包 (Base Set) ===

    // base_rhodes_plaza: 罗德百货商场
    // "在这个基地计分时，每位玩家在这里每有一个随从就获得1VP"
    registerBaseAbility('base_rhodes_plaza', 'beforeScoring', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const playerMinionCounts = new Map<PlayerId, number>();
        for (const m of base.minions) {
            playerMinionCounts.set(m.controller, (playerMinionCounts.get(m.controller) ?? 0) + 1);
        }
        const events: SmashUpEvent[] = [];
        for (const [pid, count] of playerMinionCounts) {
            if (count > 0) {
                events.push({
                    type: SU_EVENTS.VP_AWARDED,
                    payload: { playerId: pid, amount: count, reason: '罗德百货商场：每个随从1VP' },
                    timestamp: ctx.now,
                } as VpAwardedEvent);
            }
        }
        return { events };
    });

    // base_locker_room: 更衣室
    // "你的回合开始时，如果你有随从在这，抽一张卡牌"
    registerBaseAbility('base_locker_room', 'onTurnStart', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const hasMinion = base.minions.some(m => m.controller === ctx.playerId);
        if (!hasMinion) return { events: [] };
        const player = ctx.state.players[ctx.playerId];
        if (!player || player.deck.length === 0) return { events: [] };
        const topCard = player.deck[0];
        return {
            events: [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: { playerId: ctx.playerId, count: 1, cardUids: [topCard.uid] },
                timestamp: ctx.now,
            } as CardsDrawnEvent],
        };
    });

    // base_central_brain: 中央大脑
    // "每个在这里的随从获得+1力量"
    // 持续性被动 buff，通过 power modifier 实现（非入场指示物）
    // 注册在 ongoing_modifiers.ts 的 registerBaseModifiers() 中

    // base_cave_of_shinies: 闪光洞穴
    // "每当这里的一个随从被消灭后，它的拥有者获得1VP"
    registerExtended('base_cave_of_shinies', 'onMinionDestroyed', (ctx) => {
        return {
            events: [{
                type: SU_EVENTS.VP_AWARDED,
                payload: {
                    playerId: ctx.playerId,
                    amount: 1,
                    reason: '闪光洞穴：随从被消灭获得1VP',
                },
                timestamp: ctx.now,
            } as VpAwardedEvent],
        };
    });

    // base_the_factory: 436-1337工厂
    // "当这个基地计分时，冠军在这里每有5力量就获得1VP"
    registerBaseAbility('base_the_factory', 'beforeScoring', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const playerPowers = new Map<PlayerId, number>();
        for (const m of base.minions) {
            const prev = playerPowers.get(m.controller) ?? 0;
            playerPowers.set(m.controller, prev + getEffectivePower(ctx.state, m, ctx.baseIndex));
        }
        let maxPower = 0;
        let winnerId: PlayerId | undefined;
        for (const [pid, power] of playerPowers) {
            if (power > maxPower) { maxPower = power; winnerId = pid; }
        }
        if (!winnerId || maxPower === 0) return { events: [] };
        const bonusVp = Math.floor(maxPower / 5);
        if (bonusVp <= 0) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.VP_AWARDED,
                payload: {
                    playerId: winnerId,
                    amount: bonusVp,
                    reason: `工厂：每5力量1VP（${maxPower}力量=${bonusVp}VP）`,
                },
                timestamp: ctx.now,
            } as VpAwardedEvent],
        };
    });

    // base_tar_pits: 焦油坑
    // "每当有一个随从在这里被消灭后，将它放到其拥有者的牌库底"
    // 实现：onMinionDestroyed 时从弃牌堆移到牌库底
    registerExtended('base_tar_pits', 'onMinionDestroyed', (ctx) => {
        // ctx.minionUid / ctx.minionDefId 是被消灭的随从
        if (!ctx.minionUid || !ctx.minionDefId) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: ctx.minionUid,
                    defId: ctx.minionDefId,
                    ownerId: ctx.playerId,
                    reason: '焦油坑：被消灭的随从放入牌库底',
                },
                timestamp: ctx.now,
            } as CardToDeckBottomEvent],
        };
    });

    // base_haunted_house: 伊万斯堡城镇公墓
    // "在这个基地计分后，冠军弃掉他的手牌并抽取5张牌"
    registerBaseAbility('base_haunted_house', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const winner = ctx.state.players[winnerId];
        if (!winner) return { events: [] };
        const events: SmashUpEvent[] = [];
        // 弃掉所有手牌
        if (winner.hand.length > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: winnerId,
                    cardUids: winner.hand.map(c => c.uid),
                },
                timestamp: ctx.now,
            } as CardsDiscardedEvent);
        }
        // 抽5张牌（从牌库顶取）
        const drawCount = Math.min(5, winner.deck.length);
        if (drawCount > 0) {
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: {
                    playerId: winnerId,
                    count: drawCount,
                    cardUids: winner.deck.slice(0, drawCount).map(c => c.uid),
                },
                timestamp: ctx.now,
            } as CardsDrawnEvent);
        }
        return { events };
    });

    // base_temple_of_goju: 刚柔流寺庙
    // "在这个基地计分后，将每位玩家在这里力量最高的一张随从放入他们拥有者的牌库底"
    registerBaseAbility('base_temple_of_goju', 'afterScoring', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const events: SmashUpEvent[] = [];
        // 按玩家分组，找每位玩家力量最高的随从
        const playerMinions = new Map<PlayerId, MinionOnBase[]>();
        for (const m of base.minions) {
            const list = playerMinions.get(m.controller) ?? [];
            list.push(m);
            playerMinions.set(m.controller, list);
        }
        for (const [, minions] of playerMinions) {
            if (minions.length === 0) continue;
            // 找力量最高的随从
            const strongest = minions.reduce((best, m) => {
                const mPower = getEffectivePower(ctx.state, m, ctx.baseIndex);
                const bPower = getEffectivePower(ctx.state, best, ctx.baseIndex);
                return mPower > bPower ? m : best;
            });
            events.push({
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: strongest.uid,
                    defId: strongest.defId,
                    ownerId: strongest.owner,
                    reason: '刚柔流寺庙：最高力量随从放入牌库底',
                },
                timestamp: ctx.now,
            } as CardToDeckBottomEvent);
        }
        return { events };
    });

    // base_great_library: 大图书馆
    // "在这个基地计分后，所有在这里有随从的玩家可以抽一张卡牌"
    registerBaseAbility('base_great_library', 'afterScoring', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const events: SmashUpEvent[] = [];
        // 找出在此基地有随从的玩家
        const playersWithMinions = new Set<PlayerId>();
        for (const m of base.minions) {
            playersWithMinions.add(m.controller);
        }
        for (const pid of playersWithMinions) {
            const player = ctx.state.players[pid];
            if (!player || player.deck.length === 0) continue;
            events.push({
                type: SU_EVENTS.CARDS_DRAWN,
                payload: {
                    playerId: pid,
                    count: 1,
                    cardUids: [player.deck[0].uid],
                },
                timestamp: ctx.now,
            } as CardsDrawnEvent);
        }
        return { events };
    });

    // === 扩展包 (Awesome Level 9000) ===

    // base_haunted_house_al9000: 鬼屋
    // "在一个玩家打出一个随从到这后，这个玩家必须弃掉一张卡牌"
    registerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', (ctx) => {
        const player = ctx.state.players[ctx.playerId];
        if (!player || player.hand.length === 0) return { events: [] };
        // 只有1张手牌→自动弃掉
        if (player.hand.length === 1) {
            return {
                events: [{
                    type: SU_EVENTS.CARDS_DISCARDED,
                    payload: { playerId: ctx.playerId, cardUids: [player.hand[0].uid] },
                    timestamp: ctx.now,
                } as CardsDiscardedEvent],
            };
        }
        // 多张手牌→Prompt 选择弃哪张
        const options = player.hand.map((c, i) => {
            const def = getCardDef(c.defId);
            return { id: `card-${i}`, label: def?.name ?? c.defId, value: { cardUid: c.uid, defId: c.defId } };
        });
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_haunted_house_al9000_${ctx.now}`, ctx.playerId,
            '鬼屋：选择要弃掉的卡牌', options, 'base_haunted_house_al9000',
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });

    // base_the_field_of_honor: 荣誉之地
    // "当一个或多个随从在这里被消灭，那个将它们消灭的玩家获得1VP"
    registerExtended('base_the_field_of_honor', 'onMinionDestroyed', (ctx) => {
        // ctx.destroyerId 是消灭者
        if (!ctx.destroyerId) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.VP_AWARDED,
                payload: {
                    playerId: ctx.destroyerId,
                    amount: 1,
                    reason: '荣誉之地：消灭随从获得1VP',
                },
                timestamp: ctx.now,
            } as VpAwardedEvent],
        };
    });

    // base_the_workshop: 工坊
    // "当一个玩家打出一个战术到这个基地时，该玩家可以额外打出一张战术"
    registerBaseAbility('base_the_workshop', 'onActionPlayed', (ctx) => {
        return {
            events: [{
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: {
                    playerId: ctx.playerId,
                    limitType: 'action',
                    delta: 1,
                    reason: '工坊：额外打出一张战斗牌',
                },
                timestamp: ctx.now,
            } as LimitModifiedEvent],
        };
    });

    // base_stadium: 体育场
    // "这里的一个随从被消灭后，它的控制者抽一张卡牌"
    registerExtended('base_stadium', 'onMinionDestroyed', (ctx) => {
        // ctx.controllerId 是被消灭随从的控制者
        const controllerId = ctx.controllerId ?? ctx.playerId;
        const controller = ctx.state.players[controllerId];
        if (!controller || controller.deck.length === 0) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.CARDS_DRAWN,
                payload: {
                    playerId: controllerId,
                    count: 1,
                    cardUids: [controller.deck[0].uid],
                },
                timestamp: ctx.now,
            } as CardsDrawnEvent],
        };
    });

    // base_ritual_site: 仪式场所
    // "在这个基地计分后，在它上面的所有随从洗回他们的拥有者牌库，而不收回是进入弃牌堆"
    registerBaseAbility('base_ritual_site', 'afterScoring', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const events: SmashUpEvent[] = [];
        for (const m of base.minions) {
            events.push({
                type: SU_EVENTS.CARD_TO_DECK_BOTTOM,
                payload: {
                    cardUid: m.uid,
                    defId: m.defId,
                    ownerId: m.owner,
                    reason: '仪式场所：随从洗回牌库',
                },
                timestamp: ctx.now,
            } as CardToDeckBottomEvent);
        }
        return { events };
    });

    // === 克苏鲁扩展基地 ===

    // base_mountains_of_madness: 疯狂之山
    // "在一个玩家打出一个随从到这后，这个玩家抽一张疯狂卡"
    registerBaseAbility('base_mountains_of_madness', 'onMinionPlayed', (ctx) => {
        const evt = drawMadnessCards(ctx.playerId, 1, ctx.state, 'base_mountains_of_madness', ctx.now);
        return { events: evt ? [evt] : [] };
    });

    // base_rlyeh: 拉莱耶
    // "你的回合开始时，你可以消灭这里的一个随从来获得1VP"
    registerBaseAbility('base_rlyeh', 'onTurnStart', (ctx) => {
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const myMinions = base.minions.filter(m => m.controller === ctx.playerId);
        if (myMinions.length === 0) return { events: [] };
        // 只有1个己方随从→直接提供 skip + 该随从
        const minionOptions = myMinions.map((m, i) => {
            const def = getCardDef(m.defId);
            return {
                id: `minion-${i}`,
                label: `${def?.name ?? m.defId} (力量${getEffectivePower(ctx.state, m, ctx.baseIndex)})`,
                value: { minionUid: m.uid, baseIndex: ctx.baseIndex },
            };
        });
        const options: PromptOption<{ skip: true } | { minionUid: string; baseIndex: number }>[] = [
            { id: 'skip', label: '不收回消灭', value: { skip: true } },
            ...minionOptions,
        ];
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_rlyeh_${ctx.now}`, ctx.playerId,
            '拉莱耶：消灭一个随从获得1VP', options, 'base_rlyeh',
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });

    // === 基础版需要 Prompt 的基地 ===

    // base_the_homeworld: 母星
    // "在一个玩家打出一个随从到这后，这个玩家可以额外打出一个力量≤2的随从到这里"
    // 力量≤2 限制通过 BaseCardDef.restrictions 的 extraPlayMinionPowerMax 数据驱动实现
    registerBaseAbility('base_the_homeworld', 'onMinionPlayed', (ctx) => {
        return {
            events: [{
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: {
                    playerId: ctx.playerId,
                    limitType: 'minion',
                    delta: 1,
                    reason: '母星：额外打出力量≤2的随从',
                },
                timestamp: ctx.now,
            } as LimitModifiedEvent],
        };
    });

    // base_the_mothership: 母舰
    // "在这个基地计分后，冠军可以将这里一个力量≤3的随从放回手牌"
    registerBaseAbility('base_the_mothership', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const eligible = base.minions.filter(m =>
            m.controller === winnerId &&
            getEffectivePower(ctx.state, m, ctx.baseIndex) <= 3
        );
        if (eligible.length === 0) return { events: [] };
        // 只有1个→自动选择（仍提供 skip 选项因为 "may"）
        const minionOptions = eligible.map((m, i) => {
            const def = getCardDef(m.defId);
            return {
                id: `minion-${i}`,
                label: `${def?.name ?? m.defId} (力量${getEffectivePower(ctx.state, m, ctx.baseIndex)})`,
                value: { minionUid: m.uid, minionDefId: m.defId },
            };
        });
        const options: PromptOption<{ skip: true } | { minionUid: string; minionDefId: string }>[] = [
            { id: 'skip', label: '不收回', value: { skip: true } },
            ...minionOptions,
        ];
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_the_mothership_${ctx.now}`, winnerId,
            '母舰：选择收回的随从', options, 'base_the_mothership',
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex } },
            }),
        };
    });

    // base_ninja_dojo: 忍者道场
    // "在这个基地计分后，冠军可以消灭这里的一个随从"
    registerBaseAbility('base_ninja_dojo', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base || base.minions.length === 0) return { events: [] };
        const minionOptions = base.minions.map((m, i) => {
            const def = getCardDef(m.defId);
            return {
                id: `minion-${i}`,
                label: `${def?.name ?? m.defId} (${m.controller}, 力量${getEffectivePower(ctx.state, m, ctx.baseIndex)})`,
                value: { minionUid: m.uid, baseIndex: ctx.baseIndex, minionDefId: m.defId, ownerId: m.owner },
            };
        });
        const options: PromptOption<{ skip: true } | { minionUid: string; baseIndex: number; minionDefId: string; ownerId: string }>[] = [
            { id: 'skip', label: '不消灭', value: { skip: true } },
            ...minionOptions,
        ];
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_ninja_dojo_${ctx.now}`, winnerId,
            '忍者道场：选择消灭的随从', options, 'base_ninja_dojo',
        );
        return { events: [], matchState: queueInteraction(ctx.matchState, interaction) };
    });

    // === 基础版需要 Prompt 的基地（续） ===

    // base_pirate_cove: 海盗湾
    // "在这个基地计分后，除了冠军的所有玩家可以从这里移动一个随从到其他基地而不收回是进入弃牌堆"
    // 注意：afterScoring 能力在 BASE_SCORED 事件处理前收集，此时随从仍在基地上。
    // Prompt continuation 运行时随从已进入弃牌堆，因此将随从信息存入 continuation data。
    registerBaseAbility('base_pirate_cove', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const events: SmashUpEvent[] = [];
        // 遍历非冠军玩家，为每位在此有随从的玩家生成 Prompt
        const playerMinions = new Map<string, MinionOnBase[]>();
        for (const m of base.minions) {
            if (m.controller === winnerId) continue;
            const list = playerMinions.get(m.controller) ?? [];
            list.push(m);
            playerMinions.set(m.controller, list);
        }
        for (const [pid, minions] of playerMinions) {
            const minionOptions = minions.map((m, i) => {
                const def = getCardDef(m.defId);
                return {
                    id: `minion-${i}`,
                    label: `${def?.name ?? m.defId} (力量${getEffectivePower(ctx.state, m, ctx.baseIndex)})`,
                    value: { minionUid: m.uid, minionDefId: m.defId, owner: m.owner },
                };
            });
            const options: PromptOption<{ skip: true } | { minionUid: string; minionDefId: string; owner: string }>[] = [
                { id: 'skip', label: '跳过', value: { skip: true } },
                ...minionOptions,
            ];
            if (ctx.matchState) {
                const interaction = createSimpleChoice(
                    `base_pirate_cove_${pid}_${ctx.now}`, pid,
                    '海盗湾：选择移动一个随从到其他基地', options, 'base_pirate_cove',
                );
                ctx.matchState = queueInteraction(ctx.matchState, {
                    ...interaction,
                    data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex } },
                });
            }
        }
        return { events, matchState: ctx.matchState };
    });

    // base_tortuga: 托尔图加
    // "冠军计分后，亚军可以移动他的一个随从到替换本基地的基地上"
    // 注意：continuation 运行时基地已被替换，替换基地在同一 baseIndex 位置
    registerBaseAbility('base_tortuga', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length < 2) return { events: [] };
        const runnerUpId = ctx.rankings[1].playerId;
        const base = ctx.state.bases[ctx.baseIndex];
        if (!base) return { events: [] };
        const runnerUpMinions = base.minions.filter(m => m.controller === runnerUpId);
        if (runnerUpMinions.length === 0) return { events: [] };
        const minionOptions = runnerUpMinions.map((m, i) => {
            const def = getCardDef(m.defId);
            return {
                id: `minion-${i}`,
                label: `${def?.name ?? m.defId} (力量${getEffectivePower(ctx.state, m, ctx.baseIndex)})`,
                value: { minionUid: m.uid, minionDefId: m.defId, owner: m.owner },
            };
        });
        const options: PromptOption<{ skip: true } | { minionUid: string; minionDefId: string; owner: string }>[] = [
            { id: 'skip', label: '跳过', value: { skip: true } },
            ...minionOptions,
        ];
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_tortuga_${ctx.now}`, runnerUpId,
            '托尔图加：选择移动一个随从到替换基地', options, 'base_tortuga',
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex } },
            }),
        };
    });

    // base_wizard_academy: 巫师学院
    // "在这个基地计分后，冠军查看基地牌库顶的3张牌。选择一张替换这个基地，然后以任意顺序将其余的放回"
    // 简化实现：让冠军选择排列顺序，第一张将成为下次替换的基地
    registerBaseAbility('base_wizard_academy', 'afterScoring', (ctx) => {
        if (!ctx.rankings || ctx.rankings.length === 0) return { events: [] };
        const winnerId = ctx.rankings[0].playerId;
        const baseDeck = ctx.state.baseDeck;
        if (!baseDeck || baseDeck.length === 0) return { events: [] };
        const topCount = Math.min(3, baseDeck.length);
        const topCards = baseDeck.slice(0, topCount);
        // 为每张基地卡生成选项，玩家选择排列顺序
        const options = topCards.map((defId, i) => {
            const def = getBaseDef(defId);
            return {
                id: `base-${i}`,
                label: def?.name ?? defId,
                value: { defId, index: i },
            };
        });
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_wizard_academy_${ctx.now}`, winnerId,
            '巫师学院：选择排列基地牌库顶的顺序', options, 'base_wizard_academy',
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { baseIndex: ctx.baseIndex, topCards } },
            }),
        };
    });

    // base_mushroom_kingdom: 蘑菇王国
    // "在每位玩家回合开始时，该玩家可以从任意基地移动一个其他玩家的随从到这里"
    registerBaseAbility('base_mushroom_kingdom', 'onTurnStart', (ctx) => {
        const mushroomBaseIndex = ctx.baseIndex;
        // 收集所有基地上的对手随从
        const opponentMinions: { uid: string; defId: string; baseIndex: number; label: string }[] = [];
        for (let i = 0; i < ctx.state.bases.length; i++) {
            if (i === mushroomBaseIndex) continue; // 不收回从蘑菇王国自身移动
            const base = ctx.state.bases[i];
            const bDef = getBaseDef(base.defId);
            for (const m of base.minions) {
                if (m.controller === ctx.playerId) continue; // 排除自己的随从
                const def = getCardDef(m.defId);
                opponentMinions.push({
                    uid: m.uid,
                    defId: m.defId,
                    baseIndex: i,
                    label: `${def?.name ?? m.defId} (${bDef?.name ?? '基地'}, 力量${getEffectivePower(ctx.state, m, i)})`,
                });
            }
        }
        if (opponentMinions.length === 0) return { events: [] };
        const minionOptions = opponentMinions.map((m, i) => ({
            id: `minion-${i}`,
            label: m.label,
            value: { minionUid: m.uid, minionDefId: m.defId, fromBaseIndex: m.baseIndex },
        }));
        const options: PromptOption<{ skip: true } | { minionUid: string; minionDefId: string; fromBaseIndex: number }>[] = [
            { id: 'skip', label: '跳过', value: { skip: true } },
            ...minionOptions,
        ];
        if (!ctx.matchState) return { events: [] };
        const interaction = createSimpleChoice(
            `base_mushroom_kingdom_${ctx.now}`, ctx.playerId,
            '蘑菇王国：选择一个对手随从移动到蘑菇王国', options, 'base_mushroom_kingdom',
        );
        return {
            events: [],
            matchState: queueInteraction(ctx.matchState, {
                ...interaction,
                data: { ...interaction.data, continuationContext: { mushroomBaseIndex } },
            }),
        };
    });

    // === 限制类基地已通过 BaseCardDef.restrictions 数据驱动，isOperationRestricted 自动解析 ===

    // === 被动保护类已在 baseAbilities_expansion.ts 中通过 registerProtection 注册 ===

    // === 扩展包基地能力（克苏鲁/AL9000/Pretty Pretty） ===
    registerExpansionBaseAbilities();
}

// ============================================================================
// 基地交互解决处理函数
// ============================================================================

/** 注册基地能力的交互解决处理函数 */
export function registerBaseInteractionHandlers(): void {
    // 鬼屋：选择弃哪张卡
    registerInteractionHandler('base_haunted_house_al9000', (state, playerId, value, _iData, _random, timestamp) => {
        const { cardUid } = value as { cardUid: string };
        return { state, events: [{
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: { playerId, cardUids: [cardUid] },
            timestamp,
        } as CardsDiscardedEvent] };
    });

    // 拉莱耶：消灭随从+1VP
    registerInteractionHandler('base_rlyeh', (state, playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const base = state.core.bases[selected.baseIndex!];
        if (!base) return { state, events: [] };
        const target = base.minions.find(m => m.uid === selected.minionUid);
        if (!target) return { state, events: [] };
        return { state, events: [
            destroyMinion(target.uid, target.defId, selected.baseIndex!, target.owner, 'base_rlyeh', timestamp),
            {
                type: SU_EVENTS.VP_AWARDED,
                payload: { playerId, amount: 1, reason: '拉莱耶：消灭随从获得1VP' },
                timestamp,
            } as VpAwardedEvent,
        ] };
    });

    // 母舰：收回随从到手牌
    registerInteractionHandler('base_the_mothership', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ baseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        return { state, events: [{
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: selected.minionUid!,
                minionDefId: selected.minionDefId!,
                fromBaseIndex: ctx.baseIndex,
                toPlayerId: playerId,
                reason: '母舰：冠军收回随从',
            },
            timestamp,
        } as MinionReturnedEvent] };
    });

    // 忍者道场：消灭随从
    registerInteractionHandler('base_ninja_dojo', (state, _playerId, value, _iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; baseIndex?: number; minionDefId?: string; ownerId?: string };
        if (selected.skip) return { state, events: [] };
        return { state, events: [destroyMinion(selected.minionUid!, selected.minionDefId!, selected.baseIndex!, selected.ownerId!, 'base_ninja_dojo', timestamp)] };
    });

    // 海盗湾：选择随从后，链式选择目标基地
    registerInteractionHandler('base_pirate_cove', (state, playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; owner?: string };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ baseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        // 收集可用的目标基地（排除原基地）
        const baseCandidates: { baseIndex: number; label: string }[] = [];
        for (let i = 0; i < state.core.bases.length; i++) {
            if (i === ctx.baseIndex) continue;
            const bDef = getBaseDef(state.core.bases[i].defId);
            baseCandidates.push({ baseIndex: i, label: bDef?.name ?? `基地 ${i + 1}` });
        }
        // 只有一个目标基地→自动移动
        if (baseCandidates.length <= 1) {
            const targetBase = baseCandidates.length === 1 ? baseCandidates[0].baseIndex : 0;
            return { state, events: [moveMinion(
                selected.minionUid!, selected.minionDefId!, ctx.baseIndex, targetBase,
                '海盗湾：移动随从到其他基地', timestamp,
            )] };
        }
        // 多个目标基地→链式交互选择
        const options = buildBaseTargetOptions(baseCandidates);
        const interaction = createSimpleChoice(
            `base_pirate_cove_choose_base_${timestamp}`, playerId,
            '海盗湾：选择移动到的基地', options, 'base_pirate_cove_choose_base',
        );
        return {
            state: queueInteraction(state, {
                ...interaction,
                data: {
                    ...interaction.data,
                    continuationContext: {
                        minionUid: selected.minionUid,
                        minionDefId: selected.minionDefId,
                        fromBaseIndex: ctx.baseIndex,
                    },
                },
            }),
            events: [],
        };
    });

    // 海盗湾：第二步——选择目标基地后执行移动
    registerInteractionHandler('base_pirate_cove_choose_base', (state, _playerId, value, iData, _random, timestamp) => {
        const { baseIndex: targetBase } = value as { baseIndex: number };
        const ctx = getContinuationContext<{ minionUid: string; minionDefId: string; fromBaseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        return { state, events: [moveMinion(
            ctx.minionUid, ctx.minionDefId, ctx.fromBaseIndex, targetBase,
            '海盗湾：移动随从到其他基地', timestamp,
        )] };
    });

    // 托尔图加：将随从移动到替换基地
    registerInteractionHandler('base_tortuga', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; owner?: string };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ baseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        return { state, events: [moveMinion(
            selected.minionUid!,
            selected.minionDefId!,
            -1,
            ctx.baseIndex,
            '托尔图加：亚军移动随从到替换基地',
            timestamp,
        )] };
    });

    // 巫师学院：重排基地牌库顶
    registerInteractionHandler('base_wizard_academy', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { defId: string; index: number };
        const ctx = getContinuationContext<{ topCards: string[] }>(iData);
        if (!ctx?.topCards || ctx.topCards.length === 0) return { state, events: [] };
        const chosenDefId = selected.defId;
        const remaining = ctx.topCards.filter(id => id !== chosenDefId);
        const newOrder = [chosenDefId, ...remaining];
        return { state, events: [{
            type: SU_EVENTS.BASE_DECK_REORDERED,
            payload: {
                topDefIds: newOrder,
                reason: '巫师学院：冠军重排基地牌库顶',
            },
            timestamp,
        } as BaseDeckReorderedEvent] };
    });

    // 蘑菇王国：移动对手随从到蘑菇王国
    registerInteractionHandler('base_mushroom_kingdom', (state, _playerId, value, iData, _random, timestamp) => {
        const selected = value as { skip?: boolean; minionUid?: string; minionDefId?: string; fromBaseIndex?: number };
        if (selected.skip) return { state, events: [] };
        const ctx = getContinuationContext<{ mushroomBaseIndex: number }>(iData);
        if (!ctx) return { state, events: [] };
        return { state, events: [moveMinion(
            selected.minionUid!,
            selected.minionDefId!,
            selected.fromBaseIndex!,
            ctx.mushroomBaseIndex,
            '蘑菇王国：移动对手随从',
            timestamp,
        )] };
    });

    // === 扩展包基地交互处理函数 ===
    registerExpansionBaseInteractionHandlers();
}
