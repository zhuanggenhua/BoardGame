/**
 * 盘旋机器人链式打出测试
 * 
 * 验证场景：
 * 1. 打出第一个盘旋机器人，牌库顶是第二个盘旋机器人
 * 2. 选择打出第二个盘旋机器人
 * 3. 第二个盘旋机器人触发，应该看到新的牌库顶（不是第二个盘旋机器人）
 * 4. 验证不会出现"无限循环打出同一张卡"的问题
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { initAllAbilities } from '../abilities';
import { runCommand } from './testRunner';
import { makeState, makePlayer, makeCard, makeMatchState } from './helpers';
import { SU_COMMANDS } from '../domain/types';
import type { SmashUpCore } from '../domain/types';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { resetRobotHoverbotCounter } from '../abilities/robots';

describe('盘旋机器人链式打出', () => {
    beforeAll(() => {
        clearInteractionHandlers();
        initAllAbilities();
    });
    
    it('应该正确处理连续打出两个盘旋机器人', () => {
        // 设置初始状态：P0 手牌有第一个盘旋机器人，牌库顶是第二个盘旋机器人，第三张是普通随从
        resetRobotHoverbotCounter();
        
        const p0 = makePlayer('0', {
            hand: [
                makeCard('hoverbot-1', 'robot_hoverbot', 'minion', '0'),
            ],
            deck: [
                makeCard('hoverbot-2', 'robot_hoverbot', 'minion', '0'),
                makeCard('zapbot-1', 'robot_zapbot', 'minion', '0'),
            ],
            minionsPlayed: 0,
        });
        
        const state = makeState({ players: { '0': p0, '1': makePlayer('1') } });
        let ms = makeMatchState(state);
        
        // 1. 打出第一个盘旋机器人
        ms = runCommand(ms, SU_COMMANDS.PLAY_MINION, '0', { cardUid: 'hoverbot-1', baseIndex: 0 });
        
        // 验证：应该创建交互，选项引用第二个盘旋机器人
        const interaction1 = ms.sys.interaction?.current;
        expect(interaction1).toBeDefined();
        expect(interaction1?.playerId).toBe('0');
        
        const options1 = (interaction1?.data as any)?.options;
        expect(options1).toBeDefined();
        expect(options1.length).toBe(2);
        
        const playOption1 = options1.find((opt: any) => opt.id === 'play');
        expect(playOption1).toBeDefined();
        expect(playOption1.value.cardUid).toBe('hoverbot-2');
        expect(playOption1.value.defId).toBe('robot_hoverbot');
        
        // 2. 选择打出第二个盘旋机器人
        ms = runCommand(ms, 'SYS_INTERACTION_RESPOND', '0', { optionId: 'play' });
        
        // 验证：第二个盘旋机器人应该在场上
        const core = ms.core as SmashUpCore;
        const base = core.bases[0];
        const hoverbot2 = base.minions.find(m => m.uid === 'hoverbot-2');
        expect(hoverbot2).toBeDefined();
        expect(hoverbot2?.defId).toBe('robot_hoverbot');
        
        // 验证：应该创建新的交互，选项引用 zapbot（新的牌库顶）
        const interaction2 = ms.sys.interaction?.current;
        expect(interaction2).toBeDefined();
        expect(interaction2?.playerId).toBe('0');
        
        const options2 = (interaction2?.data as any)?.options;
        expect(options2).toBeDefined();
        expect(options2.length).toBe(2);
        
        const playOption2 = options2.find((opt: any) => opt.id === 'play');
        expect(playOption2).toBeDefined();
        expect(playOption2.value.cardUid).toBe('zapbot-1');
        expect(playOption2.value.defId).toBe('robot_zapbot');
        
        // 验证：牌库顶确实是 zapbot
        const p0Final = core.players['0'];
        expect(p0Final.deck[0]?.uid).toBe('zapbot-1');
        expect(p0Final.deck[0]?.defId).toBe('robot_zapbot');
    });
    
    it('应该阻止打出已经不在牌库顶的卡', () => {
        // 设置初始状态：P0 手牌有盘旋机器人，牌库顶是随从 A
        resetRobotHoverbotCounter();
        
        const p0 = makePlayer('0', {
            hand: [
                makeCard('hoverbot-1', 'robot_hoverbot', 'minion', '0'),
            ],
            deck: [
                makeCard('minion-a', 'robot_zapbot', 'minion', '0'),
                makeCard('minion-b', 'robot_zapbot', 'minion', '0'),
            ],
            minionsPlayed: 0,
        });
        
        const state = makeState({ players: { '0': p0, '1': makePlayer('1') } });
        let ms = makeMatchState(state);
        
        // 1. 打出盘旋机器人
        ms = runCommand(ms, SU_COMMANDS.PLAY_MINION, '0', { cardUid: 'hoverbot-1', baseIndex: 0 });
        
        // 验证：交互选项引用 minion-a
        const interaction = ms.sys.interaction?.current;
        expect(interaction).toBeDefined();
        
        const options = (interaction?.data as any)?.options;
        const playOption = options.find((opt: any) => opt.id === 'play');
        expect(playOption.value.cardUid).toBe('minion-a');
        
        // 2. 手动修改状态：模拟 minion-a 被其他方式移除（如被消灭）
        const core = ms.core as SmashUpCore;
        core.players['0'].deck.shift(); // 移除牌库顶的卡，现在牌库顶是 minion-b
        
        // 3. 尝试响应交互（打出 minion-a）
        const result = runCommand(ms, 'SYS_INTERACTION_RESPOND', '0', { optionId: 'play' }, { expectError: true });
        
        // 验证：命令应该失败（因为 minion-a 已经不在牌库顶）
        expect(result.success).toBe(false);
        
        // 验证：牌库顶仍然是 minion-b（没有被错误地打出）
        const coreFinal = result.state.core as SmashUpCore;
        expect(coreFinal.players['0'].deck[0]?.uid).toBe('minion-b');
    });
});
