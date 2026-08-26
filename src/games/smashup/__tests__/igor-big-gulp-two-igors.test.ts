/**
 * 测试场景：场上只有一个 Igor，"一大口"消灭它
 * 
 * Bug 报告：打出"一大口"消灭一个 Igor 后，出现了两次"选择随从放置+1力量指示物"的交互
 * 
 * 预期行为：只应该出现一次交互（只有被消灭的那个 Igor 触发 onDestroy）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    getPromptOption,
    getPromptOptions,
    getPromptsBySourceId,
    getSimpleChoicePrompt,
    makeState,
    makePlayer,
    makeCard,
    makeMatchState,
    makeMinion,
    respondToPrompt,
} from './helpers';
import { runCommand } from './testRunner';
import { SU_COMMANDS } from '../domain/types';
import { initAllAbilities } from '../abilities';

describe('Igor + Big Gulp: 一个 Igor 被消灭', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('一大口消灭一个 Igor → 只触发一次 onDestroy', () => {
        // 场景：蚁丘上有一个 Igor（玩家0）+ 一个咆哮者（玩家0）+ 一个新生吸血鬼（玩家1）
        // 玩家1打出"一大口"消灭 Igor
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    factions: ['frankenstein', 'werewolves'],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('bg1', 'vampire_big_gulp', 'action', '1')],
                    factions: ['vampires', 'giant_ants'],
                }),
            },
            bases: [
                {
                    defId: 'base_the_hill',
                    minions: [
                        makeMinion('igor1', 'frankenstein_igor', '0', 2, { powerCounters: 1 }),
                        makeMinion('howler', 'werewolf_howler', '0', 2, { powerCounters: 1 }),
                        makeMinion('fledgling', 'vampire_fledgling_vampire', '1', 2),
                    ],
                    ongoingActions: [],
                },
            ],
            currentPlayerIndex: 1,
        });

        // 步骤1：玩家1打出"一大口"（需要指定目标基地）
        const result1 = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '1',
            payload: { cardUid: 'bg1', targetBaseIndex: 0 },
            timestamp: 1000,
        });

        // 应该创建"一大口"的交互（选择要消灭的随从）
        const prompt1 = getSimpleChoicePrompt(result1.finalState, 'vampire_big_gulp');

        // 选项应该包含 Igor + 咆哮者 + 新生吸血鬼（力量都≤4）
        const options = getPromptOptions(prompt1);
        expect(options.length).toBeGreaterThanOrEqual(3);

        // 步骤2：玩家1选择消灭 igor1
        const igorOption = getPromptOption(
            prompt1,
            (o: any) => o.value?.minionUid === 'igor1',
            'Big Gulp target option for Igor',
        );
        const result2 = respondToPrompt(result1.finalState, igorOption.id, '1');

        // 验证 Igor 确实被消灭了
        const base = result2.finalState.core.bases[0];
        const igorStillOnBase = base.minions.some(m => m.uid === 'igor1');
        expect(igorStillOnBase).toBe(false);

        // 验证 Igor 在弃牌堆
        const player0 = result2.finalState.core.players['0'];
        const igorInDiscard = player0.discard.some(c => c.uid === 'igor1');
        expect(igorInDiscard).toBe(true);

        // Igor onDestroy 只应创建一次目标选择交互
        const igorInteractions = getPromptsBySourceId(result2.finalState, 'frankenstein_igor');
        expect(igorInteractions.length).toBe(1);

        const igorPrompt = getSimpleChoicePrompt(result2.finalState, 'frankenstein_igor');
        const howlerOption = getPromptOption(
            igorPrompt,
            (o: any) => o.value?.minionUid === 'howler',
            'Igor target option for Howler',
        );
        const result3 = respondToPrompt(result2.finalState, howlerOption.id, '0');
        expect(result3.success).toBe(true);

        const howler = result3.finalState.core.bases[0].minions.find(m => m.uid === 'howler');
        expect(howler?.powerCounters).toBe(2);
        expect(getPromptsBySourceId(result3.finalState, 'frankenstein_igor').length).toBe(0);
    });
});
