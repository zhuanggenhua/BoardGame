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
import {
    getFirstPrompt,
    getPromptSourceId,
    getPromptsBySourceId,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
} from './helpers';
import { initAllAbilities } from '../abilities';
import { defaultTestRandom, runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain/types';

describe('Bug: 对手打出"一大口"消灭 Igor 时触发两次', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('vampire_big_gulp 消灭 Igor 后 Igor onDestroy 只触发一次', () => {
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

        // 步骤1：执行"一大口"能力，进入选择消灭目标的 prompt
        const playResult = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'bg1' },
            timestamp: 1000,
        } as any, defaultTestRandom);
        expect(playResult.success, playResult.error).toBe(true);
        
        // 应该创建一个交互（选择要消灭的随从）
        const interaction1 = getFirstPrompt(playResult.finalState);
        expect(interaction1).toBeDefined();
        expect(getPromptSourceId(interaction1)).toBe('vampire_big_gulp');
        
        // 步骤2：通过真实交互响应选择消灭 Igor
        const resolved = respondToPromptOption(
            playResult.finalState,
            option => option.value?.minionUid === 'igor1',
            'Big Gulp target Igor option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        
        // 检查：应该只有一个 Igor 交互（onDestroy）
        const igorInteractions = getPromptsBySourceId(resolved.finalState, 'frankenstein_igor');
        
        // ❌ Bug: 如果这里失败，说明 Igor 触发了两次
        expect(igorInteractions.length).toBe(1);
        
        // 验证 Igor 交互属于玩家1（Igor 的拥有者）
        if (igorInteractions.length > 0) {
            expect(igorInteractions[0].playerId).toBe('1');
        }
    });
});
