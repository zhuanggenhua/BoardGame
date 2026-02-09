/**
 * 大杀四方 (Smash Up) - 测试辅助函数
 *
 * 所有测试文件共用的 makeMinion / makePlayer / makeState / makeMatchState 等工厂函数。
 * 消除 16+ 个测试文件中的重复定义。
 */

import type { MatchState } from '../../../engine/types';
import type {
    SmashUpCore,
    PlayerState,
    MinionOnBase,
    BaseInPlay,
    CardInstance,
} from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';

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

/** 创建卡牌实例 */
export function makeCard(
    uid: string,
    defId: string,
    owner: string,
    type: 'minion' | 'action' = 'minion',
): CardInstance {
    return { uid, defId, owner, type };
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
    return { core, sys: { phase: 'playCards' } as any } as any;
}
