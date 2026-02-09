/**
 * 大杀四方 - 新增基地能力测试
 *
 * 覆盖：
 * - base_haunted_house_al9000: onMinionPlayed 弃一张牌
 * - base_the_field_of_honor: onMinionDestroyed 消灭者获1VP
 * - base_the_workshop: onActionPlayed 额外行动额度
 * - base_stadium: onMinionDestroyed 控制者抽牌
 * - base_tar_pits: onMinionDestroyed 放入牌库底
 * - base_haunted_house: afterScoring 冠军弃手牌抽5
 * - base_temple_of_goju: afterScoring 最高力量随从放牌库底
 * - base_great_library: afterScoring 有随从的玩家抽牌
 * - base_ritual_site: afterScoring 随从洗回牌库
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { initAllAbilities } from '../abilities';
import {
    triggerBaseAbility,
    triggerExtendedBaseAbility,
} from '../domain/baseAbilities';
import type { BaseAbilityContext } from '../domain/baseAbilities';
import type { SmashUpCore, MinionOnBase, CardInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';

beforeAll(() => {
    initAllAbilities();
});

/** 构造最小测试状态 */
function makeState(overrides: Partial<SmashUpCore> = {}): SmashUpCore {
    return {
        players: {},
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    } as SmashUpCore;
}

function makeMinion(uid: string, controller: string, power: number, defId = 'd1'): MinionOnBase {
    return {
        uid, defId, controller, owner: controller,
        basePower: power, powerModifier: 0,
        talentUsed: false, attachedActions: [],
    };
}

function makeCard(uid: string, owner: string, defId = 'test_card'): CardInstance {
    return { uid, defId, type: 'minion', owner };
}

// ============================================================================
// base_haunted_house_al9000: 鬼屋 - 随从入场后弃一张牌
// ============================================================================

describe('base_haunted_house_al9000: 随从入场后弃牌', () => {
    it('打出随从后触发弃牌事件', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_haunted_house_al9000',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('h1', '0'), makeCard('h2', '0')],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house_al9000',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'd1',
            minionPower: 3,
            now: 1000,
        };

        const events = triggerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DISCARDED);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.cardUids.length).toBe(1);
    });

    it('手牌为空时不触发弃牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_haunted_house_al9000',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house_al9000',
            playerId: '0',
            minionUid: 'm1',
            now: 1000,
        };

        const events = triggerBaseAbility('base_haunted_house_al9000', 'onMinionPlayed', ctx);
        expect(events.length).toBe(0);
    });
});


// ============================================================================
// base_the_field_of_honor: 荣誉之地 - 消灭者获1VP
// ============================================================================

describe('base_the_field_of_honor: 消灭者获1VP', () => {
    it('有消灭者时触发VP奖励', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_field_of_honor',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_field_of_honor',
            playerId: '1', // 被消灭随从的拥有者
            destroyerId: '0', // 消灭者
            now: 1000,
        };

        const events = triggerExtendedBaseAbility('base_the_field_of_honor', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.VP_AWARDED);
        expect((events[0] as any).payload.playerId).toBe('0'); // 消灭者获得VP
        expect((events[0] as any).payload.amount).toBe(1);
    });

    it('无消灭者时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_field_of_honor',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_field_of_honor',
            playerId: '1',
            // destroyerId 未设置
            now: 1000,
        };

        const events = triggerExtendedBaseAbility('base_the_field_of_honor', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(0);
    });
});

// ============================================================================
// base_the_workshop: 工坊 - 打出战术额外行动额度
// ============================================================================

describe('base_the_workshop: 额外行动额度', () => {
    it('打出战术到工坊时获得+1行动额度', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_the_workshop',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_the_workshop',
            playerId: '0',
            actionTargetBaseIndex: 0,
            now: 1000,
        };

        const events = triggerBaseAbility('base_the_workshop', 'onActionPlayed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.limitType).toBe('action');
        expect((events[0] as any).payload.delta).toBe(1);
    });
});

// ============================================================================
// base_stadium: 体育场 - 随从被消灭后控制者抽牌
// ============================================================================

