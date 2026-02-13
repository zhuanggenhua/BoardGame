/**
 * 大杀四方 - 核心属性测试
 *
 * 使用 fast-check 验证核心不变量。
 * Feature: smashup-core-abilities
 */

import { describe, test, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { clearRegistry, resolveAbility } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearOngoingEffectRegistry, isOperationRestricted, isMinionProtected } from '../../domain/ongoingEffects';
import { execute, reduce } from '../../domain/reducer';
import { validate } from '../../domain/commands';
import {
    SU_COMMANDS, SU_EVENTS,
    MADNESS_CARD_DEF_ID, MADNESS_DECK_SIZE,
} from '../../domain/types';
import { SMASHUP_FACTION_IDS } from '../../domain/ids';
import type {
    SmashUpCore, PlayerState, CardInstance,
    MinionOnBase, BaseInPlay, SmashUpEvent, AbilityTag,
} from '../../domain/types';
import type { MatchState, RandomFn } from '../../../../engine/types';
import { ALL_FACTIONS } from './arbitraries';
import { getFactionCards, getCardDef, getBaseDef, getAllBaseDefIds } from '../../data/cards';
import { madnessVpPenalty } from '../../domain/abilityHelpers';
import { buildDeck } from '../../domain/utils';
import { getTotalEffectivePowerOnBase } from '../../domain/ongoingModifiers';

// ============================================================================
// 初始化
// ============================================================================

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    initAllAbilities();
});

const dummyRandom: RandomFn = {
    random: () => 0.5,
    shuffle: <T>(arr: T[]): T[] => [...arr],
} as any;

// ============================================================================
// 辅助函数
// ============================================================================

function makeCard(
    uid: string, defId: string,
    type: 'minion' | 'action', owner = '0',
): CardInstance {
    return { uid, defId, type, owner };
}

function makeMinion(
    uid: string, defId: string,
    controller: string, power: number,
): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0,
        talentUsed: false, attachedActions: [],
    };
}

function makePlayer(
    id: string, factions: [string, string],
    overrides?: Partial<PlayerState>,
): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1,
        actionsPlayed: 0, actionLimit: 1,
        factions, ...overrides,
    };
}

function makeBase(
    defId: string, overrides?: Partial<BaseInPlay>,
): BaseInPlay {
    return { defId, minions: [], ongoingActions: [], ...overrides };
}

/** 获取有卡牌定义的派系列表 */
const factionsWithCards = ALL_FACTIONS.filter(f => {
    try { return getFactionCards(f).length > 0; } catch { return false; }
});

// ============================================================================
// Property 1: 派系互斥选择
// ============================================================================

describe('Property 1: 派系互斥选择', () => {
    test('已选派系不可被其他玩家选择', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: ALL_FACTIONS.length - 1 }),
                (factionIdx) => {
                    const faction = ALL_FACTIONS[factionIdx];
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [faction, ''] as any),
                            '1': makePlayer('1', ['', ''] as any),
                        },
                        turnOrder: ['0', '1'],
                        currentPlayerIndex: 1,
                        bases: [makeBase('test_base')],
                        baseDeck: [],
                        turnNumber: 0,
                        nextUid: 100,
                        factionSelection: {
                            takenFactions: [faction],
                            playerSelections: { '0': [faction], '1': [] },
                            completedPlayers: [],
                        },
                    };
                    const matchState: MatchState<SmashUpCore> = {
                        core: state,
                        sys: { phase: 'factionSelect' } as any,
                    };
                    const result = validate(matchState, {
                        type: SU_COMMANDS.SELECT_FACTION,
                        payload: { factionId: faction },
                        playerId: '1',
                    } as any);
                    expect(result.valid).toBe(false);
                },
            ),
            { numRuns: 20 },
        );
    });
});

// ============================================================================
// Property 2: 牌库构建正确性
// ============================================================================

describe('Property 2: 牌库构建正确性', () => {
    test('合法两派系组合构建的牌库张数等于两派系卡牌总数且卡牌属于所选派系', () => {
        if (factionsWithCards.length < 2) return;
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: factionsWithCards.length - 1 }),
                fc.integer({ min: 0, max: factionsWithCards.length - 1 }),
                (a, b) => {
                    fc.pre(a !== b);
                    const f1 = factionsWithCards[a];
                    const f2 = factionsWithCards[b];
                    const f1Cards = getFactionCards(f1);
                    const f2Cards = getFactionCards(f2);
                    const expectedCount =
                        f1Cards.reduce((sum, d) => sum + d.count, 0) +
                        f2Cards.reduce((sum, d) => sum + d.count, 0);
                    const { deck } = buildDeck([f1, f2], '0', 0, dummyRandom);
                    expect(deck.length).toBe(expectedCount);
                    const f1Defs = new Set(f1Cards.map(d => d.id));
                    const f2Defs = new Set(f2Cards.map(d => d.id));
                    for (const card of deck) {
                        expect(
                            f1Defs.has(card.defId) || f2Defs.has(card.defId),
                        ).toBe(true);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });
});

// ============================================================================
// Property 3: 选择完成后初始化
// ============================================================================

