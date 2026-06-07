import { beforeEach, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { getDiscardSpecialOptions } from '../../domain/discardSpecialAbilities';
import { SU_COMMANDS } from '../../domain/types';
import { makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from '../helpers';
import { runCommand } from '../testRunner';

describe('世界冠军弃牌堆 special 目标族', () => {
    beforeEach(() => {
        resetAbilityInit();
        initAllAbilities();
    });

    it('Eh 在弃牌堆中应暴露为点随从的 special，而不是 base-first special', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('eh-discard', 'world_champs_eh', 'action', '0')],
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [makeBase('base_monkey_lab', [
                makeMinion('ally-a', 'robot_microbot_alpha', '0', 2),
                makeMinion('ally-b', 'robot_microbot_guard', '0', 3),
            ])],
        });

        const options = getDiscardSpecialOptions(core, '0');
        expect(options).toHaveLength(1);
        expect(options[0]?.allowedBaseIndices).toEqual([0]);
        expect(options[0]?.allowedMinionUids).toEqual(['ally-a', 'ally-b']);
    });

    it('Eh 从弃牌堆发动时应直接吃掉所点随从，不再进入二段随从 prompt', () => {
        const initial = makeMatchState(makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('eh-discard', 'world_champs_eh', 'action', '0')],
                    actionsPlayed: 1,
                    actionLimit: 1,
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                makeBase('base_monkey_lab', [
                    makeMinion('ally-a', 'robot_microbot_alpha', '0', 2),
                ]),
                makeBase('base_the_factory', [
                    makeMinion('ally-b', 'robot_microbot_guard', '0', 3),
                ]),
            ],
            turnNumber: 1,
            nextUid: 100,
        }));

        const result = runCommand(initial, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: '0',
            payload: {
                discardCardUid: 'eh-discard',
                baseIndex: 1,
                targetMinionUid: 'ally-b',
            },
        } as any);

        expect(result.success).toBe(true);
        expect(result.finalState.sys.interaction?.current).toBeUndefined();
        expect(result.finalState.core.players['0'].hand.some(card => card.uid === 'eh-discard')).toBe(true);
        expect(result.finalState.core.players['0'].discard.some(card => card.uid === 'eh-discard')).toBe(false);
        const allyB = result.finalState.core.bases[1].minions.find(minion => minion.uid === 'ally-b');
        expect(allyB?.tempPowerModifier).toBe(1);
    });
});
