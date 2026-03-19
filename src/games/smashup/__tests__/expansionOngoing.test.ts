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
    interceptEvent,
} from '../domain/ongoingEffects';
import type { SmashUpCore, MinionOnBase, BaseInPlay, CardInstance, FactionId } from '../domain/types';
import { SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { clearRegistry, resolveAbility } from '../domain/abilityRegistry';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { callHandler } from './helpers';
import { registerGhostAbilities } from '../abilities/ghosts';
import { registerSteampunkAbilities, registerSteampunkInteractionHandlers } from '../abilities/steampunks';
import { registerKillerPlantAbilities, registerKillerPlantInteractionHandlers } from '../abilities/killer_plants';
import { registerInnsmouthAbilities, registerInnsmouthInteractionHandlers } from '../abilities/innsmouth';
import { registerMiskatonicAbilities, registerMiskatonicInteractionHandlers } from '../abilities/miskatonic';

// ============================================================================
// 测试辅助
// ============================================================================

function makeMinion(overrides: Partial<MinionOnBase> = {}): MinionOnBase {
    return {
        uid: 'minion-1',
        defId: 'test_minion',
        controller: '0',
        owner: '0',
        basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false,
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

    describe('ghost_incorporeal: 幽灵化保护', () => {
        test('附着 ghost_incorporeal 的随从不受对手影响', () => {
            const minion = makeMinion({
                defId: 'ghost_a', uid: 'g-1', controller: '0',
                attachedActions: [{ uid: 'gi-1', defId: 'ghost_incorporeal', ownerId: '0' }],
            });
            const base = makeBase({ minions: [minion] });
            const state = makeState([base]);

            expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(true);
        });

        test('附着 ghost_incorporeal_pod 的随从也不受对手影响', () => {
            const minion = makeMinion({
                defId: 'ghost_a', uid: 'g-pod-1', controller: '0',
                attachedActions: [{ uid: 'gi-pod-1', defId: 'ghost_incorporeal_pod', ownerId: '0' }],
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
                attachedActions: [{ uid: 'gi-1', defId: 'ghost_incorporeal', ownerId: '0' }],
            });
            const base = makeBase({ minions: [minion] });
            const state = makeState([base]);

            expect(isMinionProtected(state, minion, 0, '0', 'affect')).toBe(false);
        });
    });

    describe('ghost_make_contact: 控制对手随从', () => {
        test('唯一手牌时 onPlay 直接返回空事件（控制权由 ONGOING_ATTACHED reduce 处理）', () => {
            const oppMinion = makeMinion({ defId: 'opp_m', uid: 'om-1', controller: '1', owner: '1', basePower: 5 });
            const base = makeBase({ minions: [oppMinion] });
            const state = makeState([base]);
            // 前置条件：ghost_make_contact 必须是唯一手牌
            state.players['0'].hand = [makeCard('mc-1', 'ghost_make_contact', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS)];
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('ghost_make_contact', 'onPlay')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'mc-1', defId: 'ghost_make_contact',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            // 不应弹出交互（目标随从已通过 targetMinionUid 在打出时确定）
            const current = (result.matchState?.sys as any)?.interaction?.current;
            expect(current).toBeUndefined();
            expect(result.events).toHaveLength(0);
        });

        test('非唯一手牌时 onPlay 返回 condition_not_met 反馈', () => {
            const oppMinion = makeMinion({ defId: 'opp_m', uid: 'om-1', controller: '1', owner: '1', basePower: 5 });
            const base = makeBase({ minions: [oppMinion] });
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('mc-1', 'ghost_make_contact', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                makeCard('other-1', 'ghost_ghost', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
            ];
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('ghost_make_contact', 'onPlay')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'mc-1', defId: 'ghost_make_contact',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            expect(result.events).toHaveLength(1);
            expect((result.events[0] as any).payload?.messageKey).toBe('feedback.condition_not_met');
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
        clearInteractionHandlers();
        registerSteampunkAbilities();
        registerSteampunkInteractionHandlers();
    });

    describe('steampunk_steam_queen: 蒸汽女王保护', () => {
        test('同基地己方行动卡不受对手移除（通过拦截器）', () => {
            const queen = makeMinion({ defId: 'steampunk_steam_queen', uid: 'sq-1', controller: '0' });
            const base = makeBase({
                minions: [queen],
                ongoingActions: [{ uid: 'oa-1', defId: 'test_ongoing', ownerId: '0' }],
            });
            const state = makeState([base]);

            // steam_queen 通过 interceptor 保护 ongoing 行动卡不被对手移除
            const detachEvt = {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: { cardUid: 'oa-1', defId: 'test_ongoing', ownerId: '0', reason: 'opponent_action' },
                timestamp: 0,
            };
            const result = interceptEvent(state, detachEvt);
            // 拦截器应阻止移除（返回 null）
            expect(result).toBeNull();
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
        test('控制者回合结束时且基地有随从时抽1牌', () => {
            const minion = makeMinion({ defId: 'steampunk_a', uid: 'sa-1', controller: '0', owner: '0' });
            const base = makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'de-1', defId: 'steampunk_difference_engine', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
            expect((events[0] as any).payload.playerId).toBe('0');
        });

        test('非控制者回合不触发', () => {
            const minion = makeMinion({ defId: 'steampunk_a', uid: 'sa-1', controller: '0', owner: '0' });
            const base = makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'de-1', defId: 'steampunk_difference_engine', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state, playerId: '1', random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('基地上没有拥有者随从时不触发', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'de-1', defId: 'steampunk_difference_engine', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state, playerId: '0', random: dummyRandom, now: 1000,
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

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
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

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state, playerId: '0', baseIndex: 0,
                triggerMinionUid: 'om-1', triggerMinionDefId: 'opp_m',
                random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });

    describe('steampunk_mechanic: 机械师', () => {
        test('单张行动卡时创建 Interaction', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].discard = [
                makeCard('dis-1', 'steampunk_escape_hatch', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('steampunk_mechanic', 'onPlay')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'mech-1', defId: 'steampunk_mechanic',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            const current = (result.matchState?.sys as any)?.interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('steampunk_mechanic');
        });

        test('只能选择打出到基地上的行动牌，不包括打到随从上的和普通行动牌', () => {
            const base = makeBase();
            const state = makeState([base]);
            // 弃牌堆包含：打出到基地的 ongoing、打出到随从的 ongoing、standard 行动卡
            state.players['0'].discard = [
                makeCard('dis-1', 'steampunk_escape_hatch', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS), // ongoing to base
                makeCard('dis-2', 'ninja_smoke_bomb', 'action', '0', SMASHUP_FACTION_IDS.NINJAS), // ongoing to minion
                makeCard('dis-3', 'steampunk_scrap_diving', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS), // standard
            ];
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('steampunk_mechanic', 'onPlay')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'mech-1', defId: 'steampunk_mechanic',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            const current = (result.matchState?.sys as any)?.interaction?.current;
            expect(current).toBeDefined();
            const options = current?.data?.options || [];
            
            // 应该只有 2 个选项：escape_hatch（打出到基地）+ 取消
            expect(options.length).toBe(2);
            const cardUids = options.map((opt: any) => opt.value?.cardUid).filter(Boolean);
            expect(cardUids).toContain('dis-1'); // escape_hatch
            expect(cardUids).not.toContain('dis-2'); // smoke_bomb（打出到随从）应该被排除
            expect(cardUids).not.toContain('dis-3'); // scrap_diving（普通行动牌）应该被排除
            
            // 验证有取消选项
            const hasCancelOption = options.some((opt: any) => opt.id === '__cancel__');
            expect(hasCancelOption).toBe(true);
        });

        test('无合法基地时不应把受 playConstraint 限制的 ongoing 列为候选', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].discard = [
                makeCard('dis-4', 'cthulhu_complete_the_ritual', 'action', '0', SMASHUP_FACTION_IDS.CTHULHU),
            ];
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('steampunk_mechanic', 'onPlay')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'mech-1', defId: 'steampunk_mechanic',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            expect((result.matchState?.sys as any)?.interaction?.current).toBeUndefined();
            expect(result.events.some((event: any) => event.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
        });

        test('若所选行动已不在弃牌堆则不再恢复或打出', () => {
            const handler = getInteractionHandler('steampunk_mechanic');
            expect(handler).toBeDefined();

            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].discard = [];

            const events = callHandler(handler!, {
                state,
                playerId: '0',
                selectedValue: { cardUid: 'dis-1', defId: 'steampunk_escape_hatch' },
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('steampunk_mechanic_target: 目标基地被对手 ornate_dome 封锁时不再附着', () => {
            const handler = getInteractionHandler('steampunk_mechanic_target');
            expect(handler).toBeDefined();

            const base = makeBase();
            base.ongoingActions = [{
                uid: 'dome-1',
                defId: 'steampunk_ornate_dome',
                ownerId: '1',
                talentUsed: false,
            } as any];
            const state = makeState([base]);
            state.players['0'].hand = [
                makeCard('dis-1', 'steampunk_escape_hatch', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];

            const events = callHandler(handler!, {
                state,
                playerId: '0',
                selectedValue: { baseIndex: 0 },
                data: { cardUid: 'dis-1', defId: 'steampunk_escape_hatch' },
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('若所选行动不是可打到基地上的行动牌则不再恢复或打出', () => {
            const handler = getInteractionHandler('steampunk_mechanic');
            expect(handler).toBeDefined();

            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].discard = [
                makeCard('dis-3', 'steampunk_scrap_diving', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];

            const events = callHandler(handler!, {
                state,
                playerId: '0',
                selectedValue: { cardUid: 'dis-3', defId: 'steampunk_scrap_diving' },
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('steampunk_mechanic_target: 若待附着的 ongoing 已不在手牌则不再附着到基地', () => {
            const handler = getInteractionHandler('steampunk_mechanic_target');
            expect(handler).toBeDefined();

            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].hand = [];

            const events = callHandler(handler!, {
                state,
                playerId: '0',
                selectedValue: { baseIndex: 0 },
                data: { cardUid: 'dis-1', defId: 'steampunk_escape_hatch' },
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });

    describe('steampunk_change_of_venue: 换场', () => {
        test('steampunk_change_of_venue_choose_base: 若待重打的 ongoing 已不在手牌则不再附着', () => {
            const handler = getInteractionHandler('steampunk_change_of_venue_choose_base');
            expect(handler).toBeDefined();

            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].hand = [];

            const events = callHandler(handler!, {
                state,
                playerId: '0',
                selectedValue: { baseIndex: 0 },
                data: { cardUid: 'ongoing-1', defId: 'steampunk_escape_hatch' },
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
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
        clearInteractionHandlers();
        registerKillerPlantAbilities();
        registerKillerPlantInteractionHandlers();
    });

    describe('killer_plant_deep_roots: 深根保护', () => {
        test('基地上有 deep_roots 且随从属于拥有者→对手不可移动', () => {
            const minion = makeMinion({ defId: 'kp_a', uid: 'kp-1', controller: '0' });
            const base = makeBase({
                minions: [minion],
                ongoingActions: [{ uid: 'dr-1', defId: 'killer_plant_deep_roots', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, minion, 0, '1', 'move')).toBe(true);
        });

        test('无 deep_roots 时可被移动', () => {
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

            const { events } = fireTriggers(state, 'onTurnStart', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
        });

        test('POD 版控制者回合开始时也抽1牌', () => {
            const lily = makeMinion({ defId: 'killer_plant_water_lily_pod', uid: 'wl-pod-1', controller: '0' });
            const base = makeBase({ minions: [lily] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
        });

        test('非控制者回合不触发', () => {
            const lily = makeMinion({ defId: 'killer_plant_water_lily', uid: 'wl-1', controller: '0' });
            const base = makeBase({ minions: [lily] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state, playerId: '1', random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(0);
        });

        test('多张睡莲在场每回合也只触发一次', () => {
            const lily1 = makeMinion({ defId: 'killer_plant_water_lily', uid: 'wl-1', controller: '0' });
            const lily2 = makeMinion({ defId: 'killer_plant_water_lily', uid: 'wl-2', controller: '0' });
            const lily3 = makeMinion({ defId: 'killer_plant_water_lily', uid: 'wl-3', controller: '0' });
            const base = makeBase({ minions: [lily1, lily2, lily3] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
        });
    });

    describe('killer_plant_sprout: 嫩芽', () => {
        test('控制者回合开始时消灭自身+搜索随从', () => {
            const sprout = makeMinion({ defId: 'killer_plant_sprout', uid: 'sp-1', controller: '0', owner: '0' });
            const base = makeBase({ minions: [sprout] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            expect(events.length).toBeGreaterThanOrEqual(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('sp-1');
            // 第二个事件：如果牌库有符合条件的随从则是 CARDS_DRAWN，否则是 DECK_REORDERED（洗牌）
            if (events.length > 1) {
                expect([SU_EVENTS.CARDS_DRAWN, SU_EVENTS.DECK_REORDERED]).toContain(events[1].type);
            }
        });

        test('POD 版控制者回合开始时也会消灭自身并搜索随从', () => {
            const sprout = makeMinion({ defId: 'killer_plant_sprout_pod', uid: 'sp-pod-1', controller: '0', owner: '0' });
            const base = makeBase({ minions: [sprout] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            expect(events.length).toBeGreaterThanOrEqual(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('sp-pod-1');
        });

        test('多个候选时创建 generic 牌库检索交互，避免 UI 被错误分流', () => {
            const sprout = makeMinion({ defId: 'killer_plant_sprout', uid: 'sp-1', controller: '0', owner: '0' });
            const base = makeBase({ minions: [sprout] });
            const state = makeState([base]);
            state.players['0'].deck = [
                makeCard('d1', 'killer_plant_sprout', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
                makeCard('d2', 'wizard_neophyte', 'minion', '0', SMASHUP_FACTION_IDS.WIZARDS),
            ];

            const matchState = {
                core: state,
                sys: { phase: 'startTurn', interaction: { current: undefined, queue: [] } },
            } as any;

            const result = fireTriggers(state, 'onTurnStart', {
                state,
                matchState,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            const current = result.matchState?.sys?.interaction?.current as any;
            expect(current).toBeDefined();
            expect(current.data?.sourceId).toBe('killer_plant_sprout_search');
            expect(current.data?.targetType).toBe('generic');
            expect(current.data?.autoRefresh).toBe('deck');
            expect(current.data?.responseValidationMode).toBe('live');
            expect(current.data?.options?.some((opt: any) => opt.id === 'skip')).toBe(true);
            expect(current.data?.options?.filter((opt: any) => opt.displayMode === 'card')).toHaveLength(2);
        });

        test('多个嫩芽共享唯一候选时不会重复打出同一 UID', () => {
            const bases = [
                makeBase({ minions: [makeMinion({ defId: 'killer_plant_sprout', uid: 'sp-1', controller: '0', owner: '0' })] }),
                makeBase({ minions: [makeMinion({ defId: 'killer_plant_sprout', uid: 'sp-2', controller: '0', owner: '0' })] }),
            ];
            const state = makeState(bases);
            state.players['0'].deck = [
                makeCard('wl-1', 'killer_plant_water_lily', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
            ];

            const { events } = fireTriggers(state, 'onTurnStart', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            const playedEvents = events.filter(event => event.type === SU_EVENTS.MINION_PLAYED);
            expect(playedEvents).toHaveLength(1);
            expect((playedEvents[0] as any).payload.cardUid).toBe('wl-1');
        });

        test('嫩芽交互在卡已离开牌库后不会再次打出同一 UID', () => {
            const handler = getInteractionHandler('killer_plant_sprout_search');
            expect(handler).toBeDefined();

            const state = makeState([makeBase()]);
            state.players['0'].deck = [
                makeCard('wl-2', 'killer_plant_water_lily', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
            ];

            const events = callHandler(handler!, {
                state,
                playerId: '0',
                selectedValue: { cardUid: 'wl-1', defId: 'killer_plant_water_lily' },
                data: { baseIndex: 0 },
                random: dummyRandom,
                now: 1000,
            });

            expect(events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
            expect(events.some(event => event.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
        });

    });

    describe('killer_plant_choking_vines: 窒息藤蔓', () => {
        test('回合开始时消灭附着了 choking_vines 的随从', () => {
            const target = makeMinion({
                defId: 'weak_m', uid: 'wm-1', controller: '1', owner: '1', basePower: 1,
                attachedActions: [{ uid: 'cv-1', defId: 'killer_plant_choking_vines', ownerId: '0' }],
            });
            const strong = makeMinion({ defId: 'strong_m', uid: 'sm-1', controller: '0', basePower: 5 });
            const base = makeBase({ minions: [target, strong] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            const destroyEvts = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyEvts).toHaveLength(1);
            expect((destroyEvts[0] as any).payload.minionUid).toBe('wm-1');
        });
    });

    describe('killer_plant_venus_man_trap: 金星捕蝇草', () => {
        test('talent 能力已注册', () => {
            const executor = resolveAbility('killer_plant_venus_man_trap', 'talent');
            expect(executor).toBeDefined();
        });

        test('牌库有力量≤2随从时产生搜索结果', () => {
            const base = makeBase();
            // 放入一个已注册的 power≤2 随从卡（sprout power=2）
            const sproutCard: CardInstance = { uid: 'sp-deck', defId: 'killer_plant_sprout', type: 'minion', owner: '0' };
            const state = makeState([base]);
            state.players['0'].deck = [sproutCard];

            const executor = resolveAbility('killer_plant_venus_man_trap', 'talent')!;
            const result = executor({
                state, playerId: '0', cardUid: 'vmt-1', defId: 'killer_plant_venus_man_trap',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            // 只有一个候选→自动抽取 (CARDS_DRAWN + LIMIT_MODIFIED + MINION_PLAYED + DECK_RESHUFFLED)
            expect(result.events).toHaveLength(4);
            expect(result.events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
            expect(result.events[1].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
            expect(result.events[2].type).toBe(SU_EVENTS.MINION_PLAYED);
            // 验证随从被打出到此基地（baseIndex=0）
            expect((result.events[2] as any).payload.baseIndex).toBe(0);
        });

        test('venus man trap 交互响应会带上基地信息', () => {
            const handler = getInteractionHandler('killer_plant_venus_man_trap_search');
            expect(handler).toBeDefined();

            const base = makeBase({ defId: 'base_crypt' });
            const state = makeState([base]);
            state.players['0'].deck = [
                makeCard('sp-1', 'killer_plant_sprout', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
            ];

            const events = callHandler(handler!, {
                state,
                playerId: '0',
                selectedValue: { cardUid: 'sp-1', defId: 'killer_plant_sprout' },
                data: { baseIndex: 0 },
                random: dummyRandom,
                now: 1000,
            });

            const playedEvent = events.find(event => event.type === SU_EVENTS.MINION_PLAYED) as any;
            expect(playedEvent).toBeDefined();
            expect(playedEvent.payload.cardUid).toBe('sp-1');
            expect(playedEvent.payload.baseIndex).toBe(0);
            expect(playedEvent.payload.baseDefId).toBe('base_crypt');
        });

        test('venus man trap 交互目标已离开牌库时不会重复打出', () => {
            const handler = getInteractionHandler('killer_plant_venus_man_trap_search');
            expect(handler).toBeDefined();

            const state = makeState([makeBase()]);
            state.players['0'].deck = [
                makeCard('sp-2', 'killer_plant_sprout', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
            ];

            const events = callHandler(handler!, {
                state,
                playerId: '0',
                selectedValue: { cardUid: 'sp-1', defId: 'killer_plant_sprout' },
                data: { baseIndex: 0 },
                random: dummyRandom,
                now: 1000,
            });

            expect(events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
            expect(events.some(event => event.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
        });
    });

    describe('killer_plant_blossom: 绽放', () => {
        test('给予3个同名额外随从额度', () => {
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
                expect((e as any).payload.sameNameOnly).toBe(true);
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
        clearInteractionHandlers();
        registerInnsmouthAbilities();
        registerInnsmouthInteractionHandlers();
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

        test('POD 版 in_plain_sight 也会保护力量≤2的己方随从', () => {
            const weakMinion = makeMinion({ defId: 'inn_a', uid: 'ia-pod-1', controller: '0', basePower: 2 });
            const base = makeBase({
                minions: [weakMinion],
                ongoingActions: [{ uid: 'ips-pod-1', defId: 'innsmouth_in_plain_sight_pod', ownerId: '0' }],
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

        test('交互响应会保留原基地索引，且目标失效时不再重复回手', () => {
            const executor = resolveAbility('innsmouth_return_to_the_sea', 'special')!;
            const triggerMinion = makeMinion({
                uid: 'inn-1',
                defId: 'innsmouth_the_locals',
                controller: '0',
                owner: '0',
            });
            const sameNameMinion = makeMinion({
                uid: 'inn-2',
                defId: 'innsmouth_the_locals',
                controller: '0',
                owner: '0',
            });
            const otherMinion = makeMinion({
                uid: 'other-1',
                defId: 'wizard_neophyte',
                controller: '1',
                owner: '1',
            });
            const state = makeState([makeBase({ minions: [triggerMinion, sameNameMinion, otherMinion] })]);
            const ms = { core: state, sys: { phase: 'scoreBases', interaction: { current: undefined, queue: [] } } } as any;

            const result = executor({
                state,
                matchState: ms,
                playerId: '0',
                cardUid: 'inn-1',
                defId: 'innsmouth_return_to_the_sea',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });

            const interaction = (result.matchState?.sys as any)?.interaction?.current;
            expect(interaction?.data?.sourceId).toBe('innsmouth_return_to_the_sea');
            const firstOption = interaction?.data?.options?.find((entry: any) => entry.value?.minionUid === 'inn-1');
            expect(firstOption?.value?.baseIndex).toBe(0);

            const handler = getInteractionHandler('innsmouth_return_to_the_sea');
            expect(handler).toBeDefined();

            const liveEvents = callHandler(handler!, {
                state,
                playerId: '0',
                selectedValue: [firstOption.value],
                random: dummyRandom,
                now: 1001,
            });
            expect(liveEvents).toHaveLength(1);
            expect(liveEvents[0].type).toBe(SU_EVENTS.MINION_RETURNED);
            expect((liveEvents[0] as any).payload.fromBaseIndex).toBe(0);

            const staleState = makeState([makeBase({ minions: [otherMinion] })], {
                players: {
                    ...state.players,
                    '0': {
                        ...state.players['0'],
                        discard: [
                            ...state.players['0'].discard,
                            makeCard('inn-1', 'innsmouth_the_locals', 'minion', '0', SMASHUP_FACTION_IDS.INNSMOUTH),
                        ],
                    },
                },
            });
            const staleEvents = callHandler(handler!, {
                state: staleState,
                playerId: '0',
                selectedValue: [firstOption.value],
                random: dummyRandom,
                now: 1002,
            });
            expect(staleEvents).toHaveLength(0);
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
        clearInteractionHandlers();
        registerMiskatonicAbilities();
        registerMiskatonicInteractionHandlers();
    });

    describe('miskatonic_researcher: 研究员', () => {
        test('onPlay 能力已注册', () => {
            const executor = resolveAbility('miskatonic_researcher', 'onPlay');
            expect(executor).toBeDefined();
        });

        test('创建确认交互（"你可以"抽疯狂卡）', () => {
            const base = makeBase();
            const state = makeState([base], {
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('miskatonic_researcher', 'onPlay')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'res-1', defId: 'miskatonic_researcher',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            // 应创建确认交互而非直接抽牌
            expect(result.matchState).toBeDefined();
            const interaction = (result.matchState as any)?.sys?.interaction;
            expect(interaction?.current).toBeDefined();
            expect(interaction?.current?.data?.sourceId).toBe('miskatonic_researcher');
            expect(interaction?.current?.data?.targetType).toBe('button');
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
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('miskatonic_field_trip', 'onPlay')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'ft-1', defId: 'miskatonic_field_trip',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            // 手牌>0时创建多选 Interaction 让玩家选择放牌库底的手牌
            const interaction = (result.matchState?.sys as any)?.interaction;
            const current = interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('miskatonic_field_trip');
        });

        test('交互选项不包含疯狂牌', () => {
            const base = makeBase();
            // 手牌中混入疯狂牌
            const stateWithMadness = makeState([base], {
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [
                            makeCard('h1', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                            { uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' } as any,
                            { uid: 'mad2', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' } as any,
                        ],
                        deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
                    },
                },
            });
            const ms = { core: stateWithMadness, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('miskatonic_field_trip', 'onPlay')!;
            const result = executor({
                state: stateWithMadness, matchState: ms, playerId: '0',
                cardUid: 'ft-1', defId: 'miskatonic_field_trip',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            const interaction = (result.matchState?.sys as any)?.interaction;
            const current = interaction?.current;
            expect(current).toBeDefined();
            // 选项中不应包含疯狂牌（mad1, mad2）
            const options = current?.data?.options ?? [];
            const madnessOptions = options.filter((o: any) => o.value?.defId === MADNESS_CARD_DEF_ID);
            expect(madnessOptions.length).toBe(0);
            // 只有 h1 这一张普通牌（skip 选项不算）
            const cardOptions = options.filter((o: any) => o.value?.cardUid);
            expect(cardOptions.length).toBe(1);
        });
    });

    describe('miskatonic_pod: pod rule regression', () => {
        test('researcher pod creates pod interaction', () => {
            const base = makeBase({ minions: [makeMinion({ uid: 'm-1', defId: 'test_minion', controller: '0' })] });
            const state = makeState([base], {
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('miskatonic_researcher_pod', 'onPlay')!;
            const result = executor({
                state,
                matchState: ms,
                playerId: '0',
                cardUid: 'res-pod-1',
                defId: 'miskatonic_researcher_pod',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });

            const current = (result.matchState?.sys as any)?.interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('miskatonic_researcher_pod');
        });

        test('researcher pod draw flow leads to minion pick and +1 counter', () => {
            const base = makeBase({ minions: [makeMinion({ uid: 'm-1', defId: 'test_minion', controller: '0' })] });
            const state = makeState([base], {
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const step1 = getInteractionHandler('miskatonic_researcher_pod');
            expect(step1).toBeDefined();
            const step1Result = step1!(ms, '0', { draw: true }, undefined, dummyRandom, 1001);
            const chooseMinion = (step1Result.state?.sys as any)?.interaction?.current;
            expect(chooseMinion).toBeDefined();
            expect(chooseMinion?.data?.sourceId).toBe('miskatonic_researcher_pod_choose_minion');

            const step2 = getInteractionHandler('miskatonic_researcher_pod_choose_minion');
            expect(step2).toBeDefined();
            const events = callHandler(step2!, {
                state,
                playerId: '0',
                selectedValue: { minionUid: 'm-1', baseIndex: 0 },
                random: dummyRandom,
                now: 1002,
            });

            expect(events.some(e => e.type === SU_EVENTS.MADNESS_DRAWN)).toBe(true);
            expect(events.some(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED)).toBe(true);
        });

        test('field trip pod options include Madness cards', () => {
            const base = makeBase();
            const stateWithMadness = makeState([base], {
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [
                            makeCard('h1', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS),
                            { uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' } as any,
                        ],
                        deck: [makeCard('d1', 'deck_action_1', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS)],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
                    },
                },
            });
            const ms = { core: stateWithMadness, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('miskatonic_field_trip_pod', 'onPlay')!;
            const result = executor({
                state: stateWithMadness,
                matchState: ms,
                playerId: '0',
                cardUid: 'ft-pod-1',
                defId: 'miskatonic_field_trip_pod',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });

            const current = (result.matchState?.sys as any)?.interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('miskatonic_field_trip_pod');
            const options = current?.data?.options ?? [];
            const madnessOptions = options.filter((o: any) => o.value?.defId === MADNESS_CARD_DEF_ID);
            expect(madnessOptions.length).toBeGreaterThan(0);
        });

        test('field trip pod draws 1 even when selecting no cards', () => {
            const base = makeBase();
            const state = makeState([base], {
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [makeCard('h1', 'test_minion_a', 'minion', '0', SMASHUP_FACTION_IDS.GHOSTS)],
                        deck: [makeCard('d1', 'deck_action_1', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS)],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
                    },
                },
            });
            const handler = getInteractionHandler('miskatonic_field_trip_pod');
            expect(handler).toBeDefined();

            const events = callHandler(handler!, {
                state,
                playerId: '0',
                selectedValue: { skip: true },
                random: dummyRandom,
                now: 1003,
            });
            const drawEvt = events.find(e => e.type === SU_EVENTS.CARDS_DRAWN) as any;
            expect(drawEvt).toBeDefined();
            expect(drawEvt.payload?.count).toBe(1);
        });

        test('things best not known pod grants temporary power, not permanent power', () => {
            const target = makeMinion({ uid: 'target-1', defId: 'test_minion', controller: '0' });
            const base = makeBase({ minions: [target] });
            const state = makeState([base], {
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });
            const handler = getInteractionHandler('miskatonic_things_best_not_known_pod_draw');
            expect(handler).toBeDefined();

            const events = callHandler(handler!, {
                state,
                playerId: '0',
                selectedValue: { count: 2, minionUid: 'target-1', baseIndex: 0 },
                random: dummyRandom,
                now: 1004,
            });

            expect(events.some(e => e.type === SU_EVENTS.MADNESS_DRAWN)).toBe(true);
            expect(events.some(e => e.type === SU_EVENTS.TEMP_POWER_ADDED)).toBe(true);
            expect(events.some(e => e.type === SU_EVENTS.PERMANENT_POWER_ADDED)).toBe(false);
        });

        test('librarian pod extra mode only plays Madness and marks extra action', () => {
            const base = makeBase();
            const state = makeState([base], {
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [
                            { uid: 'mad1', defId: MADNESS_CARD_DEF_ID, type: 'action', owner: '0' } as any,
                            makeCard('h1', 'test_action_a', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS),
                        ],
                        deck: [],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.GHOSTS, SMASHUP_FACTION_IDS.STEAMPUNKS] as [string, string],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.ALIENS] as [string, string],
                    },
                },
            });
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const modeHandler = getInteractionHandler('miskatonic_librarian_pod');
            expect(modeHandler).toBeDefined();
            const modeResult = modeHandler!(ms, '0', { mode: 'extra' }, undefined, dummyRandom, 1005);
            const chooseMadness = (modeResult.state?.sys as any)?.interaction?.current;
            expect(chooseMadness).toBeDefined();
            expect(chooseMadness?.data?.sourceId).toBe('miskatonic_librarian_pod_play_madness');

            const playMadnessHandler = getInteractionHandler('miskatonic_librarian_pod_play_madness');
            expect(playMadnessHandler).toBeDefined();
            const events = callHandler(playMadnessHandler!, {
                state,
                playerId: '0',
                selectedValue: { cardUid: 'mad1' },
                random: dummyRandom,
                now: 1006,
            });

            const actionPlayed = events.find(e => e.type === SU_EVENTS.ACTION_PLAYED) as any;
            expect(actionPlayed).toBeDefined();
            expect(actionPlayed.payload?.defId).toBe(MADNESS_CARD_DEF_ID);
            expect(actionPlayed.payload?.isExtraAction).toBe(true);
        });
    });
});
