import { beforeAll, describe, expect, it } from 'vitest';
import { SU_COMMANDS, SU_EVENTS, MADNESS_CARD_DEF_ID } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { makeCard, makeMatchState, makeMinion, makePlayer, makeState, getInteractionsFromMS } from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import { getEffectivePower } from '../domain/ongoingModifiers';
import { getTriggerExecutor } from '../domain/triggerExecutors';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('elder_things_pod: Elder Thing POD', () => {
    it('if cannot destroy two other minions, must go to deck bottom', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('c1', 'elder_thing_elder_thing_pod', 'minion', '0')] }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });
        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'c1', baseIndex: 0 } },
            defaultTestRandom,
        );
        const prompt: any = getInteractionsFromMS(play.finalState)[0]?.data;
        expect(prompt?.sourceId).toBe('elder_thing_elder_thing_pod_mode');
        const destroyOpt = prompt.options.find((o: any) => o.id === 'destroy');
        expect(destroyOpt?.disabled).toBe(true);
    });
});

describe('elder_things_pod: Unfathomable Goals POD', () => {
    it('extra thresholds from revealed madness snapshot', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'elder_thing_unfathomable_goals_pod', 'action', '0')] }),
                '1': makePlayer('1', { hand: [makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '1'), makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '1')] }),
                '2': makePlayer('2', { hand: [makeCard('m3', MADNESS_CARD_DEF_ID, 'action', '2'), makeCard('m4', MADNESS_CARD_DEF_ID, 'action', '2')] }),
            },
            turnOrder: ['0', '1', '2'],
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
            madnessDeck: [],
        });
        const res = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );
        const types = res.events.map(e => e.type);
        // Expect both extra minion and extra action limits granted.
        const limits = res.events.filter(e => e.type === SU_EVENTS.LIMIT_MODIFIED) as any[];
        expect(limits.length).toBeGreaterThanOrEqual(2);
    });
});

describe('elder_things_pod: Insanity POD', () => {
    it('removes itself from game (in the box) after resolving', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [makeCard('a1', 'elder_thing_insanity_pod', 'action', '0')] }),
                '1': makePlayer('1'),
                '2': makePlayer('2'),
            },
            turnOrder: ['0', '1', '2'],
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
            madnessDeck: [
                makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '1'),
                makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '1'),
                makeCard('m3', MADNESS_CARD_DEF_ID, 'action', '2'),
                makeCard('m4', MADNESS_CARD_DEF_ID, 'action', '2'),
            ],
        });
        const res = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );
        const finalP0 = res.finalState.core.players['0'];
        expect(finalP0.discard.some(c => c.uid === 'a1')).toBe(false);
        expect((finalP0.removedFromGame ?? []).some(c => c.uid === 'a1')).toBe(true);
    });
});

describe('elder_things_pod: Mi-Go POD', () => {
    it('does not auto-draw Madness before opponent choice resolves', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('migo', 'elder_thing_mi_go_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
            madnessDeck: [makeCard('md1', MADNESS_CARD_DEF_ID, 'action', '1')],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'migo', baseIndex: 0 } },
            defaultTestRandom,
        );

        // onPlay 仅应创建对手选择，不应提前发放疯狂牌
        const prompt: any = getInteractionsFromMS(played.finalState)[0]?.data;
        expect(prompt?.sourceId).toBe('elder_thing_mi_go_pod');
        expect(played.events.some(e => e.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
        expect(played.finalState.core.players['1'].hand.some(c => c.defId === MADNESS_CARD_DEF_ID)).toBe(false);
    });
});

