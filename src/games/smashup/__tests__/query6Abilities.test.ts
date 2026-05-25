/**
 * 大杀四方 - 第6批能力测试（移动/搜索/伪装类）
 *
 * 覆盖：
 * - 海盗：pirate_dinghy（小艇）、pirate_shanghai（上海）、pirate_sea_dogs（海狗）、pirate_powderkeg（炸药桶）
 * - 忍者：ninja_way_of_deception（欺骗之道）、ninja_disguise（伪装）
 * - 巫师：wizard_mass_enchantment（群体附魔）、wizard_portal（传送门）、wizard_scry（占卜）
 *         wizard_sacrifice（献祭）、wizard_winds_of_change（变化之风）
 * - 外星人：alien_scout（侦察兵）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { reduce } from '../domain/reducer';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import type {
    SmashUpCore,
    SmashUpEvent,
    PlayerState,
    MinionOnBase,
    CardInstance,
} from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { makeMatchState as makeMatchStateFromHelpers } from './helpers';
import { runCommand } from './testRunner';
import type { MatchState, RandomFn } from '../../../engine/types';
import { INTERACTION_COMMANDS, refreshInteractionOptions } from '../../../engine/systems/InteractionSystem';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 辅助函数
// ============================================================================

function makeMinion(uid: string, defId: string, controller: string, power: number, owner?: string): MinionOnBase {
    return {
        uid, defId, controller, owner: owner ?? controller,
        basePower: power, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [],
    };
}

function makeCard(uid: string, defId: string, type: 'minion' | 'action', owner: string): CardInstance {
    return { uid, defId, type, owner };
}

function makePlayer(id: string, overrides?: Partial<PlayerState>): PlayerState {
    return {
        id, vp: 0, hand: [], deck: [], discard: [],
        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
        factions: ['test_a', 'test_b'] as [string, string],
        ...overrides,
    };
}

function makeState(overrides?: Partial<SmashUpCore>): SmashUpCore {
    return {
        players: { '0': makePlayer('0'), '1': makePlayer('1') },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases: [],
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        ...overrides,
    };
}

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    return makeMatchStateFromHelpers(core);
}

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number, random?: RandomFn) {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_MINION, playerId,
        payload: { cardUid, baseIndex },
    } as any, random ?? defaultRandom);
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number, random?: RandomFn) {
    const ms = makeMatchState(state);
    const result = runCommand(ms, {
        type: SU_COMMANDS.PLAY_ACTION, playerId,
        payload: { cardUid, targetBaseIndex },
    } as any, random ?? defaultRandom);
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

function applyEvents(state: SmashUpCore, events: SmashUpEvent[]): SmashUpCore {
    return events.reduce((s, e) => reduce(s, e), state);
}

// ============================================================================
// 海盗派系 - 移动/炸药桶
// ============================================================================

describe('海盗派系能力（第6批）', () => {
    it('pirate_dinghy: 多个己方随从时创建 Prompt 选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_dinghy', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 2, { powerModifier: 0 }), makeMinion('m1', 'test', '0', 3, { powerModifier: 0 })], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('pirate_dinghy_choose_first');
    });

    it('pirate_dinghy: 只有一个己方随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_dinghy', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 2, { powerModifier: 0 })], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('pirate_dinghy_choose_first');
    });

    it('pirate_dinghy: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_dinghy', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3, { powerModifier: 0 })], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(0);
    });

    it('pirate_shanghai: 多目标时创建 Prompt 选择随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_shanghai', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'test', '1', 5), makeMinion('m2', 'test', '1', 3, { powerModifier: 0 })], ongoingActions: [] },
                { defId: 'b2', minions: [makeMinion('m3', 'test', '0', 4), makeMinion('m4', 'test', '0', 2, { powerModifier: 0 })], ongoingActions: [] },
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 多个对手随从时创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('pirate_shanghai_choose_minion');
    });

    it('pirate_sea_dogs: 多目标时创建 Prompt 选择派系', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_sea_dogs', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'robot_zapbot', '1', 5), makeMinion('m2', 'robot_hoverbot', '1', 2, { powerModifier: 0 })], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 现在先选派系
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('pirate_sea_dogs_choose_faction');
    });

    it('pirate_powderkeg: 单个己方随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_powderkeg', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1', minions: [
                    makeMinion('m0', 'test', '0', 2, { powerModifier: 0 }), // 己方力量最低
                    makeMinion('m1', 'test', '1', 2), // 对手力量=2
                    makeMinion('m2', 'test', '1', 5), // 对手力量=5
                ], ongoingActions: [],
            }],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 单个己方随从时创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('pirate_powderkeg');
    });

    it('pirate_powderkeg: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'pirate_powderkeg', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'b1', minions: [
                    makeMinion('m1', 'test', '1', 3, { powerModifier: 0 }),
                ], ongoingActions: [],
            }],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents.length).toBe(0);
    });

});

// ============================================================================
// 忍者派系 - 欺骗/伪装
// ============================================================================

describe('忍者派系能力（第6批）', () => {
    it('ninja_way_of_deception: 多个己方随从时创建 Prompt 选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_way_of_deception', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 5, { powerModifier: 0 }), makeMinion('m1', 'test', '0', 2, { powerModifier: 0 })], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('ninja_way_of_deception_choose_minion');
    });

    it('ninja_way_of_deception: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_way_of_deception', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3, { powerModifier: 0 })], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(0);
    });

    it('ninja_way_of_deception: 只有一个基地时无法移动', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_way_of_deception', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 5)], ongoingActions: [] },
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents.length).toBe(0);
    });

    it('ninja_disguise: 单个己方随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ninja_disguise', 'action', '0'),
                        makeCard('m_hand', 'ninja_master', 'minion', '0'), // 手牌中的随从
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 2)], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 单个己方随从时直接跳到选随从
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('ninja_disguise_choose_minions');
    });

    it('ninja_disguise: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ninja_disguise', 'action', '0'),
                        makeCard('m_hand', 'ninja_master', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3, { powerModifier: 0 })], ongoingActions: [] },
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const returnEvents = events.filter(e => e.type === SU_EVENTS.MINION_RETURNED);
        expect(returnEvents.length).toBe(0);
    });

    it('ninja_disguise: 有己方随从但手牌无随从时不创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_disguise', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 2)], ongoingActions: [] },
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        // 手牌无随从时 maxSelect=0，不创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeUndefined();
        expect(events.filter(e => e.type === SU_EVENTS.MINION_RETURNED).length).toBe(0);
    });

    it('ninja_disguise: 打出 borrowed 手牌随从时应保留真实 owner', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ninja_disguise', 'action', '0'),
                        makeCard('borrowed-hand-minion', 'ninja_master', 'minion', '1'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('return-me', 'ninja_shinobi', '0', 2)], ongoingActions: [] },
                { defId: 'b2', minions: [], ongoingActions: [] },
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const chooseMinionsPrompt: any = matchState.sys.interaction?.current?.data;
        expect(chooseMinionsPrompt?.sourceId).toBe('ninja_disguise_choose_minions');
        const returnOption = chooseMinionsPrompt.options.find((option: any) => option.value?.minionUid === 'return-me');
        expect(returnOption).toBeTruthy();

        const afterReturnSelection = runCommand(
            matchState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: returnOption.id } },
            defaultRandom,
        );
        const playPrompt: any = afterReturnSelection.finalState.sys.interaction?.current?.data;
        expect(playPrompt?.sourceId).toBe('ninja_disguise_choose_play1');
        const borrowedOption = playPrompt.options.find((option: any) => option.value?.cardUid === 'borrowed-hand-minion');
        expect(borrowedOption).toBeTruthy();

        const afterPlay = runCommand(
            afterReturnSelection.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: borrowedOption.id } },
            defaultRandom,
        );

        const playedEvent: any = afterPlay.events.find(event => event.type === SU_EVENTS.MINION_PLAYED);
        expect(playedEvent?.payload?.ownerId).toBe('1');
        const playedMinion = afterPlay.finalState.core.bases[0].minions.find(minion => minion.uid === 'borrowed-hand-minion');
        expect(playedMinion?.controller).toBe('0');
        expect(playedMinion?.owner).toBe('1');
        expect(afterPlay.finalState.core.players['0'].hand.some(card => card.uid === 'borrowed-hand-minion')).toBe(false);
    });
});

// ============================================================================
// 巫师派系 - 群体附魔/传送门/占卜/献祭/变化之风
// ============================================================================

describe('巫师派系能力（第6批）', () => {
    it('wizard_mass_enchantment: 单个对手时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_mass_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('d1', 'test_action', 'action', '1'), makeCard('d2', 'test_minion', 'minion', '1')],
                }),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 单个对手时创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('wizard_mass_enchantment');
    });

    it('wizard_mass_enchantment: 对手牌库顶变化后不应继续保留过期行动卡候选', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_mass_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('d1', 'test_action', 'action', '1'),
                        makeCard('d2', 'test_minion', 'minion', '1'),
                    ],
                }),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const refreshedState = refreshInteractionOptions({
            ...matchState,
            core: {
                ...matchState.core,
                players: {
                    ...matchState.core.players,
                    '1': {
                        ...matchState.core.players['1'],
                        deck: [
                            makeCard('intrude', 'test_minion', 'minion', '1'),
                            makeCard('d1', 'test_action', 'action', '1'),
                            makeCard('d2', 'test_minion', 'minion', '1'),
                        ],
                    },
                },
            },
        });

        const current = (refreshedState.sys as any).interaction?.current;
        expect(current?.data?.sourceId).toBe('wizard_mass_enchantment');
        const optionUids = (current?.data?.options ?? []).map((option: any) => option.value?.cardUid).filter(Boolean);
        expect(optionUids).not.toContain('d1');
    });

    it('wizard_mass_enchantment: 对手牌库为空时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_mass_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1', { deck: [] }),
            },
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });

    it('wizard_mass_enchantment: 打出附着到随从的行动时应保留目标上下文并触发 base_enchanted_glade', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_mass_enchantment', 'action', '0')],
                    deck: [makeCard('draw-a', 'draw_card_1', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('d1', 'ninja_smoke_bomb', 'action', '1')],
                }),
            },
            bases: [
                {
                    defId: 'base_enchanted_glade',
                    minions: [makeMinion('host-0', 'test_host', '0', 3)],
                    ongoingActions: [],
                },
            ],
        });

        const playMass = execPlayAction(state, '0', 'a1');
        const chooseAction = (playMass.matchState.sys as any).interaction?.current;
        expect(chooseAction?.data?.sourceId).toBe('wizard_mass_enchantment');

        const chooseActionResult = runCommand(playMass.matchState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: chooseAction.data.options[0].id },
            timestamp: 1001,
        }, defaultRandom);
        expect(chooseActionResult.success).toBe(true);

        const chooseTarget = (chooseActionResult.finalState.sys as any).interaction?.current;
        expect(chooseTarget?.data?.sourceId).toBe('wizard_mass_enchantment_choose_minion');

        const resolveTarget = runCommand(chooseActionResult.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: chooseTarget.data.options[0].id },
            timestamp: 1002,
        }, defaultRandom);
        expect(resolveTarget.success).toBe(true);

        const actionPlayed = resolveTarget.events.find(event => event.type === SU_EVENTS.ACTION_PLAYED) as any;
        expect(actionPlayed?.payload).toEqual(expect.objectContaining({
            playerId: '0',
            cardUid: 'd1',
            defId: 'ninja_smoke_bomb',
            ownerId: '1',
            isExtraAction: true,
            targetBaseIndex: 0,
            targetType: 'minion',
            targetMinionUid: 'host-0',
        }));
        expect(resolveTarget.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                count: 1,
                cardUids: ['draw-a'],
            }),
        }));
        expect(resolveTarget.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'd1',
                defId: 'ninja_smoke_bomb',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'host-0',
            }),
        }));
        expect(resolveTarget.finalState.core.bases[0].minions[0].attachedActions).toEqual(expect.arrayContaining([
            expect.objectContaining({ uid: 'd1', defId: 'ninja_smoke_bomb', ownerId: '1' }),
        ]));
        expect((resolveTarget.finalState.sys as any).interaction?.current).toBeUndefined();
        expect(resolveTarget.finalState.core.players['0'].hand.map(card => card.uid)).toContain('draw-a');
    });

    it('wizard_mass_enchantment: 打出无 onPlay 的基地 ongoing 时应保留目标上下文，并让 base_enchanted_glade 以 base-target 语义入队但不抽牌', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_mass_enchantment', 'action', '0')],
                    deck: [makeCard('draw-a', 'draw_card_1', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('d1', 'steampunk_escape_hatch', 'action', '1')],
                }),
            },
            bases: [
                {
                    defId: 'base_enchanted_glade',
                    minions: [makeMinion('host-0', 'test_host', '0', 3)],
                    ongoingActions: [],
                },
            ],
        });

        const playMass = execPlayAction(state, '0', 'a1');
        const chooseAction = (playMass.matchState.sys as any).interaction?.current;
        expect(chooseAction?.data?.sourceId).toBe('wizard_mass_enchantment');

        const chooseActionResult = runCommand(playMass.matchState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: chooseAction.data.options[0].id },
            timestamp: 1101,
        }, defaultRandom);
        expect(chooseActionResult.success).toBe(true);

        const chooseTarget = (chooseActionResult.finalState.sys as any).interaction?.current;
        expect(chooseTarget?.data?.sourceId).toBe('wizard_mass_enchantment_choose_base');

        const resolveTarget = runCommand(chooseActionResult.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: chooseTarget.data.options[0].id },
            timestamp: 1102,
        }, defaultRandom);
        expect(resolveTarget.success).toBe(true);

        const actionPlayed = resolveTarget.events.find(event => event.type === SU_EVENTS.ACTION_PLAYED) as any;
        expect(actionPlayed?.payload).toEqual(expect.objectContaining({
            playerId: '0',
            cardUid: 'd1',
            defId: 'steampunk_escape_hatch',
            ownerId: '1',
            isExtraAction: true,
            targetBaseIndex: 0,
            targetType: 'base',
        }));
        expect(resolveTarget.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'd1',
                defId: 'steampunk_escape_hatch',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
            }),
        }));
        expect(resolveTarget.finalState.core.bases[0].ongoingActions).toEqual(expect.arrayContaining([
            expect.objectContaining({ uid: 'd1', defId: 'steampunk_escape_hatch', ownerId: '1' }),
        ]));
        const queued = resolveTarget.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued?.payload?.triggers).toEqual(expect.arrayContaining([
            expect.objectContaining({
                sourceDefId: 'base_enchanted_glade',
                ownerPlayerId: '0',
                actionTargetBaseIndex: 0,
                actionTargetType: 'base',
                sourceEventId: 'action-played:d1:1102',
                frameId: 'action-played-frame:d1:1102',
            }),
        ]));
        const queuedTriggerId = queued?.payload?.triggers?.[0]?.id;
        expect(resolveTarget.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.TRIGGER_CONSUMED,
            payload: expect.objectContaining({
                triggerId: queuedTriggerId,
            }),
        }));
        expect(resolveTarget.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        expect(resolveTarget.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('draw-a');
    });

    it('wizard_mass_enchantment: 借打他人拥有的 minion ongoing 到 Brownie 身上时也应保留 sourcePlayerId', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_mass_enchantment', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('d1', 'ninja_smoke_bomb', 'action', '1')],
                    hand: [makeCard('brownie-discard-a', 'sharks_mako', 'minion', '1')],
                }),
            },
            bases: [
                {
                    defId: 'base_ancient_ruins',
                    minions: [makeMinion('brownie-a', 'trickster_brownie', '1', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const playMass = execPlayAction(state, '0', 'a1');
        const chooseAction = (playMass.matchState.sys as any).interaction?.current;
        expect(chooseAction?.data?.sourceId).toBe('wizard_mass_enchantment');

        const chooseActionResult = runCommand(playMass.matchState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: chooseAction.data.options[0].id },
            timestamp: 1111,
        }, defaultRandom);
        expect(chooseActionResult.success).toBe(true);

        const chooseTarget = (chooseActionResult.finalState.sys as any).interaction?.current;
        expect(chooseTarget?.data?.sourceId).toBe('wizard_mass_enchantment_choose_minion');

        const resolveTarget = runCommand(chooseActionResult.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: chooseTarget.data.options[0].id },
            timestamp: 1112,
        }, defaultRandom);
        expect(resolveTarget.success).toBe(true);

        expect(resolveTarget.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'd1',
                defId: 'ninja_smoke_bomb',
                ownerId: '1',
                sourcePlayerId: '0',
                targetType: 'minion',
                targetBaseIndex: 0,
                targetMinionUid: 'brownie-a',
            }),
        }));
        expect(resolveTarget.finalState.core.bases[0].minions[0].attachedActions).toEqual(expect.arrayContaining([
            expect.objectContaining({ uid: 'd1', defId: 'ninja_smoke_bomb', ownerId: '1' }),
        ]));
    });

    it('wizard_portal: 有随从时创建选择 Prompt 让玩家选随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_portal', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test_a', 'action', '0'),
                        makeCard('d2', 'test_m', 'minion', '0'),
                        makeCard('d3', 'test_a2', 'action', '0'),
                        makeCard('d4', 'test_m2', 'minion', '0'),
                        makeCard('d5', 'test_a3', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        // 不应该自动抽牌，而是创建选择随从的 Interaction
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('wizard_portal_pick');
        // 应该有2个随从选项
        expect(current?.data?.options?.length).toBe(2);
        // 多选配置：min=0, max=2
        expect(current?.data?.multi).toEqual({ min: 0, max: 2 });
    });

    it('wizard_portal: 牌库为空时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_portal', 'action', '0')],
                    deck: [],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });

    it('wizard_portal: 顶部5张全是行动卡时不抽牌但创建排序 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_portal', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test_a', 'action', '0'),
                        makeCard('d2', 'test_a2', 'action', '0'),
                        makeCard('d3', 'test_a3', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
        // 多张非随从卡时创建排序 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('wizard_portal_order');
    });

    it('wizard_portal_order: 牌库顶被插入新牌后不应继续保留旧揭示排序候选', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_portal', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test_a', 'action', '0'),
                        makeCard('d2', 'test_a2', 'action', '0'),
                        makeCard('d3', 'test_a3', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const refreshedState = refreshInteractionOptions({
            ...matchState,
            core: {
                ...matchState.core,
                players: {
                    ...matchState.core.players,
                    '0': {
                        ...matchState.core.players['0'],
                        deck: [
                            makeCard('intrude', 'test_a4', 'action', '0'),
                            ...matchState.core.players['0'].deck,
                        ],
                    },
                },
            },
        });

        const current = (refreshedState.sys as any).interaction?.current;
        expect(current?.data?.sourceId).toBe('wizard_portal_order');
        const optionUids = (current?.data?.options ?? []).map((option: any) => option.value?.cardUid).filter(Boolean);
        expect(optionUids).not.toContain('d1');
        expect(optionUids).not.toContain('d2');
        expect(optionUids).not.toContain('d3');
    });

    it('wizard_portal_order: borrowed action 放回牌库顶时应回到拥有者牌库并带 sourcePlayerId', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_portal', 'action', '0')],
                    deck: [
                        makeCard('borrowed-a', 'test_a', 'action', '1'),
                        makeCard('own-a1', 'test_a2', 'action', '0'),
                        makeCard('own-a2', 'test_a3', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-tail', 'test_tail', 'action', '1')],
                }),
            },
        });

        const playPortal = execPlayAction(state, '0', 'a1');
        const chooseFirst = (playPortal.matchState.sys as any).interaction?.current;
        expect(chooseFirst?.data?.sourceId).toBe('wizard_portal_order');

        const chooseOwnA1 = runCommand(playPortal.matchState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                optionId: chooseFirst.data.options.find((option: any) => option.value?.cardUid === 'own-a1')?.id,
            },
            timestamp: 1101,
        }, defaultRandom);
        expect(chooseOwnA1.success).toBe(true);

        const chooseSecond = (chooseOwnA1.finalState.sys as any).interaction?.current;
        expect(chooseSecond?.data?.sourceId).toBe('wizard_portal_order');

        const resolveOrder = runCommand(chooseOwnA1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: {
                optionId: chooseSecond.data.options.find((option: any) => option.value?.cardUid === 'own-a2')?.id,
            },
            timestamp: 1102,
        }, defaultRandom);
        expect(resolveOrder.success).toBe(true);

        const topdeckEvents = resolveOrder.events.filter((event) => event.type === SU_EVENTS.CARD_TO_DECK_TOP) as any[];
        expect(topdeckEvents).toContainEqual(expect.objectContaining({
            payload: expect.objectContaining({
                cardUid: 'borrowed-a',
                ownerId: '1',
                sourcePlayerId: '0',
                reason: 'wizard_portal',
            }),
        }));
        expect(resolveOrder.finalState.core.players['0'].deck.map((card) => card.uid)).toEqual(expect.arrayContaining(['own-a1', 'own-a2']));
        expect(resolveOrder.finalState.core.players['0'].deck).toHaveLength(2);
        expect(resolveOrder.finalState.core.players['1'].deck.map((card) => card.uid)).toEqual(['borrowed-a', 'p1-tail']);
    });

    it('wizard_scry: 单张行动卡时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_scry', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test_m', 'minion', '0'),
                        makeCard('d2', 'test_a', 'action', '0'),
                        makeCard('d3', 'test_m2', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        // 单张行动卡时创建 Interaction
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('wizard_scry');
    });

    it('wizard_scry: refresh 后仍应从当前牌库重新生成行动卡候选', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_scry', 'action', '0')],
                    deck: [
                        makeCard('old-action', 'test_a', 'action', '0'),
                        makeCard('old-minion', 'test_m', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const refreshedState = refreshInteractionOptions({
            ...matchState,
            core: {
                ...matchState.core,
                players: {
                    ...matchState.core.players,
                    '0': {
                        ...matchState.core.players['0'],
                        deck: [
                            makeCard('fresh-action', 'test_a2', 'action', '0'),
                            makeCard('fresh-action-2', 'test_a3', 'action', '0'),
                            makeCard('fresh-minion', 'test_m2', 'minion', '0'),
                        ],
                    },
                },
            },
        });

        const current = (refreshedState.sys as any).interaction?.current;
        expect(current?.data?.sourceId).toBe('wizard_scry');
        const optionUids = (current?.data?.options ?? []).map((option: any) => option.value?.cardUid).filter(Boolean);
        expect(optionUids).toEqual(['fresh-action', 'fresh-action-2']);
        expect(optionUids).not.toContain('old-action');
    });

    it('wizard_scry: 选择当前牌库中的 borrowed 行动时仍应进入当前玩家手牌并只重洗当前玩家牌库', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_scry', 'action', '0')],
                    deck: [
                        makeCard('borrowed-action', 'test_a', 'action', '1'),
                        makeCard('own-minion', 'test_m', 'minion', '0'),
                        makeCard('own-action', 'test_a2', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-tail', 'test_m2', 'minion', '1')],
                }),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const current = (matchState.sys as any).interaction?.current;
        expect(current?.data?.sourceId).toBe('wizard_scry');
        const borrowedOptionId = current.data.options.find((option: any) =>
            option.value?.cardUid === 'borrowed-action')?.id;
        expect(borrowedOptionId).toBeDefined();

        const resolved = runCommand(matchState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: borrowedOptionId },
            timestamp: 1101,
        }, defaultRandom);
        expect(resolved.success).toBe(true);

        const drawEvent = resolved.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent?.payload).toEqual(expect.objectContaining({
            playerId: '0',
            cardUids: ['borrowed-action'],
        }));
        const reorderEvent = resolved.events.find(event => event.type === SU_EVENTS.DECK_REORDERED) as any;
        expect(reorderEvent?.payload).toEqual(expect.objectContaining({
            playerId: '0',
            deckUids: ['own-minion', 'own-action'],
        }));
        expect(reorderEvent.payload.sourcePlayerId).toBeUndefined();
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toContain('borrowed-action');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['own-minion', 'own-action']);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['p1-tail']);
    });

    it('wizard_scry: 牌库无行动卡时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_scry', 'action', '0')],
                    deck: [makeCard('d1', 'test_m', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });

    it('wizard_scry: 召唤→时间法师→占卜→女巫链中，废物利用不应回退成占卜', () => {
        const state = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a-summon', 'wizard_summon', 'action', '0'),
                        makeCard('m-chrono', 'wizard_chronomage', 'minion', '0'),
                        makeCard('a-scry', 'wizard_scry', 'action', '0'),
                        makeCard('m-enchant', 'wizard_enchantress', 'minion', '0'),
                    ],
                    deck: [
                        makeCard('d-scrap-1', 'steampunk_scrap_diving', 'action', '0'),
                        makeCard('d-change', 'steampunk_change_of_venue', 'action', '0'),
                        makeCard('d-scrap-2', 'steampunk_scrap_diving', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_the_homeworld', minions: [], ongoingActions: [] },
            ],
        }));

        const playSummon = runCommand(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-summon' },
            timestamp: 500,
        }, defaultRandom);
        expect(playSummon.success).toBe(true);
        expect(playSummon.finalState.core.players['0'].minionLimit).toBe(2);

        const playChronomage = runCommand(playSummon.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm-chrono', baseIndex: 0 },
            timestamp: 1000,
        }, defaultRandom);
        expect(playChronomage.success).toBe(true);
        expect(playChronomage.finalState.core.players['0'].actionLimit).toBe(2);

        const playScry = runCommand(playChronomage.finalState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'a-scry' },
            timestamp: 2000,
        }, defaultRandom);
        expect(playScry.success).toBe(true);
        expect(playScry.finalState.sys.interaction?.current?.data?.sourceId).toBe('wizard_scry');

        const resolveScry = runCommand(playScry.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: 'card-0' },
            timestamp: 3000,
        }, defaultRandom);
        expect(resolveScry.success).toBe(true);
        expect(resolveScry.finalState.core.players['0'].hand.map(card => card.uid)).toContain('d-scrap-1');
        expect(resolveScry.finalState.core.players['0'].hand.map(card => card.uid)).not.toContain('a-scry');
        expect(resolveScry.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('d-scrap-1');

        const playEnchantress = runCommand(resolveScry.finalState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm-enchant', baseIndex: 0 },
            timestamp: 4000,
        }, defaultRandom);
        expect(playEnchantress.success).toBe(true);

        const finalPlayer = playEnchantress.finalState.core.players['0'];
        const finalHandUids = finalPlayer.hand.map(card => card.uid);
        expect(finalHandUids).toContain('d-scrap-1');
        expect(finalHandUids).toContain('d-change');
        expect(finalHandUids).not.toContain('a-scry');
        expect(finalPlayer.deck.map(card => card.uid)).toEqual(['d-scrap-2']);
    });

    it('wizard_sacrifice: 多个己方随从时创建 Prompt 选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_sacrifice', 'action', '0')],
                    deck: [
                        makeCard('d1', 'test1', 'minion', '0'),
                        makeCard('d2', 'test2', 'action', '0'),
                        makeCard('d3', 'test3', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m0', 'test', '0', 3), makeMinion('m1', 'test', '0', 5, { powerModifier: 0 })], ongoingActions: [] },
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const current = (matchState.sys as any).interaction?.current;
        expect(current).toBeDefined();
        expect(current?.data?.sourceId).toBe('wizard_sacrifice');
    });

    it('wizard_sacrifice: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'wizard_sacrifice', 'action', '0')],
                    deck: [makeCard('d1', 'test1', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3)], ongoingActions: [] },
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const destroyEvents = events.filter(e => e.type === SU_EVENTS.MINION_DESTROYED);
        expect(destroyEvents.length).toBe(0);
    });

    it('wizard_winds_of_change: 洗手牌回牌库抽5张并额外打出一个行动', () => {
        const handCards = [
            makeCard('a1', 'wizard_winds_of_change', 'action', '0'),
            makeCard('h1', 'test1', 'minion', '0'),
            makeCard('h2', 'test2', 'action', '0'),
        ];
        const deckCards = [
            makeCard('d1', 'test3', 'minion', '0'),
            makeCard('d2', 'test4', 'action', '0'),
            makeCard('d3', 'test5', 'minion', '0'),
            makeCard('d4', 'test6', 'action', '0'),
            makeCard('d5', 'test7', 'minion', '0'),
            makeCard('d6', 'test8', 'action', '0'),
        ];
        const state = makeState({
            players: {
                '0': makePlayer('0', { hand: handCards, deck: deckCards }),
                '1': makePlayer('1'),
            },
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const shuffleEvents = events.filter(e => e.type === SU_EVENTS.HAND_SHUFFLED_INTO_DECK);
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        const limitEvents = events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED);

        expect(shuffleEvents.length).toBe(1);
        expect(drawEvents.length).toBe(1);
        expect((drawEvents[0] as any).payload.count).toBe(5);
        expect(limitEvents.length).toBe(1);
        expect((limitEvents[0] as any).payload.limitType).toBe('action');
    });
});

// ============================================================================
// 外星人派系 - 侦察兵
// ============================================================================

describe('外星人派系能力（第6批）', () => {
    it('alien_scout: 打出时无 onPlay 交互（能力为 afterScoring 触发）', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [
                        makeCard('d1', 'alien_invader', 'minion', '0'),
                        makeCard('d2', 'test_action', 'action', '0'),
                        makeCard('d3', 'alien_supreme_overlord', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [], ongoingActions: [] },
            ],
        });

        const { matchState } = execPlayMinion(state, '0', 'm_scout', 0);
        const current = (matchState.sys as any).interaction?.current;
        // 侦察兵没有 onPlay 能力，不应创建交互
        expect(current).toBeUndefined();
    });

    it('alien_scout: 牌库无随从时无抽牌事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [
                        makeCard('d1', 'test_action', 'action', '0'),
                        makeCard('d2', 'test_action2', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [], ongoingActions: [] },
            ],
        });

        const { events, matchState } = execPlayMinion(state, '0', 'm_scout', 0);
        // 只有 MINION_PLAYED 事件，没有额外抽牌
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });

    it('alien_scout: 牌库为空时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m_scout', 'alien_scout', 'minion', '0')],
                    deck: [],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'b1', minions: [], ongoingActions: [] },
            ],
        });

        const { events, matchState } = execPlayMinion(state, '0', 'm_scout', 0);
        const drawEvents = events.filter(e => e.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents.length).toBe(0);
    });
});