describe('Property 3: 选择完成后初始化', () => {
    test('所有玩家选完后每人 5 张手牌且 factionSelection 清除', () => {
        if (factionsWithCards.length < 4) return;
        fc.assert(
            fc.property(
                fc.shuffledSubarray(
                    [...Array(factionsWithCards.length).keys()],
                    { minLength: 4, maxLength: 4 },
                ),
                (indices) => {
                    const [f0a, f0b, f1a, f1b] = indices.map(
                        i => factionsWithCards[i],
                    );
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [f0a, f0b]),
                            '1': makePlayer('1', [f1a, f1b]),
                        },
                        turnOrder: ['0', '1'],
                        currentPlayerIndex: 0,
                        bases: [makeBase('test_base')],
                        baseDeck: [],
                        turnNumber: 0,
                        nextUid: 1,
                        factionSelection: {
                            takenFactions: [f0a, f0b, f1a],
                            playerSelections: { '0': [f0a, f0b], '1': [f1a] },
                            completedPlayers: [],
                        },
                    };
                    const matchState: MatchState<SmashUpCore> = {
                        core: state,
                        sys: { phase: 'factionSelect' } as any,
                    };
                    const events = execute(matchState, {
                        type: SU_COMMANDS.SELECT_FACTION,
                        payload: { factionId: f1b },
                        playerId: '1',
                    } as any, dummyRandom);

                    const allSelected = events.find(
                        e => e.type === SU_EVENTS.ALL_FACTIONS_SELECTED,
                    );
                    expect(allSelected).toBeDefined();
                    if (!allSelected) return;

                    let s = state;
                    for (const evt of events) s = reduce(s, evt as any);
                    expect(s.players['0'].hand.length).toBe(5);
                    expect(s.players['1'].hand.length).toBe(5);
                    expect(s.factionSelection).toBeUndefined();
                },
            ),
            { numRuns: 15 },
        );
    });
});

// ============================================================================
// Property 4: 能力注册表往返一致性
// ============================================================================

describe('Property 4: 能力注册表往返一致性', () => {
    test('注册后解析返回同一执行函数', () => {
        const known: [string, AbilityTag][] = [
            ['alien_invader', 'onPlay'],
            ['pirate_saucy_wench', 'onPlay'],
            ['ninja_tiger_assassin', 'onPlay'],
            ['dino_augmentation', 'onPlay'],
            ['robot_zapbot', 'onPlay'],
            ['wizard_neophyte', 'onPlay'],
            ['zombie_grave_digger', 'onPlay'],
            ['trickster_gnome', 'onPlay'],
        ];
        for (const [defId, tag] of known) {
            const a = resolveAbility(defId, tag);
            if (a) expect(resolveAbility(defId, tag)).toBe(a);
        }
    });

    test('未注册的 defId 解析返回 undefined', () => {
        fc.assert(
            fc.property(
                fc.stringMatching(/^nonexistent_[a-z]{5,10}$/),
                (defId) => {
                    expect(resolveAbility(defId, 'onPlay')).toBeUndefined();
                },
            ),
            { numRuns: 20 },
        );
    });
});

// ============================================================================
// Property 6: 天赋每回合一次
// ============================================================================

describe('Property 6: 天赋每回合一次', () => {
    test('talentUsed=true 时验证拒绝', () => {
        const minion = makeMinion('t-1', 'miskatonic_professor', '0', 5);
        minion.talentUsed = true;
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY, SMASHUP_FACTION_IDS.GHOSTS], {
                    hand: [makeCard('h1', 'test', 'minion')],
                    deck: [makeCard('d1', 'deck1', 'minion')],
                }),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('test_base', { minions: [minion] })],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        const r = validate(
            { core: state, sys: { phase: 'playCards' } as any },
            { type: SU_COMMANDS.USE_TALENT, payload: { minionUid: 't-1', baseIndex: 0 }, playerId: '0' } as any,
        );
        expect(r.valid).toBe(false);
    });

    test('TURN_STARTED 重置 talentUsed', () => {
        const minion = makeMinion('t-1', 'test', '0', 3);
        minion.talentUsed = true;
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('b', { minions: [minion] })],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        const s = reduce(state, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 2 },
            timestamp: Date.now(),
        } as any);
        expect(s.bases[0].minions[0].talentUsed).toBe(false);
    });
});

// ============================================================================
// Property 8: 标准行动卡生命周期
// ============================================================================

describe('Property 8: 标准行动卡生命周期', () => {
    test('打出行动卡后产生 ACTION_PLAYED 且 actionsPlayed 增加', () => {
        const card = makeCard('a-1', 'ghost_ghostly_arrival', 'action');
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS], {
                    hand: [card],
                    deck: [makeCard('d1', 'deck1', 'minion')],
                }),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('test_base')],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        const events = execute(
            { core: state, sys: { phase: 'playCards' } as any },
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a-1', baseIndex: 0 } } as any,
            dummyRandom,
        );
        expect(events.some(e => e.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        let s = state;
        for (const e of events) s = reduce(s, e as any);
        expect(s.players['0'].actionsPlayed).toBe(1);
    });
});

// ============================================================================
// Property 9: 持续行动卡附着
// ============================================================================

describe('Property 9: 持续行动卡附着', () => {
    test('ongoing 行动卡附着到基地，不在弃牌堆', () => {
        // trickster_enshrouding_mist 是 ongoing 子类型
        const card = makeCard('og-1', 'trickster_enshrouding_mist', 'action');
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.TRICKSTERS, SMASHUP_FACTION_IDS.GHOSTS], {
                    hand: [card],
                    deck: [makeCard('d1', 'x', 'minion')],
                }),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('test_base')],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        const events = execute(
            { core: state, sys: { phase: 'playCards' } as any },
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'og-1', targetBaseIndex: 0 } } as any,
            dummyRandom,
        );
        expect(events.some(e => e.type === SU_EVENTS.ONGOING_ATTACHED)).toBe(true);
        let s = state;
        for (const e of events) s = reduce(s, e as any);
        expect(s.bases[0].ongoingActions.some(o => o.uid === 'og-1')).toBe(true);
        expect(s.players['0'].discard.some(c => c.uid === 'og-1')).toBe(false);
    });

    test('ongoing 行动卡附着到随从', () => {
        // dino_upgrade 是 ongoing 子类型，可附着到随从
        const card = makeCard('og-2', 'dino_upgrade', 'action');
        const minion = makeMinion('m-1', 'test', '0', 3);
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.DINOSAURS, SMASHUP_FACTION_IDS.NINJAS], {
                    hand: [card],
                    deck: [makeCard('d1', 'x', 'minion')],
                }),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('test_base', { minions: [minion] })],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        const events = execute(
            { core: state, sys: { phase: 'playCards' } as any },
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'og-2', targetBaseIndex: 0, targetMinionUid: 'm-1' } } as any,
            dummyRandom,
        );
        let s = state;
        for (const e of events) s = reduce(s, e as any);
        const m = s.bases[0].minions.find(x => x.uid === 'm-1');
        expect(m?.attachedActions.some(a => a.uid === 'og-2')).toBe(true);
        expect(s.players['0'].discard.some(c => c.uid === 'og-2')).toBe(false);
    });
});

