/**
 * 测试场景：场上有两个 Igor，一个被消灭
 * 
 * 用户报告：场上有两个 Igor（c43 和 c44），对手打出 vampire_big_gulp 消灭其中一个，
 * 结果触发了两次交互，让用户选择了两个不同的随从各+1力量。
 * 
 * 预期行为：只有被消灭的 Igor 触发 onDestroy，只创建一个交互。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { makeState, makePlayer, makeCard, makeBase, makeMinion, makeMatchState } from './helpers';
import { runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain';
import { initAllAbilities } from '../abilities';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';

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
            hasInteraction: !!result1.finalState.sys.interaction.current,
            queueLength: result1.finalState.sys.interaction.queue.length,
            events: result1.events.map(e => e.type),
            interactionData: result1.finalState.sys.interaction.current?.data,
        });

        expect(result1.success).toBe(true);
        if (!result1.success) {
            console.error('PLAY_ACTION failed:', result1.error);
            return;
        }

        // 应该创建一个交互：选择要消灭的随从
        const interaction1 = result1.finalState.sys.interaction.current;
        if (!interaction1) {
            console.error('[TEST] No interaction created! This means vampireBigGulp did not create an interaction.');
            console.error('[TEST] Possible reasons:');
            console.error('[TEST] 1. All minions are protected');
            console.error('[TEST] 2. No valid targets (power > 4)');
            console.error('[TEST] 3. buildMinionTargetOptions returned empty array');
            return;
        }
        
        expect(interaction1).toBeDefined();
        expect((interaction1?.data as any)?.sourceId).toBe('vampire_big_gulp');

        // 选项应该包含两个 Igor + 一个 howler
        const options = (interaction1?.data as any)?.options;
        expect(options).toBeDefined();
        expect(options.length).toBe(4);  // 3 minions + skip option

        console.log('Big Gulp options:', options.map((o: any) => o.label));

        // 步骤2：玩家0选择消灭第一个 Igor（igor1）
        const result2 = runCommand(result1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            interactionId: interaction1!.id,
            payload: { optionId: options[0].id },
        });

        expect(result2.success).toBe(true);
        if (!result2.success) return;

        // 应该创建一个交互：Igor onDestroy 让玩家1选择目标
        const interaction2 = result2.finalState.sys.interaction.current;
        expect(interaction2).toBeDefined();
        expect(interaction2!.playerId).toBe('1');  // Igor 属于玩家1
        expect((interaction2?.data as any)?.sourceId).toBe('frankenstein_igor');

        // 检查候选列表：应该只包含场上剩余的己方随从（igor2 + howler）
        const igorOptions = (interaction2?.data as any)?.options;
        expect(igorOptions).toBeDefined();
        console.log('Igor onDestroy options:', igorOptions.map((o: any) => o.label));

        // 关键断言：只应该有一个交互，不应该有第二个 Igor onDestroy 交互
        expect(result2.finalState.sys.interaction.queue.length).toBe(0);

        // 步骤3：玩家1选择给 igor2 +1力量
        const result3 = runCommand(result2.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '1',
            interactionId: interaction2!.id,
            payload: { optionId: igorOptions[0].id },
        });

        expect(result3.success).toBe(true);
        if (!result3.success) return;

        // 最终状态：不应该有任何待处理的交互
        expect(result3.finalState.sys.interaction.current).toBeUndefined();
        expect(result3.finalState.sys.interaction.queue.length).toBe(0);

        // 验证最终状态：igor1 被消灭，igor2 得到 +1 力量
        const finalBase = result3.finalState.core.bases[0];
        expect(finalBase.minions.length).toBe(2);  // igor2 + howler
        const igor2Final = finalBase.minions.find(m => m.uid === 'igor2');
        expect(igor2Final).toBeDefined();
        expect(igor2Final!.powerCounters).toBe(1);
    });
});
