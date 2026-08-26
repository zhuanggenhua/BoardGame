/**
 * 一大口 + 雄蜂防止消灭 交互链测试
 *
 * 复现 bug：一大口消灭科学小怪时，雄蜂防止消灭弹窗出现但按钮无法点击
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { SU_COMMANDS } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import {
    expectNoPrompt,
    getPromptOption,
    getPromptPlayerId,
    getPromptSourceId,
    getSimpleChoicePrompt,
    makeMinion,
    makeCard,
    makePlayer,
    makeState,
    makeMatchState,
    respondToPrompt,
} from './helpers';
import { runCommand } from './testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('一大口 + 雄蜂防止消灭', () => {
    /**
     * 场景：玩家1打出一大口，场上有多个力量≤4随从（需要交互选择）
     * 玩家0有科学小怪和雄蜂（有指示物）
     * 玩家1选择消灭科学小怪 → 雄蜂防止消灭交互应出现
     */
    it('一大口选择消灭科学小怪时，雄蜂防止消灭交互正确创建', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['giant_ants', 'frankenstein'],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('bg1', 'vampire_big_gulp', 'action', '1')],
                    factions: ['vampires', 'pirates'],
                }),
            },
            currentPlayerIndex: 1, // 玩家1的回合
            bases: [{
                defId: 'test_base',
                minions: [
                    // 玩家0的科学小怪（力量2）
                    makeMinion('igor1', 'frankenstein_igor', '0', 2),
                    // 玩家0的雄蜂（力量2 + 1个指示物 = 力量3）
                    makeMinion('drone1', 'giant_ant_drone', '0', 2, { powerCounters: 1 }),
                    // 玩家1的随从（力量2，给一大口多个候选）
                    makeMinion('pirate1', 'pirate_saucy_wench', '1', 2),
                ],
                ongoingActions: [],
            }],
        });

        const ms = makeMatchState(core);
        ms.sys.phase = 'playCards';

        // 步骤1：玩家1打出一大口
        const result1 = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bg1' },
            timestamp: 100,
        });

        expect(result1.success).toBe(true);

        // 应创建一大口的选择交互（多个候选）
        const interaction1 = getSimpleChoicePrompt(result1.finalState, 'vampire_big_gulp');
        expect(getPromptPlayerId(interaction1)).toBe('1'); // 一大口属于玩家1
        expect(getPromptSourceId(interaction1)).toBe('vampire_big_gulp');

        // 步骤2：玩家1选择消灭科学小怪
        const igorOption = getPromptOption(interaction1, (o: any) => {
            const val = o.value;
            return val?.minionUid === 'igor1' || val?.defId === 'frankenstein_igor';
        }, 'Igor destroy option');

        const result2 = respondToPrompt(result1.finalState, igorOption.id, '1');

        expect(result2.success).toBe(true);

        // 关键验证：雄蜂防止消灭交互应被创建
        const interaction2 = getSimpleChoicePrompt(result2.finalState, 'giant_ant_drone_prevent_destroy');

        expect(getPromptPlayerId(interaction2)).toBe('0'); // 雄蜂交互属于玩家0（随从拥有者）
        expect(getPromptSourceId(interaction2)).toBe('giant_ant_drone_prevent_destroy');

        // 验证科学小怪还在基地上（未被消灭，等待雄蜂决定）
        const igorStillOnBase = result2.finalState.core.bases[0].minions.some(m => m.uid === 'igor1');
        expect(igorStillOnBase).toBe(true);

        // 步骤3：玩家0选择防止消灭（移除雄蜂指示物）
        const droneOption = getPromptOption(
            interaction2,
            (o: any) => Boolean(o.value?.droneUid),
            'Drone prevent destroy option',
        );

        const result3 = respondToPrompt(result2.finalState, droneOption.id, '0');

        expect(result3.success).toBe(true);

        // 验证：科学小怪仍在基地上（被防止消灭）
        const igorSaved = result3.finalState.core.bases[0].minions.some(m => m.uid === 'igor1');
        expect(igorSaved).toBe(true);

        // 验证：雄蜂指示物减少了1
        const drone = result3.finalState.core.bases[0].minions.find(m => m.uid === 'drone1');
        expect(drone).toBeDefined();
        expect(drone!.powerCounters).toBe(0); // 从1减到0

        // 验证：交互已清除
        expectNoPrompt(result3.finalState);
    });

    /**
     * 场景：一大口只有一个候选（但有跳过选项，所以会创建交互），消灭科学小怪
     * 雄蜂防止消灭交互应正确创建
     */
    it('一大口自动解决消灭科学小怪时，雄蜂防止消灭交互正确创建', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['giant_ants', 'frankenstein'],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('bg1', 'vampire_big_gulp', 'action', '1')],
                    factions: ['vampires', 'pirates'],
                }),
            },
            currentPlayerIndex: 1,
            bases: [{
                defId: 'test_base',
                minions: [
                    // 只有科学小怪力量≤4（唯一候选，但有跳过选项）
                    makeMinion('igor1', 'frankenstein_igor', '0', 2),
                    // 雄蜂力量6（basePower=5 + 1个指示物），不是一大口候选
                    makeMinion('drone1', 'giant_ant_drone', '0', 5, { powerCounters: 1 }),
                    // 玩家1的随从力量>4，不是候选
                    makeMinion('big1', 'test_big_minion', '1', 5),
                ],
                ongoingActions: [],
            }],
        });

        const ms = makeMatchState(core);
        ms.sys.phase = 'playCards';

        // 步骤1：打出一大口（创建选择交互：Igor 或跳过）
        const result1 = runCommand(ms, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bg1' },
            timestamp: 100,
        });

        expect(result1.success).toBe(true);

        // 应创建一大口的选择交互（Igor 或跳过）
        const interaction1 = getSimpleChoicePrompt(result1.finalState, 'vampire_big_gulp');
        expect(getPromptPlayerId(interaction1)).toBe('1'); // 一大口交互属于玩家1
        expect(getPromptSourceId(interaction1)).toBe('vampire_big_gulp');

        // 步骤2：选择消灭 Igor
        const igorOption = getPromptOption(interaction1, (o: any) => {
            const val = o.value;
            return val?.minionUid === 'igor1' || val?.defId === 'frankenstein_igor';
        }, 'Igor destroy option');

        const result2 = respondToPrompt(result1.finalState, igorOption.id, '1');

        expect(result2.success).toBe(true);

        // 关键验证：雄蜂防止消灭交互应被创建
        const interaction2 = getSimpleChoicePrompt(result2.finalState, 'giant_ant_drone_prevent_destroy');

        expect(getPromptPlayerId(interaction2)).toBe('0'); // 雄蜂交互属于玩家0（随从拥有者）
        expect(getPromptSourceId(interaction2)).toBe('giant_ant_drone_prevent_destroy');

        // 科学小怪应还在基地上（等待雄蜂决定）
        const igorOnBase = result2.finalState.core.bases[0].minions.some(m => m.uid === 'igor1');
        expect(igorOnBase).toBe(true);
    });
});