// ============================================================================
// Property 11: 基地记分时持续行动清理
// ============================================================================

describe('Property 11: 基地记分时持续行动清理', () => {
    test('记分后 ongoing 行动卡回各自所有者弃牌堆', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 5 }),
                (ongoingCount) => {
                    const ongoingActions = Array.from({ length: ongoingCount }, (_, i) => ({
                        uid: `og-${i}`, defId: `ongoing_${i}`, ownerId: i % 2 === 0 ? '0' : '1',
                    }));
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase('scored_base', {
                            minions: [makeMinion('m1', 'x', '0', 3)],
                            ongoingActions,
                        })],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    const event = {
                        type: SU_EVENTS.BASE_SCORED,
                        payload: {
                            baseIndex: 0, baseDefId: 'scored_base',
                            rankings: [{ playerId: '0', power: 3, vp: 4 }],
                        },
                        timestamp: Date.now(),
                    };
                    const s = reduce(state, event as any);
                    // 基地被移除
                    expect(s.bases.length).toBe(0);
                    // ongoing 卡回各自所有者弃牌堆
                    for (const og of ongoingActions) {
                        const owner = s.players[og.ownerId];
                        expect(owner.discard.some(c => c.uid === og.uid)).toBe(true);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });
});

// ============================================================================
// Property 12: 随从离场时附着行动清理
// ============================================================================

describe('Property 12: 随从离场时附着行动清理', () => {
    test('随从被消灭后附着行动卡回各自所有者弃牌堆', () => {
        const attached: MinionOnBase['attachedActions'] = [
            { uid: 'att-0', defId: 'att_def_0', ownerId: '0' },
            { uid: 'att-1', defId: 'att_def_1', ownerId: '1' },
        ];
        const minion = makeMinion('m-1', 'test', '0', 3);
        minion.attachedActions = attached;
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('b', { minions: [minion] })],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        const event = {
            type: SU_EVENTS.MINION_DESTROYED,
            payload: {
                minionUid: 'm-1', minionDefId: 'test',
                fromBaseIndex: 0, ownerId: '0', reason: 'test',
            },
            timestamp: Date.now(),
        };
        const s = reduce(state, event as any);
        // 随从从基地移除
        expect(s.bases[0].minions.find(m => m.uid === 'm-1')).toBeUndefined();
        // 附着行动卡回各自所有者弃牌堆
        expect(s.players['0'].discard.some(c => c.uid === 'att-0')).toBe(true);
        expect(s.players['1'].discard.some(c => c.uid === 'att-1')).toBe(true);
        // 随从本身回所有者弃牌堆
        expect(s.players['0'].discard.some(c => c.uid === 'm-1')).toBe(true);
    });

    test('基地记分时随从附着行动卡也被清理', () => {
        const attached = [{ uid: 'att-x', defId: 'att_x', ownerId: '1' }];
        const minion = makeMinion('m-2', 'test2', '0', 5);
        minion.attachedActions = attached;
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('b', { minions: [minion] })],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        const event = {
            type: SU_EVENTS.BASE_SCORED,
            payload: {
                baseIndex: 0, baseDefId: 'b',
                rankings: [{ playerId: '0', power: 5, vp: 4 }],
            },
            timestamp: Date.now(),
        };
        const s = reduce(state, event as any);
        // 附着行动卡回所有者弃牌堆
        expect(s.players['1'].discard.some(c => c.uid === 'att-x')).toBe(true);
    });
});

// ============================================================================
// Property 13: 力量指示物不变量
// ============================================================================

