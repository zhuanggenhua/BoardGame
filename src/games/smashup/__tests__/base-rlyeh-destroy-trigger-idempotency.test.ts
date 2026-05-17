/**
 * base_rlyeh destroy trigger 幂等合同。
 *
 * 锁定 `base_rlyeh onTurnStart -> 选择被消灭随从 -> onDestroy prompt` 这条真实系统链：
 * - `base_rlyeh` 会产出真实消灭事件
 * - `frankenstein_igor` 的 onDestroy 只触发一次
 * - 该链路不会伪装成“双触发”
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
    getPromptSourceId,
    getSimpleChoicePrompt,
    getPromptsBySourceId,
    makeBase,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    triggerBaseAbilityWithMS,
} from './helpers';
import { initAllAbilities } from '../abilities';

describe('base_rlyeh destroy trigger 幂等', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('base_rlyeh 真实响应链下，选择消灭 Igor 后 onDestroy 只触发一次', () => {
        // 初始状态：base_rlyeh 上有 Igor + 其他随从
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [], deck: [], discard: [] }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [
                makeBase('base_rlyeh', [
                    makeMinion('igor1', 'frankenstein_igor', '0', 2),
                    makeMinion('monster1', 'frankenstein_the_monster', '0', 4),
                    makeMinion('wolf1', 'werewolf_loup_garou', '0', 4),
                ]),
            ],
        });

        const trigger = triggerBaseAbilityWithMS('base_rlyeh', 'onTurnStart', {
            state: core,
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_rlyeh',
        } as any);
        const rlyehPrompt = getSimpleChoicePrompt(trigger.matchState!, 'base_rlyeh');
        expect(rlyehPrompt).toBeDefined();

        const afterChooseIgor = respondToPromptOption(
            trigger.matchState!,
            option => option.value?.minionUid === 'igor1',
            'Rlyeh choose Igor option',
        );
        expect(afterChooseIgor.success, afterChooseIgor.error).toBe(true);

        const igorInteractions = getPromptsBySourceId(afterChooseIgor.finalState, 'frankenstein_igor');

        expect(igorInteractions.map(i => ({
            id: i.id,
            sourceId: getPromptSourceId(i),
            playerId: i.playerId,
        }))).toHaveLength(1);
        expect(igorInteractions.length).toBe(1);
    });
});