describe('elder_things_pod: Shoggoth POD', () => {
    it('still prompts opponent to choose madness draw even when target base has no opponent minions', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('sho', 'elder_thing_shoggoth_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sho', baseIndex: 0 } },
            defaultTestRandom,
        );

        const current = played.finalState.sys.interaction.current as any;
        expect(current?.data?.sourceId).toBe('elder_thing_shoggoth_pod');
        expect(current?.playerId).toBe('1');
    });

    it('can destroy an opponent minion with power greater than 6', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('sho', 'elder_thing_shoggoth_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('big1', 'zombie_king_rex', '1', 10)],
                    ongoingActions: [],
                },
            ],
            madnessDeck: [
                makeCard('md1', MADNESS_CARD_DEF_ID, 'action', '0'),
                makeCard('md2', MADNESS_CARD_DEF_ID, 'action', '0'),
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'sho', baseIndex: 0 } },
            defaultTestRandom,
        );
        const firstPrompt: any = getInteractionsFromMS(played.finalState)[0]?.data;
        expect(firstPrompt?.sourceId).toBe('elder_thing_shoggoth_pod');

        // 对手拒绝抽疯狂 -> 施法者应可选择消灭该对手此基地一个随从（不受力量6限制）
        const afterDecline = runCommand(
            played.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '1', payload: { optionId: 'no' } },
            defaultTestRandom,
        );
        const destroyPrompt: any = getInteractionsFromMS(afterDecline.finalState)[0]?.data;
        expect(destroyPrompt?.sourceId).toBe('elder_thing_shoggoth_pod_destroy');
        const optionIds = (destroyPrompt?.options ?? []).map((o: any) => o.value?.minionUid ?? o.value?.uid);
        expect(optionIds).toContain('big1');

        const targetOption = (destroyPrompt?.options ?? []).find((o: any) => (o.value?.minionUid ?? o.value?.uid) === 'big1');
        const destroyRes = runCommand(
            afterDecline.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: targetOption.id } },
            defaultTestRandom,
        );
        const destroyed = destroyRes.events.find(e => e.type === SU_EVENTS.MINION_DESTROYED) as any;
        expect(destroyed?.payload?.minionUid).toBe('big1');
    });
});

describe('elder_things_pod: Dunwich Horror POD', () => {
    it('does not add permanent power on play and only grants +5 ongoing power', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'elder_thing_dunwich_horror_pod', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [makeMinion('m1', 'robot_microbot', '0', 3)],
                    ongoingActions: [],
                },
            ],
        });
        const res = runCommand(
            makeMatchState(core),
            {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: '0',
                payload: { cardUid: 'a1', targetBaseIndex: 0, targetMinionUid: 'm1' },
            },
            defaultTestRandom,
        );

        expect(res.events.some(e => e.type === SU_EVENTS.PERMANENT_POWER_ADDED)).toBe(false);
        const minion = res.finalState.core.bases[0].minions.find(m => m.uid === 'm1');
        expect(minion).toBeTruthy();
        expect(getEffectivePower(res.finalState.core, minion!, 0)).toBe(8); // 3 + 5
    });

    it('does not inherit base version end-of-turn auto-destroy trigger', () => {
        const executor = getTriggerExecutor('onTurnEnd', 'elder_thing_dunwich_horror_pod');
        expect(executor).toBeDefined();

        const core = makeState({
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
            bases: [{ defId: 'base_a', minions: [makeMinion('m1', 'robot_microbot', '0', 3)], ongoingActions: [] }],
        });
        const out = executor!({ state: core, playerId: '0', now: 1, timing: 'onTurnEnd' } as any);
        const events = Array.isArray(out) ? out : out.events;
        expect(events.some(e => e.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });
});

describe('elder_things_pod: The Price of Power POD', () => {
    it('before scoring only checks players with minions there and grants +1 counters per Madness', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'elder_thing_the_price_of_power_pod', 'action', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('m1', MADNESS_CARD_DEF_ID, 'action', '1'),
                        makeCard('m2', MADNESS_CARD_DEF_ID, 'action', '1'),
                        makeCard('x1', 'robot_microbot', 'minion', '1'),
                    ],
                }),
                '2': makePlayer('2', {
                    hand: [makeCard('m3', MADNESS_CARD_DEF_ID, 'action', '2')],
                }),
            },
            turnOrder: ['0', '1', '2'],
            bases: [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        makeMinion('p0m1', 'robot_microbot', '0', 15),
                        makeMinion('p1m1', 'robot_microbot', '1', 15),
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_temple_of_goju', minions: [makeMinion('p0m2', 'robot_microbot', '0', 3)], ongoingActions: [] },
            ],
        });

        const ms = makeMatchState(core);
        (ms.sys as any).phase = 'scoreBases';
        (ms.sys as any).responseWindow = {
            current: {
                id: 'rw1',
                windowType: 'meFirst',
                sourceId: 'test',
                responderQueue: ['0'],
                currentResponderIndex: 0,
                passedPlayers: [],
            },
        };

        const res = runCommand(
            ms,
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1', targetBaseIndex: 0 } },
            defaultTestRandom,
        );

        const revealEvt: any = res.events.find(e => e.type === SU_EVENTS.REVEAL_HAND);
        expect(revealEvt).toBeTruthy();
        expect(revealEvt.payload.targetPlayerId).toBe('1');

        const counters = res.events.filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED) as any[];
        expect(counters.length).toBe(2);
        expect(counters.every(e => e.payload.amount === 1)).toBe(true);
        expect(counters.every(e => e.payload.reason === 'elder_thing_the_price_of_power_pod')).toBe(true);
    });
});