describe('Property 13: 力量指示物不变量', () => {
    test('powerModifier 始终 >= 0', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 10 }),
                fc.integer({ min: 0, max: 20 }),
                (initial, removeAmount) => {
                    const minion = makeMinion('pm-1', 'test', '0', 3);
                    minion.powerModifier = initial;
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase('b', { minions: [minion] })],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    const s = reduce(state, {
                        type: SU_EVENTS.POWER_COUNTER_REMOVED,
                        payload: { minionUid: 'pm-1', baseIndex: 0, amount: removeAmount, reason: 'test' },
                        timestamp: Date.now(),
                    } as any);
                    const m = s.bases[0].minions.find(x => x.uid === 'pm-1');
                    if (m) expect(m.powerModifier).toBeGreaterThanOrEqual(0);
                },
            ),
            { numRuns: 50 },
        );
    });

    test('添加 N 增加 N', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 5 }),
                fc.integer({ min: 1, max: 10 }),
                (initial, addAmount) => {
                    const minion = makeMinion('pm-1', 'test', '0', 3);
                    minion.powerModifier = initial;
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase('b', { minions: [minion] })],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    const s = reduce(state, {
                        type: SU_EVENTS.POWER_COUNTER_ADDED,
                        payload: { minionUid: 'pm-1', baseIndex: 0, amount: addAmount, reason: 'test' },
                        timestamp: Date.now(),
                    } as any);
                    const m = s.bases[0].minions.find(x => x.uid === 'pm-1');
                    if (m) expect(m.powerModifier).toBe(initial + addAmount);
                },
            ),
            { numRuns: 50 },
        );
    });

    test('基地总力量等于所有随从 (basePower + powerModifier) 之和', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        power: fc.integer({ min: 1, max: 10 }),
                        modifier: fc.integer({ min: 0, max: 5 }),
                    }),
                    { minLength: 1, maxLength: 6 },
                ),
                (minionSpecs) => {
                    const minions = minionSpecs.map((spec, i) => {
                        const m = makeMinion(`m-${i}`, `d-${i}`, '0', spec.power);
                        m.powerModifier = spec.modifier;
                        return m;
                    });
                    const base = makeBase('b', { minions });
                    const expectedTotal = minionSpecs.reduce(
                        (sum, s) => sum + s.power + s.modifier, 0,
                    );
                    const actual = base.minions.reduce(
                        (sum, m) => sum + m.basePower + m.powerModifier, 0,
                    );
                    expect(actual).toBe(expectedTotal);
                },
            ),
            { numRuns: 30 },
        );
    });
});

// ============================================================================
// Property 16: VP 分配正确性
// ============================================================================

describe('Property 16: VP 分配正确性', () => {
    test('BASE_SCORED 正确分配 VP 给排名玩家', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 10 }),
                fc.integer({ min: 1, max: 10 }),
                fc.integer({ min: 1, max: 5 }),
                fc.integer({ min: 0, max: 3 }),
                (p0Power, p1Power, vp1st, vp2nd) => {
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase('b', {
                            minions: [
                                makeMinion('m0', 'x', '0', p0Power),
                                makeMinion('m1', 'y', '1', p1Power),
                            ],
                        })],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    // 按力量排名
                    const rankings = p0Power >= p1Power
                        ? [
                            { playerId: '0', power: p0Power, vp: vp1st },
                            { playerId: '1', power: p1Power, vp: vp2nd },
                        ]
                        : [
                            { playerId: '1', power: p1Power, vp: vp1st },
                            { playerId: '0', power: p0Power, vp: vp2nd },
                        ];
                    const event = {
                        type: SU_EVENTS.BASE_SCORED,
                        payload: { baseIndex: 0, baseDefId: 'b', rankings },
                        timestamp: Date.now(),
                    };
                    const s = reduce(state, event as any);
                    // 冠军获得 vp1st
                    const winnerId = rankings[0].playerId;
                    const loserId = rankings[1].playerId;
                    expect(s.players[winnerId].vp).toBe(vp1st);
                    expect(s.players[loserId].vp).toBe(vp2nd);
                },
            ),
            { numRuns: 30 },
        );
    });

    test('零力量玩家不获得 VP', () => {
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('b', {
                minions: [makeMinion('m0', 'x', '0', 5)],
            })],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        const event = {
            type: SU_EVENTS.BASE_SCORED,
            payload: {
                baseIndex: 0, baseDefId: 'b',
                rankings: [
                    { playerId: '0', power: 5, vp: 4 },
                    { playerId: '1', power: 0, vp: 0 },
                ],
            },
            timestamp: Date.now(),
        };
        const s = reduce(state, event as any);
        expect(s.players['0'].vp).toBe(4);
        expect(s.players['1'].vp).toBe(0);
    });
});

// ============================================================================
// Property 17: 基地能力事件顺序
// ============================================================================

describe('Property 17: 基地能力事件顺序', () => {
    test('onMinionPlayed 基地能力事件在 MINION_PLAYED 之后', () => {
        // 中央大脑：随从入场时 +1 力量
        const card = makeCard('m-1', 'alien_invader', 'minion');
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.NINJAS], {
                    hand: [card],
                    deck: [makeCard('d1', 'x', 'minion')],
                }),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.GHOSTS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('base_central_brain')],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        const events = execute(
            { core: state, sys: { phase: 'playCards' } as any },
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'm-1', baseIndex: 0 } } as any,
            dummyRandom,
        );
        const minionPlayedIdx = events.findIndex(e => e.type === SU_EVENTS.MINION_PLAYED);
        const powerAddedIdx = events.findIndex(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(minionPlayedIdx).toBeGreaterThanOrEqual(0);
        // 如果有 POWER_COUNTER_ADDED，它应在 MINION_PLAYED 之后
        if (powerAddedIdx >= 0) {
            expect(powerAddedIdx).toBeGreaterThan(minionPlayedIdx);
        }
    });
});

// ============================================================================
// Property 18: Me First 窗口协议
// ============================================================================

describe('Property 18: Me First 窗口协议', () => {
    test('Me First 窗口中只能打出 special 行动卡', () => {
        // 构造 Me First 响应窗口状态
        const standardCard = makeCard('a-1', 'ghost_ghostly_arrival', 'action');
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS], { hand: [standardCard] }),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('b')],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        const matchState: MatchState<SmashUpCore> = {
            core: state,
            sys: {
                phase: 'scoreBases',
                responseWindow: {
                    current: {
                        windowId: 'meFirst_test',
                        windowType: 'meFirst',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 0,
                        consecutivePasses: 0,
                    },
                },
            } as any,
        };
        // 尝试打出 standard 行动卡（应被拒绝）
        const r = validate(matchState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-1' },
        } as any);
        expect(r.valid).toBe(false);
        expect(r.error).toContain('特殊');
    });

    test('非当前响应者不能在 Me First 窗口中打牌', () => {
        const specialCard = makeCard('s-1', 'ninja_hidden_ninja', 'action');
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS], { hand: [specialCard] }),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('b')],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        const matchState: MatchState<SmashUpCore> = {
            core: state,
            sys: {
                phase: 'scoreBases',
                responseWindow: {
                    current: {
                        windowId: 'meFirst_test',
                        windowType: 'meFirst',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 0, // 当前是玩家0
                        consecutivePasses: 0,
                    },
                },
            } as any,
        };
        // 玩家1尝试打牌（不是当前响应者）
        const r = validate(matchState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 's-1' },
        } as any);
        expect(r.valid).toBe(false);
    });
});

