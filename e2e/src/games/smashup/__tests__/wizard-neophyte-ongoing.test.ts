/**
 * 测试学徒打出 ongoing 行动卡的流程
 * 
 * Bug: 学徒通过 play_extra 打出 ongoing 行动卡时，没有选择目标基地的交互
 * Fix: 检测到 ongoing 行动卡时，先创建选择基地的交互，然后再打出
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { makeState, makePlayer, makeCard, makeBase, makeMatchState } from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { registerWizardAbilities, registerWizardInteractionHandlers } from '../abilities/wizards';
import { registerZombieAbilities, registerZombieInteractionHandlers } from '../abilities/zombies';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';

beforeAll(() => {
    clearRegistry();
    clearInteractionHandlers();
    registerWizardAbilities();
    registerWizardInteractionHandlers();
    registerZombieAbilities();
    registerZombieInteractionHandlers();
});

describe('学徒打出 ongoing 行动卡', () => {
    it('学徒打出 zombie_overrun（泛滥横行）时应该先选择目标基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [
                        makeCard('overrun', 'zombie_overrun', 'action', '0'), // ongoing 行动卡
                        makeCard('d2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase(), makeBase()],
        });

        const ms = makeMatchState(state);

        // Step 1: 打出学徒
        const r1 = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        }, defaultTestRandom);

        expect(r1.success).toBe(true);

        // Step 2: 学徒 onPlay 触发，展示牌库顶（zombie_overrun）
        const interaction1 = r1.finalState.sys.interaction.current;
        expect(interaction1).toBeDefined();
        expect((interaction1?.data as any)?.sourceId).toBe('wizard_neophyte');

        // Step 3: 选择 play_extra（作为额外行动打出）
        const r2 = runCommand(r1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: 'play_extra' },
        }, defaultTestRandom);

        expect(r2.success).toBe(true);

        // Step 4: 应该弹出选择基地的交互
        const interaction2 = r2.finalState.sys.interaction.current;
        expect(interaction2).toBeDefined();
        expect((interaction2?.data as any)?.sourceId).toBe('wizard_neophyte_choose_base');
        expect((interaction2?.data as any)?.title).toContain('泛滥横行');

        // 验证选项包含所有基地
        const options = (interaction2?.data as any)?.options;
        expect(options).toHaveLength(2);

        // Step 5: 选择基地 0
        const r3 = runCommand(r2.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: options[0].id },
        }, defaultTestRandom);

        expect(r3.success).toBe(true);

        // 验证 ongoing 行动卡已附着到基地 0
        const finalState = r3.finalState.core;
        expect(finalState.bases[0].ongoingActions).toHaveLength(1);
        expect(finalState.bases[0].ongoingActions[0].defId).toBe('zombie_overrun');
        expect(finalState.bases[0].ongoingActions[0].ownerId).toBe('0');

        // 验证卡牌不在手牌中
        expect(finalState.players['0'].hand.find(c => c.uid === 'overrun')).toBeUndefined();

        // 验证行动额度没有被消耗（额外行动）
        expect(finalState.players['0'].actionsPlayed).toBe(0);
    });

    it('学徒打出 standard 行动卡时不需要选择基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'wizard_neophyte', 'minion', '0')],
                    deck: [
                        makeCard('summon', 'wizard_summon', 'action', '0'), // standard 行动卡
                        makeCard('d2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase()],
        });

        const ms = makeMatchState(state);

        // Step 1: 打出学徒
        const r1 = runCommand(ms, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'm1', baseIndex: 0 },
        }, defaultTestRandom);

        expect(r1.success).toBe(true);

        // Step 2: 选择 play_extra
        const r2 = runCommand(r1.finalState, {
            type: INTERACTION_COMMANDS.RESPOND,
            playerId: '0',
            payload: { optionId: 'play_extra' },
        }, defaultTestRandom);

        expect(r2.success).toBe(true);

        // Step 3: wizard_summon 的 onPlay 能力会增加随从额度（不创建交互）
        const finalState = r2.finalState.core;
        
        // 验证行动卡已进入弃牌堆
        expect(finalState.players['0'].discard.find(c => c.uid === 'summon')).toBeDefined();
        
        // 验证随从额度增加了 1
        expect(finalState.players['0'].minionLimit).toBe(2); // 初始 1 + wizard_summon 额外 1
        
        // 验证行动额度没有被消耗（额外行动）
        expect(finalState.players['0'].actionsPlayed).toBe(0);
    });
});