describe('elder_things_pod: Spreading Horror POD', () => {
    it('decliner does not force the caster to play from discard', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('a1', 'elder_thing_spreading_horror_pod', 'action', '0')],
                    discard: [makeCard('d1', 'elder_thing_byakhee_pod', 'minion', '0')],
                }),
                '1': makePlayer('1', {
                    hand: [
                        makeCard('h1', 'robot_microbot', 'minion', '1'),
                        makeCard('h2', 'robot_microbot_alpha', 'minion', '1'),
                    ],
                }),
            },
            turnOrder: ['0', '1'],
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const play = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'a1' } },
            defaultTestRandom,
        );
        const firstPrompt: any = getInteractionsFromMS(play.finalState)[0]?.data;
        expect(firstPrompt?.sourceId).toBe('elder_thing_spreading_horror_pod_opponent');

        const afterDecline = runCommand(
            play.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '1', payload: { optionId: 'no' } },
            defaultTestRandom,
        );
        const mayPrompt: any = getInteractionsFromMS(afterDecline.finalState)[0]?.data;
        expect(mayPrompt?.sourceId).toBe('elder_thing_spreading_horror_pod_may_play');

        const afterSkip = runCommand(
            afterDecline.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: 'no' } },
            defaultTestRandom,
        );

        expect(getInteractionsFromMS(afterSkip.finalState).length).toBe(0);
        expect(afterSkip.finalState.core.players['0'].discard.some(c => c.uid === 'd1')).toBe(true);
    });
});

describe('elder_things (base): Elder Thing', () => {
    it('if you cannot destroy two other minions, destroy option disabled and you can put it to deck bottom (FAQ)', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('et1', 'elder_thing_elder_thing', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                {
                    defId: 'base_a',
                    minions: [
                        makeMinion('m1', 'robot_microbot', '0', 1),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'et1', baseIndex: 0 } },
            defaultTestRandom,
        );

        // Choose "destroy" mode
        const choiceInteraction: any = getInteractionsFromMS(played.finalState)[0];
        const choicePrompt: any = choiceInteraction?.data;
        expect(choicePrompt?.sourceId).toBe('elder_thing_elder_thing_choice');
        const destroyOpt = choicePrompt.options.find((o: any) => o.id === 'destroy');
        expect(destroyOpt?.disabled).toBe(true);
        const deckBottomOpt = choicePrompt.options.find((o: any) => o.id === 'deckbottom');
        expect(deckBottomOpt).toBeTruthy();

        const afterChoice = runCommand(
            played.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: deckBottomOpt.id } },
            defaultTestRandom,
        );
        expect(afterChoice.events.some(e => e.type === SU_EVENTS.CARD_TO_DECK_BOTTOM)).toBe(true);

        const base0 = afterChoice.finalState.core.bases[0];
        // Existing minion should remain (destroy none)
        expect(base0.minions.some(m => m.uid === 'm1')).toBe(true);
        // Elder Thing should not be in play (moved to bottom of deck)
        expect(base0.minions.some(m => m.defId === 'elder_thing_elder_thing')).toBe(false);
        // and not in discard
        expect(afterChoice.finalState.core.players['0'].discard.some(c => c.uid === 'et1')).toBe(false);
    });
});

