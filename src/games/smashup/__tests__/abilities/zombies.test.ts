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
    getPromptHandlerData,
    getPromptSourceId,
    getPromptTargetType,
    getSimpleChoicePrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
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

function execPlayMinion(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_MINION,
            playerId,
            payload: { cardUid, baseIndex },
        } as any,
        defaultTestRandom,
    );
    return { events: result.events as SmashUpEvent[], matchState: result.finalState };
}

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

describe('僵尸派系能力', () => {
    it('zombie_grave_digger: 单张随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'zombie_grave_digger', 'minion', '0')],
                    discard: [
                        makeCard('d1', 'test_action', 'action', '0'),
                        makeCard('d2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { matchState } = execPlayMinion(state, '0', 'm1', 0);
        const prompt = getSimpleChoicePrompt(matchState, 'zombie_grave_digger');
        expect(getPromptSourceId(prompt)).toBe('zombie_grave_digger');
    });

    it('zombie_grave_digger: 弃牌堆无随从时不产生事件', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'zombie_grave_digger', 'minion', '0')],
                    discard: [makeCard('d1', 'test_action', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { events } = execPlayMinion(state, '0', 'm1', 0);
        expect(events.filter(event => event.type === SU_EVENTS.CARD_RECOVERED_FROM_DISCARD)).toHaveLength(0);
    });

    it('zombie_walker: 创建 Prompt 选择弃掉或保留', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'zombie_walker', 'minion', '0')],
                    deck: [
                        makeCard('d1', 'top_card', 'minion', '0'),
                        makeCard('d2', 'second', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const { matchState } = execPlayMinion(state, '0', 'm1', 0);
        const prompt = getSimpleChoicePrompt(matchState, 'zombie_walker');
        expect(getPromptTargetType(prompt)).toBe('button');
        expect(getPromptHandlerData(prompt)?.displayCard).toEqual({ defId: 'top_card', cardUid: 'd1' });
    });

    it('zombie_grave_robbing: 多张弃牌时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_grave_robbing', 'action', '0')],
                    discard: [
                        makeCard('d1', 'test_action', 'action', '0'),
                        makeCard('d2', 'test_minion', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'zombie_grave_robbing');
        expect(getPromptSourceId(prompt)).toBe('zombie_grave_robbing');
    });

    it('zombie_grave_robbing: 单张弃牌时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_grave_robbing', 'action', '0')],
                    discard: [makeCard('d1', 'test_action', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'zombie_grave_robbing');
        expect(getPromptSourceId(prompt)).toBe('zombie_grave_robbing');
    });

    it('zombie_not_enough_bullets: 多组同名随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_not_enough_bullets', 'action', '0')],
                    discard: [
                        makeCard('d1', 'zombie_walker', 'minion', '0'),
                        makeCard('d2', 'zombie_walker', 'minion', '0'),
                        makeCard('d3', 'zombie_grave_digger', 'minion', '0'),
                        makeCard('d4', 'zombie_walker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'zombie_not_enough_bullets');
        expect(getPromptSourceId(prompt)).toBe('zombie_not_enough_bullets');
    });

    it('zombie_not_enough_bullets: 单组同名随从时创建 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_not_enough_bullets', 'action', '0')],
                    discard: [
                        makeCard('d1', 'zombie_walker', 'minion', '0'),
                        makeCard('d2', 'zombie_walker', 'minion', '0'),
                        makeCard('d4', 'zombie_walker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'zombie_not_enough_bullets');
        expect(getPromptSourceId(prompt)).toBe('zombie_not_enough_bullets');
    });

    it('zombie_lend_a_hand: 弃牌堆有卡时创建多选 Prompt', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_lend_a_hand', 'action', '0')],
                    deck: [makeCard('d1', 'card_a', 'minion', '0')],
                    discard: [
                        makeCard('d2', 'card_b', 'minion', '0'),
                        makeCard('d3', 'card_c', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'zombie_lend_a_hand');
        expect(getPromptSourceId(prompt)).toBe('zombie_lend_a_hand');
    });

    it('zombie_outbreak: 多个空基地时选择基地后直接授予额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'zombie_outbreak', 'action', '0'),
                        makeCard('m2', 'zombie_walker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m0', 'test', '0', 3, { powerModifier: 0 })],
                    ongoingActions: [],
                }),
                makeBase({ defId: 'b2', minions: [], ongoingActions: [] }),
                makeBase({ defId: 'b3', minions: [], ongoingActions: [] }),
            ],
        });

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(0);
        const prompt = getSimpleChoicePrompt(matchState, 'zombie_outbreak_choose_base');
        expect(getPromptSourceId(prompt)).toBe('zombie_outbreak_choose_base');

        const resolved = respondToPromptOption(
            matchState,
            option => option.value?.baseIndex === 1,
            'zombie outbreak base 1 option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        const granted = resolved.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(granted).toHaveLength(1);
        expect((granted[0] as any).payload.limitType).toBe('minion');
        expect((granted[0] as any).payload.restrictToBase).toBe(1);
    });

    it('zombie_outbreak: 只有一个空基地时直接授予额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('a1', 'zombie_outbreak', 'action', '0'),
                        makeCard('m2', 'zombie_walker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m0', 'test', '0', 3, { powerModifier: 0 })],
                    ongoingActions: [],
                }),
                makeBase({ defId: 'b2', minions: [], ongoingActions: [] }),
            ],
        });

        const { events } = execPlayAction(state, '0', 'a1');
        const limitEvents = events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(1);
        expect((limitEvents[0] as any).payload.limitType).toBe('minion');
        expect((limitEvents[0] as any).payload.restrictToBase).toBe(1);
    });

    it('zombie_outbreak: 所有基地都有己方随从时不给额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_outbreak', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [makeMinion('m0', 'test', '0', 3, { powerModifier: 0 })],
                    ongoingActions: [],
                }),
            ],
        });

        const { events } = execPlayAction(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(0);
    });

    it('zombie_mall_crawl: 多组不同卡名时创建 Prompt 选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_mall_crawl', 'action', '0')],
                    deck: [
                        makeCard('d1', 'zombie_walker', 'minion', '0'),
                        makeCard('d2', 'zombie_grave_digger', 'minion', '0'),
                        makeCard('d3', 'zombie_walker', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'zombie_mall_crawl');
        expect(getPromptSourceId(prompt)).toBe('zombie_mall_crawl');
    });

    it('zombie_mall_crawl: 选择卡名后同名卡进入弃牌堆，牌库重洗', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_mall_crawl', 'action', '0')],
                    deck: [
                        makeCard('d1', 'zombie_walker', 'minion', '0'),
                        makeCard('d2', 'zombie_grave_digger', 'minion', '0'),
                        makeCard('d3', 'zombie_walker', 'minion', '0'),
                        makeCard('d4', 'test_card', 'action', '0'),
                    ],
                    discard: [
                        makeCard('a1', 'zombie_mall_crawl', 'action', '0'),
                        makeCard('x1', 'old_discard', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const { matchState } = execPlayAction(state, '0', 'a1');
        const prompt = getSimpleChoicePrompt(matchState, 'zombie_mall_crawl');
        expect(getPromptSourceId(prompt)).toBe('zombie_mall_crawl');

        const result = respondToPromptOption(
            matchState,
            option => option.value?.defId === 'zombie_walker',
            'zombie mall crawl zombie_walker option',
            '0',
            defaultTestRandom,
        );
        expect(result.success, result.error).toBe(true);

        const finalState = result.finalState.core;
        const discardUids = finalState.players['0'].discard.map(card => card.uid);
        expect(discardUids).toContain('d1');
        expect(discardUids).toContain('d3');
        expect(discardUids).toContain('a1');
        expect(discardUids).toContain('x1');

        expect(result.events.some(event => event.type === SU_EVENTS.DECK_REORDERED)).toBe(true);
        expect(result.events.some(event => event.type === SU_EVENTS.DECK_RESHUFFLED)).toBe(false);

        const deckUids = finalState.players['0'].deck.map(card => card.uid);
        expect(deckUids).toContain('d2');
        expect(deckUids).toContain('d4');
        expect(finalState.players['0'].deck.filter(card => card.defId === 'zombie_walker')).toHaveLength(0);

        const totalCards = finalState.players['0'].deck.length
            + finalState.players['0'].discard.length
            + finalState.players['0'].hand.length;
        expect(totalCards).toBe(7);
    });
});