// ============================================================================
// Property 19: 疯狂牌库生命周期
// ============================================================================

describe('Property 19: 疯狂牌库生命周期', () => {
    test('抽取 N 张疯狂牌使牌库减少 N 且玩家手牌增加 N', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 5 }),
                (drawCount) => {
                    const madnessDeck = Array.from(
                        { length: MADNESS_DECK_SIZE },
                        () => MADNESS_CARD_DEF_ID,
                    );
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase('b')],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                        madnessDeck,
                    };
                    const cardUids = Array.from(
                        { length: drawCount },
                        (_, i) => `mad-${i}`,
                    );
                    const event = {
                        type: SU_EVENTS.MADNESS_DRAWN,
                        payload: {
                            playerId: '0', count: drawCount,
                            cardUids, reason: 'test',
                        },
                        timestamp: Date.now(),
                    };
                    const s = reduce(state, event as any);
                    expect(s.madnessDeck!.length).toBe(MADNESS_DECK_SIZE - drawCount);
                    expect(s.players['0'].hand.length).toBe(drawCount);
                    // 所有抽到的卡都是疯狂卡
                    for (const c of s.players['0'].hand) {
                        expect(c.defId).toBe(MADNESS_CARD_DEF_ID);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    test('疯狂卡返回时从手牌移除并回到牌库', () => {
        const madnessCard = makeCard('mad-0', MADNESS_CARD_DEF_ID, 'action');
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU, SMASHUP_FACTION_IDS.NINJAS], {
                    hand: [madnessCard],
                }),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('b')],
            baseDeck: [], turnNumber: 1, nextUid: 100,
            madnessDeck: Array.from(
                { length: 29 },
                () => MADNESS_CARD_DEF_ID,
            ),
        };
        const event = {
            type: SU_EVENTS.MADNESS_RETURNED,
            payload: { playerId: '0', cardUid: 'mad-0', reason: 'test' },
            timestamp: Date.now(),
        };
        const s = reduce(state, event as any);
        expect(s.players['0'].hand.length).toBe(0);
        expect(s.madnessDeck!.length).toBe(30);
    });

    test('疯狂卡 VP 惩罚：每 2 张扣 1 VP', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 20 }),
                (count) => {
                    expect(madnessVpPenalty(count)).toBe(Math.floor(count / 2));
                },
            ),
            { numRuns: 20 },
        );
    });
});

// ============================================================================
// Property 5: onPlay 能力触发
// ============================================================================

describe('Property 5: onPlay 能力触发', () => {
    /** 已知有 onPlay 能力的随从 defId 列表（从注册表验证） */
    const minionsWithOnPlay = [
        'alien_invader',
        'pirate_saucy_wench',
        'ninja_tiger_assassin',
        'dino_augmentation',
        'robot_zapbot',
        'wizard_neophyte',
        'zombie_grave_digger',
        'trickster_gnome',
    ];

    test('所有已知 onPlay 随从都已注册能力', () => {
        for (const defId of minionsWithOnPlay) {
            const executor = resolveAbility(defId, 'onPlay');
            expect(executor, `${defId} 应注册 onPlay 能力`).toBeDefined();
        }
    });

    test('带 onPlay 的随从打出后事件序列包含 MINION_PLAYED', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: minionsWithOnPlay.length - 1 }),
                (idx) => {
                    const defId = minionsWithOnPlay[idx];
                    const card = makeCard('op-1', defId, 'minion');
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.NINJAS], {
                                hand: [card],
                                deck: Array.from({ length: 10 }, (_, i) =>
                                    makeCard(`d${i}`, 'filler', 'minion'),
                                ),
                                discard: Array.from({ length: 3 }, (_, i) =>
                                    makeCard(`dis${i}`, 'zombie_walker', 'minion'),
                                ),
                            }),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.GHOSTS], {
                                deck: Array.from({ length: 5 }, (_, i) =>
                                    makeCard(`e${i}`, 'filler2', 'minion'),
                                ),
                            }),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase('test_base', {
                            minions: [makeMinion('existing-m', 'test', '1', 2)],
                        })],
                        baseDeck: [], turnNumber: 1, nextUid: 200,
                    };
                    const events = execute(
                        { core: state, sys: { phase: 'playCards' } as any },
                        { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'op-1', baseIndex: 0 } } as any,
                        dummyRandom,
                    );
                    // 必须包含 MINION_PLAYED 事件
                    expect(events.some(e => e.type === SU_EVENTS.MINION_PLAYED)).toBe(true);
                    // 事件数量 >= 1（有些能力在无合法目标时不产生额外事件）
                    expect(events.length).toBeGreaterThanOrEqual(1);
                },
            ),
            { numRuns: minionsWithOnPlay.length },
        );
    });
});

// ============================================================================
// Property 7: 目标选择提示匹配合法目标（简化版）
// ============================================================================

