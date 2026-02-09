/**
 * 扩展派系 ongoing/special 能力测试
 *
 * 覆盖 Task 9.1-9.5 新增的能力：
 * - 幽灵：ghost_incorporeal (haunting protection), ghost_make_contact
 * - 蒸汽朋克：steam_queen, ornate_dome, difference_engine, escape_hatch, mechanic, change_of_venue, captain_ahab
 * - 食人花：deep_roots, water_lily, sprout, choking_vines, venus_man_trap, budding, blossom
 * - 印斯茅斯：in_plain_sight, return_to_the_sea
 * - 米斯卡塔尼克：student, field_trip
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
    registerProtection,
    registerRestriction,
    registerTrigger,
    clearOngoingEffectRegistry,
    isMinionProtected,
    isOperationRestricted,
    fireTriggers,
} from '../domain/ongoingEffects';
import type { SmashUpCore, MinionOnBase, BaseInPlay, CardInstance, FactionId } from '../domain/types';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { clearRegistry, resolveAbility } from '../domain/abilityRegistry';
import { registerGhostAbilities } from '../abilities/ghosts';
import { registerSteampunkAbilities } from '../abilities/steampunks';
import { registerKillerPlantAbilities } from '../abilities/killer_plants';
import { registerInnsmouthAbilities } from '../abilities/innsmouth';
import { registerMiskatonicAbilities } from '../abilities/miskatonic';

// ============================================================================
// 测试辅助
// ============================================================================

function makeMinion(overrides: Partial<MinionOnBase> = {}): MinionOnBase {
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

function makeBase(overrides: Partial<BaseInPlay> = {}): BaseInPlay {
    return {
        defId: 'test_base',
        minions: [],
        ongoingActions: [],
        ...overrides,
    };
}

type TestCardInstance = CardInstance & { faction: FactionId };

function makeCard(
    uid: string,
    defId: string,
    type: 'minion' | 'action',
    owner: string,
    faction: FactionId
): TestCardInstance {
    return { uid, defId, type, owner, faction };
}

function makeState(bases: BaseInPlay[], overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: {
            '0': {
                id: '0', vp: 0,
                hand: [
                    makeCard('h1', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                    makeCard('h2', 'test_action_a', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                ],
                deck: [
                    makeCard('d1', 'deck_minion_1', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                    makeCard('d2', 'deck_action_1', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                    makeCard('d3', 'deck_minion_2', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                ],
                discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
            },
            '1': {
                id: '1', vp: 0,
                hand: [
                    makeCard('oh1', 'opp_card_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS),
                    makeCard('oh2', 'opp_card_2', 'action', '1', SMASHUP_FACTION_IDS.ROBOTS),
                ],
                deck: [makeCard('od1', 'opp_deck_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS)],
                discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases,
        baseDeck: [],
        turnNumber: 1,
        nextUid: 300,
        ...overrides,
    };
}

const dummyRandom = {
    random: () => 0.5,
    shuffle: <T>(arr: T[]): T[] => [...arr],
} as any;

// ============================================================================
// 幽灵 ongoing 能力
// ============================================================================

describe('幽灵 ongoing 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerGhostAbilities();
    });

    describe('ghost_haunting: 不散阴魂保护', () => {
        test('附着 ghost_haunting 的随从不受对手影响', () => {
            const minion = makeMinion({
                defId: 'ghost_a', uid: 'g-1', controller: '0',
                attachedActions: [{ uid: 'gh-1', defId: 'ghost_haunting', ownerId: '0' }],
            });
            const base = makeBase({ minions: [minion] });
            const state = makeState([base]);

            expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(true);
        });

        test('无附着时不受保护', () => {
            const minion = makeMinion({ defId: 'ghost_a', uid: 'g-1', controller: '0' });
            const base = makeBase({ minions: [minion] });
            const state = makeState([base]);

            expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(false);
        });

        test('自己不受保护限制', () => {
            const minion = makeMinion({
                defId: 'ghost_a', uid: 'g-1', controller: '0',
                attachedActions: [{ uid: 'gh-1', defId: 'ghost_haunting', ownerId: '0' }],
            });
            const base = makeBase({ minions: [minion] });
            const state = makeState([base]);

            expect(isMinionProtected(state, minion, 0, '0', 'affect')).toBe(false);
        });
    });

    describe('ghost_make_contact: 控制对手随从', () => {
        test('将对手随从返回手牌', () => {
            const oppMinion = makeMinion({ defId: 'opp_m', uid: 'om-1', controller: '1', owner: '1', basePower: 5 });
            const base = makeBase({ minions: [oppMinion] });
            const state = makeState([base]);

            const executor = resolveAbility('ghost_make_contact', 'onPlay')!;
            const result = executor({
                state, playerId: '0', cardUid: 'mc-1', defId: 'ghost_make_contact',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            expect(result.events).toHaveLength(1);
            expect(result.events[0].type).toBe(SU_EVENTS.MINION_RETURNED);
            expect((result.events[0] as any).payload.minionUid).toBe('om-1');
        });
    });
});

// ============================================================================
// 蒸汽朋克 ongoing 能力
// ============================================================================

describe('蒸汽朋克 ongoing 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerSteampunkAbilities();
    });

    describe('steampunk_steam_queen: 蒸汽女王保护', () => {
        test('同基地己方随从不受对手行动卡影响', () => {
            const queen = makeMinion({ defId: 'steampunk_steam_queen', uid: 'sq-1', controller: '0' });
            const ally = makeMinion({ defId: 'steampunk_a', uid: 'sa-1', controller: '0' });
            const base = makeBase({ minions: [queen, ally] });
            const state = makeState([base]);

            expect(isMinionProtected(state, ally, 0, '1', 'action')).toBe(true);
        });

        test('不保护对手随从', () => {
            const queen = makeMinion({ defId: 'steampunk_steam_queen', uid: 'sq-1', controller: '0' });
            const opp = makeMinion({ defId: 'opp_m', uid: 'om-1', controller: '1' });
            const base = makeBase({ minions: [queen, opp] });
            const state = makeState([base]);

            expect(isMinionProtected(state, opp, 0, '0', 'action')).toBe(false);
        });
    });

    describe('steampunk_ornate_dome: 华丽穹顶限制', () => {
        test('对手不能打行动卡到此基地', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'od-1', defId: 'steampunk_ornate_dome', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isOperationRestricted(state, 0, '1', 'play_action')).toBe(true);
        });

        test('自己不受限制', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'od-1', defId: 'steampunk_ornate_dome', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isOperationRestricted(state, 0, '0', 'play_action')).toBe(false);
        });
    });

    describe('steampunk_difference_engine: 差分机', () => {
        test('控制者回合结束时抽1牌', () => {
            const engine = makeMinion({ defId: 'steampunk_difference_engine', uid: 'de-1', controller: '0' });
            const base = makeBase({ minions: [engine] });
            const state = makeState([base]);

            const events = fireTriggers(state, 'onTurnEnd', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
            expect((events[0] as any).payload.playerId).toBe('0');
        });

        test('非控制者回合不触发', () => {
            const engine = makeMinion({ defId: 'steampunk_difference_engine', uid: 'de-1', controller: '0' });
            const base = makeBase({ minions: [engine] });
            const state = makeState([base]);

            const events = fireTriggers(state, 'onTurnEnd', {
                state, playerId: '1', random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });

    describe('steampunk_escape_hatch: 逃生舱', () => {
        test('己方随从被消灭时回手牌', () => {
            const minion = makeMinion({ defId: 'steampunk_a', uid: 'sa-1', controller: '0', owner: '0' });
            const base = makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'eh-1', defId: 'steampunk_escape_hatch', ownerId: '0' }],
            });
            const state = makeState([base]);

            const events = fireTriggers(state, 'onMinionDestroyed', {
                state, playerId: '1', baseIndex: 0,
                triggerMinionUid: 'sa-1', triggerMinionDefId: 'steampunk_a',
                random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_RETURNED);
            expect((events[0] as any).payload.minionUid).toBe('sa-1');
        });

        test('对手随从被消灭时不触发', () => {
            const oppMinion = makeMinion({ defId: 'opp_m', uid: 'om-1', controller: '1', owner: '1' });
            const base = makeBase({
                minions: [oppMinion],
                ongoingActions: [{ uid: 'eh-1', defId: 'steampunk_escape_hatch', ownerId: '0' }],
            });
            const state = makeState([base]);

            const events = fireTriggers(state, 'onMinionDestroyed', {
                state, playerId: '0', baseIndex: 0,
                triggerMinionUid: 'om-1', triggerMinionDefId: 'opp_m',
                random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });

    describe('steampunk_mechanic: 机械师', () => {
        test('从弃牌堆取回行动卡', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].discard = [
                makeCard('dis-1', 'some_action', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];

            const executor = resolveAbility('steampunk_mechanic', 'onPlay')!;
            const result = executor({
                state, playerId: '0', cardUid: 'mech-1', defId: 'steampunk_mechanic',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            expect(result.events).toHaveLength(1);
            expect(result.events[0].type).toBe(SU_EVENTS.CARD_RECOVERED_FROM_DISCARD);
        });
    });

    describe('steampunk_captain_ahab: 亚哈船长', () => {
        test('talent 能力已注册', () => {
            const executor = resolveAbility('steampunk_captain_ahab', 'talent');
            expect(executor).toBeDefined();
        });
    });
});


// ============================================================================
// 食人花 ongoing 能力
// ============================================================================

describe('食人花 ongoing 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerKillerPlantAbilities();
    });

    describe('killer_plant_deep_roots: 深根保护', () => {
        test('附着 deep_roots 的随从不可被移动', () => {
            const minion = makeMinion({
                defId: 'kp_a', uid: 'kp-1', controller: '0',
                attachedActions: [{ uid: 'dr-1', defId: 'killer_plant_deep_roots', ownerId: '0' }],
            });
            const base = makeBase({ minions: [minion] });
            const state = makeState([base]);

            expect(isMinionProtected(state, minion, 0, '1', 'move')).toBe(true);
        });

        test('无附着时可被移动', () => {
            const minion = makeMinion({ defId: 'kp_a', uid: 'kp-1', controller: '0' });
            const base = makeBase({ minions: [minion] });
            const state = makeState([base]);

            expect(isMinionProtected(state, minion, 0, '1', 'move')).toBe(false);
        });
    });

    describe('killer_plant_water_lily: 睡莲', () => {
        test('控制者回合开始时抽1牌', () => {
            const lily = makeMinion({ defId: 'killer_plant_water_lily', uid: 'wl-1', controller: '0' });
            const base = makeBase({ minions: [lily] });
            const state = makeState([base]);

            const events = fireTriggers(state, 'onTurnStart', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
        });

        test('非控制者回合不触发', () => {
            const lily = makeMinion({ defId: 'killer_plant_water_lily', uid: 'wl-1', controller: '0' });
            const base = makeBase({ minions: [lily] });
            const state = makeState([base]);

            const events = fireTriggers(state, 'onTurnStart', {
                state, playerId: '1', random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });

    describe('killer_plant_sprout: 嫩芽', () => {
        test('控制者回合开始时消灭自身+搜索随从', () => {
            const sprout = makeMinion({ defId: 'killer_plant_sprout', uid: 'sp-1', controller: '0', owner: '0' });
            const base = makeBase({ minions: [sprout] });
            const state = makeState([base]);

            const events = fireTriggers(state, 'onTurnStart', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            expect(events.length).toBeGreaterThanOrEqual(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('sp-1');
            // 第二个事件是抽牌（如果牌库有随从）
            if (events.length > 1) {
                expect(events[1].type).toBe(SU_EVENTS.CARDS_DRAWN);
            }
        });
    });

    describe('killer_plant_choking_vines: 窒息藤蔓', () => {
        test('回合开始时消灭基地上力量最低的随从', () => {
            const weak = makeMinion({ defId: 'weak_m', uid: 'wm-1', controller: '1', owner: '1', basePower: 1 });
            const strong = makeMinion({ defId: 'strong_m', uid: 'sm-1', controller: '0', basePower: 5 });
            const base = makeBase({
                minions: [weak, strong],
                ongoingActions: [{ uid: 'cv-1', defId: 'killer_plant_choking_vines', ownerId: '0' }],
            });
            const state = makeState([base]);

            const events = fireTriggers(state, 'onTurnStart', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('wm-1');
        });
    });

    describe('killer_plant_venus_man_trap: 金星捕蝇草', () => {
        test('talent 能力已注册', () => {
            const executor = resolveAbility('killer_plant_venus_man_trap', 'talent');
            expect(executor).toBeDefined();
        });

        test('从牌库搜索随从', () => {
            const base = makeBase();
            const state = makeState([base]);

            const executor = resolveAbility('killer_plant_venus_man_trap', 'talent')!;
            const result = executor({
                state, playerId: '0', cardUid: 'vmt-1', defId: 'killer_plant_venus_man_trap',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            expect(result.events).toHaveLength(1);
            expect(result.events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
        });
    });

    describe('killer_plant_blossom: 绽放', () => {
        test('给予3个额外随从额度', () => {
            const base = makeBase();
            const state = makeState([base]);

            const executor = resolveAbility('killer_plant_blossom', 'onPlay')!;
            const result = executor({
                state, playerId: '0', cardUid: 'bl-1', defId: 'killer_plant_blossom',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            expect(result.events).toHaveLength(3);
            result.events.forEach(e => {
                expect(e.type).toBe(SU_EVENTS.LIMIT_MODIFIED);
                expect((e as any).payload.limitType).toBe('minion');
            });
        });
    });
});

// ============================================================================
// 印斯茅斯 ongoing 能力
// ============================================================================

describe('印斯茅斯 ongoing 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerInnsmouthAbilities();
    });

    describe('innsmouth_in_plain_sight: 众目睽睽', () => {
        test('力量≤2的己方随从不受对手影响', () => {
            const weakMinion = makeMinion({ defId: 'inn_a', uid: 'ia-1', controller: '0', basePower: 2 });
            const base = makeBase({
                minions: [weakMinion],
                ongoingActions: [{ uid: 'ips-1', defId: 'innsmouth_in_plain_sight', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, weakMinion, 0, '1', 'affect')).toBe(true);
        });

        test('力量>2的随从不受保护', () => {
            const strongMinion = makeMinion({ defId: 'inn_b', uid: 'ib-1', controller: '0', basePower: 4 });
            const base = makeBase({
                minions: [strongMinion],
                ongoingActions: [{ uid: 'ips-1', defId: 'innsmouth_in_plain_sight', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, strongMinion, 0, '1', 'affect')).toBe(false);
        });

        test('对手随从不受保护', () => {
            const oppMinion = makeMinion({ defId: 'opp_m', uid: 'om-1', controller: '1', basePower: 1 });
            const base = makeBase({
                minions: [oppMinion],
                ongoingActions: [{ uid: 'ips-1', defId: 'innsmouth_in_plain_sight', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, oppMinion, 0, '0', 'affect')).toBe(false);
        });
    });

    describe('innsmouth_return_to_the_sea: 回归大海', () => {
        test('special 能力已注册', () => {
            const executor = resolveAbility('innsmouth_return_to_the_sea', 'special');
            expect(executor).toBeDefined();
        });
    });
});

// ============================================================================
// 米斯卡塔尼克 新增能力
// ============================================================================

describe('米斯卡塔尼克 新增能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerMiskatonicAbilities();
    });

    describe('miskatonic_student: 学生', () => {
        test('special 能力已注册', () => {
            const executor = resolveAbility('miskatonic_student', 'special');
            expect(executor).toBeDefined();
        });

        test('手中有疯狂卡时转移给对手', () => {
            const base = makeBase();
            const state = makeState([base], {
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });
            state.players['0'].hand.push(
                makeCard('m-hand', MADNESS_CARD_DEF_ID, 'action', '0', SMASHUP_FACTION_IDS.MADNESS)
            );

            const executor = resolveAbility('miskatonic_student', 'special')!;
            const result = executor({
                state, playerId: '0', cardUid: 'stu-1', defId: 'miskatonic_student',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            expect(result.events.length).toBeGreaterThanOrEqual(1);
            // 第一个事件：返回疯狂卡
            expect(result.events[0].type).toBe(SU_EVENTS.MADNESS_RETURNED);
        });
    });

    describe('miskatonic_field_trip: 实地考察', () => {
        test('onPlay 能力已注册', () => {
            const executor = resolveAbility('miskatonic_field_trip', 'onPlay');
            expect(executor).toBeDefined();
        });

        test('手牌放牌库底+抽牌', () => {
            const base = makeBase();
            const state = makeState([base]);

            const executor = resolveAbility('miskatonic_field_trip', 'onPlay')!;
            const result = executor({
                state, playerId: '0', cardUid: 'ft-1', defId: 'miskatonic_field_trip',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            // 至少有手牌洗入牌库事件
            expect(result.events.length).toBeGreaterThanOrEqual(1);
            expect(result.events[0].type).toBe(SU_EVENTS.HAND_SHUFFLED_INTO_DECK);
        });
    });
});
