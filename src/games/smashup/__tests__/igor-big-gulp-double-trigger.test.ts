/**
 * Bug 重现：对手打出"一大口"消灭 Igor 时，Igor onDestroy 触发两次
 * 
 * 用户报告场景：
 * - 基地：base_pirate_cove（海盗湾）
 * - 场上：Igor + 狼人
 * - 对手打出"一大口"（vampire_big_gulp）消灭 Igor
 * - Igor onDestroy 触发两次，用户选择了两个不同的随从各+1力量
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { makeState, makeBase, makeMinion, makeMatchState, makePlayer, makeCard } from './helpers';
import { initAllAbilities } from '../abilities';
import { defaultTestRandom } from './testRunner';
import { execute, processDestroyMoveCycle } from '../domain/reducer';
import { SU_COMMANDS } from '../domain/types';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';

describe('Bug: 对手打出"一大口"消灭 Igor 时触发两次', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('vampire_big_gulp 消灭 Igor → processDestroyMoveCycle → Igor onDestroy 只触发一次', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('bg1', 'vampire_big_gulp', 'action', '0')],
                    factions: ['vampires', 'pirates'],
                }),
                '1': makePlayer('1', {
                    hand: [],
                    factions: ['frankenstein', 'werewolves'],
                }),
            },
            bases: [
                makeBase('base_pirate_cove', [
                    makeMinion('igor1', 'frankenstein_igor', '1', 2),
                    makeMinion('wolf1', 'werewolf_loup_garou', '1', 4),
                    makeMinion('monster1', 'frankenstein_the_monster', '1', 4),
                ]),
            ],
            currentPlayerIndex: 0,
        });
        
        const ms = makeMatchState(core);

        // 步骤1：执行"一大口"能力（跳过命令验证，直接执行）
        const events = execute(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bg1' },
            timestamp: 1000,
        }, defaultTestRandom);
        
        const executeResult = { matchState: ms, events };
        
        // 应该创建一个交互（选择要消灭的随从）
        const interaction1 = executeResult.matchState?.sys.interaction.current;
        expect(interaction1).toBeDefined();
        expect((interaction1?.data as any)?.sourceId).toBe('vampire_big_gulp');
        
        console.log('Big Gulp interaction options:', (interaction1?.data as any)?.options?.map((o: any) => o.label));
        
        // 步骤2：调用 vampire_big_gulp handler（模拟玩家选择消灭 Igor）
        const handler = getInteractionHandler('vampire_big_gulp');
        expect(handler).toBeDefined();
        
        const handlerResult = handler!(
            executeResult.matchState!,
            '0',
            { minionUid: 'igor1', defId: 'frankenstein_igor', baseIndex: 0 },
            interaction1?.data,
            defaultTestRandom,
            1001
        );
        
        console.log('Handler result events:', handlerResult.events.map((e: any) => e.type));
        
        // 步骤3：调用 processDestroyMoveCycle（模拟 SmashUpEventSystem.afterEvents）
        const afterDestroyMove = processDestroyMoveCycle(
            handlerResult.events as any[],
            handlerResult.matchState ?? executeResult.matchState!,
            '0',
            defaultTestRandom,
            1001
        );
        
        // 检查：应该只有一个 Igor 交互（onDestroy）
        const allInteractions = [
            ...(afterDestroyMove.matchState?.sys.interaction.current ? [afterDestroyMove.matchState.sys.interaction.current] : []),
            ...(afterDestroyMove.matchState?.sys.interaction.queue ?? []),
        ];
        
        const igorInteractions = allInteractions.filter(i => (i.data as any)?.sourceId === 'frankenstein_igor');
        
        console.log('All interactions:', allInteractions.map(i => ({
            id: i.id,
            sourceId: (i.data as any)?.sourceId,
            playerId: i.playerId,
        })));
        
        console.log('Igor interactions count:', igorInteractions.length);
        
        // ❌ Bug: 如果这里失败，说明 Igor 触发了两次
        expect(igorInteractions.length).toBe(1);
        
        // 验证 Igor 交互属于玩家1（Igor 的拥有者）
        if (igorInteractions.length > 0) {
            expect(igorInteractions[0].playerId).toBe('1');
        }
    });
});