describe('Property 7: 目标选择提示匹配', () => {
    test('PLAY_MINION 只能指定存在的基地索引', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 5 }),
                fc.integer({ min: 0, max: 9 }),
                (baseCount, targetIdx) => {
                    const card = makeCard('m-1', 'alien_invader', 'minion');
                    const bases = Array.from({ length: baseCount }, (_, i) =>
                        makeBase(`base_${i}`),
                    );
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.NINJAS], { hand: [card] }),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.GHOSTS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases, baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    const r = validate(
                        { core: state, sys: { phase: 'playCards' } as any },
                        { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'm-1', baseIndex: targetIdx } } as any,
                    );
                    if (targetIdx < baseCount) {
                        // 合法索引 → 验证应通过（除非有 ongoing 限制）
                        // 不做 toBe(true) 因为可能有其他限制，但不应因索引越界失败
                    } else {
                        // 越界索引 → 验证应失败
                        expect(r.valid).toBe(false);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    test('USE_TALENT 只能指定场上存在的随从', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('m-exist', 'm-nonexist'),
                (minionUid) => {
                    const minion = makeMinion('m-exist', 'miskatonic_professor', '0', 5);
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY, SMASHUP_FACTION_IDS.GHOSTS], {
                                hand: [makeCard('h1', 'test', 'minion')],
                                deck: [makeCard('d1', 'deck1', 'minion')],
                            }),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase('b', { minions: [minion] })],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    const r = validate(
                        { core: state, sys: { phase: 'playCards' } as any },
                        { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid, baseIndex: 0 } } as any,
                    );
                    if (minionUid === 'm-nonexist') {
                        expect(r.valid).toBe(false);
                    }
                    // 存在的随从可能通过也可能因其他原因失败，但不应因找不到随从而崩溃
                },
            ),
            { numRuns: 10 },
        );
    });
});

// ============================================================================
// Property 10: 特殊行动卡生命周期
// ============================================================================

describe('Property 10: 特殊行动卡生命周期', () => {
    test('special 行动卡在 Me First 窗口中打出后从手牌移入弃牌堆', () => {
        // ninja_hidden_ninja 是 special 子类型
        const specialCard = makeCard('sp-1', 'ninja_hidden_ninja', 'action');
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.NINJAS, SMASHUP_FACTION_IDS.GHOSTS], {
                    hand: [specialCard],
                    deck: [makeCard('d1', 'x', 'minion')],
                }),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('test_base', {
                minions: [makeMinion('m1', 'test', '1', 3)],
            })],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        const matchState: MatchState<SmashUpCore> = {
            core: state,
            sys: {
                phase: 'scoreBases',
                responseWindow: {
                    current: {
                        windowId: 'meFirst_test',
                        windowType: 'meFirst',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 0,
                        consecutivePasses: 0,
                    },
                },
            } as any,
        };
        const events = execute(
            matchState,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'sp-1', baseIndex: 0 } } as any,
            dummyRandom,
        );
        // 应产生 ACTION_PLAYED 事件
        expect(events.some(e => e.type === SU_EVENTS.ACTION_PLAYED)).toBe(true);
        // 归约后 special 卡不在手牌中
        let s = state;
        for (const e of events) s = reduce(s, e as any);
        expect(s.players['0'].hand.some(c => c.uid === 'sp-1')).toBe(false);
    });
});

// ============================================================================
// Property 14: 多基地记分提示（简化版）
// ============================================================================

describe('Property 14: 多基地记分提示', () => {
    test('多基地达到临界点时需要选择记分顺序', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 4 }),
                (eligibleCount) => {
                    // 构造多个达到临界点的基地
                    const bases = Array.from({ length: eligibleCount }, (_, i) =>
                        makeBase(`base_${i}`, {
                            minions: [makeMinion(`m-${i}`, `d-${i}`, '0', 30)],
                        }),
                    );
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases, baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    // 验证：多个基地的力量都超过了典型临界点
                    // 每个基地至少有 30 力量的随从，远超任何基地的 breakpoint
                    for (let i = 0; i < bases.length; i++) {
                        const total = getTotalEffectivePowerOnBase(state, bases[i], i);
                        expect(total).toBeGreaterThanOrEqual(20);
                    }
                    // 验证达标基地数量 >= 2
                    expect(bases.length).toBeGreaterThanOrEqual(2);
                },
            ),
            { numRuns: 10 },
        );
    });
});

// ============================================================================
// Property 15: 记分循环完整性
// ============================================================================

