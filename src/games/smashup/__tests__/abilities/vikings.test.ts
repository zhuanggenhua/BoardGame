import { describe, it, expect, beforeAll } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, collectTriggers } from '../../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../../domain/reactionQueue';
import { reduce } from '../../domain/reducer';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import {
    getPromptOption,
    getSimpleChoicePrompt,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPrompt,
} from '../helpers';
import { defaultTestRandom, runCommand } from '../testRunner';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('Vikings abilities', () => {
    it('vikings_viking_funeral 在宿主进入弃牌堆后仍会通过 queued discard trigger 结算 VP 与移出游戏', () => {
        const preDiscardCore = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('host-1', 'samurai_bushi', '0', 4, {
                        attachedActions: [{ uid: 'funeral-1', defId: 'vikings_viking_funeral', ownerId: '0' }] as any,
                    }),
                ],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(preDiscardCore, 'onMinionDiscardedFromBase', {
            state: preDiscardCore,
            matchState: makeMatchState(preDiscardCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: preDiscardCore.bases[0].minions[0],
            triggerMinionUid: 'host-1',
            triggerMinionDefId: 'samurai_bushi',
            random: defaultTestRandom,
            now: 1000,
        });

        expect(queued).toBeDefined();

        const queuedCore = makeState({
            players: preDiscardCore.players,
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
            }],
            triggerQueue: (queued as any).payload.triggers,
        });

        const resolved = maybeResolveReactionQueue(makeMatchState(queuedCore), defaultTestRandom, 1000);
        expect(resolved).toBeDefined();
        expect(resolved!.events.some(event =>
            event.type === SU_EVENTS.VP_AWARDED
            && (event as any).payload.playerId === '0'
            && (event as any).payload.reason === 'vikings_viking_funeral',
        )).toBe(true);
        expect(resolved!.events.some(event =>
            event.type === SU_EVENTS.CARD_REMOVED_FROM_GAME
            && (event as any).payload.cardUid === 'host-1'
            && (event as any).payload.reason === 'vikings_viking_funeral',
        )).toBe(true);
    });

    it('vikings_viking_funeral 的 borrowed 宿主被自己控制时仍应移出其拥有者弃牌堆', () => {
        const preDiscardCore = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('borrowed-host', 'samurai_bushi', '0', 4, {
                        owner: '1',
                        attachedActions: [{ uid: 'funeral-borrowed', defId: 'vikings_viking_funeral', ownerId: '0' }] as any,
                    }),
                ],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(preDiscardCore, 'onMinionDiscardedFromBase', {
            state: preDiscardCore,
            matchState: makeMatchState(preDiscardCore),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: preDiscardCore.bases[0].minions[0],
            triggerMinionUid: 'borrowed-host',
            triggerMinionDefId: 'samurai_bushi',
            random: defaultTestRandom,
            now: 1001,
        });

        expect(queued).toBeDefined();

        const queuedCore = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1', {
                    discard: [makeCard('borrowed-host', 'samurai_bushi', 'minion', '1')],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
            }],
            triggerQueue: (queued as any).payload.triggers,
        });

        const resolved = maybeResolveReactionQueue(makeMatchState(queuedCore), defaultTestRandom, 1001);
        expect(resolved).toBeDefined();
        expect(resolved!.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.VP_AWARDED,
            payload: expect.objectContaining({
                playerId: '0',
                reason: 'vikings_viking_funeral',
            }),
        }));
        expect(resolved!.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_REMOVED_FROM_GAME,
            payload: expect.objectContaining({
                cardUid: 'borrowed-host',
                playerId: '1',
                reason: 'vikings_viking_funeral',
            }),
        }));

        const finalCore = resolved!.events.reduce((acc, event) => reduce(acc, event), queuedCore);
        expect(finalCore.players['1'].discard.some(card => card.uid === 'borrowed-host')).toBe(false);
        expect(finalCore.players['1'].removedFromGame.some(card => card.uid === 'borrowed-host')).toBe(true);
    });

    it('vikings_cast_the_runes_order 排序 borrowed 揭示牌时应回到其拥有者牌库', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('cast-runes-1', 'vikings_cast_the_runes', 'action', '0')],
                    deck: [makeCard('p0-rest', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('own-top', 'wizard_neophyte', 'minion', '1'),
                        makeCard('borrowed-top', 'pirate_first_mate', 'minion', '0'),
                        makeCard('rest-1', 'zombie_walker', 'minion', '1'),
                    ],
                }),
            },
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'cast-runes-1' },
            } as any,
            defaultTestRandom,
        );

        const playerPrompt = getSimpleChoicePrompt(played.finalState, 'vikings_cast_the_runes_player');
        const chooseP1 = getPromptOption(playerPrompt, option => option.value?.targetPlayerId === '1', 'target player 1 option');
        const afterPlayerChoice = respondToPrompt(played.finalState, chooseP1.id, '0', defaultTestRandom);

        const orderPrompt = getSimpleChoicePrompt(afterPlayerChoice.finalState, 'vikings_cast_the_runes_order');
        const chooseOwnTop = getPromptOption(orderPrompt, option => option.value?.topCardUid === 'own-top', 'own top card option');
        const resolved = respondToPrompt(afterPlayerChoice.finalState, chooseOwnTop.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['own-top', 'rest-1']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['borrowed-top', 'p0-rest']);
    });
});