describe('base_stadium: 控制者抽牌', () => {
    it('随从被消灭后控制者抽一张牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_stadium',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c1', '0'), makeCard('c2', '0')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_stadium',
            playerId: '0', // 被消灭随从的拥有者
            controllerId: '0', // 控制者
            now: 1000,
        };

        const events = triggerExtendedBaseAbility('base_stadium', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.cardUids).toEqual(['c1']);
    });

    it('控制者牌库为空时不抽牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_stadium',
                    minions: [],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_stadium',
            playerId: '0',
            controllerId: '0',
            now: 1000,
        };

        const events = triggerExtendedBaseAbility('base_stadium', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(0);
    });
});


// ============================================================================
// base_tar_pits: 焦油坑 - 被消灭随从放入牌库底
// ============================================================================

describe('base_tar_pits: 被消灭随从放入牌库底', () => {
    it('随从被消灭后产生 CARD_TO_DECK_BOTTOM 事件', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_tar_pits',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_tar_pits',
            playerId: '0',
            minionUid: 'm1',
            minionDefId: 'test_minion',
            now: 1000,
        };

        const events = triggerExtendedBaseAbility('base_tar_pits', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.CARD_TO_DECK_BOTTOM);
        expect((events[0] as any).payload.cardUid).toBe('m1');
        expect((events[0] as any).payload.ownerId).toBe('0');
    });

    it('无随从信息时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_tar_pits',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_tar_pits',
            playerId: '0',
            // minionUid 未设置
            now: 1000,
        };

        const events = triggerExtendedBaseAbility('base_tar_pits', 'onMinionDestroyed', ctx);
        expect(events.length).toBe(0);
    });
});

// ============================================================================
// base_haunted_house: 伊万斯堡城镇公墓 - 冠军弃手牌抽5
// ============================================================================

describe('base_haunted_house: 冠军弃手牌抽5', () => {
    it('冠军弃掉所有手牌并抽5张', () => {
        const deckCards = Array.from({ length: 10 }, (_, i) =>
            makeCard(`d${i}`, '0', `card_${i}`)
        );
        const handCards = [makeCard('h1', '0'), makeCard('h2', '0'), makeCard('h3', '0')];

        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_haunted_house',
                    minions: [makeMinion('m1', '0', 5), makeMinion('m2', '1', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: handCards,
                        deck: deckCards,
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house',
            playerId: '0',
            rankings: [
                { playerId: '0', power: 5, vp: 5 },
                { playerId: '1', power: 3, vp: 3 },
            ],
            now: 1000,
        };

        const events = triggerBaseAbility('base_haunted_house', 'afterScoring', ctx);
        expect(events.length).toBe(2); // 弃牌 + 抽牌

        // 第一个事件：弃掉所有手牌
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DISCARDED);
        expect((events[0] as any).payload.playerId).toBe('0');
        expect((events[0] as any).payload.cardUids).toEqual(['h1', 'h2', 'h3']);

        // 第二个事件：抽5张
        expect(events[1].type).toBe(SU_EVENTS.CARDS_DRAWN);
        expect((events[1] as any).payload.playerId).toBe('0');
        expect((events[1] as any).payload.count).toBe(5);
        expect((events[1] as any).payload.cardUids.length).toBe(5);
    });

    it('无排名信息时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState(),
            baseIndex: 0,
            baseDefId: 'base_haunted_house',
            playerId: '0',
            // rankings 未设置
            now: 1000,
        };

        const events = triggerBaseAbility('base_haunted_house', 'afterScoring', ctx);
        expect(events.length).toBe(0);
    });

    it('冠军手牌为空时只抽牌不弃牌', () => {
        const deckCards = Array.from({ length: 10 }, (_, i) =>
            makeCard(`d${i}`, '0')
        );

        const ctx: BaseAbilityContext = {
            state: makeState({
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [],
                        deck: deckCards,
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_haunted_house',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 5 }],
            now: 1000,
        };

        const events = triggerBaseAbility('base_haunted_house', 'afterScoring', ctx);
        expect(events.length).toBe(1); // 只有抽牌
        expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
    });
});

// ============================================================================
// base_temple_of_goju: 刚柔流寺庙 - 最高力量随从放牌库底
// ============================================================================

