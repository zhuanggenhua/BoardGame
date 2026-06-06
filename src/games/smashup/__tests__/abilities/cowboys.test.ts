import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { defaultTestRandom } from '../testRunner';
import {
    expectNoPrompt,
    getPromptOption,
    getSimpleChoicePrompt,
    getReactionPrompt,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
    respondToPromptOption,
    respondToPromptOptions,
} from '../helpers';
import { runCommand } from '../testRunner';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('Cowboys queued source-controller runtime context', () => {
    it('cowboys_sheriff 在对手计分前仍应把 queued beforeScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('cowboy-sheriff-1', 'cowboys_sheriff', '1', 4),
                        makeMinion('enemy-1', 'robot_microbot_alpha', '0', 2),
                    ],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 4301,
        });

        expect(queued).toBeDefined();
        const sheriffTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'cowboy-sheriff-1');
        expect(sheriffTrigger).toBeDefined();
        expect(sheriffTrigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            defaultTestRandom,
            4301,
        );
        expect(queuedState).toBeDefined();
        expect(getReactionPrompt(queuedState!.state)?.playerId).toBe('1');
    });

    it('cowboys_sheriff_pod 在对手计分前仍应把 queued beforeScoring 选择权交给随从控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [
                        makeMinion('cowboy-sheriff-pod-1', 'cowboys_sheriff_pod', '1', 4),
                        makeMinion('enemy-pod-1', 'robot_microbot_alpha', '0', 2),
                    ],
                    ongoingActions: [],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const queued = collectTriggers(core, 'beforeScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 1 }],
            random: defaultTestRandom,
            now: 4302,
        });

        expect(queued).toBeDefined();
        const sheriffTrigger = (queued as any).payload.triggers.find((trigger: any) => trigger.sourceCardUid === 'cowboy-sheriff-pod-1');
        expect(sheriffTrigger).toBeDefined();
        expect(sheriffTrigger.ownerPlayerId).toBe('1');
    });

    it('cowboys_stagecoach 应按控制者而不是真实 owner 搬运基地上的 borrowed 持续行动', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('stagecoach-1', 'cowboys_stagecoach', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase({
                    defId: 'base_a',
                    minions: [],
                    ongoingActions: [{
                        uid: 'gold-1',
                        defId: 'cowboys_gold_strike',
                        ownerId: '1',
                        talentUsed: false,
                        metadata: {
                            sourcePlayerId: '0',
                            sourceControllerId: '0',
                        },
                    } as any],
                }),
                makeBase({
                    defId: 'base_b',
                    minions: [],
                    ongoingActions: [],
                }),
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'stagecoach-1' } },
            defaultTestRandom,
        );

        const sourcePrompt = getSimpleChoicePrompt(played.finalState, 'cowboys_stagecoach_source');
        const sourceBase = getPromptOption(sourcePrompt, option => option.value?.baseIndex === 0, 'source base option');
        const sourceResolved = respondToPrompt(played.finalState, sourceBase.id, '0', defaultTestRandom);

        const cardsPrompt = getSimpleChoicePrompt(sourceResolved.finalState, 'cowboys_stagecoach_cards');
        const ongoingOption = getPromptOption(cardsPrompt, option => option.value?.uid === 'gold-1', 'borrowed ongoing option');
        const cardsResolved = respondToPromptOptions(sourceResolved.finalState, [ongoingOption.id], '0', defaultTestRandom);

        const destinationPrompt = getSimpleChoicePrompt(cardsResolved.finalState, 'cowboys_stagecoach_destination');
        const targetBase = getPromptOption(destinationPrompt, option => option.value?.baseIndex === 1, 'destination base option');
        const resolved = respondToPrompt(cardsResolved.finalState, targetBase.id, '0', defaultTestRandom);

        expectNoPrompt(resolved.finalState);
        expect(resolved.finalState.core.bases[0].ongoingActions.find(action => action.uid === 'gold-1')).toBeUndefined();
        const moved = resolved.finalState.core.bases[1].ongoingActions.find(action => action.uid === 'gold-1');
        expect(moved).toBeDefined();
        expect(moved?.ownerId).toBe('1');
        expect(moved?.metadata?.sourcePlayerId).toBe('0');
        expect(moved?.metadata?.sourceControllerId).toBe('0');
    });

    it('cowboys_gold_in_them_thar_hills 未选中的 borrowed 揭示牌应回到拥有者牌库而不是当前玩家牌库', () => {
        const reverseRandom = {
            shuffle: <T,>(items: T[]) => [...items].reverse(),
            random: () => 0.5,
            d: () => 1,
            range: (min: number) => min,
        };
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('gold-1', 'cowboys_gold_in_them_thar_hills', 'action', '0')],
                    deck: [
                        makeCard('borrowed-top-a', 'ghosts_spectre', 'minion', '1'),
                        makeCard('top-b', 'sharks_mako', 'minion', '0'),
                        makeCard('top-c', 'sharks_great_white', 'minion', '0'),
                        makeCard('rest-1', 'pirate_first_mate', 'minion', '0'),
                    ],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-a', 'ghosts_apparition', 'minion', '1')],
                }),
            },
            bases: [makeBase({ defId: 'base_a', minions: [], ongoingActions: [] })],
        });

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'gold-1' },
        } as any, reverseRandom);
        expect(played.success).toBe(true);

        const choseCard = respondToPromptOption(
            played.finalState,
            option => option.value?.cardUid === 'top-b',
            'gold chosen card',
            '0',
            reverseRandom,
        );
        const orderedRemaining = respondToPromptOption(
            choseCard.finalState,
            option => option.value?.topCardUid === 'top-c',
            'gold remaining top card order',
            '0',
            reverseRandom,
        );
        expectNoPrompt(orderedRemaining.finalState);
        expect(orderedRemaining.finalState.core.players['0'].hand.map(card => card.uid)).toContain('top-b');
        expect(orderedRemaining.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['top-c', 'rest-1']);
        expect(orderedRemaining.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['borrowed-top-a', 'p1-deck-a']);

        expect(orderedRemaining.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({
                playerId: '1',
                sourcePlayerId: '0',
                deckUids: ['borrowed-top-a', 'p1-deck-a'],
            }),
        }));
    });
});
