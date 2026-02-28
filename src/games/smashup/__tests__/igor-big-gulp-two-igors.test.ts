/**
 * 测试场景：场上只有一个 Igor，"一大口"消灭它
 * 
 * Bug 报告：打出"一大口"消灭一个 Igor 后，出现了两次"选择随从放置+1力量指示物"的交互
 * 
 * 预期行为：只应该出现一次交互（只有被消灭的那个 Igor 触发 onDestroy）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { makeState, makePlayer, makeCard, makeMatchState, makeMinion } from './helpers';
import { runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { resolveOnDestroy } from '../domain/index';

describe('Igor + Big Gulp: 一个 Igor 被消灭', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('验证 Igor onDestroy 已注册', () => {
        const executor = resolveOnDestroy('frankenstein_igor');
        console.log('Igor onDestroy executor:', executor ? 'REGISTERED' : 'NOT REGISTERED');
        expect(executor).toBeDefined();
    });

    it('一大口消灭一个 Igor → 只触发一次 onDestroy', () => {
        // 场景：蚁丘上有一个 Igor（玩家0）+ 一个咆哮者（玩家0）+ 一个新生吸血鬼（玩家1）
        // 玩家1打出"一大口"消灭 Igor
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['frankenstein', 'werewolves'],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('bg1', 'vampire_big_gulp', 'action', '1')],
                    factions: ['vampires', 'giant_ants'],
                }),
            },
            bases: [
                {
                    defId: 'base_the_hill',
                    minions: [
                        makeMinion('igor1', 'frankenstein_igor', '0', 2, { powerCounters: 1 }),
                        makeMinion('howler', 'werewolf_howler', '0', 2, { powerCounters: 1 }),
                        makeMinion('fledgling', 'vampire_fledgling_vampire', '1', 2),
                    ],
                    ongoingActions: [],
                },
            ],
            currentPlayerIndex: 1,
        });

        console.log('\n=== 步骤1：打出"一大口" ===');
        // 步骤1：玩家1打出"一大口"（需要指定目标基地）
        const result1 = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bg1', targetBaseIndex: 0 },
            timestamp: 1000,
        });

        // 应该创建"一大口"的交互（选择要消灭的随从）
        const interaction1 = result1.finalState.sys.interaction.current;
        expect(interaction1).toBeDefined();
        expect((interaction1?.data as any)?.sourceId).toBe('vampire_big_gulp');

        // 选项应该包含 Igor + 咆哮者 + 新生吸血鬼（力量都≤4）
        const options = (interaction1?.data as any)?.options ?? [];
        console.log('Big Gulp options:', options.map((o: any) => o.label));
        expect(options.length).toBeGreaterThanOrEqual(3);

        console.log('\n=== 步骤2：选择消灭 Igor ===');
        // 步骤2：玩家1选择消灭 igor1
        const igorOption = options.find((o: any) => o.value?.minionUid === 'igor1');
        expect(igorOption).toBeDefined();
        console.log('Selected option:', igorOption.label);
        
        const result2 = runCommand(result1.finalState, {
            type: 'SYS_INTERACTION_RESPOND' as any,
            playerId: '1',
            payload: { optionId: igorOption.id },
            timestamp: 2000,
        });

        console.log('\n=== 步骤3：验证结果 ===');
        // 验证 Igor 确实被消灭了
        const base = result2.finalState.core.bases[0];
        const igorStillOnBase = base.minions.some(m => m.uid === 'igor1');
        console.log('Igor still on base:', igorStillOnBase);
        expect(igorStillOnBase).toBe(false);

        // 验证 Igor 在弃牌堆
        const player0 = result2.finalState.core.players['0'];
        const igorInDiscard = player0.discard.some(c => c.uid === 'igor1');
        console.log('Igor in discard:', igorInDiscard);
        expect(igorInDiscard).toBe(true);

        // 验证 howler 的 powerCounters
        const howler = base.minions.find(m => m.uid === 'howler');
        console.log('Howler powerCounters:', howler?.powerCounters);
        console.log('Expected: 2 (initial 1 + Igor onDestroy +1), Got:', howler?.powerCounters);
        
        // Igor onDestroy 应该只触发一次：
        // - 初始值：1
        // - Igor onDestroy 自动选择 howler（唯一候选）：+1
        // - 最终值：2
        // 如果 onDestroy 被触发两次，howler 会有 3 个指示物（初始1 + 两次触发各加1）
        expect(howler?.powerCounters).toBe(2);
        
        // 收集所有交互（current + queue）
        const allInteractions = [];
        if (result2.finalState.sys.interaction.current) {
            allInteractions.push(result2.finalState.sys.interaction.current);
        }
        allInteractions.push(...(result2.finalState.sys.interaction.queue ?? []));

        // 应该没有 Igor 的交互（因为只有一个候选，自动执行了）
        const igorInteractions = allInteractions.filter(i => (i.data as any)?.sourceId === 'frankenstein_igor');
        
        console.log('All interactions:', allInteractions.map(i => ({
            id: i.id,
            sourceId: (i.data as any)?.sourceId,
            playerId: i.playerId,
        })));
        
        console.log('Igor interactions count:', igorInteractions.length);
        
        // 因为只有一个候选，Igor onDestroy 自动执行了（没有创建交互）
        expect(igorInteractions.length).toBe(0);
        
        // 验证 onDestroy 只触发了一次（不是两次）
        expect(howler?.powerCounters).not.toBe(3);
    });
});