describe('base_temple_of_goju: 最高力量随从放牌库底', () => {
    it('每位玩家最高力量随从放入牌库底', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_temple_of_goju',
                    minions: [
                        makeMinion('m1', '0', 5),
                        makeMinion('m2', '0', 3),
                        makeMinion('m3', '1', 4),
                    ],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_temple_of_goju',
            playerId: '0',
            rankings: [
                { playerId: '0', power: 8, vp: 2 },
                { playerId: '1', power: 4, vp: 3 },
            ],
            now: 1000,
        };

        const events = triggerBaseAbility('base_temple_of_goju', 'afterScoring', ctx);
        expect(events.length).toBe(2); // 每位玩家一个

        // P0 的最高力量随从 m1 (power 5)
        const p0Event = events.find(e => (e as any).payload.cardUid === 'm1');
        expect(p0Event).toBeDefined();
        expect(p0Event!.type).toBe(SU_EVENTS.CARD_TO_DECK_BOTTOM);
        expect((p0Event as any).payload.ownerId).toBe('0');

        // P1 的最高力量随从 m3 (power 4)
        const p1Event = events.find(e => (e as any).payload.cardUid === 'm3');
        expect(p1Event).toBeDefined();
        expect((p1Event as any).payload.ownerId).toBe('1');
    });

    it('基地无随从时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_temple_of_goju',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_temple_of_goju',
            playerId: '0',
            rankings: [],
            now: 1000,
        };

        const events = triggerBaseAbility('base_temple_of_goju', 'afterScoring', ctx);
        expect(events.length).toBe(0);
    });
});


// ============================================================================
// base_great_library: 大图书馆 - 有随从的玩家抽牌
// ============================================================================

describe('base_great_library: 有随从的玩家抽牌', () => {
    it('每位有随从的玩家抽一张牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_great_library',
                    minions: [
                        makeMinion('m1', '0', 3),
                        makeMinion('m2', '1', 2),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c1', '0')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                    '1': {
                        id: '1', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c2', '1')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_great_library',
            playerId: '0',
            now: 1000,
        };

        const events = triggerBaseAbility('base_great_library', 'afterScoring', ctx);
        expect(events.length).toBe(2);
        expect(events.every(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);

        const p0Draw = events.find(e => (e as any).payload.playerId === '0');
        const p1Draw = events.find(e => (e as any).payload.playerId === '1');
        expect(p0Draw).toBeDefined();
        expect(p1Draw).toBeDefined();
    });

    it('没有随从的玩家不抽牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_great_library',
                    minions: [makeMinion('m1', '0', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c1', '0')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                    '1': {
                        id: '1', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c2', '1')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_great_library',
            playerId: '0',
            now: 1000,
        };

        const events = triggerBaseAbility('base_great_library', 'afterScoring', ctx);
        expect(events.length).toBe(1); // 只有 P0
        expect((events[0] as any).payload.playerId).toBe('0');
    });

    it('牌库为空的玩家不抽牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_great_library',
                    minions: [makeMinion('m1', '0', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [], // 空牌库
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_great_library',
            playerId: '0',
            now: 1000,
        };

        const events = triggerBaseAbility('base_great_library', 'afterScoring', ctx);
        expect(events.length).toBe(0);
    });
});

// ============================================================================
// base_ritual_site: 仪式场所 - 随从洗回牌库
// ============================================================================

describe('base_ritual_site: 随从洗回牌库', () => {
    it('所有随从产生 CARD_TO_DECK_BOTTOM 事件', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_ritual_site',
                    minions: [
                        makeMinion('m1', '0', 3),
                        makeMinion('m2', '1', 4),
                        makeMinion('m3', '0', 2),
                    ],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_ritual_site',
            playerId: '0',
            now: 1000,
        };

        const events = triggerBaseAbility('base_ritual_site', 'afterScoring', ctx);
        expect(events.length).toBe(3);
        expect(events.every(e => e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);

        // 验证每个随从都有对应事件
        const uids = events.map(e => (e as any).payload.cardUid);
        expect(uids).toContain('m1');
        expect(uids).toContain('m2');
        expect(uids).toContain('m3');

        // 验证 owner 正确
        const m2Event = events.find(e => (e as any).payload.cardUid === 'm2');
        expect((m2Event as any).payload.ownerId).toBe('1');
    });

    it('基地无随从时不触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_ritual_site',
                    minions: [],
                    ongoingActions: [],
                }],
            }),
            baseIndex: 0,
            baseDefId: 'base_ritual_site',
            playerId: '0',
            now: 1000,
        };

        const events = triggerBaseAbility('base_ritual_site', 'afterScoring', ctx);
        expect(events.length).toBe(0);
    });
});