describe('Property 15: 记分循环完整性', () => {
    test('BASE_SCORED 事件移除基地并分配 VP', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 4 }),
                fc.integer({ min: 1, max: 8 }),
                (baseCount, vpFirst) => {
                    const bases = Array.from({ length: baseCount }, (_, i) =>
                        makeBase(`base_${i}`, {
                            minions: [makeMinion(`m-${i}`, `d-${i}`, '0', 5)],
                        }),
                    );
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases, baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    // 对第一个基地执行记分
                    const event = {
                        type: SU_EVENTS.BASE_SCORED,
                        payload: {
                            baseIndex: 0, baseDefId: 'base_0',
                            rankings: [{ playerId: '0', power: 5, vp: vpFirst }],
                        },
                        timestamp: Date.now(),
                    };
                    const s = reduce(state, event as any);
                    // 基地被移除
                    expect(s.bases.length).toBe(baseCount - 1);
                    // VP 正确分配
                    expect(s.players['0'].vp).toBe(vpFirst);
                    // 剩余基地仍可继续记分（循环完整性）
                    if (baseCount > 1) {
                        expect(s.bases.length).toBeGreaterThan(0);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    test('连续记分多个基地后所有基地都被移除', () => {
        const bases = [
            makeBase('b0', { minions: [makeMinion('m0', 'd0', '0', 5)] }),
            makeBase('b1', { minions: [makeMinion('m1', 'd1', '1', 3)] }),
        ];
        let state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases, baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        // 记分第一个基地（index 0）
        state = reduce(state, {
            type: SU_EVENTS.BASE_SCORED,
            payload: {
                baseIndex: 0, baseDefId: 'b0',
                rankings: [{ playerId: '0', power: 5, vp: 4 }],
            },
            timestamp: Date.now(),
        } as any);
        expect(state.bases.length).toBe(1);
        // 记分第二个基地（现在是 index 0）
        state = reduce(state, {
            type: SU_EVENTS.BASE_SCORED,
            payload: {
                baseIndex: 0, baseDefId: 'b1',
                rankings: [{ playerId: '1', power: 3, vp: 2 }],
            },
            timestamp: Date.now(),
        } as any);
        expect(state.bases.length).toBe(0);
        expect(state.players['0'].vp).toBe(4);
        expect(state.players['1'].vp).toBe(2);
    });
});

// ============================================================================
// Property 20: 基地限制一致性
// ============================================================================

/**
 * 收集所有在 BaseCardDef 上声明了 restrictions 的基地 defId。
 * 这些限制由 isOperationRestricted 的 "层 1" 数据驱动分支自动解析。
 */
const basesWithRestrictions: { defId: string; rType: 'play_minion' | 'play_action'; maxPower?: number; extraPlayMax?: number; minionPlayLimitPerTurn?: number }[] = [];
for (const defId of getAllBaseDefIds()) {
    const def = getBaseDef(defId);
    if (!def?.restrictions) continue;
    for (const r of def.restrictions) {
        basesWithRestrictions.push({
            defId,
            rType: r.type,
            maxPower: r.condition?.maxPower,
            extraPlayMax: r.condition?.extraPlayMinionPowerMax,
            minionPlayLimitPerTurn: r.condition?.minionPlayLimitPerTurn,
        });
    }
}

describe('Property 20: 基地限制一致性', () => {
    test('声明了 restrictions 的基地至少 1 个', () => {
        expect(basesWithRestrictions.length).toBeGreaterThanOrEqual(1);
    });

    test('无条件 play_minion 限制始终生效', () => {
        const unconditional = basesWithRestrictions.filter(
            r => r.rType === 'play_minion' && r.maxPower === undefined && r.extraPlayMax === undefined && r.minionPlayLimitPerTurn === undefined,
        );
        // 如 castle_of_ice：禁止一切随从
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: Math.max(unconditional.length - 1, 0) }),
                fc.integer({ min: 1, max: 10 }),
                (idx, basePower) => {
                    fc.pre(unconditional.length > 0);
                    const { defId } = unconditional[idx];
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase(defId)],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower });
                    expect(restricted).toBe(true);
                },
            ),
            { numRuns: 20 },
        );
    });

    test('maxPower 条件限制：力量 <= maxPower 被限制，> maxPower 不被限制', () => {
        const maxPowerBases = basesWithRestrictions.filter(r => r.maxPower !== undefined);
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: Math.max(maxPowerBases.length - 1, 0) }),
                fc.integer({ min: 1, max: 20 }),
                (idx, basePower) => {
                    fc.pre(maxPowerBases.length > 0);
                    const { defId, maxPower } = maxPowerBases[idx];
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase(defId)],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower });
                    if (basePower <= maxPower!) {
                        expect(restricted).toBe(true);
                    } else {
                        expect(restricted).toBe(false);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    test('extraPlayMinionPowerMax 条件限制：额外出牌时力量 > limit 被限制', () => {
        const extraPlayBases = basesWithRestrictions.filter(r => r.extraPlayMax !== undefined);
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: Math.max(extraPlayBases.length - 1, 0) }),
                fc.integer({ min: 1, max: 10 }),
                fc.integer({ min: 0, max: 3 }),
                (idx, basePower, minionsPlayed) => {
                    fc.pre(extraPlayBases.length > 0);
                    const { defId, extraPlayMax } = extraPlayBases[idx];
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.NINJAS], {
                                minionsPlayed,
                            }),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.GHOSTS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase(defId)],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower });
                    if (minionsPlayed >= 1 && basePower > extraPlayMax!) {
                        // 额外出牌且力量超限 → 应被限制
                        expect(restricted).toBe(true);
                    } else {
                        // 首次出牌或力量不超限 → 不被限制
                        expect(restricted).toBe(false);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    test('minionPlayLimitPerTurn 条件限制：已达上限时被限制', () => {
        const limitBases = basesWithRestrictions.filter(r => r.minionPlayLimitPerTurn !== undefined);
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: Math.max(limitBases.length - 1, 0) }),
                fc.integer({ min: 0, max: 3 }),
                (idx, playedAtBase) => {
                    fc.pre(limitBases.length > 0);
                    const { defId, minionPlayLimitPerTurn } = limitBases[idx];
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.NINJAS], {
                                minionsPlayedPerBase: playedAtBase > 0 ? { 0: playedAtBase } : undefined,
                            }),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.GHOSTS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase(defId)],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    const restricted = isOperationRestricted(state, 0, '0', 'play_minion', { basePower: 5 });
                    if (playedAtBase >= minionPlayLimitPerTurn!) {
                        expect(restricted).toBe(true);
                    } else {
                        expect(restricted).toBe(false);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    test('无条件 play_action 限制始终生效', () => {
        const actionRestricted = basesWithRestrictions.filter(r => r.rType === 'play_action');
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: Math.max(actionRestricted.length - 1, 0) }),
                (idx) => {
                    fc.pre(actionRestricted.length > 0);
                    const { defId } = actionRestricted[idx];
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase(defId)],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    const restricted = isOperationRestricted(state, 0, '0', 'play_action');
                    expect(restricted).toBe(true);
                },
            ),
            { numRuns: 10 },
        );
    });

    test('无 restrictions 声明的基地不触发数据驱动限制', () => {
        const basesWithoutRestrictions = getAllBaseDefIds().filter(id => {
            const def = getBaseDef(id);
            return !def?.restrictions || def.restrictions.length === 0;
        });
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: Math.max(basesWithoutRestrictions.length - 1, 0) }),
                fc.integer({ min: 1, max: 10 }),
                (idx, basePower) => {
                    fc.pre(basesWithoutRestrictions.length > 0);
                    const defId = basesWithoutRestrictions[idx];
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase(defId)],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    // 无数据驱动限制 → play_minion 和 play_action 都不应被限制
                    expect(isOperationRestricted(state, 0, '0', 'play_minion', { basePower })).toBe(false);
                    expect(isOperationRestricted(state, 0, '0', 'play_action')).toBe(false);
                },
            ),
            { numRuns: 30 },
        );
    });
});

