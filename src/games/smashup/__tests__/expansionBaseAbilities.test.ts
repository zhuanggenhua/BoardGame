/**
 * 大杀四方 - 扩展包基地能力测试
 *
 * 覆盖 triggerBaseAbility 层面的扩展基地事件生成。
 *
 * 克苏鲁扩展：
 * - base_the_asylum: onMinionPlayed → Prompt（返回疯狂卡）
 * - base_innsmouth_base: onMinionPlayed → Prompt（弃牌堆卡入牌库底）
 * - base_mountains_of_madness: onMinionPlayed → 抽疯狂卡
 * - base_miskatonic_university_base: afterScoring → Prompt（返回疯狂卡）
 * - base_plateau_of_leng: onMinionPlayed → Prompt（打同名随从）
 *
 * AL9000：
 * - base_greenhouse: afterScoring → Prompt（牌库搜索随从打出）
 * - base_secret_garden: onTurnStart → 额外随从额度
 * - base_inventors_salon: afterScoring → Prompt（弃牌堆取回行动卡）
 *
 * Pretty Pretty：
 * - base_cat_fanciers_alley: onTurnStart → Prompt（消灭己方随从抽牌）
 * - base_enchanted_glade: onActionPlayed → 附着行动卡时抽牌
 * - base_fairy_ring: onMinionPlayed → 首次打出时额外随从+行动额度
 * - base_land_of_balance: onMinionPlayed → Prompt（移动己方随从到此）
 */
 

import { describe, expect, it, beforeAll } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry, triggerBaseAbility } from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import type { SmashUpCore, PlayerState, BaseInPlay, MinionOnBase, CardInstance } from '../domain/types';
import { SU_EVENTS, MADNESS_CARD_DEF_ID, MADNESS_DECK_SIZE } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { triggerBaseAbilityWithMS, getInteractionsFromResult } from './helpers';

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

// ============================================================================
// 辅助函数
// ============================================================================

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1,
        actionsPlayed: 0, actionLimit: 1,
        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
        ...overrides,
    };
}

function makeMinion(uid: string, controller: string, power: number, defId = 'd1'): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0,
        talentUsed: false, attachedActions: [],
    };
}

function makeBase(defId: string, overrides?: Partial<BaseInPlay>): BaseInPlay {
    return { defId, minions: [], ongoingActions: [], ...overrides };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner = '0'): CardInstance {
    return { uid, defId, type, owner };
}

function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: {
            '0': makePlayer('0'),
            '1': makePlayer('1'),
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    } as SmashUpCore;
}

function makeCtx(overrides: Partial<BaseAbilityContext>): BaseAbilityContext {
    return {
        state: makeState(),
        baseIndex: 0,
        baseDefId: 'test',
        playerId: '0',
        now: 1000,
        ...overrides,
    };
}

// ============================================================================
// 克苏鲁扩展
// ============================================================================

describe('base_the_asylum: 疯人院 - 返回疯狂卡', () => {
    it('有疯狂卡时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_the_asylum', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_the_asylum')],
                madnessDeck: Array(MADNESS_DECK_SIZE).fill(MADNESS_CARD_DEF_ID),
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', MADNESS_CARD_DEF_ID, 'action')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_the_asylum',
            minionUid: 'm1',
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_the_asylum');
    });

    it('无疯狂卡时不触发', () => {
        const { events } = triggerBaseAbility('base_the_asylum', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_the_asylum')],
                madnessDeck: Array(10).fill(MADNESS_CARD_DEF_ID),
                players: {
                    '0': makePlayer('0', { hand: [makeCard('h1', 'normal_card', 'action')] }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_the_asylum',
            minionUid: 'm1',
        }));

        expect(events).toHaveLength(0);
    });

    it('无疯狂牌库时不触发', () => {
        const { events } = triggerBaseAbility('base_the_asylum', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_the_asylum')],
                // 无 madnessDeck
            }),
            baseDefId: 'base_the_asylum',
            minionUid: 'm1',
        }));

        expect(events).toHaveLength(0);
    });
});

