/**
 * 大杀四方 - 属性测试共用状态生成器
 *
 * 提供 fast-check arbitrary 用于生成随机游戏状态。
 */

import * as fc from 'fast-check';
import type { SmashUpCore, PlayerState, BaseInPlay, MinionOnBase, CardInstance } from '../../domain/types';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';

// ============================================================================
// 基础派系列表
// ============================================================================

export const BASE_FACTIONS = [
    SMASHUP_FACTION_IDS.ALIENS,
    SMASHUP_FACTION_IDS.DINOSAURS,
    SMASHUP_FACTION_IDS.GHOSTS,
    SMASHUP_FACTION_IDS.NINJAS,
    SMASHUP_FACTION_IDS.PIRATES,
    SMASHUP_FACTION_IDS.ROBOTS,
    SMASHUP_FACTION_IDS.TRICKSTERS,
    SMASHUP_FACTION_IDS.WIZARDS,
    SMASHUP_FACTION_IDS.ZOMBIES,
    SMASHUP_FACTION_IDS.BEAR_CAVALRY,
    SMASHUP_FACTION_IDS.STEAMPUNKS,
    SMASHUP_FACTION_IDS.KILLER_PLANTS,
] as const;

export const ALL_FACTIONS = [
    ...BASE_FACTIONS,
    SMASHUP_FACTION_IDS.INNSMOUTH,
    SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY,
    SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU,
    SMASHUP_FACTION_IDS.ELDER_THINGS,
] as const;

// ============================================================================
// 卡牌生成器
// ============================================================================

let uidCounter = 0;
function nextUid(): string {
    return `gen-${uidCounter++}`;
}

export function resetUidCounter(): void {
    uidCounter = 0;
}

/** 生成随机卡牌实例 */
export const arbCardInstance: fc.Arbitrary<CardInstance> = fc.record({
    uid: fc.constant('').map(() => nextUid()),
    defId: fc.stringMatching(/^[a-z_]{3,20}$/),
    type: fc.constantFrom('minion' as const, 'action' as const),
    owner: fc.constantFrom('0', '1'),
    faction: fc.constantFrom(...ALL_FACTIONS),
});

/** 生成随机随从卡牌 */
export const arbMinionCard: fc.Arbitrary<CardInstance> = arbCardInstance.map(c => ({
    ...c,
    type: 'minion' as const,
}));

/** 生成随机行动卡牌 */
export const arbActionCard: fc.Arbitrary<CardInstance> = arbCardInstance.map(c => ({
    ...c,
    type: 'action' as const,
}));

// ============================================================================
// 随从生成器
// ============================================================================

/** 生成随机场上随从 */
export const arbMinionOnBase: fc.Arbitrary<MinionOnBase> = fc.record({
    uid: fc.constant('').map(() => nextUid()),
    defId: fc.stringMatching(/^[a-z_]{3,20}$/),
    controller: fc.constantFrom('0', '1'),
    owner: fc.constantFrom('0', '1'),
    basePower: fc.integer({ min: 1, max: 10 }),
    powerModifier: fc.integer({ min: 0, max: 5 }),
    talentUsed: fc.boolean(),
    attachedActions: fc.constant([]),
});

// ============================================================================
// 基地生成器
// ============================================================================

/** 生成随机基地 */
export const arbBase: fc.Arbitrary<BaseInPlay> = fc.record({
    defId: fc.stringMatching(/^base_[a-z_]{3,15}$/),
    minions: fc.array(arbMinionOnBase, { minLength: 0, maxLength: 6 }),
    ongoingActions: fc.constant([]),
});

// ============================================================================
// 派系组合生成器
// ============================================================================

/** 生成合法的两个派系组合（互不相同） */
export const arbFactionPair: fc.Arbitrary<[string, string]> = fc
    .tuple(
        fc.integer({ min: 0, max: ALL_FACTIONS.length - 1 }),
        fc.integer({ min: 0, max: ALL_FACTIONS.length - 1 })
    )
    .filter(([a, b]) => a !== b)
    .map(([a, b]) => [ALL_FACTIONS[a], ALL_FACTIONS[b]]);

/** 生成两组互不重叠的派系组合（两个玩家） */
export const arbTwoPlayerFactions: fc.Arbitrary<[[string, string], [string, string]]> = fc
    .tuple(
        fc.integer({ min: 0, max: ALL_FACTIONS.length - 1 }),
        fc.integer({ min: 0, max: ALL_FACTIONS.length - 1 }),
        fc.integer({ min: 0, max: ALL_FACTIONS.length - 1 }),
        fc.integer({ min: 0, max: ALL_FACTIONS.length - 1 })
    )
    .filter(([a, b, c, d]) => {
        const set = new Set([a, b, c, d]);
        return set.size === 4 && a !== b && c !== d;
    })
    .map(([a, b, c, d]) => [
        [ALL_FACTIONS[a], ALL_FACTIONS[b]] as [string, string],
        [ALL_FACTIONS[c], ALL_FACTIONS[d]] as [string, string],
    ]);

// ============================================================================
// 玩家状态生成器
// ============================================================================

/** 生成随机玩家状态 */
export function arbPlayerState(id: string, factions: [string, string]): fc.Arbitrary<PlayerState> {
    return fc.record({
        id: fc.constant(id),
        vp: fc.integer({ min: 0, max: 15 }),
        hand: fc.array(arbCardInstance, { minLength: 0, maxLength: 10 }),
        deck: fc.array(arbCardInstance, { minLength: 0, maxLength: 40 }),
        discard: fc.array(arbCardInstance, { minLength: 0, maxLength: 20 }),
        minionsPlayed: fc.integer({ min: 0, max: 3 }),
        minionLimit: fc.integer({ min: 1, max: 3 }),
        actionsPlayed: fc.integer({ min: 0, max: 3 }),
        actionLimit: fc.integer({ min: 1, max: 3 }),
        factions: fc.constant(factions),
    });
}

// ============================================================================
// 完整游戏状态生成器
// ============================================================================

/** 生成最小可用游戏状态（两个玩家） */
export function arbMinimalGameState(): fc.Arbitrary<SmashUpCore> {
    return arbTwoPlayerFactions.chain(([f1, f2]) =>
        fc.record({
            players: fc.record({
                '0': arbPlayerState('0', f1),
                '1': arbPlayerState('1', f2),
            }),
            turnOrder: fc.constant(['0', '1']),
            currentPlayerIndex: fc.constantFrom(0, 1),
            bases: fc.array(arbBase, { minLength: 1, maxLength: 5 }),
            baseDeck: fc.constant([]),
            turnNumber: fc.integer({ min: 1, max: 20 }),
            nextUid: fc.constant(1000),
        })
    );
}
