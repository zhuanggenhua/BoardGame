/**
 * 基础派系 ongoing/special 能力测试
 *
 * 覆盖 Task 7.2-7.5 新增的能力：
 * - 忍者：smoke_bomb, assassination, shinobi, acolyte, hidden_ninja, infiltrate
 * - 机器人：warbot, microbot_archive
 * - 巫师：archmage
 * - 诡术师：leprechaun, brownie, enshrouding_mist, hideout, flame_trap, block_the_path, pay_the_piper, mark_of_sleep
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
import { SU_EVENTS } from '../domain/types';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { clearRegistry } from '../domain/abilityRegistry';
import { registerNinjaAbilities } from '../abilities/ninjas';
import { registerRobotAbilities } from '../abilities/robots';
import { registerWizardAbilities } from '../abilities/wizards';
import { registerTricksterAbilities } from '../abilities/tricksters';
import { resolveAbility } from '../domain/abilityRegistry';
import { reduce } from '../domain/reduce';

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
        tempPowerModifier: 0,
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

function makeState(bases: BaseInPlay[], extraPlayers?: Partial<SmashUpCore['players']>): SmashUpCore {
    return {
        players: {
            '0': {
                id: '0', vp: 0,
                hand: [
                    makeCard('h1', 'ninja_shinobi', 'minion', '0', SMASHUP_FACTION_IDS.NINJAS),
                    makeCard('h2', 'test_action', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
                    makeCard('h3', 'test_minion_b', 'minion', '0', SMASHUP_FACTION_IDS.NINJAS),
                ],
                deck: [
                    makeCard('d1', 'deck_card_1', 'minion', '0', SMASHUP_FACTION_IDS.NINJAS),
                    makeCard('d2', 'deck_card_2', 'action', '0', SMASHUP_FACTION_IDS.NINJAS),
                ],
                discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: [SMASHUP_FACTION_IDS.NINJAS, 'test_b'] as [string, string],
            },
            '1': {
                id: '1', vp: 0,
                hand: [
                    makeCard('oh1', 'opp_card_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS),
                    makeCard('oh2', 'opp_card_2', 'action', '1', SMASHUP_FACTION_IDS.ROBOTS),
                    makeCard('oh3', 'opp_card_3', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS),
                ],
                deck: [
                    makeCard('od1', 'opp_deck_1', 'minion', '1', SMASHUP_FACTION_IDS.ROBOTS),
                ],
                discard: [],
                minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                factions: [SMASHUP_FACTION_IDS.ROBOTS, 'test_d'] as [string, string],
            },
            ...extraPlayers,
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases,
        baseDeck: [],
        turnNumber: 1,
        nextUid: 200,
    };
}

const dummyRandom = {
    random: () => 0.5,
    shuffle: <T>(arr: T[]): T[] => [...arr],
} as any;

// ============================================================================
// 忍者 ongoing/special 能力
// ============================================================================

describe('忍者 ongoing/special 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerNinjaAbilities();
    });

    describe('ninja_smoke_bomb: 烟雾弹保护', () => {
        test('保护同基地己方随从不受对手行动卡影响', () => {
            const myMinion = makeMinion({ defId: 'ninja_a', uid: 'n-1', controller: '0' });
            const base = makeBase({
                minions: [myMinion],
                ongoingActions: [{ uid: 'sb-1', defId: 'ninja_smoke_bomb', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, myMinion, 0, '1', 'action')).toBe(true);
        });

        test('不保护对手随从', () => {
            const oppMinion = makeMinion({ defId: 'robot_a', uid: 'r-1', controller: '1' });
            const base = makeBase({
                minions: [oppMinion],
                ongoingActions: [{ uid: 'sb-1', defId: 'ninja_smoke_bomb', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, oppMinion, 0, '0', 'action')).toBe(false);
        });
    });

    describe('ninja_assassination: 暗杀', () => {
        test('回合结束时消灭附着了暗杀的随从', () => {
            const target = makeMinion({
                defId: 'opp_minion', uid: 'om-1', controller: '1', owner: '1',
                attachedActions: [{ uid: 'as-1', defId: 'ninja_assassination', ownerId: '0' }],
            });
            const base = makeBase({ minions: [target] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('om-1');
            expect((events[0] as any).payload.reason).toBe('ninja_assassination');
        });

        test('无附着暗杀时不触发', () => {
            const target = makeMinion({ defId: 'opp_minion', uid: 'om-1', controller: '1' });
            const base = makeBase({ minions: [target] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnEnd', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });

    describe('ninja_infiltrate: 渗透', () => {
        test('附着渗透的随从不受影响', () => {
            const minion = makeMinion({
                defId: 'ninja_a', uid: 'n-1', controller: '0',
                attachedActions: [{ uid: 'inf-1', defId: 'ninja_infiltrate', ownerId: '0' }],
            });
            const base = makeBase({ minions: [minion] });
            const state = makeState([base]);

            expect(isMinionProtected(state, minion, 0, '1', 'affect')).toBe(true);
        });
    });

    describe('ninja_shinobi: 忍 special', () => {
        test('special 能力已注册', () => {
            const executor = resolveAbility('ninja_shinobi', 'special');
            expect(executor).toBeDefined();
        });

        test('正常打出到基地', () => {
            const base = makeBase({ minions: [] });
            const state = makeState([base]);
            const executor = resolveAbility('ninja_shinobi', 'special')!;
            const result = executor({
                state, playerId: '0', cardUid: 'h1', defId: 'ninja_shinobi',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });
            expect(result.events.length).toBe(2);
            expect(result.events[0].type).toBe(SU_EVENTS.SPECIAL_LIMIT_USED);
            expect(result.events[1].type).toBe(SU_EVENTS.MINION_PLAYED);
        });

        test('同基地已使用忍者 special 时被阻止', () => {
            const base = makeBase({ minions: [] });
            const state = makeState([base]);
            state.specialLimitUsed = { ninja_special: [0] };
            const executor = resolveAbility('ninja_shinobi', 'special')!;
            const result = executor({
                state, playerId: '0', cardUid: 'h1', defId: 'ninja_shinobi',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });
            expect(result.events).toHaveLength(0);
        });

        test('不同基地不受限制', () => {
            const base0 = makeBase({ minions: [] });
            const base1 = makeBase({ minions: [] });
            const state = makeState([base0, base1]);
            state.specialLimitUsed = { ninja_special: [0] };
            const executor = resolveAbility('ninja_shinobi', 'special')!;
            const result = executor({
                state, playerId: '0', cardUid: 'h1', defId: 'ninja_shinobi',
                baseIndex: 1, random: dummyRandom, now: 1000,
            });
            expect(result.events.length).toBe(2);
            expect(result.events[0].type).toBe(SU_EVENTS.SPECIAL_LIMIT_USED);
        });
    });

    describe('ninja_acolyte: 侍僧 special', () => {
        test('返回手牌并给额外随从额度', () => {
            const base = makeBase({
                minions: [makeMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })],
            });
            const state = makeState([base]);

            const executor = resolveAbility('ninja_acolyte', 'special')!;
            const result = executor({
                state,
                playerId: '0',
                cardUid: 'ac-1',
                defId: 'ninja_acolyte',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });

            expect(result.events).toHaveLength(3);
            expect(result.events[0].type).toBe(SU_EVENTS.SPECIAL_LIMIT_USED);
            expect(result.events[1].type).toBe(SU_EVENTS.MINION_RETURNED);
            expect(result.events[2].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
        });

        test('同基地已使用忍者 special 时被阻止', () => {
            const base = makeBase({
                minions: [makeMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })],
            });
            const state = makeState([base]);
            state.specialLimitUsed = { ninja_special: [0] };
            const executor = resolveAbility('ninja_acolyte', 'special')!;
            const result = executor({
                state, playerId: '0', cardUid: 'ac-1', defId: 'ninja_acolyte',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });
            expect(result.events).toHaveLength(0);
        });
    });

    describe('ninja_hidden_ninja: 隐忍 special', () => {
        test('special 能力已注册', () => {
            const executor = resolveAbility('ninja_hidden_ninja', 'special');
            expect(executor).toBeDefined();
        });

        test('同基地已使用忍者 special 时被阻止', () => {
            const base = makeBase({ minions: [] });
            const state = makeState([base]);
            state.specialLimitUsed = { ninja_special: [0] };
            const executor = resolveAbility('ninja_hidden_ninja', 'special')!;
            const result = executor({
                state, playerId: '0', cardUid: 'hn-1', defId: 'ninja_hidden_ninja',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });
            expect(result.events).toHaveLength(0);
        });
    });

    describe('specialLimitGroup: 跨卡牌共享限制', () => {
        test('使用 shinobi 后同基地 acolyte 被阻止', () => {
            const base = makeBase({
                minions: [makeMinion({ defId: 'ninja_acolyte', uid: 'ac-1', controller: '0' })],
            });
            const state = makeState([base]);
            // 模拟 shinobi 已使用（同组 ninja_special）
            state.specialLimitUsed = { ninja_special: [0] };
            const executor = resolveAbility('ninja_acolyte', 'special')!;
            const result = executor({
                state, playerId: '0', cardUid: 'ac-1', defId: 'ninja_acolyte',
                baseIndex: 0, random: dummyRandom, now: 1000,
            });
            expect(result.events).toHaveLength(0);
        });

        test('SPECIAL_LIMIT_USED 事件正确更新 reducer 状态', () => {
            const base = makeBase({ minions: [] });
            const state = makeState([base]);
            const evt = {
                type: SU_EVENTS.SPECIAL_LIMIT_USED,
                payload: { playerId: '0', baseIndex: 0, limitGroup: 'ninja_special', abilityDefId: 'ninja_shinobi' },
                timestamp: 1000,
            };
            const next = reduce(state, evt as any);
            expect(next.specialLimitUsed).toEqual({ ninja_special: [0] });
            // 再次使用不同基地
            const evt2 = { ...evt, payload: { ...evt.payload, baseIndex: 1 } };
            const next2 = reduce(next, evt2 as any);
            expect(next2.specialLimitUsed).toEqual({ ninja_special: [0, 1] });
        });

        test('TURN_STARTED 清除 specialLimitUsed', () => {
            const base = makeBase({ minions: [] });
            const state = makeState([base]);
            state.specialLimitUsed = { ninja_special: [0, 1] };
            const evt = {
                type: SU_EVENTS.TURN_STARTED,
                payload: { playerId: '0', turnNumber: 2 },
                timestamp: 2000,
            };
            const next = reduce(state, evt as any);
            expect(next.specialLimitUsed).toBeUndefined();
        });
    });
});

// ============================================================================
// 机器人 ongoing 能力
// ============================================================================

describe('机器人 ongoing 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerRobotAbilities();
    });

    describe('robot_warbot: 战争机器人不可被消灭', () => {
        test('warbot 受 destroy 保护', () => {
            const warbot = makeMinion({ defId: 'robot_warbot', uid: 'wb-1', controller: '0' });
            const base = makeBase({ minions: [warbot] });
            const state = makeState([base]);

            expect(isMinionProtected(state, warbot, 0, '1', 'destroy')).toBe(true);
        });

        test('非 warbot 不受保护', () => {
            const warbot = makeMinion({ defId: 'robot_warbot', uid: 'wb-1', controller: '0' });
            const normal = makeMinion({ defId: 'robot_zapbot', uid: 'zb-1', controller: '0' });
            const base = makeBase({ minions: [warbot, normal] });
            const state = makeState([base]);

            expect(isMinionProtected(state, normal, 0, '1', 'destroy')).toBe(false);
        });
    });

    describe('robot_microbot_archive: 微型机被消灭后抽牌', () => {
        test('微型机被消灭时 archive 控制者抽牌', () => {
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-1', controller: '0' });
            const base = makeBase({ minions: [archive] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '0',
                baseIndex: 0,
                triggerMinionUid: 'mg-1',
                triggerMinionDefId: 'robot_microbot_guard',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DRAWN);
            expect((events[0] as any).payload.playerId).toBe('0');
        });

        test('非微型机被消灭时不触发', () => {
            const archive = makeMinion({ defId: 'robot_microbot_archive', uid: 'ma-1', controller: '0' });
            const base = makeBase({ minions: [archive] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionDestroyed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'big-1',
                triggerMinionDefId: 'robot_hoverbot',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });
});


// ============================================================================
// 巫师 ongoing 能力
// ============================================================================

describe('巫师 ongoing 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerWizardAbilities();
    });

    describe('wizard_archmage: 大法师回合开始额外行动', () => {
        test('控制者回合开始时获得额外行动额度', () => {
            const archmage = makeMinion({ defId: 'wizard_archmage', uid: 'am-1', controller: '0' });
            const base = makeBase({ minions: [archmage] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
            expect((events[0] as any).payload.playerId).toBe('0');
            expect((events[0] as any).payload.limitType).toBe('action');
            expect((events[0] as any).payload.delta).toBe(1);
        });

        test('非控制者回合不触发', () => {
            const archmage = makeMinion({ defId: 'wizard_archmage', uid: 'am-1', controller: '0' });
            const base = makeBase({ minions: [archmage] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '1', // 对手回合
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });
});

// ============================================================================
// 诡术师 ongoing 能力
// ============================================================================

describe('诡术师 ongoing 能力', () => {
    beforeEach(() => {
        clearOngoingEffectRegistry();
        clearRegistry();
        registerTricksterAbilities();
    });

    describe('trickster_flame_trap: 火焰陷阱', () => {
        test('对手打出随从到陷阱基地时消灭', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'ft-1', defId: 'trickster_flame_trap', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(2);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.reason).toBe('trickster_flame_trap');
            // 火焰陷阱触发后自毁
            expect(events[1].type).toBe(SU_EVENTS.ONGOING_DETACHED);
            expect((events[1] as any).payload.defId).toBe('trickster_flame_trap');
        });

        test('自己打出随从不触发', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'ft-1', defId: 'trickster_flame_trap', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '0', // 自己
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });

    describe('trickster_block_the_path: 封路', () => {
        test('对手不能打出被封派系随从到封路基地', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'bp-1', defId: 'trickster_block_the_path', ownerId: '0', metadata: { blockedFaction: SMASHUP_FACTION_IDS.ROBOTS } }],
            });
            const state = makeState([base]);

            // 使用真实的机器人派系 defId
            expect(isOperationRestricted(state, 0, '1', 'play_minion', { minionDefId: 'robot_zapbot' })).toBe(true);
        });

        test('所有玩家都受封路限制（描述无"对手"限定）', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'bp-1', defId: 'trickster_block_the_path', ownerId: '0', metadata: { blockedFaction: SMASHUP_FACTION_IDS.ROBOTS } }],
            });
            const state = makeState([base]);

            // 拥有者也受限制（描述无"对手"限定词）
            expect(isOperationRestricted(state, 0, '0', 'play_minion', { minionDefId: 'robot_zapbot' })).toBe(true);
        });
    });

    describe('trickster_hideout: 藏身处保护', () => {
        test('保护同基地己方随从不受对手行动卡影响', () => {
            const myMinion = makeMinion({ defId: 'trickster_a', uid: 't-1', controller: '0' });
            const base = makeBase({
                minions: [myMinion],
                ongoingActions: [{ uid: 'ho-1', defId: 'trickster_hideout', ownerId: '0' }],
            });
            const state = makeState([base]);

            expect(isMinionProtected(state, myMinion, 0, '1', 'action')).toBe(true);
        });
    });

    describe('trickster_pay_the_piper: 付笛手的钱', () => {
        test('对手打出随从后弃一张牌', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'pp-1', defId: 'trickster_pay_the_piper', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'new-m',
                triggerMinionDefId: 'some_minion',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.CARDS_DISCARDED);
            expect((events[0] as any).payload.playerId).toBe('1');
        });
    });

    describe('trickster_enshrouding_mist: 迷雾笼罩', () => {
        test('拥有者回合开始时获得额外随从额度', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'em-1', defId: 'trickster_enshrouding_mist', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '0',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.LIMIT_MODIFIED);
            expect((events[0] as any).payload.limitType).toBe('minion');
        });

        test('非拥有者回合不触发', () => {
            const base = makeBase({
                ongoingActions: [{ uid: 'em-1', defId: 'trickster_enshrouding_mist', ownerId: '0' }],
            });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onTurnStart', {
                state,
                playerId: '1',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(0);
        });
    });

    describe('trickster_leprechaun: 小矮妖', () => {
        test('对手打出力量更低的随从到同基地时消灭', () => {
            const leprechaun = makeMinion({
                defId: 'trickster_leprechaun', uid: 'lp-1', controller: '0', basePower: 4,
            });
            const weakMinion = makeMinion({
                defId: 'weak_minion', uid: 'wm-1', controller: '1', basePower: 2,
            });
            const base = makeBase({ minions: [leprechaun, weakMinion] });
            const state = makeState([base]);

            const { events } = fireTriggers(state, 'onMinionPlayed', {
                state,
                playerId: '1',
                baseIndex: 0,
                triggerMinionUid: 'wm-1',
                triggerMinionDefId: 'weak_minion',
                random: dummyRandom,
                now: 1000,
            });

            expect(events).toHaveLength(1);
            expect(events[0].type).toBe(SU_EVENTS.MINION_DESTROYED);
            expect((events[0] as any).payload.minionUid).toBe('wm-1');
        });
    });

    describe('trickster_mark_of_sleep: 沉睡印记', () => {
        test('onPlay 能力已注册', () => {
            const executor = resolveAbility('trickster_mark_of_sleep', 'onPlay');
            expect(executor).toBeDefined();
        });

        test('单目标时创建 Interaction', () => {
            const base = makeBase();
            const state = makeState([base]);
            const ms = { core: state, sys: { phase: 'playCards', interaction: { current: undefined, queue: [] } } } as any;

            const executor = resolveAbility('trickster_mark_of_sleep', 'onPlay')!;
            const result = executor({
                state,
                matchState: ms,
                playerId: '0',
                cardUid: 'ms-1',
                defId: 'trickster_mark_of_sleep',
                baseIndex: 0,
                random: dummyRandom,
                now: 1000,
            });

            // 迁移后通过 Interaction 而非事件
            const interaction = (result.matchState?.sys as any)?.interaction;
            const current = interaction?.current;
            expect(current).toBeDefined();
            expect(current?.data?.sourceId).toBe('trickster_mark_of_sleep');
        });
    });
});
