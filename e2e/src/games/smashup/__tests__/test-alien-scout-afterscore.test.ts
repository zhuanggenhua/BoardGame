/**
 * 测试：验证 alien_scout 的 afterScoring trigger 是否正常工作
 * 
 * 问题：用户报告移除 abilityTags: ['special'] 后，侦察兵的计分后效果不触发了
 * 
 * 预期：移除 abilityTags 不应该影响 afterScoring trigger
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import type { SmashUpCore } from '../domain/types';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe.skip('alien_scout afterScoring trigger', () => {
    it('侦察兵在基地计分后应该创建交互让玩家选择是否回手', () => {
        const runner = new GameTestRunner('smashup', {
            players: ['p1', 'p2'],
            setupFn: (core) => {
                // 设置：基地达标，p1 有一个侦察兵在基地上
                const base = core.bases[0];
                base.breakpoint = 10;
                
                // p1 打出侦察兵（力量 3）
                const scout = {
                    uid: 'scout1',
                    defId: 'alien_scout',
                    owner: 'p1',
                    controller: 'p1',
                };
                base.minions.push(scout);
                
                // p2 打出随从凑够爆破点
                base.minions.push({
                    uid: 'm2',
                    defId: 'alien_invader',
                    owner: 'p2',
                    controller: 'p2',
                });
                
                return core;
            },
        });

        // 执行：触发基地计分
        const result = runner.runCommand({
            type: 'SCORE_BASES',
            playerId: 'p1',
            payload: {},
        });

        expect(result.ok).toBe(true);
        
        // 验证：应该创建了 alien_scout_return 交互
        const interaction = result.state.sys.interaction?.current;
        expect(interaction).toBeDefined();
        expect(interaction?.data.sourceId).toBe('alien_scout_return');
        
        // 验证：交互选项应该包含"返回手牌"和"留在基地"
        const options = (interaction?.data as any).options;
        expect(options).toBeDefined();
        expect(options.length).toBe(2);
        expect(options.some((opt: any) => opt.id === 'yes')).toBe(true);
        expect(options.some((opt: any) => opt.id === 'no')).toBe(true);
    });

    it('侦察兵选择返回手牌后应该回到手牌', () => {
        const runner = new GameTestRunner('smashup', {
            players: ['p1', 'p2'],
            setupFn: (core) => {
                const base = core.bases[0];
                base.breakpoint = 10;
                
                const scout = {
                    uid: 'scout1',
                    defId: 'alien_scout',
                    owner: 'p1',
                    controller: 'p1',
                };
                base.minions.push(scout);
                
                base.minions.push({
                    uid: 'm2',
                    defId: 'alien_invader',
                    owner: 'p2',
                    controller: 'p2',
                });
                
                return core;
            },
        });

        // 触发计分
        runner.runCommand({
            type: 'SCORE_BASES',
            playerId: 'p1',
            payload: {},
        });

        // 选择返回手牌
        const result = runner.runCommand({
            type: 'RESOLVE_INTERACTION',
            playerId: 'p1',
            payload: {
                interactionId: runner.getState().sys.interaction?.current?.id ?? '',
                value: { returnIt: true, minionUid: 'scout1', minionDefId: 'alien_scout', owner: 'p1', baseIndex: 0 },
            },
        });

        expect(result.ok).toBe(true);
        
        // 验证：侦察兵应该回到 p1 手牌
        const p1Hand = result.state.core.players.p1.hand;
        expect(p1Hand.some(c => c.uid === 'scout1' && c.defId === 'alien_scout')).toBe(true);
        
        // 验证：侦察兵不应该在基地上
        const base = result.state.core.bases[0];
        expect(base.minions.some(m => m.uid === 'scout1')).toBe(false);
    });
});
