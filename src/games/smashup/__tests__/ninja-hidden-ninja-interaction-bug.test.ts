/**
 * 便衣忍者交互创建失败 Bug 测试
 * 
 * Bug 报告：便衣忍者在 Me First! 窗口中打出后，没有创建选择随从的交互
 * 
 * 状态快照显示：
 * - specialLimitUsed 已记录 ninja_hidden_ninja
 * - 手牌中有 2 张随从（ninja_tiger_assassin 和 ninja_acolyte）
 * - 但没有创建交互
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { clearRegistry, clearBaseAbilityRegistry } from '../domain';
import { resetAbilityInit } from '../abilities';

const PLAYER_IDS = ['0', '1'];

describe('便衣忍者交互创建 Bug', () => {
    beforeAll(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        resetAbilityInit();
        initAllAbilities();
    });

    it.skip('便衣忍者在 Me First 窗口中打出后应该创建交互', () => {
        const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems: [],
            playerIds: PLAYER_IDS,
        });

        const result = runner.run({
            name: '便衣忍者创建交互',
            setup: (ids, random) => {
                const core = SmashUpDomain.setup(ids, random);
                // 设置测试场景：Me First 窗口已打开
                core.bases = [{
                    defId: 'base_the_mothership',
                    minions: [
                        { uid: 'm1', defId: 'pirate_saucy_wench', controller: '0', owner: '0', basePower: 3, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'opp1', defId: 'test_minion', controller: '1', owner: '1', basePower: 10, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                }];
                core.players['0'].hand = [
                    { uid: 'c23', defId: 'ninja_tiger_assassin', type: 'minion', owner: '0' },
                    { uid: 'c28', defId: 'ninja_acolyte', type: 'minion', owner: '0' },
                    { uid: 'c35', defId: 'ninja_hidden_ninja', type: 'action', owner: '0' },
                ];
                core.players['0'].minionsPlayed = 1;
                core.players['0'].factions = ['pirates', 'ninjas'];
                return { 
                    core, 
                    sys: { 
                        phase: 'scoreBases', 
                        interaction: { current: undefined, queue: [] }, 
                        responseWindow: { 
                            current: {
                                windowId: 'meFirst_scoreBases_1',
                                responderQueue: ['0', '1'],
                                currentResponderIndex: 0,
                                windowType: 'meFirst',
                                sourceId: 'scoreBases',
                            }
                        }, 
                        gameover: null 
                    } as any 
                };
            },
            commands: [
                {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: '0',
                    payload: {
                        cardUid: 'c35',
                        targetBaseIndex: 0,
                    },
                },
            ],
        });

        // 验证：应该创建交互
        expect(result.finalState.sys.interaction.current).toBeDefined();
        expect(result.finalState.sys.interaction.current?.id).toContain('ninja_hidden_ninja');
    });
});
