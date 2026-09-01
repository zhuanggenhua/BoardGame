import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { validate } from '../domain/commands';
import { SMASHUP_FACTION_IDS } from '../domain/ids';
import { execute, reduce } from '../domain/reducer';
import { MADNESS_CARD_DEF_ID, SU_COMMANDS, SU_EVENTS } from '../domain/types';
import {
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
} from './helpers';

function makeOngoing(uid: string, defId: string, ownerId: string, talentUsed = false) {
    return { uid, defId, ownerId, talentUsed };
}

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    initAllAbilities();
});

describe('天赋基础设施', () => {
    it('无天赋能力注册的随从使用天赋时只生成 TALENT_USED', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'nonexistent_talent_minion', '0', 3, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(SU_EVENTS.TALENT_USED);
    });

    it('基地上不存在的随从使用天赋时返回空事件', () => {
        const core = makeState({
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'nonexistent', baseIndex: 0 },
        }, defaultRandom);

        expect(events).toHaveLength(0);
    });

    it('execute 层不负责 talentUsed 校验（以教授为样本）', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'miskatonic_professor', '0', 5, { talentUsed: true })],
                    ongoingActions: [],
                },
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        expect(events.length).toBeGreaterThan(0);
    });

    it('巨石阵：同一随从本回合可使用第2次才能（若双才能名额未占用）', () => {
        const core = makeState({
            standingStonesDoubleTalentMinionUid: undefined,
            bases: [
                {
                    defId: 'base_standing_stones',
                    minions: [makeMinion('m1', 'miskatonic_professor', '0', 5, { talentUsed: true })],
                    ongoingActions: [],
                },
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        });
        expect(result.valid).toBe(true);
    });

    it('巨石阵：双才能名额已占用时，不允许其他随从第2次才能', () => {
        const core = makeState({
            standingStonesDoubleTalentMinionUid: 'used-minion',
            bases: [
                {
                    defId: 'base_standing_stones',
                    minions: [makeMinion('m1', 'miskatonic_professor', '0', 5, { talentUsed: true })],
                    ongoingActions: [],
                },
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('本回合天赋已使用');
    });

    it('巨石阵：附着行动卡不属于“一个随从”，不可发动第2次天赋', () => {
        const core = makeState({
            standingStonesDoubleTalentMinionUid: undefined,
            bases: [
                {
                    defId: 'base_standing_stones',
                    minions: [
                        makeMinion('m1', 'werewolf_pack_alpha', '0', 4, {
                            attachedActions: [
                                { uid: 'oa1', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: true },
                            ],
                        }),
                    ],
                    ongoingActions: [],
                },
            ],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('本回合天赋已使用');
    });

    it('巨石阵：附着行动卡在名额占用后不可发动第2次天赋（ongoingCardUid）', () => {
        const core = makeState({
            standingStonesDoubleTalentMinionUid: 'used-minion',
            bases: [
                {
                    defId: 'base_standing_stones',
                    minions: [
                        makeMinion('m1', 'werewolf_pack_alpha', '0', 4, {
                            attachedActions: [
                                { uid: 'oa1', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: true },
                            ],
                        }),
                    ],
                    ongoingActions: [],
                },
            ],
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('本回合天赋已使用');
    });

    it('被压制的随从不可手动发动天赋', () => {
        const core = makeState({
            suppressedCardsUntilTurnStart: [{
                cardUid: 'm1',
                baseIndex: 0,
                suppressorPlayerId: '1',
                cardType: 'minion',
            }],
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'miskatonic_professor', '0', 5)],
                    ongoingActions: [],
                },
            ],
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const matchState = makeMatchState(core);
        const validation = validate(matchState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        });
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('该卡牌能力已被压制');
    });
});

describe('ongoing 行动卡天赋基础设施', () => {
    it('有天赋的 ongoing 卡可以使用天赋', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0')],
                },
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        });
        expect(result.valid).toBe(true);
    });

    it('ongoing 卡天赋已使用时拒绝', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0', true)],
                },
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('已使用');
    });

    it('巨狼之灵：基地上的 ongoing 行动卡可发动第2次天赋并阻止第3次', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0', true)],
                },
            ],
            titans: [{
                uid: 't-gws',
                defId: 'werewolves_great_wolf_spirit',
                faction: SMASHUP_FACTION_IDS.WEREWOLVES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
            madnessDeck: ['madness_0'],
        });

        const command = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as const;

        expect(validate(makeMatchState(core), command).valid).toBe(true);

        const events = execute(makeMatchState(core), command, defaultRandom);
        const nextCore = events.reduce(reduce, core);
        expect(nextCore.greatWolfSpiritDoubleTalentCardUids).toContain('oa1');
        expect(validate(makeMatchState(nextCore), command).valid).toBe(false);
    });

    it('巨狼之灵：附着行动卡也可发动第2次天赋', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('host', 'werewolf_pack_alpha', '0', 4, {
                            attachedActions: [
                                { uid: 'oa1', defId: 'werewolf_leader_of_the_pack', ownerId: '0', talentUsed: true },
                            ],
                        }),
                    ],
                    ongoingActions: [],
                },
            ],
            titans: [{
                uid: 't-gws',
                defId: 'werewolves_great_wolf_spirit',
                faction: SMASHUP_FACTION_IDS.WEREWOLVES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: false,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
        });

        const command = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        } as const;

        expect(validate(makeMatchState(core), command).valid).toBe(true);

        const events = execute(makeMatchState(core), command, defaultRandom);
        const nextCore = events.reduce(reduce, core);
        expect(nextCore.greatWolfSpiritDoubleTalentCardUids).toContain('oa1');
    });

    it('巨狼之灵：自身天赋也可因持续效果发动第2次并阻止第3次', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('target', 'werewolf_teenage_wolf', '0', 2)],
                    ongoingActions: [],
                },
            ],
            titans: [{
                uid: 't-gws',
                defId: 'werewolves_great_wolf_spirit',
                faction: SMASHUP_FACTION_IDS.WEREWOLVES,
                ownerId: '0',
                controllerId: '0',
                powerCounters: 0,
                talentUsed: true,
                location: { zone: 'base', baseIndex: 0, enteredAt: 1 },
            }],
        });

        const command = {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { titanUid: 't-gws', baseIndex: 0 },
        } as const;

        expect(validate(makeMatchState(core), command).valid).toBe(true);

        const events = execute(makeMatchState(core), command, defaultRandom);
        const nextCore = events.reduce(reduce, core);
        expect(nextCore.greatWolfSpiritDoubleTalentCardUids).toContain('t-gws');
        expect(validate(makeMatchState(nextCore), command).valid).toBe(false);
    });

    it('不是自己的 ongoing 卡时拒绝', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '1')],
                },
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        });
        expect(result.valid).toBe(false);
    });

    it('没有 talent 标签的 ongoing 卡拒绝', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [makeOngoing('oa1', 'pirate_full_sail', '0')],
                },
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        });
        expect(result.valid).toBe(false);
    });

    it('ongoing 卡天赋在非出牌阶段时拒绝', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0')],
                },
            ],
        });

        const matchState = makeMatchState(core);
        matchState.sys.phase = 'draw';
        const result = validate(matchState, {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        });
        expect(result.valid).toBe(false);
    });

    it('被压制的 ongoing 卡不可手动发动天赋', () => {
        const core = makeState({
            suppressedCardsUntilTurnStart: [
                {
                    cardUid: 'oa1',
                    baseIndex: 0,
                    suppressorPlayerId: '1',
                    cardType: 'ongoing',
                },
            ],
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0')],
                },
            ],
        });

        const result = validate(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('该卡牌能力已被压制');
    });

    it('ongoing 卡天赋触发后 TALENT_USED 记录 ongoingCardUid 与 defId', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0')],
                },
            ],
            madnessDeck: ['madness_0'],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        }, defaultRandom);

        const talentEvt = events.find(e => e.type === SU_EVENTS.TALENT_USED);
        expect(talentEvt).toBeDefined();
        expect((talentEvt as any).payload.ongoingCardUid).toBe('oa1');
        expect((talentEvt as any).payload.defId).toBe('miskatonic_lost_knowledge');
        expect((talentEvt as any).payload.minionUid).toBeUndefined();
    });

    it('ongoing 卡天赋 reduce 后 talentUsed 标记为 true', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [makeOngoing('oa1', 'miskatonic_lost_knowledge', '0')],
                },
            ],
            madnessDeck: ['madness_0'],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { ongoingCardUid: 'oa1', baseIndex: 0 },
        }, defaultRandom);

        const nextCore = events.reduce(reduce, core);
        expect(nextCore.bases[0].ongoingActions[0]?.talentUsed).toBe(true);
    });

    it('TURN_STARTED 只重置当前玩家的 ongoing 卡 talentUsed', () => {
        const core = makeState({
            bases: [
                {
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [
                        makeOngoing('oa1', 'miskatonic_lost_knowledge', '0', true),
                        makeOngoing('oa2', 'steampunk_zeppelin', '1', true),
                    ],
                },
            ],
        });

        const nextCore = reduce(core, {
            type: SU_EVENTS.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 2 },
            timestamp: Date.now(),
        } as any);

        expect(nextCore.bases[0].ongoingActions[0]?.talentUsed).toBe(false);
        expect(nextCore.bases[0].ongoingActions[1]?.talentUsed).toBe(true);
    });
});

describe('随从天赋回归合同', () => {
    it('随从天赋仍通过 minionUid 记录 TALENT_USED，而不是 ongoingCardUid', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'miskatonic_professor', '0', 5, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const talentEvt = events.find(e => e.type === SU_EVENTS.TALENT_USED);
        expect(talentEvt).toBeDefined();
        expect((talentEvt as any).payload.minionUid).toBe('m1');
        expect((talentEvt as any).payload.ongoingCardUid).toBeUndefined();
    });

    it('随从天赋 reduce 后仍正确标记 minion.talentUsed', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('mad1', MADNESS_CARD_DEF_ID, 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'miskatonic_professor', '0', 5, { powerModifier: 0 })],
                    ongoingActions: [],
                },
            ],
        });

        const events = execute(makeMatchState(core), {
            type: SU_COMMANDS.USE_TALENT,
            playerId: '0',
            payload: { minionUid: 'm1', baseIndex: 0 },
        }, defaultRandom);

        const nextCore = events.reduce(reduce, core);
        expect(nextCore.bases[0].minions[0]?.talentUsed).toBe(true);
    });
});
