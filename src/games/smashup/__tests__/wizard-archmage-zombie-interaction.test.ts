/**
 * 大法师 × 它们不断来临 focused gate
 *
 * 锁定当前真实合同：
 * - `zombie_they_keep_coming` 先创建“弃牌堆随从 + 目标基地”的单步交互
 * - 通过 mergedValue 一次性提交 `cardUid + baseIndex`
 * - 从弃牌堆打出的 `wizard_archmage` 仍视为真实 `onMinionPlayed`
 * - 因此应授予当前回合额外行动额度
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { asSimpleChoice, INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { initAllAbilities } from '../abilities';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { makeBase, makeCard, makeMatchState, makePlayer, makeState } from './helpers';
import { runCommand } from './testRunner';

function findOption(choice: any, predicate: (option: any) => boolean): string {
    const option = choice?.options?.find(predicate);
    if (!option) {
        throw new Error(`找不到匹配选项: ${JSON.stringify(choice?.options ?? [])}`);
    }
    return option.id;
}

describe('大法师 × 它们不断来临', () => {
    beforeAll(() => {
        initAllAbilities();
    });

    it('通过它们不断来临从弃牌堆打出大法师时，应创建真实交互并授予额外行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('tkc-1', 'zombie_they_keep_coming', 'action', '0')],
                    discard: [makeCard('archmage-1', 'wizard_archmage', 'minion', '0')],
                    factions: ['zombies', 'wizards'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_tar_pits'),
                makeBase('base_factory_436_1337'),
            ],
        });

        const state = makeMatchState(core);

        const r1 = runCommand(
            state,
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'tkc-1' },
            },
            undefined,
        );

        expect(r1.success).toBe(true);

        const choice = asSimpleChoice(r1.finalState.sys.interaction.current);
        expect(choice?.sourceId).toBe('zombie_they_keep_coming');
        expect(choice?.targetType).toBe('discard_minion');

        const archmageOptionId = findOption(choice, (option: any) => option.value?.cardUid === 'archmage-1');

        const r2 = runCommand(
            r1.finalState,
            {
                type: INTERACTION_COMMANDS.RESPOND as any,
                playerId: '0',
                payload: {
                    optionId: archmageOptionId,
                    mergedValue: {
                        ...(choice?.options?.find((option: any) => option.id === archmageOptionId)?.value ?? {}),
                        baseIndex: 0,
                    },
                },
            } as any,
            undefined,
        );

        expect(r2.success).toBe(true);
        expect(r2.finalState.sys.interaction.current).toBeUndefined();

        const player = r2.finalState.core.players['0'];
        expect(player.discard.some((card) => card.uid === 'archmage-1')).toBe(false);
        expect(r2.finalState.core.bases[0].minions.some((minion) => minion.uid === 'archmage-1')).toBe(true);
        expect(player.actionsPlayed).toBe(1);
        expect(player.actionLimit).toBe(2);

        const limitEvents = r2.events.filter(
            (event: any) => event.type === SU_EVENTS.LIMIT_MODIFIED && event.payload?.reason === 'wizard_archmage',
        );
        expect(limitEvents).toHaveLength(1);
        expect(limitEvents[0]).toMatchObject({
            payload: {
                playerId: '0',
                limitType: 'action',
                delta: 1,
                reason: 'wizard_archmage',
            },
        });
    });
});
