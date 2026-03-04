/**
 * 大杀四方 (Smash Up) - 测试辅助函数
 *
 * 所有测试文件共用的 makeMinion / makePlayer / makeState / makeMatchState 等工厂函数。
 * 消除 16+ 个测试文件中的重复定义。
 */

import type { MatchState } from '../../../engine/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    PlayerState,
    MinionOnBase,
    BaseInPlay,
    CardInstance,
} from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { reduce } from '../domain/reducer';
import { createInitialSystemState } from '../../../engine/pipeline';
import { smashUpTestSystems } from './testRunner';

// ============================================================================
// 随从工厂
// ============================================================================

/** 创建基地上的随从实例（常用签名） */
export function makeMinion(
    uid: string,
    defId: string,
    controller: string,
    power: number,
    ownerOrOpts?: string | Partial<MinionOnBase>,
): MinionOnBase {
    const base: MinionOnBase = {
        uid,
        defId,
        controller,
        owner: typeof ownerOrOpts === 'string' ? ownerOrOpts : controller,
        basePower: power,
        powerModifier: 0,
        talentUsed: false,
        attachedActions: [],
    };
    if (typeof ownerOrOpts === 'object') {
        return { ...base, ...ownerOrOpts };
    }
    return base;
}

/** 创建基地上的随从实例（overrides 签名，用于 ongoingEffects/baseFactionOngoing/expansionOngoing 等） */
export function makeMinionFromOverrides(overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid: 'minion-1',
        defId: 'test_minion',
        controller: '0',
        owner: '0',
        basePower: 3,
        powerModifier: 0,
        talentUsed: false,
        attachedActions: [],
        ...overrides,
    };
}


// ============================================================================
// 玩家工厂
// ============================================================================

/** 创建玩家状态（通用签名） */
export function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id,
        vp: 0,
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.ALIENS],
        ...overrides,
    };
}

/** 创建玩家状态（带自定义派系签名） */
export function makePlayerWithFactions(
    id: string,
    factions: [string, string],
    overrides?: Partial<PlayerState>,
): PlayerState {
    return makePlayer(id, { factions, ...overrides });
}

// ============================================================================
// 卡牌实例工厂
// ============================================================================

/** 创建卡牌实例（4 参数签名：uid, defId, type, owner） */
export function makeCard(
    uid: string,
    defId: string,
    type: 'minion' | 'action',
    owner: string,
): CardInstance;
/** 创建卡牌实例（3 参数签名：uid, defId, owner，默认 type='minion'） */
export function makeCard(
    uid: string,
    defId: string,
    owner: string,
): CardInstance;
/** 创建卡牌实例实现 */
export function makeCard(
    uid: string,
    defId: string,
    typeOrOwner: 'minion' | 'action' | string,
    owner?: string,
): CardInstance {
    // 3 参数：uid, defId, owner（type 默认为 'minion'）
    if (owner === undefined) {
        return { uid, defId, owner: typeOrOwner, type: 'minion' };
    }
    // 4 参数：uid, defId, type, owner
    return { uid, defId, owner, type: typeOrOwner as 'minion' | 'action' };
}

// ============================================================================
// 基地工厂
// ============================================================================

/** 创建空基地 */
export function makeBase(defId: string, minions: MinionOnBase[] = []): BaseInPlay {
    return { defId, minions, ongoingActions: [] };
}

// ============================================================================
// 状态工厂
// ============================================================================

/** 创建最小可用的 SmashUpCore（双人） */
export function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [{ defId: 'test_base', minions: [], ongoingActions: [] }],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

/** 创建带基地列表的 SmashUpCore */
export function makeStateWithBases(
    bases: BaseInPlay[],
    overrides?: Partial<SmashUpCore>,
): SmashUpCore {
    return makeState({ bases, ...overrides });
}

/** 创建带疯狂牌库的 SmashUpCore */
export function makeStateWithMadness(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return makeState({
        madnessDeck: Array.from({ length: 30 }, (_, i) => `madness_${i}`),
        ...overrides,
    });
}

/** 包装为 MatchState（用于 validate/execute 测试） */
export function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    const playerIds = Object.keys(core.players);
    const sys = createInitialSystemState(playerIds, smashUpTestSystems, undefined);
    // 测试默认在出牌阶段
    sys.phase = 'playCards';
    return { core, sys };
}

// ============================================================================
// 事件应用工具
// ============================================================================

/** 应用事件列表到状态（通过 reduce） */
export function applyEvents(state: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((s, e) => reduce(s, e), state);
}

// ============================================================================
// InteractionHandler 测试桥接工具
// ============================================================================

import type { InteractionHandler } from '../domain/abilityInteractionHandlers';
import type { RandomFn } from '../../../engine/types';

/**
 * 旧式 handler 调用桥接：将对象参数转为位置参数
 *
 * 旧调用：handler({ state, playerId, selectedValue, data, random, now })
 * 新签名：handler(matchState, playerId, value, iData, random, timestamp)
 *
 * 返回 events 数组（兼容旧测试断言）
 */
export function callHandler(
    handler: InteractionHandler,
    args: {
        state: SmashUpCore;
        playerId: string;
        selectedValue: unknown;
        data?: Record<string, unknown>;
        random: RandomFn;
        now: number;
    },
): SmashUpEvent[] {
    const ms = makeMatchState(args.state);
    // 旧测试的 data 字段对应新 handler 中 iData.continuationContext
    const iData = args.data && Object.keys(args.data).length > 0
        ? { continuationContext: args.data } as Record<string, unknown>
        : undefined;
    const result = handler(
        ms,
        args.playerId,
        args.selectedValue,
        iData,
        args.random,
        args.now,
    );
    return result?.events ?? [];
}

import type { BaseAbilityContext, BaseAbilityResult } from '../domain/baseAbilities';
import { triggerBaseAbility as _triggerBaseAbility } from '../domain/baseAbilities';

/**
 * 基地能力测试桥接：自动注入 matchState 到 ctx
 *
 * 旧测试不传 matchState，但新能力实现需要它来调用 queueInteraction。
 * 返回 BaseAbilityResult（含 events 和 matchState）。
 */
export function triggerBaseAbilityWithMS(
    baseDefId: string,
    timing: 'onMinionPlayed' | 'onMinionDestroyed' | 'onTurnStart' | 'afterScoring' | 'onActionPlayed',
    ctx: BaseAbilityContext,
): BaseAbilityResult {
    const ctxWithMS: BaseAbilityContext = {
        ...ctx,
        matchState: ctx.matchState ?? makeMatchState(ctx.state),
    };
    return _triggerBaseAbility(baseDefId, timing, ctxWithMS);
}

/**
 * 获取 BaseAbilityResult 中的所有 interaction（current + queue）
 * 用于替代旧的 CHOICE_REQUESTED 事件检查
 */
export function getInteractionsFromResult(result: BaseAbilityResult): any[] {
    const interaction = (result.matchState?.sys as any)?.interaction;
    if (!interaction) return [];
    const list: any[] = [];
    if (interaction.current) list.push(interaction.current);
    if (interaction.queue?.length) list.push(...interaction.queue);
    return list;
}


/**
 * 从 MatchState 中获取所有 interaction（current + queue）
 * 用于 execute() 后检查是否创建了交互
 */
export function getInteractionsFromMS(ms: MatchState<SmashUpCore>): any[] {
    const interaction = (ms.sys as any)?.interaction;
    if (!interaction) return [];
    const list: any[] = [];
    if (interaction.current) list.push(interaction.current);
    if (interaction.queue?.length) list.push(...interaction.queue);
    return list;
}
