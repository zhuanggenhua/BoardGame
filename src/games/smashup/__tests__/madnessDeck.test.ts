/**
 * 大杀四方 - P19: 疯狂牌库生命周期测试
 *
 * 覆盖 Property 19: 疯狂牌库初始化、抽取、返回、VP 惩罚
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearPromptContinuationRegistry } from '../domain/promptContinuation';
import { reduce } from '../domain/reducer';
import {
    SU_EVENTS,
    MADNESS_DECK_SIZE,
    MADNESS_CARD_DEF_ID,
    CTHULHU_EXPANSION_FACTIONS,
} from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import type {
    SmashUpCore,
    PlayerState,
    CardInstance,
    MadnessDrawnEvent,
    MadnessReturnedEvent,
} from '../domain/types';
import {
    drawMadnessCards,
    returnMadnessCard,
    countMadnessCards,
    madnessVpPenalty,
    hasCthulhuExpansionFaction,
} from '../domain/abilityHelpers';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPromptContinuationRegistry();
    resetAbilityInit();
    initAllAbilities();
});

function makePlayer(
    id: string,
    factions: [string, string] = [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS]
): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1,
        actionsPlayed: 0, actionLimit: 1,
        factions,
    };
}

function makeCore(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: {
            '0': makePlayer('0', [SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU, SMASHUP_FACTION_IDS.ALIENS]),
            '1': makePlayer('1', [SMASHUP_FACTION_IDS.ELDER_THINGS, SMASHUP_FACTION_IDS.PIRATES]),
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [{ defId: 'base_the_jungle', minions: [], ongoingActions: [] }],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        madnessDeck: Array.from({ length: MADNESS_DECK_SIZE }, () => MADNESS_CARD_DEF_ID),
        ...overrides,
    };
}

describe('Property 19: 疯狂牌库生命周期', () => {
    describe('疯狂牌库初始化', () => {
        it('克苏鲁扩展派系存在时 hasCthulhuExpansionFaction 返回 true', () => {
            expect(hasCthulhuExpansionFaction({
                '0': { factions: [SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU, SMASHUP_FACTION_IDS.ALIENS] },
                '1': { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] },
            })).toBe(true);
        });

        it('无克苏鲁扩展派系时 hasCthulhuExpansionFaction 返回 false', () => {
            expect(hasCthulhuExpansionFaction({
                '0': { factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS] },
                '1': { factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS] },
            })).toBe(false);
        });

        it('所有 4 个克苏鲁扩展派系都能被识别', () => {
            for (const faction of CTHULHU_EXPANSION_FACTIONS) {
                expect(hasCthulhuExpansionFaction({
                    '0': { factions: [faction, SMASHUP_FACTION_IDS.ALIENS] },
                })).toBe(true);
            }
        });

        it('疯狂牌库初始包含 30 张牌', () => {
            const core = makeCore();
            expect(core.madnessDeck).toBeDefined();
            expect(core.madnessDeck!.length).toBe(30);
        });
    });

    describe('疯狂卡抽取', () => {
        it('抽取 N 张疯狂卡使牌库减少 N 且玩家手牌增加 N', () => {
            const core = makeCore();
            const evt = drawMadnessCards('0', 2, core, 'test', 1000);
            expect(evt).toBeDefined();
            expect(evt!.payload.count).toBe(2);
            expect(evt!.payload.cardUids.length).toBe(2);

            const newState = reduce(core, evt!);
            expect(newState.madnessDeck!.length).toBe(28);
            expect(newState.players['0'].hand.length).toBe(2);
            expect(newState.players['0'].hand[0].defId).toBe(MADNESS_CARD_DEF_ID);
            expect(newState.players['0'].hand[1].defId).toBe(MADNESS_CARD_DEF_ID);
        });

        it('抽取时 nextUid 递增', () => {
            const core = makeCore();
            const evt = drawMadnessCards('0', 3, core, 'test', 1000);
            const newState = reduce(core, evt!);
            expect(newState.nextUid).toBe(103);
        });

        it('每张疯狂卡有唯一 UID', () => {
            const core = makeCore();
            const evt = drawMadnessCards('0', 3, core, 'test', 1000);
            const uids = evt!.payload.cardUids;
            expect(new Set(uids).size).toBe(3);
        });

        it('疯狂牌库为空时不生成事件', () => {
            const core = makeCore({ madnessDeck: [] });
            const evt = drawMadnessCards('0', 1, core, 'test', 1000);
            expect(evt).toBeUndefined();
        });

        it('请求数量超过牌库剩余时只抽取剩余数量', () => {
            const core = makeCore({
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });
            const evt = drawMadnessCards('0', 5, core, 'test', 1000);
            expect(evt!.payload.count).toBe(2);
            expect(evt!.payload.cardUids.length).toBe(2);

            const newState = reduce(core, evt!);
            expect(newState.madnessDeck!.length).toBe(0);
            expect(newState.players['0'].hand.length).toBe(2);
        });

        it('无疯狂牌库时不生成事件', () => {
            const core = makeCore({ madnessDeck: undefined });
            const evt = drawMadnessCards('0', 1, core, 'test', 1000);
            expect(evt).toBeUndefined();
        });
    });

    describe('疯狂卡返回', () => {
        it('疯狂卡从手牌返回疯狂牌库', () => {
            // 先抽一张
            const core = makeCore();
            const drawEvt = drawMadnessCards('0', 1, core, 'test', 1000)!;
            const afterDraw = reduce(core, drawEvt);
            expect(afterDraw.madnessDeck!.length).toBe(29);
            expect(afterDraw.players['0'].hand.length).toBe(1);

            // 返回
            const cardUid = afterDraw.players['0'].hand[0].uid;
            const returnEvt = returnMadnessCard('0', cardUid, 'test', 2000);
            const afterReturn = reduce(afterDraw, returnEvt);
            expect(afterReturn.madnessDeck!.length).toBe(30);
            expect(afterReturn.players['0'].hand.length).toBe(0);
        });
    });

    describe('疯狂卡计数与 VP 惩罚', () => {
        it('countMadnessCards 统计手牌+牌库+弃牌堆中的疯狂卡', () => {
            const madnessCard: CardInstance = {
                uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0',
            };
            const normalCard: CardInstance = {
                uid: 'c1', defId: 'alien_invader', type: 'minion', owner: '0',
            };
            const player = {
                hand: [madnessCard, normalCard],
                deck: [{ ...madnessCard, uid: 'mad2' }],
                discard: [{ ...madnessCard, uid: 'mad3' }, normalCard],
            };
            expect(countMadnessCards(player)).toBe(3);
        });

        it('无疯狂卡时计数为 0', () => {
            const player = { hand: [], deck: [], discard: [] };
            expect(countMadnessCards(player)).toBe(0);
        });

        it('每 2 张疯狂卡扣 1 VP', () => {
            expect(madnessVpPenalty(0)).toBe(0);
            expect(madnessVpPenalty(1)).toBe(0);
            expect(madnessVpPenalty(2)).toBe(1);
            expect(madnessVpPenalty(3)).toBe(1);
            expect(madnessVpPenalty(4)).toBe(2);
            expect(madnessVpPenalty(5)).toBe(2);
            expect(madnessVpPenalty(6)).toBe(3);
        });
    });

    describe('ALL_FACTIONS_SELECTED 初始化疯狂牌库', () => {
        it('选择克苏鲁扩展派系后 madnessDeck 被初始化', () => {
            // 模拟派系选择完成前的状态
            const core: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [{ defId: 'base_the_jungle', minions: [], ongoingActions: [] }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
                factionSelection: {
                    takenFactions: [
                        SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU,
                        SMASHUP_FACTION_IDS.ALIENS,
                        SMASHUP_FACTION_IDS.PIRATES,
                        SMASHUP_FACTION_IDS.NINJAS,
                    ],
                    playerSelections: {
                        '0': [SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU, SMASHUP_FACTION_IDS.ALIENS],
                        '1': [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS],
                    },
                    completedPlayers: ['0', '1'],
                },
            };

            const evt = {
                type: SU_EVENTS.ALL_FACTIONS_SELECTED,
                payload: {
                    readiedPlayers: {
                        '0': { deck: [], hand: [] },
                        '1': { deck: [], hand: [] },
                    },
                    nextUid: 200,
                },
                timestamp: 1000,
            };

            const newState = reduce(core, evt as any);
            expect(newState.madnessDeck).toBeDefined();
            expect(newState.madnessDeck!.length).toBe(MADNESS_DECK_SIZE);
        });

        it('无克苏鲁扩展派系时 madnessDeck 为 undefined', () => {
            const core: SmashUpCore = {
                players: {
                    '0': makePlayer('0'),
                    '1': makePlayer('1'),
                },
                turnOrder: ['0', '1'],
                currentPlayerIndex: 0,
                bases: [{ defId: 'base_the_jungle', minions: [], ongoingActions: [] }],
                baseDeck: [],
                turnNumber: 1,
                nextUid: 100,
                factionSelection: {
                    takenFactions: [
                        SMASHUP_FACTION_IDS.ALIENS,
                        SMASHUP_FACTION_IDS.DINOSAURS,
                        SMASHUP_FACTION_IDS.PIRATES,
                        SMASHUP_FACTION_IDS.NINJAS,
                    ],
                    playerSelections: {
                        '0': [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                        '1': [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS],
                    },
                    completedPlayers: ['0', '1'],
                },
            };

            const evt = {
                type: SU_EVENTS.ALL_FACTIONS_SELECTED,
                payload: {
                    readiedPlayers: {
                        '0': { deck: [], hand: [] },
                        '1': { deck: [], hand: [] },
                    },
                    nextUid: 200,
                },
                timestamp: 1000,
            };

            const newState = reduce(core, evt as any);
            expect(newState.madnessDeck).toBeUndefined();
        });
    });

    describe('疯狂卡离场进弃牌堆', () => {
        it('疯狂卡被弃牌时进入控制者弃牌堆而非返回牌库', () => {
            // 先抽一张疯狂卡
            const core = makeCore();
            const drawEvt = drawMadnessCards('0', 1, core, 'test', 1000)!;
            const afterDraw = reduce(core, drawEvt);
            const cardUid = afterDraw.players['0'].hand[0].uid;

            // 通过 CARDS_DISCARDED 弃掉
            const discardEvt = {
                type: SU_EVENTS.CARDS_DISCARDED,
                payload: { playerId: '0', cardUids: [cardUid] },
                timestamp: 2000,
            };
            const afterDiscard = reduce(afterDraw, discardEvt as any);
            expect(afterDiscard.players['0'].hand.length).toBe(0);
            expect(afterDiscard.players['0'].discard.length).toBe(1);
            expect(afterDiscard.players['0'].discard[0].defId).toBe(MADNESS_CARD_DEF_ID);
            // 疯狂牌库不变（不返回）
            expect(afterDiscard.madnessDeck!.length).toBe(29);
        });
    });
});
