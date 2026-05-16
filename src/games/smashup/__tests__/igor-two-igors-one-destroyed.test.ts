/**
 * 测试场景：场上有两个 Igor，一个被消灭
 * 
 * 用户报告：场上有两个 Igor（c43 和 c44），对手打出 vampire_big_gulp 消灭其中一个，
 * 结果触发了两次交互，让用户选择了两个不同的随从各+1力量。
 * 
 * 预期行为：只有被消灭的 Igor 触发 onDestroy，只创建一个交互。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    expectNoPrompt,
    getPromptsBySourceId,
    getPromptOption,
    getPromptOptions,
    getPromptPlayerId,
    getSimpleChoicePrompt,
    makeState,
    makePlayer,
    makeCard,
    makeBase,
    makeMinion,
    makeMatchState,
    respondToPrompt,
} from './helpers';
import { runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain';
import { initAllAbilities } from '../abilities';

describe('Igor: 场上有两个 Igor，一个被消灭', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('vampire_big_gulp 消灭一个 Igor → 只触发一次 onDestroy', () => {
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
                    makeMinion('igor1', 'frankenstein_igor', '1', 2, { powerCounters: 0 }),  // 第一个 Igor
                    makeMinion('igor2', 'frankenstein_igor', '1', 2, { powerCounters: 0 }),  // 第二个 Igor
                    makeMinion('howler', 'werewolf_howler', '1', 2, { powerCounters: 0 }),
                ]),
            ],
            currentPlayerIndex: 0,
        });

        console.log('[TEST] Initial state:', {
            bases: core.bases.map(b => ({
                defId: b.defId,
                minions: b.minions.map(m => ({ uid: m.uid, defId: m.defId, controller: m.controller, power: m.power }))
            }))
        });

        // 步骤1：玩家0打出 vampire_big_gulp
        const result1 = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bg1' },
        });

        console.log('[TEST] After PLAY_ACTION:', {
            success: result1.success,
            error: result1.error,
            events: result1.events.map(e => e.type),
        });

        expect(result1.success).toBe(true);
        if (!result1.success) {
            console.error('PLAY_ACTION failed:', result1.error);
            return;
        }

        // 应该创建一个交互：选择要消灭的随从
        const prompt1 = getSimpleChoicePrompt(result1.finalState, 'vampire_big_gulp');

        // 选项应该包含两个 Igor + 一个 howler
        const options = getPromptOptions(prompt1);
        expect(options.length).toBe(4);  // 3 minions + skip option

        console.log('Big Gulp options:', options.map((o: any) => o.label));

        // 步骤2：玩家0选择消灭第一个 Igor（igor1）
        const igor1Option = getPromptOption(
            prompt1,
            (option: any) => option.value?.minionUid === 'igor1',
            'Big Gulp target option for first Igor',
        );
        const result2 = respondToPrompt(result1.finalState, igor1Option.id, '0');

        expect(result2.success).toBe(true);
        if (!result2.success) return;

        // 应该创建一个交互：Igor onDestroy 让玩家1选择目标
        const prompt2 = getSimpleChoicePrompt(result2.finalState, 'frankenstein_igor');
        expect(getPromptPlayerId(prompt2)).toBe('1');  // Igor 属于玩家1

        // 检查候选列表：应该只包含场上剩余的己方随从（igor2 + howler）
        const igorOptions = getPromptOptions(prompt2);
        console.log('Igor onDestroy options:', igorOptions.map((o: any) => o.label));

        // 关键断言：只应该有一个交互，不应该有第二个 Igor onDestroy 交互
        expect(getPromptsBySourceId(result2.finalState, 'frankenstein_igor')).toHaveLength(1);

        // 步骤3：玩家1选择给 igor2 +1力量
        const igor2Option = getPromptOption(
            prompt2,
            (option: any) => option.value?.minionUid === 'igor2',
            'Igor onDestroy target option for remaining Igor',
        );
        const result3 = respondToPrompt(result2.finalState, igor2Option.id, '1');

        expect(result3.success).toBe(true);
        if (!result3.success) return;

        const igorCounterEvents = result3.events.filter((event: any) =>
            event.type === 'su:power_counter_added'
            && event.payload?.reason === 'frankenstein_igor',
        );

        // 最终状态：Igor 交互已被解决
        expectNoPrompt(result3.finalState);

        // 验证最终状态：igor1 被消灭，igor2 得到 +1 力量
        const finalBase = result3.finalState.core.bases[0];
        expect(finalBase.minions.length).toBe(2);  // igor2 + howler
        const igor2Final = finalBase.minions.find(m => m.uid === 'igor2');
        expect(igor2Final).toBeDefined();
        expect(igor2Final!.powerCounters).toBe(1);
        expect(igorCounterEvents).toHaveLength(1);
        expect(igorCounterEvents[0]).toMatchObject({
            payload: {
                minionUid: 'igor2',
                amount: 1,
                reason: 'frankenstein_igor',
            },
        });
    });
});
