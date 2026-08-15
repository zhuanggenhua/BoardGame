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
    it('线上反馈 6a36cbe60bd730b192833d8e：vikings_ransack 选择附着行动时不应抛出 state is not defined', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('r1', 'vikings_ransack', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [
                    makeMinion('enemy-1', 'frankenstein_the_monster', '1', 4, {
                        attachedActions: [{ uid: 'attach-1', defId: 'frankenstein_uberserum', ownerId: '1' }] as any,
                    }),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'r1' } } as any,
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(played.finalState, 'vikings_ransack');
        const attachedOption = getPromptOption(prompt, option => option.value?.cardUid === 'attach-1', 'vikings ransack attached ongoing');
        const resolved = respondToPrompt(played.finalState, attachedOption.id, '0', defaultTestRandom);

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TRANSFERRED,
            payload: expect.objectContaining({
                cardUid: 'attach-1',
                defId: 'frankenstein_uberserum',
                toPlayerId: '0',
                reason: 'vikings_ransack',
            }),
        }));
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'attach-1')).toBe(true);
    });

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

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.DECK_REORDERED,
            payload: expect.objectContaining({
                playerId: '0',
                sourcePlayerId: '1',
            }),
        }));
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['own-top', 'rest-1']);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['borrowed-top', 'p0-rest']);
    });

    it('vikings_huscarl 选择被他人拥有的手牌时，仍应进入其拥有者牌库顶而不是当前玩家牌库顶', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('borrowed-1', 'pirate_first_mate', 'minion', '1')],
                    deck: [makeCard('p0-deck-1', 'robot_microbot_alpha', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [makeCard('p1-deck-1', 'wizard_archmage', 'minion', '1')],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('huscarl-1', 'vikings_huscarl', '0', 4)],
                ongoingActions: [],
            }],
        });

        const used = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.USE_TALENT, playerId: '0', payload: { minionUid: 'huscarl-1', baseIndex: 0 } } as any,
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(used.finalState, 'vikings_huscarl');
        const borrowedOption = getPromptOption(prompt, option => option.value?.cardUid === 'borrowed-1', 'borrowed hand option');
        const resolved = respondToPrompt(used.finalState, borrowedOption.id, '0', defaultTestRandom);

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TO_DECK_TOP,
            payload: expect.objectContaining({
                cardUid: 'borrowed-1',
                ownerId: '1',
                sourcePlayerId: '0',
                reason: 'vikings_huscarl',
            }),
        }));
        expect(resolved.finalState.core.players['0'].hand.some(card => card.uid === 'borrowed-1')).toBe(false);
        expect(resolved.finalState.core.players['0'].deck.map(card => card.uid)).toEqual(['p0-deck-1']);
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['borrowed-1', 'p1-deck-1']);
    });

    it('vikings_pillage 从他人手里拿到第三方拥有的牌时，应显式保留真实 ownerId', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('pillage-1', 'vikings_pillage', 'action', '0')],
                }),
                '1': makePlayer('1'),
                '2': makePlayer('2', {
                    hand: [makeCard('borrowed-action', 'wizard_summon', 'action', '1')],
                }),
            },
            turnOrder: ['0', '1', '2'],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'pillage-1' },
            } as any,
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(played.finalState, 'vikings_pillage');
        const targetOption = getPromptOption(prompt, option => option.value?.targetPlayerId === '2', 'target player 2 option');
        const resolved = respondToPrompt(played.finalState, targetOption.id, '0', {
            ...defaultTestRandom,
            shuffle: items => [...items],
        });

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARD_TRANSFERRED,
            payload: expect.objectContaining({
                cardUid: 'borrowed-action',
                fromPlayerId: '2',
                toPlayerId: '0',
                ownerId: '1',
                reason: 'vikings_pillage',
            }),
        }));
        expect(resolved.finalState.core.players['0'].hand).toContainEqual(
            expect.objectContaining({ uid: 'borrowed-action', owner: '1' }),
        );
    });

    it('vikings_raiding_party 打出揭示随从时，应先正式转移再由 MINION_PLAYED 落地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('raiding-party-1', 'vikings_raiding_party', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('stolen-raptor', 'dino_war_raptor', 'minion', '1'),
                        makeCard('deck-rest', 'dino_armor_stego', 'minion', '1'),
                    ],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'raiding-party-1' },
            } as any,
            defaultTestRandom,
        );

        const playerPrompt = getSimpleChoicePrompt(played.finalState, 'vikings_raiding_party_player');
        const chooseP1 = getPromptOption(playerPrompt, option => option.value?.targetPlayerId === '1', 'target player 1 option');
        const afterPlayerChoice = respondToPrompt(played.finalState, chooseP1.id, '0', defaultTestRandom);

        const choicePrompt = getSimpleChoicePrompt(afterPlayerChoice.finalState, 'vikings_raiding_party_choice');
        const chooseRaptor = getPromptOption(choicePrompt, option => option.value?.cardUid === 'stolen-raptor', 'revealed raptor option');
        const resolved = respondToPrompt(afterPlayerChoice.finalState, chooseRaptor.id, '0', defaultTestRandom);

        const transferIndex = resolved.events.findIndex(event =>
            event.type === SU_EVENTS.CARD_TRANSFERRED
            && (event as any).payload.cardUid === 'stolen-raptor',
        );
        const reorderIndex = resolved.events.findIndex(event => event.type === SU_EVENTS.DECK_REORDERED);
        const playedIndex = resolved.events.findIndex(event =>
            event.type === SU_EVENTS.MINION_PLAYED
            && (event as any).payload.cardUid === 'stolen-raptor',
        );

        expect(transferIndex).toBeGreaterThanOrEqual(0);
        expect(reorderIndex).toBeGreaterThan(transferIndex);
        expect(playedIndex).toBeGreaterThan(reorderIndex);
        expect(resolved.events[playedIndex]).toEqual(expect.objectContaining({
            payload: expect.objectContaining({
                playerId: '0',
                ownerId: '1',
                baseIndex: 0,
                consumesNormalLimit: false,
            }),
        }));
        expect(resolved.finalState.core.bases[0].minions).toContainEqual(
            expect.objectContaining({ uid: 'stolen-raptor', owner: '1', controller: '0' }),
        );
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['deck-rest']);
    });

    it('vikings_raiding_party 打出揭示持续行动时，应由正式 ACTION_PLAYED 和 ONGOING_ATTACHED 落地', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('raiding-party-2', 'vikings_raiding_party', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    deck: [
                        makeCard('stolen-preserve', 'dino_wildlife_preserve', 'action', '1'),
                        makeCard('deck-rest-2', 'dino_armor_stego', 'minion', '1'),
                    ],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'raiding-party-2' },
            } as any,
            defaultTestRandom,
        );

        const playerPrompt = getSimpleChoicePrompt(played.finalState, 'vikings_raiding_party_player');
        const chooseP1 = getPromptOption(playerPrompt, option => option.value?.targetPlayerId === '1', 'target player 1 option');
        const afterPlayerChoice = respondToPrompt(played.finalState, chooseP1.id, '0', defaultTestRandom);

        const choicePrompt = getSimpleChoicePrompt(afterPlayerChoice.finalState, 'vikings_raiding_party_choice');
        const choosePreserve = getPromptOption(choicePrompt, option => option.value?.cardUid === 'stolen-preserve', 'revealed preserve option');
        const afterCardChoice = respondToPrompt(afterPlayerChoice.finalState, choosePreserve.id, '0', defaultTestRandom);

        const basePrompt = getSimpleChoicePrompt(afterCardChoice.finalState, 'vikings_raiding_party_action_base');
        const chooseBase = getPromptOption(basePrompt, option => option.value?.baseIndex === 0, 'target base option');
        const resolved = respondToPrompt(afterCardChoice.finalState, chooseBase.id, '0', defaultTestRandom);

        const transferIndex = resolved.events.findIndex(event =>
            event.type === SU_EVENTS.CARD_TRANSFERRED
            && (event as any).payload.cardUid === 'stolen-preserve',
        );
        const actionIndex = resolved.events.findIndex(event =>
            event.type === SU_EVENTS.ACTION_PLAYED
            && (event as any).payload.cardUid === 'stolen-preserve',
        );
        const attachIndex = resolved.events.findIndex(event =>
            event.type === SU_EVENTS.ONGOING_ATTACHED
            && (event as any).payload.cardUid === 'stolen-preserve',
        );

        expect(transferIndex).toBeGreaterThanOrEqual(0);
        expect(actionIndex).toBeGreaterThan(transferIndex);
        expect(attachIndex).toBeGreaterThan(actionIndex);
        expect(resolved.events[actionIndex]).toEqual(expect.objectContaining({
            payload: expect.objectContaining({
                playerId: '0',
                ownerId: '1',
                isExtraAction: true,
                targetBaseIndex: 0,
            }),
        }));
        expect(resolved.events[attachIndex]).toEqual(expect.objectContaining({
            payload: expect.objectContaining({
                ownerId: '1',
                sourcePlayerId: '0',
                targetBaseIndex: 0,
            }),
        }));
        expect(resolved.finalState.core.bases[0].ongoingActions).toContainEqual(
            expect.objectContaining({ uid: 'stolen-preserve', ownerId: '1' }),
        );
        expect(resolved.finalState.core.players['1'].deck.map(card => card.uid)).toEqual(['deck-rest-2']);
    });
});
