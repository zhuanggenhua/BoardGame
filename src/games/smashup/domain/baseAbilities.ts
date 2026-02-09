/**
 * 大杀四方 - 基地能力触发系统
 *
 * 基地能力按触发时机分类，通过注册表模式实现。
 * FlowHooks 在对应时机调用 triggerBaseAbilities() 获取事件。
 */

import type { PlayerId } from '../../../engine/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    VpAwardedEvent,
    CardsDrawnEvent,
    CardsDiscardedEvent,
    PowerCounterAddedEvent,
    LimitModifiedEvent,
    CardToDeckBottomEvent,
    MinionOnBase,
} from './types';
import { SU_EVENTS } from './types';
import { getEffectivePower } from './ongoingModifiers';

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
    now: number;
}

/** 基地能力执行结果 */
export interface BaseAbilityResult {
    events: SmashUpEvent[];
}

/** 基地能力执行函数签名 */
export type BaseAbilityExecutor = (ctx: BaseAbilityContext) => BaseAbilityResult;

// ============================================================================
// 注册表
// ============================================================================

/** 内部存储：baseDefId → Map<BaseTriggerTiming, BaseAbilityExecutor> */
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
): SmashUpEvent[] {
    const executor = baseAbilityRegistry.get(baseDefId)?.get(timing);
    if (!executor) return [];
    return executor(ctx).events;
}

