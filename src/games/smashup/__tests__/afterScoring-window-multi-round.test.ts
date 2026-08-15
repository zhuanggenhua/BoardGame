/**
 * 大杀四方 - afterScoring 响应窗口 live pass 测试
 * 
 * 测试场景：
 * - 基地计分后打开 afterScoring 响应窗口
 * - 多个玩家手牌中有 afterScoring 卡牌（如"我们乃最强"）
 * - 验证当前响应者通过 Smash Up 专用 reaction pass 逐个让过
 * - 验证所有有权响应者都让过后窗口关闭，且不依赖通用 ResponseWindow 镜像
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { SmashUpDomain } from '../domain';
import { SU_COMMANDS, type SmashUpCore, type SmashUpCommand, type SmashUpEvent } from '../domain/types';
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

describe('afterScoring 响应窗口 - live pass', () => {
    it('两个玩家都有 afterScoring 卡牌时，应通过 live ReactionSession 逐个 pass 后关闭', () => {
        // Setup: 两个玩家都有 afterScoring 卡牌
        function setup(ids: PlayerId[], random: RandomFn) {
            const core = SmashUpDomain.setup(ids, random);
            const sys = createInitialSystemState(ids, systems, undefined);
            
            // 跳过派系选择
            core.factionSelection = undefined;
            sys.phase = 'playCards';
            core.currentPlayerIndex = 0;
            
            // 设置一个基地达到临界点
            core.bases[1] = {
                defId: 'base_temple_of_goju', // 刚柔流寺庙，临界点 20
                minions: [
                    {
                        uid: 'c1',
                        defId: 'pirate_buccaneer',
                        owner: '0',
                        controller: '0',
                        basePower: 3,
                        powerModifier: 10, // +10 修正，确保达到临界点
                        tempPowerModifier: 0,
                        powerCounters: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                    {
                        uid: 'c2',
                        defId: 'giant_ant_drone',
                        owner: '1',
                        controller: '1',
                        basePower: 3,
                        powerModifier: 5, // +5 修正
                        tempPowerModifier: 0,
                        powerCounters: 0,
                        attachedActions: [],
                        talentUsed: false,
                    },
                ],
                ongoingActions: [],
            };
            
            // P0 手牌：有 afterScoring 卡牌
            core.players['0'].hand = [
                { uid: 'c10', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '0' },
                { uid: 'c11', defId: 'pirate_dinghy', type: 'action', owner: '0' },
            ];
            
            // P1 手牌：有 afterScoring 卡牌
            core.players['1'].hand = [
                { uid: 'c20', defId: 'giant_ant_we_are_the_champions', type: 'action', owner: '1' },
                { uid: 'c21', defId: 'pirate_shanghai', type: 'action', owner: '1' },
            ];

            return { sys, core };
        }
        
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup,
        });
        
        const advance = runner.dispatch('ADVANCE_PHASE', { playerId: '0' });
        expect(advance.success).toBe(true);

        const passedPlayers: PlayerId[] = [];
        for (let guard = 0; guard < PLAYER_IDS.length + 2; guard += 1) {
            const presentation = getSmashUpReactionWindowPresentation(runner.getState());
            if (!presentation) break;

            expect(presentation.windowType).toBe('afterScoring');
            expect(runner.getState().sys.responseWindow?.current).toBeUndefined();
            passedPlayers.push(presentation.activePlayerId);

            const pass = runner.dispatch(SU_COMMANDS.REACTION_PASS, {
                playerId: presentation.activePlayerId,
                reason: 'player_pass',
            });
            expect(pass.success, pass.error).toBe(true);
        }

        expect(passedPlayers).toEqual(['0', '1']);
        expect(getSmashUpReactionWindowPresentation(runner.getState())).toBeUndefined();
        expect(runner.getState().sys.responseWindow?.current).toBeUndefined();
    });
});
