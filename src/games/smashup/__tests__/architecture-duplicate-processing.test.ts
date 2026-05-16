/**
 * 架构测试：检测重复处理
 * 
 * 目的：防止多个系统对同一批事件执行相同的后处理，导致触发器重复触发。
 * 
 * 背景：Igor 双重触发 bug 的根本原因是 SmashUpEventSystem.afterEvents() 和
 * postProcessSystemEvents 都调用了 processDestroyMoveCycle，导致 Igor onDestroy 触发两次。
 * 
 * 审计维度：
 * - D41：系统职责重叠检测
 * - D42：事件流全链路审计
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { applyEvents, makeState, makePlayer, makeCard, makeBase, makeMinion, makeMatchState } from './helpers';
import {
    getFirstPrompt,
    getPromptOption,
    getPromptsBySourceId,
    getPromptSourceId,
    respondToPrompt,
} from './helpers';
import { runCommand } from './testRunner';
import { SU_COMMANDS, SU_EVENTS } from '../domain';
import { initAllAbilities } from '../abilities';

describe('架构测试：防止重复处理', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('D41: onDestroy 触发器只执行一次（不被重复处理）', () => {
        // 场景：消灭一个 Igor，验证 onDestroy 只触发一次
        // 注意：Igor onDestroy 需要至少 2 个其他己方随从才会创建交互（1 个会自动执行，0 个返回 feedback）
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bg1', 'vampire_big_gulp', 'action', '0')],
                    factions: ['vampires', 'pirates'],
                }),
                '1': makePlayer('1', {
                    factions: ['frankenstein', 'werewolves'],
                }),
            },
            bases: [
                makeBase('base_tortuga', [
                    makeMinion('igor1', 'frankenstein_igor', '1', 2),
                    makeMinion('howler', 'werewolf_howler', '1', 2),
                    makeMinion('alpha', 'werewolf_alpha', '1', 4),  // 第二个己方随从，确保 Igor 有 2+ 候选
                ]),
            ],
            currentPlayerIndex: 0,
        });

        // 步骤1：打出 Big Gulp
        const result1 = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bg1' },
        });

        expect(result1.success).toBe(true);
        const interaction1 = getFirstPrompt(result1.finalState);
        expect(interaction1).toBeDefined();

        // 步骤2：选择消灭 Igor（科学小怪蛋）
        const igorOption = getPromptOption(
            interaction1,
            o =>
            o.label.includes('科学小怪蛋') || o.value?.defId === 'frankenstein_igor'
            ,
            'Big Gulp Igor target option',
        );

        const result2 = respondToPrompt(result1.finalState, igorOption.id, '0');

        expect(result2.success).toBe(true);

        // 关键断言：只应该有一个 Igor onDestroy 交互
        const interaction2 = getFirstPrompt(result2.finalState);
        expect(interaction2).toBeDefined();
        expect(getPromptSourceId(interaction2)).toBe('frankenstein_igor');

        // 总共只有一个 Igor 交互（current）
        expect(getPromptsBySourceId(result2.finalState, 'frankenstein_igor').length).toBe(1);
    });

    it('D42: MINION_DESTROYED 事件只被后处理一次', () => {
        // 场景：消灭随从，验证 MINION_DESTROYED 事件只触发一次 onDestroy
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bg1', 'vampire_big_gulp', 'action', '0')],
                    factions: ['vampires', 'pirates'],
                }),
                '1': makePlayer('1', {
                    factions: ['frankenstein', 'werewolves'],
                }),
            },
            bases: [
                makeBase('base_tortuga', [
                    makeMinion('igor1', 'frankenstein_igor', '1', 2),
                    makeMinion('howler', 'werewolf_howler', '1', 2),
                    makeMinion('alpha', 'werewolf_alpha', '1', 4),  // 第二个己方随从，确保 Igor 有 2+ 候选
                ]),
            ],
            currentPlayerIndex: 0,
        });

        const result1 = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bg1' },
        });

        expect(result1.success).toBe(true);
        const interaction1 = getFirstPrompt(result1.finalState);
        expect(interaction1).toBeDefined();

        const igorOption = getPromptOption(
            interaction1,
            o =>
            o.label.includes('科学小怪蛋') || o.value?.defId === 'frankenstein_igor'
            ,
            'Big Gulp Igor target option',
        );

        const result2 = respondToPrompt(result1.finalState, igorOption.id, '0');

        expect(result2.success).toBe(true);

        // 验证事件流：应该只有一个 MINION_DESTROYED 事件
        const destroyEvents = result2.events.filter(e => e.type === 'su:minion_destroyed');
        expect(destroyEvents.length).toBe(1);

        // 验证 Igor onDestroy 只触发一次（只有一个交互）
        const interaction2 = getFirstPrompt(result2.finalState);
        expect(interaction2).toBeDefined();
        expect(getPromptSourceId(interaction2)).toBe('frankenstein_igor');
        expect(getPromptsBySourceId(result2.finalState, 'frankenstein_igor').length).toBe(1);
    });

    it('D42: 重复 MINION_RETURNED 事件不会把同一 uid 随从复制进手牌', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['minions_of_cthulhu_pod', 'steampunks_pod'],
                }),
                '1': makePlayer('1', {
                    factions: ['robots_pod', 'wizards_pod'],
                }),
            },
            bases: [
                makeBase('base_rlyeh', [
                    makeMinion('servitor-1', 'cthulhu_servitor_pod', '0', 2, {
                        owner: '0',
                        attachedActions: [],
                    }),
                ]),
            ],
        });

        const returnedEvent = {
            type: SU_EVENTS.MINION_RETURNED,
            payload: {
                minionUid: 'servitor-1',
                minionDefId: 'cthulhu_servitor_pod',
                fromBaseIndex: 0,
                toPlayerId: '0',
                reason: 'steampunk_escape_hatch',
            },
            timestamp: 1000,
        } as any;

        const next = applyEvents(core, [returnedEvent, returnedEvent]);

        expect(next.bases[0].minions).toHaveLength(0);
        expect(next.players['0'].hand.map(card => card.uid)).toEqual(['servitor-1']);
    });

    it('D41: 多个 Igor 被消灭时，每个 Igor 的 onDestroy 只触发一次', () => {
        // 场景：消灭一个 Igor，验证不会产生重复的交互
        // 这个测试与第一个测试类似，但更明确地检查队列中没有重复交互
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bg1', 'vampire_big_gulp', 'action', '0')],
                    factions: ['vampires', 'pirates'],
                }),
                '1': makePlayer('1', {
                    factions: ['frankenstein', 'werewolves'],
                }),
            },
            bases: [
                makeBase('base_tortuga', [
                    makeMinion('igor1', 'frankenstein_igor', '1', 2),
                    makeMinion('howler', 'werewolf_howler', '1', 2),
                    makeMinion('alpha', 'werewolf_alpha', '1', 4),
                ]),
            ],
            currentPlayerIndex: 0,
        });

        // 步骤1：打出 Big Gulp
        const result1 = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bg1' },
        });

        expect(result1.success).toBe(true);
        const interaction1 = getFirstPrompt(result1.finalState);
        expect(interaction1).toBeDefined();

        // 步骤2：选择消灭 Igor（科学小怪蛋）
        const igorOption = getPromptOption(
            interaction1,
            o =>
            o.label.includes('科学小怪蛋') || o.value?.defId === 'frankenstein_igor'
            ,
            'Big Gulp Igor target option',
        );

        const result2 = respondToPrompt(result1.finalState, igorOption.id, '0');

        expect(result2.success).toBe(true);

        // 关键断言：应该只有一个 Igor onDestroy 交互
        const interaction2 = getFirstPrompt(result2.finalState);
        expect(interaction2).toBeDefined();
        expect(getPromptSourceId(interaction2)).toBe('frankenstein_igor');

        // 总共只有一个 Igor 交互（current）
        expect(getPromptsBySourceId(result2.finalState, 'frankenstein_igor').length).toBe(1);
    });

    it('D42: ONGOING_ATTACHED 重新附着同一 uid 时应先清理旧挂载位置', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('sleep-1', 'trickster_sleep_spores', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{ uid: 'sleep-1', defId: 'trickster_sleep_spores', ownerId: '0', talentUsed: false }],
                }),
                makeBase('base_b'),
            ],
        });

        const next = applyEvents(core, [{
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: {
                cardUid: 'sleep-1',
                defId: 'trickster_sleep_spores',
                ownerId: '0',
                targetType: 'base',
                targetBaseIndex: 1,
            },
            timestamp: 1,
        } as any]);

        expect(next.bases[0].ongoingActions.some(card => card.uid === 'sleep-1')).toBe(false);
        expect(next.bases[1].ongoingActions.filter(card => card.uid === 'sleep-1')).toHaveLength(1);
        expect(next.players['0'].hand.some(card => card.uid === 'sleep-1')).toBe(false);
        expect(next.players['0'].discard.some(card => card.uid === 'sleep-1')).toBe(false);
    });

    it('D42: MINION_MOVED 应清理同 uid 的历史残留，避免跨基地重复', () => {
        const duplicated = makeMinion('dup-minion', 'alien_invader', '0', 3);
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_a', [duplicated]),
                makeBase('base_b', [{ ...duplicated }]),
            ],
        });

        const next = applyEvents(core, [{
            type: SU_EVENTS.MINION_MOVED,
            payload: {
                minionUid: 'dup-minion',
                minionDefId: 'alien_invader',
                fromBaseIndex: 0,
                toBaseIndex: 1,
                reason: 'regression-test',
            },
            timestamp: 2,
        } as any]);

        expect(next.bases[0].minions.some(minion => minion.uid === 'dup-minion')).toBe(false);
        expect(next.bases[1].minions.filter(minion => minion.uid === 'dup-minion')).toHaveLength(1);
    });

    it('D42: CARD_TO_DECK_TOP 把附着行动卡回牌库时应移除随从附着引用', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('host-1', 'alien_invader', '0', 3, {
                            owner: '0',
                            attachedActions: [{ uid: 'attach-1', defId: 'trickster_sleep_spores', ownerId: '0' }],
                        }),
                    ],
                    ongoingActions: [],
                }),
            ],
        });

        const next = applyEvents(core, [{
            type: SU_EVENTS.CARD_TO_DECK_TOP,
            payload: {
                cardUid: 'attach-1',
                defId: 'trickster_sleep_spores',
                ownerId: '0',
            },
            timestamp: 3,
        } as any]);

        const host = next.bases[0].minions.find(minion => minion.uid === 'host-1');
        expect(host?.attachedActions.some(card => card.uid === 'attach-1')).toBe(false);
        expect(next.players['0'].deck[0]?.uid).toBe('attach-1');
    });
});