/** 触发所有基地在指定时机的能力 */
export function triggerAllBaseAbilities(
    timing: BaseTriggerTiming,
    state: SmashUpCore,
    playerId: PlayerId,
    now: number,
    /** 仅 onMinionPlayed 时需要 */
    minionContext?: { baseIndex: number; minionUid: string; minionDefId: string; minionPower: number }
): SmashUpEvent[] {
    const events: SmashUpEvent[] = [];
    for (let i = 0; i < state.bases.length; i++) {
        const base = state.bases[i];
        // onMinionPlayed 只触发随从所在基地
        if (timing === 'onMinionPlayed' && minionContext && i !== minionContext.baseIndex) {
            continue;
        }
        const ctx: BaseAbilityContext = {
            state,
            baseIndex: i,
            baseDefId: base.defId,
            playerId,
            minionUid: minionContext?.minionUid,
            minionDefId: minionContext?.minionDefId,
            minionPower: minionContext?.minionPower,
            now,
        };
        events.push(...triggerBaseAbility(base.defId, timing, ctx));
    }
    return events;
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

function registerExtended(baseDefId: string, timing: string, executor: BaseAbilityExecutor): void {
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
): SmashUpEvent[] {
    const executor = extendedRegistry.get(baseDefId)?.get(timing);
    if (!executor) return [];
    return executor(ctx).events;
}

// ============================================================================
// 基地能力注册（所有可无 Prompt 实现的基地）
// ============================================================================

/** 注册所有基地能力（幂等） */
export function registerBaseAbilities(): void {

    // === 基础版 (Base Set) ===

    // base_rhodes_plaza: 罗德百货商场
    // "在这个基地计分时，每位玩家在这里每有一个随从就获得1VP。"
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
    // "你的回合开始时，如果你有随从在这，抽一张卡牌。"
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
    // "每个在这里的随从获得+1力量。"
    registerBaseAbility('base_central_brain', 'onMinionPlayed', (ctx) => {
        if (!ctx.minionUid) return { events: [] };
        return {
            events: [{
                type: SU_EVENTS.POWER_COUNTER_ADDED,
                payload: {
                    minionUid: ctx.minionUid,
                    baseIndex: ctx.baseIndex,
                    amount: 1,
                    reason: '中央大脑：+1力量',
                },
                timestamp: ctx.now,
            } as PowerCounterAddedEvent],
        };
    });

    // base_cave_of_shinies: 闪光洞穴
    // "每当这里的一个随从被消灭后，它的拥有者获得1VP。"
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
    // "当这个基地计分时，冠军在这里每有5力量就获得1VP。"
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
                    reason: `工厂：每5力量1VP（${maxPower}力量→${bonusVp}VP）`,
                },
                timestamp: ctx.now,
            } as VpAwardedEvent],
        };
    });

    // base_tar_pits: 焦油坑
    // "每当有一个随从在这里被消灭后，将它放到其拥有者的牌库底。"
    // 实现：onMinionDestroyed → 从弃牌堆移到牌库底
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
    // "在这个基地计分后，冠军弃掉他的手牌并抽取5张牌。"
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
    // "在这个基地计分后，将每位玩家在这里力量最高的一张随从放入他们拥有者的牌库底。"
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
    // "在这个基地计分后，所有在这里有随从的玩家可以抽一张卡牌。"
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

    // === 扩展版 (Awesome Level 9000) ===

    // base_haunted_house_al9000: 鬼屋
    // "在一个玩家打出一个随从到这后，这个玩家必须弃掉一张卡牌。"
    registerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', (ctx) => {
        const player = ctx.state.players[ctx.playerId];
        if (!player || player.hand.length === 0) return { events: [] };
        // 自动弃掉手牌中第一张（无 Prompt 时的简化实现）
        // TODO: 接入 PromptSystem 后改为玩家选择弃哪张
        const cardToDiscard = player.hand[0];
        return {
            events: [{
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: {
                    playerId: ctx.playerId,
                    cardUids: [cardToDiscard.uid],
                },
                timestamp: ctx.now,
            } as CardsDiscardedEvent],
        };
    });

    // base_the_field_of_honor: 荣誉之地
    // "当一个或多个随从在这里被消灭，那个将它们消灭的玩家获得1VP。"
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
    // "当一个玩家打出一个战术到这个基地时，该玩家可以额外打出一张战术。"
    registerBaseAbility('base_the_workshop', 'onActionPlayed', (ctx) => {
        return {
            events: [{
                type: SU_EVENTS.LIMIT_MODIFIED,
                payload: {
                    playerId: ctx.playerId,
                    limitType: 'action',
                    delta: 1,
                    reason: '工坊：额外打出一张战术',
                },
                timestamp: ctx.now,
            } as LimitModifiedEvent],
        };
    });

    // base_stadium: 体育场
    // "这里的一个随从被消灭后，它的控制者抽一张卡牌。"
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
    // "在这个基地计分后，在它上面的所有随从洗回他们的拥有者牌库，而不是进入弃牌堆。"
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

    // === 需要 PromptSystem 的基地（标记 TODO） ===
    // base_the_homeworld: 随从入场后可额外打出力量≤2的随从
    // base_the_mothership: 计分后冠军可返回力量≤3随从
    // base_ninja_dojo: 计分后冠军可消灭任意随从
    // base_pirate_cove: 计分后非冠军可移动随从
    // base_tortuga: 计分后亚军可移动随从
    // base_wizard_academy: 计分后冠军查看基地牌库顶3张
    // base_mushroom_kingdom: 回合开始移动对手随从
    // base_rlyeh: 回合开始可消灭自己随从获1VP
    // base_the_asylum: 随从入场后可返回疯狂卡
    // base_innsmouth_base: 随从入场后可将弃牌堆卡放牌库底
    // base_mountains_of_madness: 随从入场后抽疯狂卡
    // base_miskatonic_university_base: 计分后返回疯狂卡
    // base_greenhouse: 计分后搜牌库打出随从
    // base_secret_garden: 额外打出力量≤2随从
    // base_inventors_salon: 计分后从弃牌堆取战术卡
    // base_cat_fanciers_alley: 消灭自己随从抽牌
    // base_house_of_nine_lives: 随从被消灭时可移到此处
    // base_enchanted_glade: 打出战术到随从后抽牌
    // base_fairy_ring: 首次打出随从后额外出牌
    // base_land_of_balance: 打出随从后移动自己随从
    // base_plateau_of_leng: 首次打出随从后可打同名随从

    // === 限制类基地（需要 validate 层支持） ===
    // base_dread_lookout: 不能打出战术
    // base_tsars_palace: 力量≤2随从不能打出
    // base_castle_of_ice: 不能打出随从
    // base_north_pole: 每回合只能打出1个随从

    // === 被动保护类（复杂，需要拦截机制） ===
    // base_beautiful_castle: 力量≥5随从免疫
    // base_pony_paradise: 2+随从免疫消灭
}