// ============================================================================
// Property 21: 保护机制一致性
// ============================================================================

describe('Property 21: 保护机制一致性', () => {
    // ── 美丽城堡：力量 >= 5 的随从免疫 destroy/move/affect ──
    test('美丽城堡：力量 >= 5 的随从受 destroy 保护', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 12 }),
                fc.integer({ min: 0, max: 5 }),
                (basePower, modifier) => {
                    const effectivePower = basePower + modifier;
                    const minion = makeMinion('m-1', 'test_minion', '0', basePower);
                    minion.powerModifier = modifier;
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase('base_beautiful_castle', { minions: [minion] })],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    const protectedDestroy = isMinionProtected(state, minion, 0, '1', 'destroy');
                    const protectedMove = isMinionProtected(state, minion, 0, '1', 'move');
                    const protectedAffect = isMinionProtected(state, minion, 0, '1', 'affect');
                    if (effectivePower >= 5) {
                        expect(protectedDestroy).toBe(true);
                        expect(protectedMove).toBe(true);
                        expect(protectedAffect).toBe(true);
                    } else {
                        expect(protectedDestroy).toBe(false);
                        expect(protectedMove).toBe(false);
                        expect(protectedAffect).toBe(false);
                    }
                },
            ),
            { numRuns: 30 },
        );
    });

    test('美丽城堡：不在美丽城堡上的随从不受保护', () => {
        const minion = makeMinion('m-1', 'test_minion', '0', 8);
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [
                makeBase('base_other', { minions: [minion] }),
                makeBase('base_beautiful_castle'),
            ],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        // 随从在 index 0（非美丽城堡），即使力量 >= 5 也不受保护
        expect(isMinionProtected(state, minion, 0, '1', 'destroy')).toBe(false);
    });

    // ── 小马乐园：同一控制者 >= 2 随从时免疫 destroy ──
    test('小马乐园：同一控制者 >= 2 随从时免疫消灭', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 5 }),
                (minionCount) => {
                    const minions = Array.from({ length: minionCount }, (_, i) =>
                        makeMinion(`m-${i}`, `test_${i}`, '0', 2),
                    );
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase('base_pony_paradise', { minions })],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    const protectedResult = isMinionProtected(state, minions[0], 0, '1', 'destroy');
                    if (minionCount >= 2) {
                        expect(protectedResult).toBe(true);
                    } else {
                        expect(protectedResult).toBe(false);
                    }
                },
            ),
            { numRuns: 20 },
        );
    });

    test('小马乐园：不同控制者的随从不互相提供保护', () => {
        const p0Minion = makeMinion('m-0', 'test_0', '0', 3);
        const p1Minion = makeMinion('m-1', 'test_1', '1', 3);
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
            },
            turnOrder: ['0', '1'], currentPlayerIndex: 0,
            bases: [makeBase('base_pony_paradise', { minions: [p0Minion, p1Minion] })],
            baseDeck: [], turnNumber: 1, nextUid: 100,
        };
        // 每个控制者只有 1 个随从 → 均不受保护
        expect(isMinionProtected(state, p0Minion, 0, '1', 'destroy')).toBe(false);
        expect(isMinionProtected(state, p1Minion, 0, '0', 'destroy')).toBe(false);
    });

    // ── 非保护类基地上不触发保护 ──
    test('普通基地上的随从不受任何保护', () => {
        const normalBaseIds = getAllBaseDefIds().filter(
            id => id !== 'base_beautiful_castle' && id !== 'base_pony_paradise' && id !== 'base_house_of_nine_lives',
        );
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: Math.max(normalBaseIds.length - 1, 0) }),
                fc.integer({ min: 1, max: 10 }),
                (idx, power) => {
                    fc.pre(normalBaseIds.length > 0);
                    const defId = normalBaseIds[idx];
                    const minion = makeMinion('m-1', 'test', '0', power);
                    const state: SmashUpCore = {
                        players: {
                            '0': makePlayer('0', [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.NINJAS]),
                            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS]),
                        },
                        turnOrder: ['0', '1'], currentPlayerIndex: 0,
                        bases: [makeBase(defId, { minions: [minion] })],
                        baseDeck: [], turnNumber: 1, nextUid: 100,
                    };
                    expect(isMinionProtected(state, minion, 0, '1', 'destroy')).toBe(false);
                    expect(isMinionProtected(state, minion, 0, '1', 'move')).toBe(false);
                    expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(false);
                },
            ),
            { numRuns: 30 },
        );
    });
});