describe('base_innsmouth_base: 印斯茅斯 - 弃牌堆卡入牌库底', () => {
    it('弃牌堆有卡时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_innsmouth_base', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_innsmouth_base')],
                players: {
                    '0': makePlayer('0', {
                        discard: [makeCard('d1', 'test_card', 'minion')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_innsmouth_base',
            minionUid: 'm1',
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_innsmouth_base');
    });

    it('所有弃牌堆为空时不触发', () => {
        const { events } = triggerBaseAbility('base_innsmouth_base', 'onMinionPlayed', makeCtx({
            state: makeState({ bases: [makeBase('base_innsmouth_base')] }),
            baseDefId: 'base_innsmouth_base',
            minionUid: 'm1',
        }));

        expect(events).toHaveLength(0);
    });
});

describe('base_mountains_of_madness: 疯狂山脉 - 抽疯狂卡', () => {
    it('有疯狂牌库时生成 MADNESS_DRAWN 事件', () => {
        const { events } = triggerBaseAbility('base_mountains_of_madness', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_mountains_of_madness')],
                madnessDeck: Array(10).fill(MADNESS_CARD_DEF_ID),
            }),
            baseDefId: 'base_mountains_of_madness',
            minionUid: 'm1',
        }));

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.MADNESS_DRAWN);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.count).toBe(1);
    });

    it('疯狂牌库为空时不触发', () => {
        const { events } = triggerBaseAbility('base_mountains_of_madness', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_mountains_of_madness')],
                madnessDeck: [],
            }),
            baseDefId: 'base_mountains_of_madness',
            minionUid: 'm1',
        }));

        expect(events).toHaveLength(0);
    });
});

describe('base_miskatonic_university_base: 密大基地 - 计分后返回疯狂卡', () => {
    it('有随从且有疯狂卡的玩家生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_miskatonic_university_base', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_miskatonic_university_base', {
                    minions: [makeMinion('m1', '0', 3)],
                })],
                madnessDeck: Array(10).fill(MADNESS_CARD_DEF_ID),
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', MADNESS_CARD_DEF_ID, 'action')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_miskatonic_university_base',
            rankings: [{ playerId: '0', power: 3, vp: 4 }],
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_miskatonic_university_base');
        expect(interactions[0].playerId).toBe('0');
    });

    it('无疯狂牌库时不触发', () => {
        const { events } = triggerBaseAbility('base_miskatonic_university_base', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_miskatonic_university_base', {
                    minions: [makeMinion('m1', '0', 3)],
                })],
            }),
            baseDefId: 'base_miskatonic_university_base',
            rankings: [{ playerId: '0', power: 3, vp: 4 }],
        }));

        expect(events).toHaveLength(0);
    });
});

describe('base_plateau_of_leng: 冷原高地 - 打同名随从', () => {
    it('首次打出且手牌有同名随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_plateau_of_leng', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_plateau_of_leng')],
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'alien_collector', 'minion')], // 同名随从
                        minionsPlayedPerBase: { 0: 1 }, // 刚打出第一个随从（reduce 已执行）
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_plateau_of_leng',
            minionUid: 'm1',
            minionDefId: 'alien_collector', // 刚打出的随从
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_plateau_of_leng');
    });

    it('非首次打出时不触发（即使手牌有同名随从）', () => {
        const { events } = triggerBaseAbility('base_plateau_of_leng', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_plateau_of_leng')],
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'alien_collector', 'minion')], // 同名随从
                        minionsPlayedPerBase: { 0: 2 }, // 已打出第二个随从
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_plateau_of_leng',
            minionUid: 'm2',
            minionDefId: 'alien_collector',
        }));

        expect(events).toHaveLength(0);
    });

    it('手牌无同名随从时不触发', () => {
        const { events } = triggerBaseAbility('base_plateau_of_leng', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_plateau_of_leng')],
                players: {
                    '0': makePlayer('0', {
                        hand: [makeCard('h1', 'alien_invader', 'minion')], // 不同名
                        minionsPlayedPerBase: { 0: 1 }, // 首次打出
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_plateau_of_leng',
            minionUid: 'm1',
            minionDefId: 'alien_collector',
        }));

        expect(events).toHaveLength(0);
    });
});

// ============================================================================
// AL9000 扩展
// ============================================================================

