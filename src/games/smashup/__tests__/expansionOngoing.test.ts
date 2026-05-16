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
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { getAbilityRuntimePromptHandler } from '../domain/abilityRuntime';
import {
    expectNoPrompt,
    getFirstPrompt,
    getPromptHandlerData,
    getPromptOption,
    getPromptOptions,
    getPromptOptionsGenerator,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    respondToPromptOption,
    respondToPromptOptions,
    withOnlyCurrentPrompt,
} from './helpers';
import { buildAffectRecords } from '../domain/affect';
import { registerGhostAbilities } from '../abilities/ghosts';
import { registerSteampunkAbilities } from '../abilities/steampunks';
import { registerKillerPlantAbilities } from '../abilities/killer_plants';
import { registerInnsmouthAbilities } from '../abilities/innsmouth';
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
        test('唯一手牌时 onPlay 显式发出控制权变更事件', () => {
            const oppMinion = makeMinion({ defId: 'opp_m', uid: 'om-1', controller: '1', owner: '1', basePower: 5 });
            const base = makeBase({ minions: [oppMinion] });
            const state = makeState([base]);
            // 前置条件：ghost_make_contact 必须是唯一手牌
            state.players['0'].hand = [makeCard('mc-1', 'ghost_make_contact', 'action', '0', SMASHUP_FACTION_IDS.GHOSTS)];
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('ghost_make_contact', 'onPlay')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'mc-1', defId: 'ghost_make_contact',
                baseIndex: 0, targetMinionUid: 'om-1', random: dummyRandom, now: 1000,
            });

            // 不应弹出交互（目标随从已通过 targetMinionUid 在打出时确定）
            if (result.matchState) {
                expectNoPrompt(result.matchState as any);
            }
            expect(result.events).toHaveLength(1);
            expect(result.events[0].type).toBe(SU_EVENTS.MINION_CONTROL_CHANGED);
            expect((result.events[0] as any).payload).toMatchObject({
                minionUid: 'om-1',
                fromControllerId: '1',
                toControllerId: '0',
                sourcePlayerId: '0',
                sourceCardUid: 'mc-1',
                sourceDefId: 'ghost_make_contact',
            });
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

        test('POD 版无手牌时也显式发出控制权变更事件', () => {
            const oppMinion = makeMinion({ defId: 'opp_m', uid: 'om-1', controller: '1', owner: '1', basePower: 5 });
            const base = makeBase({ minions: [oppMinion] });
            const state = makeState([base]);
            state.players['0'].hand = [];
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('ghost_make_contact_pod', 'onPlay')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'mc-pod-1', defId: 'ghost_make_contact_pod',
                baseIndex: 0, targetMinionUid: 'om-1', random: dummyRandom, now: 1000,
            });

            expect(result.events).toHaveLength(1);
            expect(result.events[0].type).toBe(SU_EVENTS.MINION_CONTROL_CHANGED);
            expect((result.events[0] as any).payload.sourceDefId).toBe('ghost_make_contact_pod');
        });

        test('Make Contact 脱离时恢复控制权不会再次记成随从被影响', () => {
            const controlledMinion = makeMinion({
                defId: 'opp_m',
                uid: 'om-1',
                controller: '0',
                owner: '1',
                attachedActions: [{ uid: 'mc-1', defId: 'ghost_make_contact', ownerId: '0' }],
            });
            const state = makeState([makeBase({ minions: [controlledMinion] })]);

            const records = buildAffectRecords(state, {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'mc-1',
                    defId: 'ghost_make_contact',
                    ownerId: '0',
                    reason: 'ghost_make_contact_expired',
                },
                timestamp: 1000,
            } as any);

            expect(records).toHaveLength(1);
            expect(records[0]).toMatchObject({
                targetKind: 'attached_action',
                targetUid: 'mc-1',
                affectType: 'destroy',
                countsForOnMinionAffected: false,
            });
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
                payload: {
                    cardUid: 'oa-1',
                    defId: 'test_ongoing',
                    ownerId: '0',
                    reason: 'opponent_action',
                    sourcePlayerId: '1',
                    sourceCardUid: 'opp-action-1',
                    sourceDefId: 'pirate_shanghai',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 0,
            };
            const result = interceptEvent(state, detachEvt);
            // 拦截器应阻止移除（返回 null）
            expect(result).toBeNull();
        });

        test('不会误拦截自毁导致的行动牌离场', () => {
            const queen = makeMinion({ defId: 'steampunk_steam_queen', uid: 'sq-1', controller: '0' });
            const base = makeBase({
                minions: [queen],
                ongoingActions: [{ uid: 'oa-1', defId: 'test_ongoing', ownerId: '0' }],
            });
            const state = makeState([base]);

            const detachEvt = {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'oa-1',
                    defId: 'test_ongoing',
                    ownerId: '0',
                    reason: 'test_ongoing_self_destruct',
                    sourcePlayerId: '1',
                    sourceCardUid: 'opp-action-1',
                    sourceDefId: 'pirate_shanghai',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 0,
            };

            expect(interceptEvent(state, detachEvt)).toBeUndefined();
        });

        test('不会误拦截过期导致的行动牌离场', () => {
            const queen = makeMinion({ defId: 'steampunk_steam_queen', uid: 'sq-1', controller: '0' });
            const base = makeBase({
                minions: [queen],
                ongoingActions: [{ uid: 'oa-1', defId: 'test_ongoing', ownerId: '0' }],
            });
            const state = makeState([base]);

            const detachEvt = {
                type: SU_EVENTS.ONGOING_DETACHED,
                payload: {
                    cardUid: 'oa-1',
                    defId: 'test_ongoing',
                    ownerId: '0',
                    reason: 'test_ongoing_expired',
                    sourcePlayerId: '1',
                    sourceCardUid: 'opp-action-1',
                    sourceDefId: 'pirate_shanghai',
                    sourceControllerId: '1',
                    sourceBaseIndex: 0,
                },
                timestamp: 0,
            };

            expect(interceptEvent(state, detachEvt)).toBeUndefined();
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

            const current = getSimpleChoicePrompt(result.matchState!, 'steampunk_mechanic');
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('steampunk_mechanic');
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

            const current = getSimpleChoicePrompt(result.matchState!, 'steampunk_mechanic');
            expect(current).toBeDefined();
            const options = getPromptOptions(current);
            
            const cardUids = options.map((opt: any) => opt.value?.cardUid).filter(Boolean);
            expect(cardUids).toEqual(['dis-1']); // 只保留可打到基地上的 ongoing
            expect(cardUids).not.toContain('dis-2'); // smoke_bomb（打出到随从）应该被排除
            expect(cardUids).not.toContain('dis-3'); // scrap_diving（普通行动牌）应该被排除
        });

        test('反馈 69a2f027：附着到随从上的 ongoing 不应进入机械师候选，也不应被 handler 接受', () => {
            const base = makeBase({
                minions: [makeMinion({ uid: 'm-1', defId: 'test_minion_target' })],
            });
            const state = makeState([base]);
            state.players['0'].discard = [
                makeCard('dis-base', 'steampunk_escape_hatch', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                makeCard('dis-minion-a', 'ninja_smoke_bomb', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
                makeCard('dis-minion-b', 'ninja_assassination', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
            ];
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('steampunk_mechanic', 'onPlay')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'mech-1', defId: 'steampunk_mechanic',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            const current = getSimpleChoicePrompt(result.matchState!, 'steampunk_mechanic');
            expect(current).toBeDefined();
            const cardUids = getPromptOptions(current).map((opt: any) => opt.value?.cardUid).filter(Boolean);
            expect(cardUids).toEqual(['dis-base']);

            const handler = getAbilityRuntimePromptHandler('steampunk_mechanic');
            expect(handler).toBeDefined();
            const resolved = handler!(
                result.matchState!,
                '0',
                { cardUid: 'dis-minion-a', defId: 'ninja_smoke_bomb' },
                getPromptHandlerData(current),
                dummyRandom,
                1000,
            );
            const events = resolved?.events ?? [];
            expect(events).toHaveLength(0);
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

            if (result.matchState) {
                expectNoPrompt(result.matchState as any);
            }
            expect(result.events.some((event: any) => event.type === SU_EVENTS.ABILITY_FEEDBACK)).toBe(true);
        });

        test('若所选行动已不在弃牌堆则不再恢复或打出', () => {
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
            const current = getSimpleChoicePrompt(result.matchState!, 'steampunk_mechanic');

            const staleState = {
                ...result.matchState!,
                core: {
                    ...result.matchState!.core,
                    players: {
                        ...result.matchState!.core.players,
                        '0': {
                            ...result.matchState!.core.players['0'],
                            discard: [],
                        },
                    },
                },
            } as any;

            const resolved = respondToPromptOption(
                withOnlyCurrentPrompt(staleState, current),
                option => option.value?.cardUid === 'dis-1',
                'steampunk mechanic dis-1 option',
                '0',
                dummyRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const events = resolved.events;

            expect(events).toHaveLength(0);
        });

        test('steampunk_mechanic_target: 目标基地被对手 ornate_dome 封锁时不再附着', () => {
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
            const step1 = respondToPromptOption(
                result.matchState!,
                option => option.value?.cardUid === 'dis-1',
                'steampunk mechanic dis-1 option',
                '0',
                dummyRandom,
            );
            expect(step1.success, step1.error).toBe(true);
            const chooseTargetInteraction = getFirstPrompt(step1.finalState);

            const blockedState = {
                ...step1.finalState,
                core: {
                    ...step1.finalState.core,
                    bases: [{
                        ...step1.finalState.core.bases[0],
                        ongoingActions: [{
                            uid: 'dome-1',
                            defId: 'steampunk_ornate_dome',
                            ownerId: '1',
                            talentUsed: false,
                        } as any],
                    }],
                },
            } as any;

            const liveOptions = getPromptOptionsGenerator(chooseTargetInteraction)?.(
                withOnlyCurrentPrompt(blockedState, chooseTargetInteraction),
                getPromptHandlerData(chooseTargetInteraction),
            ) ?? [];
            expect(liveOptions.some(option => option.value?.baseIndex === 0)).toBe(false);

            const resolved = respondToPromptOption(
                withOnlyCurrentPrompt(blockedState, chooseTargetInteraction),
                option => option.value?.baseIndex === 0,
                'steampunk mechanic target base 0 option',
                '0',
                dummyRandom,
            );
            expect(resolved.success).toBe(false);
            expect(resolved.error).toBe('无效的选择');
        });

        test('若所选行动不是可打到基地上的行动牌则不再恢复或打出', () => {
            const base = makeBase();
            const state = makeState([base]);
            state.players['0'].discard = [
                makeCard('dis-1', 'steampunk_escape_hatch', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
                makeCard('dis-3', 'steampunk_scrap_diving', 'action', '0', SMASHUP_FACTION_IDS.STEAMPUNKS),
            ];
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('steampunk_mechanic', 'onPlay')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'mech-1', defId: 'steampunk_mechanic',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });
            const current = getSimpleChoicePrompt(result.matchState!, 'steampunk_mechanic');

            const handler = getAbilityRuntimePromptHandler('steampunk_mechanic');
            expect(handler).toBeDefined();

            const resolved = handler!(
                result.matchState!,
                '0',
                { cardUid: 'dis-3', defId: 'steampunk_scrap_diving' },
                getPromptHandlerData(current),
                dummyRandom,
                1001,
            );
            const events = resolved?.events ?? [];

            expect(events).toHaveLength(0);
        });

        test('steampunk_mechanic_target: 若待附着的 ongoing 已不在手牌则不再附着到基地', () => {
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
            const step1 = respondToPromptOption(
                result.matchState!,
                option => option.value?.cardUid === 'dis-1',
                'steampunk mechanic dis-1 option',
                '0',
                dummyRandom,
            );
            expect(step1.success, step1.error).toBe(true);
            const chooseTargetInteraction = getFirstPrompt(step1.finalState);

            const staleHandState = {
                ...step1.finalState,
                core: {
                    ...step1.finalState.core,
                    players: {
                        ...step1.finalState.core.players,
                        '0': {
                            ...step1.finalState.core.players['0'],
                            hand: [],
                        },
                    },
                },
            } as any;

            const resolved = respondToPromptOption(
                withOnlyCurrentPrompt(staleHandState, chooseTargetInteraction),
                option => option.value?.baseIndex === 0,
                'steampunk mechanic target base 0 option',
                '0',
                dummyRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const events = resolved.events;

            expect(events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.ONGOING_ATTACHED)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
            expect(resolved.finalState.core.bases[0].ongoingActions).toHaveLength(0);
            expect(resolved.finalState.core.players['0'].hand).toHaveLength(0);
        });
    });

    describe('steampunk_change_of_venue: 换场', () => {
        test('steampunk_change_of_venue_choose_base: 若待重打的 ongoing 已不在手牌则不再附着', () => {
            const base = makeBase({
                ongoingActions: [{
                    uid: 'ongoing-1',
                    defId: 'steampunk_escape_hatch',
                    ownerId: '0',
                    talentUsed: false,
                } as any],
            });
            const state = makeState([base]);
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('steampunk_change_of_venue', 'onPlay')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'cov-1', defId: 'steampunk_change_of_venue',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });
            const step1 = respondToPromptOption(
                result.matchState!,
                option => option.value?.cardUid === 'ongoing-1',
                'change of venue ongoing-1 option',
                '0',
                dummyRandom,
            );
            expect(step1.success, step1.error).toBe(true);
            const chooseBaseInteraction = getFirstPrompt(step1.finalState);

            const staleHandState = {
                ...step1.finalState,
                core: {
                    ...step1.finalState.core,
                    players: {
                        ...step1.finalState.core.players,
                        '0': {
                            ...step1.finalState.core.players['0'],
                            hand: [],
                        },
                    },
                },
            } as any;

            const resolved = respondToPromptOption(
                withOnlyCurrentPrompt(staleHandState, chooseBaseInteraction),
                option => option.value?.baseIndex === 0,
                'change of venue base 0 option',
                '0',
                dummyRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const events = resolved.events;

            expect(events.some(event => event.type === SU_EVENTS.ACTION_PLAYED)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.ONGOING_ATTACHED)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
            expect(resolved.finalState.core.bases[0].ongoingActions).toHaveLength(0);
            expect(resolved.finalState.core.players['0'].hand).toHaveLength(0);
        });
    });

    describe('steampunk_captain_ahab: 亚哈船长', () => {
        test('talent 能力已注册', () => {
            const executor = resolveAbility('steampunk_captain_ahab', 'talent');
            expect(executor).toBeDefined();
        });

        test('多个候选基地时创建 base interaction', () => {
            const captain = makeMinion({ uid: 'ahab-1', defId: 'steampunk_captain_ahab', controller: '0', owner: '0' });
            const state = makeState([
                makeBase({ minions: [captain] }),
                makeBase({ ongoingActions: [{ uid: 'ongoing-1', defId: 'steampunk_escape_hatch', ownerId: '0', talentUsed: false } as any] }),
                makeBase({ ongoingActions: [{ uid: 'ongoing-2', defId: 'steampunk_difference_engine', ownerId: '0', talentUsed: false } as any] }),
            ]);
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('steampunk_captain_ahab', 'talent')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'ahab-1', defId: 'steampunk_captain_ahab',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            const current = getSimpleChoicePrompt(result.matchState!, 'steampunk_captain_ahab');
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('steampunk_captain_ahab');
            expect(getPromptTargetType(current)).toBe('base');
        });

        test('唯一候选基地时直接移动，不创建 interaction', () => {
            const captain = makeMinion({ uid: 'ahab-1', defId: 'steampunk_captain_ahab', controller: '0', owner: '0' });
            const state = makeState([
                makeBase({ minions: [captain] }),
                makeBase({ ongoingActions: [{ uid: 'ongoing-1', defId: 'steampunk_escape_hatch', ownerId: '0', talentUsed: false } as any] }),
                makeBase(),
            ]);
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('steampunk_captain_ahab', 'talent')!;
            const result = executor({
                state, matchState: ms, playerId: '0', cardUid: 'ahab-1', defId: 'steampunk_captain_ahab',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });

            if (result.matchState) {
                expectNoPrompt(result.matchState as any);
            }
            const moved = result.events.find(event => event.type === SU_EVENTS.MINION_MOVED) as any;
            expect(moved).toBeDefined();
            expect(moved.payload.fromBaseIndex).toBe(0);
            expect(moved.payload.toBaseIndex).toBe(1);
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

        test('牌库空但弃牌堆有牌时先洗回再抽牌', () => {
            const lily = makeMinion({ defId: 'killer_plant_water_lily', uid: 'wl-1', controller: '0' });
            const base = makeBase({ minions: [lily] });
            const baseState = makeState([base]);
            const state = makeState([base], {
                players: {
                    ...baseState.players,
                    '0': {
                        ...baseState.players['0'],
                        deck: [],
                        discard: [makeCard('discard-1', 'deck_minion_1', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS)],
                    },
                },
            });

            const { events } = fireTriggers(state, 'onTurnStart', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            expect(events.map(event => event.type)).toEqual([
                SU_EVENTS.DECK_RESHUFFLED,
                SU_EVENTS.CARDS_DRAWN,
            ]);
            expect((events[1] as any).payload.cardUids).toEqual(['discard-1']);
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

            const current = getSimpleChoicePrompt(result.matchState as any, 'killer_plant_sprout_search');
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('killer_plant_sprout_search');
            expect(getPromptTargetType(current)).toBe('generic');
            const promptData = getPromptHandlerData(current);
            expect(promptData.autoRefresh).toBe('deck');
            expect(promptData.responseValidationMode).toBe('live');
            expect(getPromptOptions(current).some((opt: any) => opt.id === 'skip')).toBe(true);
            expect(getPromptOptions(current).filter((opt: any) => opt.displayMode === 'card')).toHaveLength(2);
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

        test('多个嫩芽在不同基地会分别消灭自身', () => {
            const bases = [
                makeBase({ minions: [makeMinion({ defId: 'killer_plant_sprout', uid: 'sp-1', controller: '0', owner: '0' })] }),
                makeBase({ minions: [makeMinion({ defId: 'killer_plant_sprout', uid: 'sp-2', controller: '0', owner: '0' })] }),
            ];
            const state = makeState(bases);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state, playerId: '0', random: dummyRandom, now: 1000,
            });

            const destroyedEvents = events.filter(event => event.type === SU_EVENTS.MINION_DESTROYED);
            expect(destroyedEvents).toHaveLength(2);
            const destroyedUids = destroyedEvents
                .map(event => (event as any).payload.minionUid)
                .sort();
            expect(destroyedUids).toEqual(['sp-1', 'sp-2']);
        });

        test('嫩芽交互在卡已离开牌库后不会再次打出同一 UID', () => {
            const initialState = makeState([makeBase({
                minions: [makeMinion({ defId: 'killer_plant_sprout', uid: 'sp-1', controller: '0', owner: '0' })],
            })]);
            initialState.players['0'].deck = [
                makeCard('wl-1', 'killer_plant_water_lily', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
                makeCard('sp-1-deck', 'killer_plant_sprout', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
            ];
            const staleState = makeState([makeBase()]);
            staleState.players['0'].deck = [
                makeCard('wl-2', 'killer_plant_water_lily', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
            ];
            const matchState = {
                core: initialState,
                sys: { phase: 'startTurn', interaction: { current: undefined, queue: [] } },
            } as any;
            const promptState = fireTriggers(initialState, 'onTurnStart', {
                state: initialState,
                matchState,
                playerId: '0',
                random: dummyRandom,
                now: 999,
            }).matchState as any;
            const prompt = getSimpleChoicePrompt(promptState, 'killer_plant_sprout_search');
            expect(getPromptSourceId(prompt)).toBe('killer_plant_sprout_search');

            const resolved = respondToPromptOption(
                withOnlyCurrentPrompt({ ...promptState, core: staleState } as any, prompt),
                option => option.value?.cardUid === 'wl-1',
                'killer plant sprout stale wl-1 option',
                '0',
                dummyRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const events = resolved.events;

            expect(events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
            expect(getPromptSourceId(getFirstPrompt(resolved.finalState))).toBe('killer_plant_sprout_search');
            expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['wl-2']);
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
            const base = makeBase({ defId: 'base_crypt' });
            const state = makeState([base]);
            state.players['0'].deck = [
                makeCard('sp-1', 'killer_plant_sprout', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
                makeCard('sp-2', 'killer_plant_sprout', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
            ];
            const executor = resolveAbility('killer_plant_venus_man_trap', 'talent')!;
            const matchState = {
                core: state,
                sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } },
            } as any;
            const promptState = executor({
                state,
                matchState,
                playerId: '0',
                cardUid: 'vmt-1',
                defId: 'killer_plant_venus_man_trap',
                baseIndex: 0,
                random: dummyRandom,
                now: 999,
            } as any).matchState as any;
            const prompt = getSimpleChoicePrompt(promptState, 'killer_plant_venus_man_trap_search');
            expect(getPromptSourceId(prompt)).toBe('killer_plant_venus_man_trap_search');

            const resolved = respondToPromptOption(
                promptState,
                option => option.value?.cardUid === 'sp-1',
                'venus man trap sp-1 option',
                '0',
                dummyRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const events = resolved.events;

            const playedEvent = events.find(event => event.type === SU_EVENTS.MINION_PLAYED) as any;
            expect(playedEvent).toBeDefined();
            expect(playedEvent.payload.cardUid).toBe('sp-1');
            expect(playedEvent.payload.baseIndex).toBe(0);
            expect(playedEvent.payload.baseDefId).toBe('base_crypt');
        });

        test('venus man trap 交互目标已离开牌库时不会重复打出', () => {
            const initialState = makeState([makeBase()]);
            initialState.players['0'].deck = [
                makeCard('sp-1', 'killer_plant_sprout', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
                makeCard('sp-3', 'killer_plant_sprout', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
            ];
            const staleState = makeState([makeBase()]);
            staleState.players['0'].deck = [
                makeCard('sp-2', 'killer_plant_sprout', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
                makeCard('wl-2', 'killer_plant_water_lily', 'minion', '0', SMASHUP_FACTION_IDS.KILLER_PLANTS),
            ];
            const executor = resolveAbility('killer_plant_venus_man_trap', 'talent')!;
            const matchState = {
                core: initialState,
                sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } },
            } as any;
            const promptState = executor({
                state: initialState,
                matchState,
                playerId: '0',
                cardUid: 'vmt-1',
                defId: 'killer_plant_venus_man_trap',
                baseIndex: 0,
                random: dummyRandom,
                now: 999,
            } as any).matchState as any;
            const prompt = getSimpleChoicePrompt(promptState, 'killer_plant_venus_man_trap_search');
            expect(getPromptSourceId(prompt)).toBe('killer_plant_venus_man_trap_search');

            const resolved = respondToPromptOption(
                withOnlyCurrentPrompt({ ...promptState, core: staleState } as any, prompt),
                option => option.value?.cardUid === 'sp-1',
                'venus man trap stale sp-1 option',
                '0',
                dummyRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const events = resolved.events;

            expect(events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
            expect(events.some(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toBe(false);
            expect(getPromptSourceId(getFirstPrompt(resolved.finalState))).toBe('killer_plant_venus_man_trap_search');
            expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['sp-2', 'wl-2']);
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

            const interaction = getSimpleChoicePrompt(result.matchState!, 'innsmouth_return_to_the_sea');
            expect(getPromptSourceId(interaction)).toBe('innsmouth_return_to_the_sea');
            const firstOption = getPromptOption(
                interaction,
                (entry: any) => entry.value?.minionUid === 'inn-1',
                'Return to the Sea self-return option',
            );
            expect(firstOption?.value?.baseIndex).toBe(0);

            const liveResult = respondToPromptOptions(
                result.matchState!,
                [firstOption.id],
                '0',
                dummyRandom,
            );
            expect(liveResult.success, liveResult.error).toBe(true);
            const liveEvents = liveResult.events;
            const returnedEvents = liveEvents.filter(event => event.type === SU_EVENTS.MINION_RETURNED);
            expect(returnedEvents).toHaveLength(1);
            expect((returnedEvents[0] as any).payload.fromBaseIndex).toBe(0);

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
            const staleMs = { core: staleState, sys: { phase: 'scoreBases', interaction: { current: undefined, queue: [] } } } as any;
            const staleResult = respondToPromptOptions(
                withOnlyCurrentPrompt(staleMs, interaction),
                [firstOption.id],
                '0',
                dummyRandom,
            );
            expect(staleResult.success, staleResult.error).toBe(true);
            const staleEvents = staleResult.events;
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
            const prompt = getSimpleChoicePrompt(result.matchState as any, 'miskatonic_researcher');
            expect(prompt).toBeDefined();
            expect(getPromptSourceId(prompt)).toBe('miskatonic_researcher');
            expect(getPromptTargetType(prompt)).toBe('button');
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
            const current = getSimpleChoicePrompt(result.matchState!, 'miskatonic_field_trip');
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('miskatonic_field_trip');
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

            const current = getSimpleChoicePrompt(result.matchState!, 'miskatonic_field_trip');
            expect(current).toBeDefined();
            // 选项中不应包含疯狂牌（mad1, mad2）
            const options = getPromptOptions(current);
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

            const current = getSimpleChoicePrompt(result.matchState!, 'miskatonic_researcher_pod');
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('miskatonic_researcher_pod');
        });

        test('researcher pod draw flow leads to minion pick and +1 counter', () => {
            const base = makeBase({ minions: [makeMinion({ uid: 'm-1', defId: 'test_minion', controller: '0' })] });
            const state = makeState([base], {
                madnessDeck: [MADNESS_CARD_DEF_ID, MADNESS_CARD_DEF_ID],
            });
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('miskatonic_researcher_pod', 'onPlay')!;
            const firstStep = executor({
                state,
                matchState: ms,
                playerId: '0',
                cardUid: 'res-pod-1',
                defId: 'miskatonic_researcher_pod',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });
            const step1Result = respondToPromptOption(
                firstStep.matchState!,
                option => option.value?.draw === true,
                'miskatonic researcher pod draw option',
                '0',
                dummyRandom,
            );
            expect(step1Result.success, step1Result.error).toBe(true);
            const chooseMinion = getSimpleChoicePrompt(step1Result.finalState, 'miskatonic_researcher_pod_choose_minion');
            expect(chooseMinion).toBeDefined();
            expect(getPromptSourceId(chooseMinion)).toBe('miskatonic_researcher_pod_choose_minion');

            const step2Result = respondToPromptOption(
                step1Result.finalState,
                option => option.value?.minionUid === 'm-1' && option.value?.baseIndex === 0,
                'miskatonic researcher pod target m-1 option',
                '0',
                dummyRandom,
            );
            expect(step2Result.success, step2Result.error).toBe(true);
            const events = step2Result.events;

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

            const current = getSimpleChoicePrompt(result.matchState!, 'miskatonic_field_trip_pod');
            expect(current).toBeDefined();
            expect(getPromptSourceId(current)).toBe('miskatonic_field_trip_pod');
            const options = getPromptOptions(current);
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
            const executor = resolveAbility('miskatonic_field_trip_pod', 'onPlay')!;
            const matchState = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
            const firstStep = executor({
                state,
                matchState,
                playerId: '0',
                cardUid: 'ft-pod-1',
                defId: 'miskatonic_field_trip_pod',
                random: dummyRandom,
                now: 1002,
            });
            const resolved = respondToPromptOptions(firstStep.matchState!, [], '0', dummyRandom);
            expect(resolved.success, resolved.error).toBe(true);
            const events = resolved.events;
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
            const executor = resolveAbility('miskatonic_things_best_not_known_pod', 'special');
            expect(executor).toBeDefined();
            const matchState = { core: state, sys: { phase: 'beforeScoring', interaction: { current: undefined, queue: [] } } } as any;
            const firstStep = executor!({
                state,
                matchState,
                playerId: '0',
                cardUid: 'tbnk-1',
                defId: 'miskatonic_things_best_not_known_pod',
                baseIndex: 0,
                random: dummyRandom,
                now: 1004,
            });
            const result = respondToPromptOption(
                firstStep.matchState!,
                option => option.value?.count === 2,
                'miskatonic things best not known draw 2 option',
                '0',
                dummyRandom,
            );
            expect(result.success, result.error).toBe(true);
            const events = result.events;

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
            const talentExecutor = resolveAbility('miskatonic_librarian_pod', 'talent')!;
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;
            const firstStep = talentExecutor({
                state,
                matchState: ms,
                playerId: '0',
                cardUid: 'lib-pod-1',
                defId: 'miskatonic_librarian_pod',
                random: dummyRandom,
                now: 1005,
            });
            const modeResult = respondToPromptOption(
                firstStep.matchState!,
                option => option.value?.mode === 'extra',
                'miskatonic librarian pod extra option',
                '0',
                dummyRandom,
            );
            expect(modeResult.success, modeResult.error).toBe(true);
            const chooseMadness = getSimpleChoicePrompt(modeResult.finalState, 'miskatonic_librarian_pod_play_madness');
            expect(chooseMadness).toBeDefined();
            expect(getPromptSourceId(chooseMadness)).toBe('miskatonic_librarian_pod_play_madness');

            const resolved = respondToPromptOption(
                modeResult.finalState,
                option => option.value?.cardUid === 'mad1',
                'miskatonic librarian pod madness mad1 option',
                '0',
                dummyRandom,
            );
            expect(resolved.success, resolved.error).toBe(true);
            const events = resolved.events;

            const actionPlayed = events.find(e => e.type === SU_EVENTS.ACTION_PLAYED) as any;
            expect(actionPlayed).toBeDefined();
            expect(actionPlayed.payload?.defId).toBe(MADNESS_CARD_DEF_ID);
            expect(actionPlayed.payload?.isExtraAction).toBe(true);
        });
    });
});
