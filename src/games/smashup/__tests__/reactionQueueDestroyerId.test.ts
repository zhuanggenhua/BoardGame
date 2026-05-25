import { beforeAll, describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore, TriggerInstance } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers, getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { defaultTestRandom } from './testRunner';
import { makeMatchState, makeMinion, makePlayer, makeState, getInteractionsFromMS } from './helpers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('reaction queue: preserves destroyerId context', () => {
    it('vampire_mad_monster_party_pod trigger works when resolved from queue', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a-mmp', defId: 'vampire_mad_monster_party_pod', type: 'action', owner: '0' } as any],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const trigger: TriggerInstance = {
            id: 't-mmp',
            timing: 'onMinionDestroyed',
            sourceDefId: 'vampire_mad_monster_party_pod',
            mandatory: false,
            ownerPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 1,
            triggerMinionUid: 'dead1',
            triggerMinionDefId: 'test_dead',
            destroyerId: '0',
            reason: 'test_destroy',
        };

        const ms: MatchState<SmashUpCore> = makeMatchState({ ...(core as any), triggerQueue: [trigger] });
        const rq = maybeResolveReactionQueue(ms, defaultTestRandom, 1);
        expect(rq).toBeDefined();

        const after = rq!.state;
        const interactions = getInteractionsFromMS(after) as any[];
        expect(interactions.length).toBeGreaterThanOrEqual(1);

        const first = interactions[0];
        if (first?.data?.sourceId === 'smashup_reaction_choose') {
            const option = first.data.options.find((opt: any) => opt.id === `trigger:${trigger.id}`)
                ?? first.data.options.find((opt: any) => String(opt.id).includes('trigger:'));
            expect(option).toBeDefined();
            const handler = getInteractionHandler('smashup_reaction_choose');
            expect(handler).toBeDefined();
            const resolved = handler!(
                after as any,
                first.playerId,
                option.value,
                first.data,
                defaultTestRandom as any,
                2,
            );
            const nextState = resolved?.state ?? after;
            const nextInteractions = getInteractionsFromMS(nextState) as any[];
            const prompt = nextInteractions.find(i => i?.data?.sourceId === 'vampire_mad_monster_party_pod_play');
            expect(prompt).toBeDefined();
            expect(prompt?.data?.displayCard).toEqual({ defId: 'vampire_mad_monster_party_pod', cardUid: 'a-mmp' });
        } else {
            expect(first?.data?.sourceId).toBe('vampire_mad_monster_party_pod_play');
            expect(first?.data?.displayCard).toEqual({ defId: 'vampire_mad_monster_party_pod', cardUid: 'a-mmp' });
        }
    });

    it('vampire_mad_monster_party_pod triggered play preserves the destroyed minion base on ACTION_PLAYED', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a-mmp', defId: 'vampire_mad_monster_party_pod', type: 'action', owner: '1' } as any],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                {
                    defId: 'base_b',
                    minions: [
                        makeMinion('ally', 'robot_microbot', '0', 2),
                        makeMinion('enemy', 'robot_microbot', '1', 2),
                    ],
                    ongoingActions: [],
                },
            ],
        });

        const trigger: TriggerInstance = {
            id: 't-mmp-target-base',
            timing: 'onMinionDestroyed',
            sourceDefId: 'vampire_mad_monster_party_pod',
            mandatory: false,
            ownerPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 1,
            triggerMinionUid: 'dead1',
            triggerMinionDefId: 'test_dead',
            destroyerId: '0',
            reason: 'test_destroy',
        };

        const queuedState = makeMatchState({ ...(core as any), triggerQueue: [trigger] });
        const rq = maybeResolveReactionQueue(queuedState, defaultTestRandom, 1);
        expect(rq).toBeDefined();

        let promptState = rq!.state;
        let prompt = getInteractionsFromMS(promptState)[0] as any;
        if (prompt?.data?.sourceId === 'smashup_reaction_choose') {
            const option = prompt.data.options.find((opt: any) => opt.id === `trigger:${trigger.id}`)
                ?? prompt.data.options.find((opt: any) => String(opt.id).includes('trigger:'));
            expect(option).toBeDefined();
            const chooseHandler = getInteractionHandler('smashup_reaction_choose');
            expect(chooseHandler).toBeDefined();
            const chooseResolved = chooseHandler!(
                promptState as any,
                prompt.playerId,
                option.value,
                prompt.data,
                defaultTestRandom as any,
                2,
            );
            promptState = chooseResolved?.state ?? promptState;
            prompt = (getInteractionsFromMS(promptState) as any[])
                .find(i => i?.data?.sourceId === 'vampire_mad_monster_party_pod_play');
        }

        expect(prompt?.data?.sourceId).toBe('vampire_mad_monster_party_pod_play');
        const playOption = prompt.data.options.find((opt: any) => opt.id === 'play');
        expect(playOption).toBeDefined();
        const playHandler = getInteractionHandler('vampire_mad_monster_party_pod_play');
        expect(playHandler).toBeDefined();

        const played = playHandler!(
            promptState as any,
            prompt.playerId,
            playOption.value,
            prompt.data,
            defaultTestRandom as any,
            3,
        );
        const actionPlayed = played?.events.find(event => event.type === SU_EVENTS.ACTION_PLAYED);
        expect(actionPlayed?.payload).toMatchObject({
            playerId: '0',
            cardUid: 'a-mmp',
            defId: 'vampire_mad_monster_party_pod',
            ownerId: '1',
            isExtraAction: true,
            targetBaseIndex: 1,
            targetType: 'base',
        });
        expect(played?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({
                minionUid: 'ally',
                baseIndex: 1,
                amount: 1,
                reason: 'vampire_mad_monster_party_pod',
            }),
        }));
    });

    it('vampire_buffet_pod trigger prompt includes the playable card preview context', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a-buffet', defId: 'vampire_buffet_pod', type: 'action', owner: '0' } as any],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const trigger: TriggerInstance = {
            id: 't-buffet',
            timing: 'onMinionDestroyed',
            sourceDefId: 'vampire_buffet_pod',
            mandatory: false,
            ownerPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'dead1',
            triggerMinionDefId: 'test_dead',
            destroyerId: '0',
            reason: 'test_destroy',
        };

        const ms: MatchState<SmashUpCore> = makeMatchState({ ...(core as any), triggerQueue: [trigger] });
        const rq = maybeResolveReactionQueue(ms, defaultTestRandom, 1);
        expect(rq).toBeDefined();

        const first = getInteractionsFromMS(rq!.state)[0] as any;
        if (first?.data?.sourceId === 'smashup_reaction_choose') {
            const option = first.data.options.find((opt: any) => opt.id === `trigger:${trigger.id}`)
                ?? first.data.options.find((opt: any) => String(opt.id).includes('trigger:'));
            const handler = getInteractionHandler('smashup_reaction_choose');
            const resolved = handler!(
                rq!.state as any,
                first.playerId,
                option.value,
                first.data,
                defaultTestRandom as any,
                2,
            );
            const prompt = (getInteractionsFromMS(resolved?.state ?? rq!.state) as any[])
                .find(i => i?.data?.sourceId === 'vampire_buffet_pod_play');
            expect(prompt?.data?.displayCard).toEqual({ defId: 'vampire_buffet_pod', cardUid: 'a-buffet' });
        } else {
            expect(first?.data?.sourceId).toBe('vampire_buffet_pod_play');
            expect(first?.data?.displayCard).toEqual({ defId: 'vampire_buffet_pod', cardUid: 'a-buffet' });
        }
    });

    it('vampire_buffet_pod triggered play remains untargeted on ACTION_PLAYED', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a-buffet', defId: 'vampire_buffet_pod', type: 'action', owner: '1' } as any],
                    deck: [
                        { uid: 'draw-a', defId: 'robot_microbot', type: 'minion', owner: '0' } as any,
                        { uid: 'draw-b', defId: 'robot_microbot', type: 'minion', owner: '0' } as any,
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const trigger: TriggerInstance = {
            id: 't-buffet-untargeted',
            timing: 'onMinionDestroyed',
            sourceDefId: 'vampire_buffet_pod',
            mandatory: false,
            ownerPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'dead1',
            triggerMinionDefId: 'test_dead',
            destroyerId: '0',
            reason: 'test_destroy',
        };

        const queuedState = makeMatchState({ ...(core as any), triggerQueue: [trigger] });
        const rq = maybeResolveReactionQueue(queuedState, defaultTestRandom, 1);
        expect(rq).toBeDefined();

        let promptState = rq!.state;
        let prompt = getInteractionsFromMS(promptState)[0] as any;
        if (prompt?.data?.sourceId === 'smashup_reaction_choose') {
            const option = prompt.data.options.find((opt: any) => opt.id === `trigger:${trigger.id}`)
                ?? prompt.data.options.find((opt: any) => String(opt.id).includes('trigger:'));
            expect(option).toBeDefined();
            const chooseHandler = getInteractionHandler('smashup_reaction_choose');
            expect(chooseHandler).toBeDefined();
            const chooseResolved = chooseHandler!(
                promptState as any,
                prompt.playerId,
                option.value,
                prompt.data,
                defaultTestRandom as any,
                2,
            );
            promptState = chooseResolved?.state ?? promptState;
            prompt = (getInteractionsFromMS(promptState) as any[])
                .find(i => i?.data?.sourceId === 'vampire_buffet_pod_play');
        }

        expect(prompt?.data?.sourceId).toBe('vampire_buffet_pod_play');
        const playOption = prompt.data.options.find((opt: any) => opt.id === 'play');
        expect(playOption).toBeDefined();
        const playHandler = getInteractionHandler('vampire_buffet_pod_play');
        expect(playHandler).toBeDefined();

        const played = playHandler!(
            promptState as any,
            prompt.playerId,
            playOption.value,
            prompt.data,
            defaultTestRandom as any,
            3,
        );
        const actionPlayed = played?.events.find(event => event.type === SU_EVENTS.ACTION_PLAYED);
        expect(actionPlayed?.payload).toMatchObject({
            playerId: '0',
            cardUid: 'a-buffet',
            defId: 'vampire_buffet_pod',
            ownerId: '1',
            isExtraAction: true,
        });
        expect((actionPlayed?.payload as any)?.targetBaseIndex).toBeUndefined();
        expect((actionPlayed?.payload as any)?.targetType).toBeUndefined();
        expect(played?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                count: 2,
                cardUids: ['draw-a', 'draw-b'],
            }),
        }));
    });
});