describe('base_greenhouse: 温室 - 计分后从牌库打随从', () => {
    it('冠军牌库有随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_greenhouse', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_greenhouse')],
                players: {
                    '0': makePlayer('0', {
                        deck: [makeCard('dk1', 'alien_collector', 'minion')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_greenhouse',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_greenhouse');
        expect(interactions[0].playerId).toBe('0');
    });

    it('冠军牌库无随从时不触发', () => {
        const { events } = triggerBaseAbility('base_greenhouse', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_greenhouse')],
                players: {
                    '0': makePlayer('0', {
                        deck: [makeCard('dk1', 'pirate_full_sail', 'action')], // 只有行动卡
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_greenhouse',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));

        expect(events).toHaveLength(0);
    });
});

describe('base_secret_garden: 神秘花园 - 回合开始额外随从', () => {
    it('回合开始时获得额外随从额度', () => {
        const { events } = triggerBaseAbility('base_secret_garden', 'onTurnStart', makeCtx({
            state: makeState({ bases: [makeBase('base_secret_garden')] }),
            baseDefId: 'base_secret_garden',
        }));

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
        const payload = (events[0] as any).payload;
        expect(payload.limitType).toBe('minion');
        expect(payload.delta).toBe(1);
    });
});

describe('base_inventors_salon: 发明家沙龙 - 计分后取回行动卡', () => {
    it('冠军弃牌堆有行动卡时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_inventors_salon', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_inventors_salon')],
                players: {
                    '0': makePlayer('0', {
                        discard: [makeCard('d1', 'pirate_full_sail', 'action')],
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_inventors_salon',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_inventors_salon');
    });

    it('冠军弃牌堆无行动卡时不触发', () => {
        const { events } = triggerBaseAbility('base_inventors_salon', 'afterScoring', makeCtx({
            state: makeState({
                bases: [makeBase('base_inventors_salon')],
                players: {
                    '0': makePlayer('0', {
                        discard: [makeCard('d1', 'alien_collector', 'minion')], // 只有随从
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_inventors_salon',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
        }));

        expect(events).toHaveLength(0);
    });
});

// ============================================================================
// Pretty Pretty 扩展
// ============================================================================

describe('base_cat_fanciers_alley: 诡猫巷 - 消灭己方随从抽牌', () => {
    it('有己方随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_cat_fanciers_alley', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [makeBase('base_cat_fanciers_alley', {
                    minions: [makeMinion('m1', '0', 2)],
                })],
            }),
            baseDefId: 'base_cat_fanciers_alley',
            baseIndex: 0,
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_cat_fanciers_alley');
    });

    it('无己方随从时不触发', () => {
        const { events } = triggerBaseAbility('base_cat_fanciers_alley', 'onTurnStart', makeCtx({
            state: makeState({
                bases: [makeBase('base_cat_fanciers_alley', {
                    minions: [makeMinion('m1', '1', 2)], // 对手随从
                })],
            }),
            baseDefId: 'base_cat_fanciers_alley',
            baseIndex: 0,
        }));

        expect(events).toHaveLength(0);
    });
});

describe('base_enchanted_glade: 魔法林地 - 附着行动卡抽牌', () => {
    it('附着行动卡到此基地随从时抽 1 卡', () => {
        const { events } = triggerBaseAbility('base_enchanted_glade', 'onActionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_enchanted_glade')],
                players: {
                    '0': makePlayer('0', { deck: [makeCard('dk1', 'test', 'minion')] }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_enchanted_glade',
            baseIndex: 0,
            actionTargetMinionUid: 'm1', // 有附着目标随从
        }));

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
        expect((events[0] as any).payload.count).toBe(1);
    });

    it('非附着行动卡（无目标随从）时不触发', () => {
        const { events } = triggerBaseAbility('base_enchanted_glade', 'onActionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_enchanted_glade')],
                players: {
                    '0': makePlayer('0', { deck: [makeCard('dk1', 'test', 'minion')] }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_enchanted_glade',
            baseIndex: 0,
            // 无 actionTargetMinionUid
        }));

        expect(events).toHaveLength(0);
    });

    it('牌库为空时不抽牌', () => {
        const { events } = triggerBaseAbility('base_enchanted_glade', 'onActionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_enchanted_glade')],
                players: {
                    '0': makePlayer('0', { deck: [] }), // 空牌库
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_enchanted_glade',
            baseIndex: 0,
            actionTargetMinionUid: 'm1',
        }));

        expect(events).toHaveLength(0);
    });
});

describe('base_fairy_ring: 仙灵圈 - 首次打随从额外额度', () => {
    it('首次打出随从时获得额外额度', () => {
        const { events } = triggerBaseAbility('base_fairy_ring', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_fairy_ring', {
                    minions: [makeMinion('m1', '0', 3)],
                })],
                players: {
                    '0': makePlayer('0', {
                        minionsPlayedPerBase: { 0: 1 }, // 首次打出（reduce 已执行）
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_fairy_ring',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(events).toHaveLength(2);
        // 一个 LIMIT_MODIFIED (minion) + 一个 LIMIT_MODIFIED (action)
        const minionLimit = events.find(e =>
            e.type === SU_EVENTS.LIMIT_MODIFIED && (e as any).payload.limitType === 'minion'
        );
        const actionLimit = events.find(e =>
            e.type === SU_EVENTS.LIMIT_MODIFIED && (e as any).payload.limitType === 'action'
        );
        expect(minionLimit).toBeDefined();
        expect(actionLimit).toBeDefined();
    });

    it('非首次打出时不触发', () => {
        const { events } = triggerBaseAbility('base_fairy_ring', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_fairy_ring', {
                    minions: [
                        makeMinion('m1', '0', 3),
                        makeMinion('m2', '0', 2),
                    ],
                })],
                players: {
                    '0': makePlayer('0', {
                        minionsPlayedPerBase: { 0: 2 }, // 第二次打出
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_fairy_ring',
            baseIndex: 0,
            minionUid: 'm2',
        }));

        expect(events).toHaveLength(0);
    });

    it('之前有随从被消灭后再打出仍不触发（非首次打出）', () => {
        // 回归测试：旧实现用基地上随从数量判断，消灭后再打出会误触发
        const { events } = triggerBaseAbility('base_fairy_ring', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_fairy_ring', {
                    minions: [makeMinion('m2', '0', 2)], // 基地上只有1个（之前的被消灭了）
                })],
                players: {
                    '0': makePlayer('0', {
                        minionsPlayedPerBase: { 0: 2 }, // 但这是第二次打出
                    }),
                    '1': makePlayer('1'),
                },
            }),
            baseDefId: 'base_fairy_ring',
            baseIndex: 0,
            minionUid: 'm2',
        }));

        expect(events).toHaveLength(0);
    });
});

