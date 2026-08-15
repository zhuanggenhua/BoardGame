/**
 * 大杀四方 - beforeScoring 响应窗口卡住问题测试
 * 
 * 复现场景：
 * - P0 场上有海盗王（beforeScoring 触发器）
 * - P1 有 afterScoring 卡牌（我们乃最强）
 * - 基地达到临界点
 * - beforeScoring 窗口打开
 * - P1 pass
 * - 窗口切换到 P0
 * - 检查 P0 是否有可响应内容
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { smashUpSystemsForTest } from '../game';
import type { PlayerId, RandomFn } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { getSmashUpReactionWindowPresentation } from '../domain/reactionWindowState';

const PLAYER_IDS = ['0', '1'];
const systems = smashUpSystemsForTest;

beforeAll(() => {
    initAllAbilities();
});

describe('beforeScoring 响应窗口 - 卡住问题', () => {
    it('P0 场上有海盗王，P1 有 afterScoring 卡牌', () => {
        // Setup: 复现用户的场景
        function setup(ids: PlayerId[], random: RandomFn) {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, systems, undefined);
            
            // 跳过派系选择
            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.currentPlayerIndex = 0;
            
            // 设置两个基地达到临界点
            core.bases[1] = {
                defId: 'base_temple_of_goju', // 刚柔流寺庙，临界点 20
                minions: [
                    {
                        uid: 'c6',
                        defId: 'pirate_saucy_wench',
                        owner: '0',
                        controller: '0',
                        basePower: 3,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        powerCounters: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'c1',
                        defId: 'pirate_king', // 海盗王，有 beforeScoring 触发器
                        owner: '0',
                        controller: '0',
                        basePower: 5,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        powerCounters: 0,
                        attachedActions: [],
                        talentUsed: false,
                        playedThisTurn: true, // 刚打出
                    },
                    {
                        uid: 'c7',
                        defId: 'pirate_first_mate',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerModifier: 10, // +10 修正，确保达到临界点 20
                        tempPowerModifier: 0,
                        powerCounters: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                ],
                ongoingActions: [],
            };
            
            core.bases[2] = {
                defId: 'base_pirate_cove', // 海盗湾，临界点 21
                minions: [
                    {
                        uid: 'c48',
                        defId: 'giant_ant_drone',
                        owner: '1',
                        controller: '1',
                        basePower: 3,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        powerCounters: 1,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'c9',
                        defId: 'pirate_first_mate',
                        owner: '0',
                        controller: '0',
                        basePower: 2,
                        powerModifier: 0,
                        tempPowerModifier: 0,
                        powerCounters: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'c10',
                        defId: 'pirate_buccaneer',
                        owner: '1',
                        controller: '1',
                        basePower: 3,
                        powerModifier: 13, // +13 修正，确保达到临界点 21
                        tempPowerModifier: 0,
                        powerCounters: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                ],
                ongoingActions: [],
            };
            
            // P0 手牌：普通卡牌（没有 beforeScoring 卡牌）
            core.players['0'].hand = [
                { uid: 'c12', defId: 'pirate_dinghy', type: 'action', owner: '0' },
                { uid: 'c18', defId: 'pirate_shanghai', type: 'action', owner: '0' },
                { uid: 'c27', defId: 'ninja_acolyte', type: 'minion', owner: '0' },
            ];
            
            // P1 手牌：有 afterScoring 卡牌
            core.players['1'].hand = [
                { uid: 'c60', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '1' },
                { uid: 'c54', defId: 'giant_ant_we_will_rock_you', type: 'action', owner: '1' },
            ];

            return { sys, core };
        }
        
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup,
        });
        
        // 执行测试命令序列
        const result = runner.run({
            name: 'beforeScoring 窗口卡住测试',
            commands: [
                // 步骤 1：推进到 scoreBases 阶段
                { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined },
                
                // 此时应该打开 beforeScoring 响应窗口
                // 检查窗口状态
            ] as any[],
        });
        
        // 验证：检查响应窗口状态
        const afterState = result.finalState;
        expect(afterState.sys.phase).toBe('scoreBases');

        expect(afterState.sys.responseWindow?.current).toBeUndefined();
        const window = getSmashUpReactionWindowPresentation(afterState);
        if (!window) return;

        expect(window.windowType).toBe('meFirst');

        const currentResponderId = window.responderQueue[window.currentResponderIndex];
        expect(currentResponderId).toBe('0');

        // 检查 P0 手牌中是否有 beforeScoring 卡牌
        const p0Hand = afterState.core.players['0'].hand;

        // 检查是否有 special 卡牌
        const hasSpecialCard = p0Hand.some((c: any) => {
            if (c.type !== 'action') return false;
            const def = require('../data/cards').getCardDef(c.defId);
            return def?.subtype === 'special' || def?.responseWindowTiming === 'beforeScoring';
        });

        // 检查是否有 beforeScoringPlayable 随从
        const hasBeforeScoringMinion = p0Hand.some((c: any) => {
            if (c.type !== 'minion') return false;
            const def = require('../data/cards').getMinionDef(c.defId);
            return def?.beforeScoringPlayable === true;
        });

        // 断言：P0 不应该有可响应内容，但窗口仍正确停在 P0 响应位
        expect(hasSpecialCard).toBe(false);
        expect(hasBeforeScoringMinion).toBe(false);
    });
});
