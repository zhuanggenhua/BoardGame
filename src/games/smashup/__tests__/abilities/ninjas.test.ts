import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import type { SmashUpCore, SmashUpEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

function execPlayAction(state: SmashUpCore, playerId: string, cardUid: string, targetBaseIndex?: number) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId,
            payload: { cardUid, targetBaseIndex },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

describe('忍者派系能力', () => {
    it('ninja_seeing_stars: 单个力量≤3对手随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_seeing_stars', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m1', 'test', '1', 5, { powerModifier: 0 })], ongoingActions: [] }),
                makeBase({ defId: 'b2', minions: [makeMinion('m2', 'test', '1', 3, { powerModifier: 0 })], ongoingActions: [] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'ninja_seeing_stars');
    });

    it('ninja_way_of_deception: 多个己方随从时创建 Prompt 选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_way_of_deception', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m0', 'test', '0', 5, { powerModifier: 0 }), makeMinion('m1', 'test', '0', 2, { powerModifier: 0 })], ongoingActions: [] }),
                makeBase({ defId: 'b2', minions: [], ongoingActions: [] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'ninja_way_of_deception_choose_minion');
    });

    it('ninja_way_of_deception: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_way_of_deception', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3, { powerModifier: 0 })], ongoingActions: [] }),
                makeBase({ defId: 'b2', minions: [], ongoingActions: [] }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('ninja_way_of_deception: 只有一个基地时无法移动', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_way_of_deception', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m0', 'test', '0', 5)], ongoingActions: [] }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const moveEvents = events.filter(e => e.type === SU_EVENTS.MINION_MOVED);
        expect(moveEvents).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('ninja_disguise: 单个己方随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ninja_disguise', 'action', '0'),
                        makeCard('m_hand', 'ninja_master', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m0', 'test', '0', 2)], ongoingActions: [] }),
                makeBase({ defId: 'b2', minions: [], ongoingActions: [] }),
            ],
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        getSimpleChoicePrompt(matchState, 'ninja_disguise_choose_minions');
    });

    it('ninja_disguise: 没有己方随从时无事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'ninja_disguise', 'action', '0'),
                        makeCard('m_hand', 'ninja_master', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m1', 'test', '1', 3, { powerModifier: 0 })], ongoingActions: [] }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        const returnEvents = events.filter(e => e.type === SU_EVENTS.MINION_RETURNED);
        expect(returnEvents).toHaveLength(0);
        expectNoPrompt(matchState);
    });

    it('ninja_disguise: 有己方随从但手牌无随从时不创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'ninja_disguise', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [makeMinion('m0', 'test', '0', 2)], ongoingActions: [] }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expectNoPrompt(matchState);
        expect(events.filter(e => e.type === SU_EVENTS.MINION_RETURNED)).toHaveLength(0);
    });
});