describe('base_land_of_balance: 平衡之地 - 移动己方随从到此', () => {
    it('其他基地有己方随从时生成 Prompt', () => {
        const result = triggerBaseAbilityWithMS('base_land_of_balance', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_land_of_balance'), // 索引 0
                    makeBase('other_base', {
                        minions: [makeMinion('m_other', '0', 4)], // 其他基地己方随从
                    }),
                ],
            }),
            baseDefId: 'base_land_of_balance',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(result.events).toHaveLength(0);
            const interactions = getInteractionsFromResult(result);
            expect(interactions).toHaveLength(1);
        expect(interactions[0].data.sourceId).toBe('base_land_of_balance');
        // skip + 1 个己方随从
        expect(interactions[0].data.options.length).toBe(2);
    });

    it('其他基地无己方随从时不触发', () => {
        const { events } = triggerBaseAbility('base_land_of_balance', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [
                    makeBase('base_land_of_balance'),
                    makeBase('other_base', {
                        minions: [makeMinion('m_other', '1', 4)], // 对手随从
                    }),
                ],
            }),
            baseDefId: 'base_land_of_balance',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(events).toHaveLength(0);
    });

    it('只有平衡之地一个基地时不触发', () => {
        const { events } = triggerBaseAbility('base_land_of_balance', 'onMinionPlayed', makeCtx({
            state: makeState({
                bases: [makeBase('base_land_of_balance')],
            }),
            baseDefId: 'base_land_of_balance',
            baseIndex: 0,
            minionUid: 'm1',
        }));

        expect(events).toHaveLength(0);
    });
});
