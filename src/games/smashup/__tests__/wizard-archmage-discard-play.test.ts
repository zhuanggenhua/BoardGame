/**
 * 测试：大法师从弃牌堆打出时是否触发额外行动
 * 
 * 问题描述：大法师在场时，如果从弃牌堆打出大法师本身，应该触发"额外行动"的能力
 * 
 * 根据官方 FAQ："You get the extra action on each of your turns, including the one when Archmage is played."
 * 
 * 注意：大法师本身没有注册 DiscardPlayProvider（它不是从弃牌堆打出的能力），
 * 但如果通过其他方式（如僵尸派系的能力）从弃牌堆打出大法师，应该触发 onMinionPlayed 触发器。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { GameTestRunner } from '../../../engine/testing/GameTestRunner';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import { createSmashUpEventSystem } from '../domain/systems';
import { smashUpFlowHooks } from '../domain/index';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand, SmashUpEvent } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { registerDiscardPlayProvider } from '../domain/discardPlayability';
import { initAllAbilities } from '../abilities';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState } from '../../../engine/pipeline';
import { makeMinion, makePlayer, makeState, makeBase, makeCard } from './helpers';

const PLAYER_IDS = ['0', '1'] as const;

describe('大法师从弃牌堆打出触发额外行动', () => {
    beforeAll(() => {
        // 初始化所有能力（包括大法师的 onMinionPlayed 触发器）
        initAllAbilities();
        
        // 注册一个测试用的 DiscardPlayProvider，允许从弃牌堆打出大法师
        registerDiscardPlayProvider({
            id: 'test_archmage_discard_play',
            getPlayableCards(core, playerId) {
                const player = core.players[playerId];
                const archmages = player.discard.filter(c => c.defId === 'wizard_archmage');
                return archmages.map(c => ({
                    card: c,
                    allowedBaseIndices: 'all' as const,
                    consumesNormalLimit: true,
                    sourceId: 'test_archmage_discard_play',
                    defId: c.defId,
                    power: 4,
                    name: '大法师',
                }));
            },
        });
    });

    function createCustomRunner(customState: MatchState<SmashUpCore>) {
        const systems = [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createBaseSystems<SmashUpCore>(),
            createSmashUpEventSystem(),
        ];
        return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
            domain: SmashUpDomain,
            systems,
            playerIds: PLAYER_IDS,
            setup: () => customState,
            silent: true,
        });
    }

    function makeFullMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
        const systems = [
            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
            ...createBaseSystems<SmashUpCore>(),
            createSmashUpEventSystem(),
        ];
        const sys = createInitialSystemState(PLAYER_IDS, systems);
        return { core, sys: { ...sys, phase: 'playCards' } } as MatchState<SmashUpCore>;
    }

    it('从弃牌堆打出大法师应该获得额外行动', () => {
        const archmageCard = makeCard('archmage-1', 'wizard_archmage', 'minion', '0');
        
        const core = makeState({
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': {
                    ...makePlayer('0'),
                    discard: [archmageCard],
                },
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tar_pits', [])],
        });
        
        const fullState = makeFullMatchState(core);
        const runner = createCustomRunner(fullState);
        
        // 验证初始状态：P0 的 actionLimit 为 1
        expect(core.players['0'].actionLimit).toBe(1);
        
        // 从弃牌堆打出大法师
        const result = runner.run({
            name: '从弃牌堆打出大法师',
            commands: [
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: '0',
                    payload: {
                        cardUid: 'archmage-1',
                        baseIndex: 0,
                        fromDiscard: true,
                    },
                },
            ] as any[],
        });

        // 验证命令执行成功
        if (!result.steps[0]?.success) {
            console.error('命令执行失败:', result.steps[0]?.error);
            console.error('完整结果:', JSON.stringify(result, null, 2));
        }
        expect(result.steps[0]?.success).toBe(true);
        
        // 验证大法师已经在场上
        const finalBase = result.finalState.core.bases[0];
        expect(finalBase.minions.length).toBe(1);
        expect(finalBase.minions[0].defId).toBe('wizard_archmage');
        
        // 关键验证：P0 的 actionLimit 应该增加 1（从 1 变成 2）
        const finalPlayer = result.finalState.core.players['0'];
        expect(finalPlayer.actionLimit).toBe(2);
        
        // 测试通过说明：从弃牌堆打出大法师时，onMinionPlayed 触发器正确触发，增加了额外行动
    });

    it('从手牌打出大法师应该获得额外行动（对照组）', () => {
        const archmageCard = makeCard('archmage-1', 'wizard_archmage', 'minion', '0');
        
        const core = makeState({
            currentPlayerIndex: 0,
            turnNumber: 1,
            players: {
                '0': {
                    ...makePlayer('0'),
                    hand: [archmageCard],
                },
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_tar_pits', [])],
        });
        
        const fullState = makeFullMatchState(core);
        const runner = createCustomRunner(fullState);
        
        const result = runner.run({
            name: '从手牌打出大法师',
            commands: [
                {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: '0',
                    payload: {
                        cardUid: 'archmage-1',
                        baseIndex: 0,
                    },
                },
            ] as any[],
        });

        if (!result.steps[0]?.success) {
            console.error('命令执行失败:', result.steps[0]?.error);
        }
        expect(result.steps[0]?.success).toBe(true);
        
        // 验证从手牌打出也能获得额外行动
        const finalPlayer = result.finalState.core.players['0'];
        expect(finalPlayer.actionLimit).toBe(2);
    });
});