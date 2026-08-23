import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import type { SmashUpCore, SmashUpEvent } from '../../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    expectNoPrompt,
    getPromptMultiMin,
    getPromptOptions,
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
    respondToPromptOptions,
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

function execPlayMinionFromDiscard(state: SmashUpCore, playerId: string, cardUid: string, baseIndex: number) {
    const result = runCommand(
        makeMatchState(state),
        {
            type: SU_COMMANDS.PLAY_MINION,
            playerId,
            payload: { cardUid, baseIndex, fromDiscard: true },
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

    it('zombie_grave_digger: 选择弃牌堆随从后回手，选择跳过则不回手', () => {
        const recoverState = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'zombie_grave_digger', 'minion', '0')],
                    discard: [makeCard('d2', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const recovered = respondToPromptOption(
            execPlayMinion(recoverState, '0', 'm1', 0).matchState,
            option => option.value?.cardUid === 'd2',
            'grave digger discard minion option',
            '0',
            defaultTestRandom,
        );
        expect(recovered.success, recovered.error).toBe(true);
        expect(recovered.finalState.core.players['0'].hand.some(card => card.uid === 'd2')).toBe(true);
        expect(recovered.finalState.core.players['0'].discard.some(card => card.uid === 'd2')).toBe(false);

        const skipState = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m2', 'zombie_grave_digger', 'minion', '0')],
                    discard: [makeCard('d3', 'test_minion', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b2', minions: [], ongoingActions: [] })],
        });

        const skipped = respondToPromptOption(
            execPlayMinion(skipState, '0', 'm2', 0).matchState,
            option => option.value?.skip === true,
            'grave digger skip option',
            '0',
            defaultTestRandom,
        );
        expect(skipped.success, skipped.error).toBe(true);
        expect(skipped.finalState.core.players['0'].discard.some(card => card.uid === 'd3')).toBe(true);
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

    it('zombie_walker: 选择弃掉会把牌库顶送进弃牌堆，选择保留则牌库不变', () => {
        const discardState = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m1', 'zombie_walker', 'minion', '0')],
                    deck: [
                        makeCard('top1', 'pirate_first_mate', 'minion', '0'),
                        makeCard('top2', 'pirate_cannon', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const discarded = respondToPromptOption(
            execPlayMinion(discardState, '0', 'm1', 0).matchState,
            option => option.value?.action === 'discard',
            'walker discard option',
            '0',
            defaultTestRandom,
        );
        expect(discarded.success, discarded.error).toBe(true);
        expect(discarded.finalState.core.players['0'].discard.some(card => card.uid === 'top1')).toBe(true);
        expect(discarded.finalState.core.players['0'].deck.some(card => card.uid === 'top1')).toBe(false);

        const keepState = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('m2', 'zombie_walker', 'minion', '0')],
                    deck: [
                        makeCard('top3', 'pirate_first_mate', 'minion', '0'),
                        makeCard('top4', 'pirate_cannon', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b2', minions: [], ongoingActions: [] })],
        });

        const kept = respondToPromptOption(
            execPlayMinion(keepState, '0', 'm2', 0).matchState,
            option => option.value?.action === 'keep',
            'walker keep option',
            '0',
            defaultTestRandom,
        );
        expect(kept.success, kept.error).toBe(true);
        expect(kept.finalState.core.players['0'].deck.some(card => card.uid === 'top3')).toBe(true);
        expect(kept.finalState.core.players['0'].discard.some(card => card.uid === 'top3')).toBe(false);
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

    it('zombie_grave_robbing: 选择弃牌堆卡后应回手', () => {
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

        const resolved = respondToPromptOption(
            execPlayAction(state, '0', 'a1').matchState,
            option => option.value?.cardUid === 'd1',
            'grave robbing discard card option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'd1')).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'd1')).toBe(false);
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

    it('zombie_not_enough_bullets: 选择同名组后应回收全部同名随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_not_enough_bullets', 'action', '0')],
                    discard: [
                        makeCard('d1', 'zombie_walker', 'minion', '0'),
                        makeCard('d2', 'zombie_walker', 'minion', '0'),
                        makeCard('d3', 'zombie_grave_digger', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
        });

        const resolved = respondToPromptOption(
            execPlayAction(state, '0', 'a1').matchState,
            option => option.value?.defId === 'zombie_walker',
            'not enough bullets walker group option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].hand.filter(card => card.defId === 'zombie_walker')).toHaveLength(2);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'd3')).toBe(true);
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

    it('zombie_lend_a_hand: min=0 且无冗余 skip，空提交不改变弃牌堆', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_lend_a_hand', 'action', '0')],
                    discard: [makeCard('d2', 'card_b', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const played = execPlayAction(state, '0', 'a1').matchState;
        const prompt = getSimpleChoicePrompt(played, 'zombie_lend_a_hand');
        expect(getPromptMultiMin(prompt)).toBe(0);
        expect(getPromptOptions(prompt).some((option: any) => option.id === 'skip')).toBe(false);

        const empty = respondToPromptOptions(played, [], '0', defaultTestRandom);
        expect(empty.success, empty.error).toBe(true);
        expect(empty.finalState.core.players['0'].discard.some(card => card.uid === 'd2')).toBe(true);
    });

    it('zombie_lend_a_hand: 选择弃牌堆卡后应洗回牌库', () => {
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

        const resolved = respondToPromptOption(
            execPlayAction(state, '0', 'a1').matchState,
            option => option.value?.cardUid === 'd2',
            'lend a hand discard card option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].deck.some(card => card.uid === 'd2')).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'd2')).toBe(false);
    });

    it('zombie_lend_a_hand: 选择被他人拥有的弃牌时，仍应洗回其拥有者牌库', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'zombie_lend_a_hand', 'action', '0')],
                    deck: [makeCard('p0-deck-1', 'card_a', 'minion', '0')],
                    discard: [makeCard('borrowed-discard', 'card_b', 'minion', '1')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-1', 'card_c', 'minion', '1')],
                }),
            },
        });

        const resolved = respondToPromptOption(
            execPlayAction(state, '0', 'a1').matchState,
            option => option.value?.cardUid === 'borrowed-discard',
            'lend a hand borrowed discard option',
            '0',
            defaultTestRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                type: SU_EVENTS.DECK_REORDERED,
                payload: expect.objectContaining({
                    playerId: '1',
                    sourcePlayerId: '0',
                }),
            }),
        ]));
        expect(resolved.finalState.core.players['0'].discard.map(card => card.uid)).not.toContain('borrowed-discard');
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).not.toContain('borrowed-discard');
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toContain('borrowed-discard');
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
        expect(prompt.autoResolveIfSingle).toBe(false);

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

    it('zombie_outbreak: 只有一个空基地时仍创建选择 prompt，玩家确认后授予额度', () => {
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

        const { events, matchState } = execPlayAction(state, '0', 'a1');
        expect(events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED)).toHaveLength(0);
        const prompt = getSimpleChoicePrompt(matchState, 'zombie_outbreak_choose_base');
        expect(getPromptSourceId(prompt)).toBe('zombie_outbreak_choose_base');
        expect(prompt.autoResolveIfSingle).toBe(false);

        const resolved = respondToPromptOption(
            matchState,
            option => option.value?.baseIndex === 1,
            'zombie outbreak single empty base option',
            '0',
            defaultTestRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        const limitEvents = resolved.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
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

    it('zombie_lord: 选弃牌堆低力量随从后打出，并继续给出下一轮选择', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('lord1', 'zombie_lord', 'minion', '0')],
                    discard: [
                        makeCard('disc-w1', 'zombie_walker', 'minion', '0'),
                        makeCard('disc-tz1', 'zombie_tenacious_z', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [], ongoingActions: [] }),
                makeBase({ defId: 'b2', minions: [], ongoingActions: [] }),
                makeBase({ defId: 'b3', minions: [makeMinion('opp-1', 'pirate_first_mate', '1', 2, { powerModifier: 0 })], ongoingActions: [] }),
            ],
        });

        const played = execPlayMinion(state, '0', 'lord1', 2).matchState;
        const resolved = respondToPromptOption(
            played,
            option => option.value?.cardUid === 'disc-w1',
            'zombie lord discard walker option',
            '0',
            defaultTestRandom,
        );
        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'disc-w1')).toBe(false);
        expect(resolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'disc-w1')).toBe(true);
        getSimpleChoicePrompt(resolved.finalState, 'zombie_lord_pick');
    });

    it('zombie_lord: 选择完成时直接结束；无合格随从时不触发 Prompt', () => {
        const doneState = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('lord1', 'zombie_lord', 'minion', '0')],
                    discard: [makeCard('disc-w1', 'zombie_walker', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({ defId: 'b1', minions: [], ongoingActions: [] }),
                makeBase({ defId: 'b2', minions: [makeMinion('opp-1', 'pirate_first_mate', '1', 2, { powerModifier: 0 })], ongoingActions: [] }),
            ],
        });

        const donePlayed = execPlayMinion(doneState, '0', 'lord1', 1).matchState;
        const doneResolved = respondToPromptOption(
            donePlayed,
            option => option.value?.done === true,
            'zombie lord done option',
            '0',
            defaultTestRandom,
        );
        expect(doneResolved.success, doneResolved.error).toBe(true);
        expectNoPrompt(doneResolved.finalState);

        const noEligibleState = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('lord2', 'zombie_lord', 'minion', '0')],
                    discard: [makeCard('disc-gd1', 'zombie_grave_digger', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b3', minions: [], ongoingActions: [] })],
        });

        const noEligible = execPlayMinion(noEligibleState, '0', 'lord2', 0);
        expectNoPrompt(noEligible.matchState);
    });

    it('zombie_tenacious_z: 可从弃牌堆打出，且每回合限一次但不消耗正常随从额度', () => {
        const playState = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-m1', 'pirate_first_mate', 'minion', '0')],
                    discard: [makeCard('tz1', 'zombie_tenacious_z', 'minion', '0')],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    factions: ['zombies', 'pirates'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b1', minions: [], ongoingActions: [] })],
        });

        const fromDiscard = execPlayMinionFromDiscard(playState, '0', 'tz1', 0);
        expect(fromDiscard.matchState.core.players['0'].discard.some(card => card.uid === 'tz1')).toBe(false);
        expect(fromDiscard.matchState.core.bases[0].minions.some(minion => minion.uid === 'tz1')).toBe(true);
        expect(fromDiscard.matchState.core.players['0'].minionsPlayed).toBe(0);

        const normalPlay = runCommand(
            fromDiscard.matchState,
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'hand-m1', baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        expect(normalPlay.success, normalPlay.error).toBe(true);

        const onceState = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('tz2', 'zombie_tenacious_z', 'minion', '0'),
                        makeCard('tz3', 'zombie_tenacious_z', 'minion', '0'),
                    ],
                    usedDiscardPlayAbilities: ['zombie_tenacious_z'],
                    factions: ['zombies', 'pirates'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'b2', minions: [], ongoingActions: [] })],
        });

        const rejected = execPlayMinionFromDiscard(onceState, '0', 'tz2', 0);
        expect(rejected.matchState).toBeDefined();
        expect(rejected.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
    });

    it('zombie_theyre_coming_to_get_you: 只能打到附着基地，且会消耗正常随从额度', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('hand-m1', 'zombie_walker', 'minion', '0')],
                    discard: [
                        makeCard('disc-m1', 'pirate_first_mate', 'minion', '0'),
                        makeCard('disc-m2', 'zombie_walker', 'minion', '0'),
                    ],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    factions: ['zombies', 'pirates'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [],
                    ongoingActions: [{ uid: 'ongoing1', defId: 'zombie_theyre_coming_to_get_you', ownerId: '0' }],
                }),
                makeBase({ defId: 'b2', minions: [], ongoingActions: [] }),
            ],
        });

        const valid = execPlayMinionFromDiscard(state, '0', 'disc-m1', 0);
        expect(valid.matchState.core.players['0'].discard.some(card => card.uid === 'disc-m1')).toBe(false);
        expect(valid.matchState.core.bases[0].minions.some(minion => minion.uid === 'disc-m1')).toBe(true);
        expect(valid.matchState.core.players['0'].minionsPlayed).toBe(1);

        const second = execPlayMinionFromDiscard(valid.matchState.core, '0', 'disc-m2', 0);
        expect(second.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);

        const nonOngoing = execPlayMinionFromDiscard(state, '0', 'disc-m2', 1);
        expect(nonOngoing.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
    });

    it('zombie_theyre_coming_to_get_you: 母星授予力量≤2的额外随从额度时，不得从弃牌堆打出高战力随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('disc-big', 'alien_invader', 'minion', '0'),
                        makeCard('disc-small', 'zombie_walker', 'minion', '0'),
                    ],
                    minionsPlayed: 1,
                    minionLimit: 2,
                    extraMinionPowerMax: 2,
                    extraMinionPowerCaps: [2],
                    factions: ['zombies', 'aliens'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [{ uid: 'ongoing1', defId: 'zombie_theyre_coming_to_get_you', ownerId: '0' }],
                }),
            ],
        });

        const rejected = execPlayMinionFromDiscard(state, '0', 'disc-big', 0);
        expect(rejected.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
        expect(rejected.matchState.core.players['0'].discard.some(card => card.uid === 'disc-big')).toBe(true);

        const allowed = execPlayMinionFromDiscard(state, '0', 'disc-small', 0);
        expect(allowed.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(true);
        expect(allowed.matchState.core.players['0'].discard.some(card => card.uid === 'disc-small')).toBe(false);
        expect(allowed.matchState.core.bases[0].minions.some(minion => minion.uid === 'disc-small')).toBe(true);
    });

    it('zombie_theyre_coming_to_get_you: 普通额外额度与母星力量受限额度并存时，仍不得从弃牌堆打出高战力随从', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('disc-big', 'alien_invader', 'minion', '0'),
                        makeCard('disc-small', 'zombie_walker', 'minion', '0'),
                    ],
                    minionsPlayed: 1,
                    minionLimit: 4,
                    extraMinionPowerMax: 2,
                    extraMinionPowerCaps: [2, 2],
                    factions: ['zombies', 'aliens'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_the_homeworld',
                    minions: [],
                    ongoingActions: [{ uid: 'ongoing1', defId: 'zombie_theyre_coming_to_get_you', ownerId: '0' }],
                }),
            ],
        });

        const rejected = execPlayMinionFromDiscard(state, '0', 'disc-big', 0);
        expect(rejected.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
        expect(rejected.matchState.core.players['0'].discard.some(card => card.uid === 'disc-big')).toBe(true);

        const allowed = execPlayMinionFromDiscard(state, '0', 'disc-small', 0);
        expect(allowed.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(true);
        expect(allowed.matchState.core.players['0'].discard.some(card => card.uid === 'disc-small')).toBe(false);
        expect(allowed.matchState.core.bases[0].minions.some(minion => minion.uid === 'disc-small')).toBe(true);
    });

    it('borrowed ongoing 附着基地时，控制者也应能通过 PLAY_MINION fromDiscard 打到该基地', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    discard: [
                        makeCard('borrowed-disc-m1', 'pirate_first_mate', 'minion', '0'),
                        makeCard('borrowed-disc-m2', 'zombie_walker', 'minion', '0'),
                    ],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    factions: ['zombies', 'pirates'] as [string, string],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [],
                    ongoingActions: [{
                        uid: 'borrowed-ongoing-1',
                        defId: 'zombie_theyre_coming_to_get_you',
                        ownerId: '1',
                        metadata: {
                            sourcePlayerId: '0',
                            sourceControllerId: '0',
                        },
                    } as any],
                }),
                makeBase({ defId: 'b2', minions: [], ongoingActions: [] }),
            ],
        });

        const valid = execPlayMinionFromDiscard(state, '0', 'borrowed-disc-m1', 0);
        expect(valid.matchState.core.players['0'].discard.some(card => card.uid === 'borrowed-disc-m1')).toBe(false);
        expect(valid.matchState.core.bases[0].minions.some(minion => minion.uid === 'borrowed-disc-m1')).toBe(true);
        expect(valid.matchState.core.players['0'].minionsPlayed).toBe(1);

        const second = execPlayMinionFromDiscard(valid.matchState.core, '0', 'borrowed-disc-m2', 0);
        expect(second.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);

        const nonOngoing = execPlayMinionFromDiscard(state, '0', 'borrowed-disc-m2', 1);
        expect(nonOngoing.events.some(event => event.type === SU_EVENTS.MINION_PLAYED)).toBe(false);
    });

    it('zombie_overrun: 其他玩家不能打到附着基地；onTurnStart 自收口时不应弹排序 Prompt', () => {
        const blockState = makeState({
            players: {
                '0': makePlayer('0', { factions: ['zombies', 'pirates'] as [string, string] }),
                '1': makePlayer('1', {
                    hand: [makeCard('m1', 'pirate_first_mate', 'minion', '1')],
                }),
            },
            bases: [
                makeBase({
                    defId: 'b1',
                    minions: [],
                    ongoingActions: [{ uid: 'overrun1', defId: 'zombie_overrun', ownerId: '0' }],
                }),
                makeBase({ defId: 'b2', minions: [], ongoingActions: [] }),
            ],
            currentPlayerIndex: 1,
        });

        const blocked = runCommand(
            makeMatchState(blockState),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '1', payload: { cardUid: 'm1', baseIndex: 0 } } as any,
            defaultTestRandom,
        );
        expect(blocked.success).toBe(false);

        const allowed = runCommand(
            makeMatchState(blockState),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '1', payload: { cardUid: 'm1', baseIndex: 1 } } as any,
            defaultTestRandom,
        );
        expect(allowed.success, allowed.error).toBe(true);

        const reactionCore = makeState({
            players: {
                '0': makePlayer('0', { factions: ['zombies', 'mermaids'] as [string, string] }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'b3',
                    minions: [],
                    ongoingActions: [{ uid: 'overrun2', defId: 'zombie_overrun', ownerId: '0' }],
                }),
                makeBase({
                    defId: 'b4',
                    minions: [],
                    ongoingActions: [{ uid: 'desert1', defId: 'mermaids_desert_island', ownerId: '0' }],
                }),
            ],
            currentPlayerIndex: 0,
        });

        const queued = collectTriggers(reactionCore, 'onTurnStart', {
            state: reactionCore,
            matchState: makeMatchState(reactionCore),
            playerId: '0',
            random: defaultTestRandom,
            now: 1,
        });
        expect(queued).toBeDefined();

        const queuedState = makeMatchState({ ...reactionCore, triggerQueue: (queued as any).payload.triggers });
        const resolved = maybeResolveReactionQueue(queuedState, defaultTestRandom, 1);
        expect(resolved).toBeDefined();
        expectNoPrompt(resolved!.state);
        expect(resolved!.events.filter((event: any) => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toHaveLength(2);
        expect(resolved!.state.core.triggerQueue ?? []).toHaveLength(0);
        expect(resolved!.state.core.bases[0].ongoingActions.some(action => action.uid === 'overrun2')).toBe(false);
        expect(resolved!.state.core.bases[1].ongoingActions.some(action => action.uid === 'desert1')).toBe(false);
    });
});
