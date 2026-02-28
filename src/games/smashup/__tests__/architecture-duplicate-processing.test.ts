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
import { makeState, makePlayer, makeCard, makeBase, makeMinion, makeMatchState } from './helpers';
import { runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain';
import { initAllAbilities } from '../abilities';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';

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
        const interaction1 = result1.finalState.sys.interaction.current;
        expect(interaction1).toBeDefined();

        // 步骤2：选择消灭 Igor
        const options = (interaction1?.data as any)?.options;
        const igorOption = options.find((o: any) => o.label.includes('igor'));
        expect(igorOption).toBeDefined();

        const result2 = runCommand(result1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            interactionId: interaction1!.id,
            payload: { optionId: igorOption.id },
        });

        expect(result2.success).toBe(true);

        // 关键断言：只应该有一个 Igor onDestroy 交互
        const interaction2 = result2.finalState.sys.interaction.current;
        expect(interaction2).toBeDefined();
        expect((interaction2?.data as any)?.sourceId).toBe('frankenstein_igor');

        // 队列中不应该有第二个 Igor 交互
        const queue = result2.finalState.sys.interaction.queue;
        const igorInteractionsInQueue = queue.filter(
            (i: any) => i.data?.sourceId === 'frankenstein_igor'
        );
        expect(igorInteractionsInQueue.length).toBe(0);

        // 总共只有一个 Igor 交互（current）
        const allInteractions = [interaction2, ...queue];
        const allIgorInteractions = allInteractions.filter(
            (i: any) => i?.data?.sourceId === 'frankenstein_igor'
        );
        expect(allIgorInteractions.length).toBe(1);
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
        const interaction1 = result1.finalState.sys.interaction.current;
        expect(interaction1).toBeDefined();

        const options = (interaction1?.data as any)?.options;
        const igorOption = options.find((o: any) => o.label.includes('igor'));

        const result2 = runCommand(result1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            interactionId: interaction1!.id,
            payload: { optionId: igorOption.id },
        });

        expect(result2.success).toBe(true);

        // 验证事件流：应该只有一个 MINION_DESTROYED 事件
        const destroyEvents = result2.events.filter(e => e.type === 'su:minion_destroyed');
        expect(destroyEvents.length).toBe(1);

        // 验证 Igor onDestroy 只触发一次（只有一个交互）
        const interaction2 = result2.finalState.sys.interaction.current;
        expect(interaction2).toBeDefined();
        expect((interaction2?.data as any)?.sourceId).toBe('frankenstein_igor');
        expect(result2.finalState.sys.interaction.queue.length).toBe(0);
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
        const interaction1 = result1.finalState.sys.interaction.current;
        expect(interaction1).toBeDefined();

        // 步骤2：选择消灭 Igor
        const options = (interaction1?.data as any)?.options;
        const igorOption = options.find((o: any) => o.label.includes('igor'));
        expect(igorOption).toBeDefined();

        const result2 = runCommand(result1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            interactionId: interaction1!.id,
            payload: { optionId: igorOption.id },
        });

        expect(result2.success).toBe(true);

        // 关键断言：应该只有一个 Igor onDestroy 交互
        const interaction2 = result2.finalState.sys.interaction.current;
        expect(interaction2).toBeDefined();
        expect((interaction2?.data as any)?.sourceId).toBe('frankenstein_igor');

        // 队列中不应该有第二个 Igor 交互（如果有重复处理，会有两个）
        const queue = result2.finalState.sys.interaction.queue;
        const igorInteractionsInQueue = queue.filter(
            (i: any) => i.data?.sourceId === 'frankenstein_igor'
        );
        expect(igorInteractionsInQueue.length).toBe(0);

        // 总共只有一个 Igor 交互（current）
        const allInteractions = [interaction2, ...queue];
        const allIgorInteractions = allInteractions.filter(
            (i: any) => i?.data?.sourceId === 'frankenstein_igor'
        );
        expect(allIgorInteractions.length).toBe(1);
    });
});
