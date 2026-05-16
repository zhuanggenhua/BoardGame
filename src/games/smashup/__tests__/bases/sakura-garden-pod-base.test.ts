import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    collectTriggers,
    fireTriggers,
    maybeResolveReactionQueue,
    dummyRandom,
    makeState,
    makeMinion,
    makeCard,
    resolveReactionPromptBySource,
    maybeResolveReactionPromptBySource,
    makeMatchState,
    getSimpleChoicePrompt,
    getPromptSourceId,
    SU_EVENTS,
    SMASHUP_FACTION_IDS,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_sakura_garden_pod: POD 版首次己方随从被弃抽牌', () => {
    it('base_sakura_garden_pod 与 samurai_samurai_chan_pod 同时触发时，先结算基地后仍会再结算武士酱抓牌', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': {
                    id: '0', vp: 0, hand: [],
                    deck: [
                        makeCard('draw-1', '0', 'robot_microbot_alpha'),
                        makeCard('draw-2', '0', 'robot_microbot_alpha'),
                    ],
                    discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
            bases: [{
                defId: 'base_sakura_garden_pod',
                minions: [makeMinion('chan-1', '0', 2, 'samurai_samurai_chan_pod')],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: core.bases[0].minions[0],
            triggerMinionUid: 'chan-1',
            triggerMinionDefId: 'samurai_samurai_chan_pod',
            destroyerId: '0',
            reason: 'samurai_yokai_attack',
            random: dummyRandom,
            now: 1000,
        });

        expect(queued).toBeDefined();
        const queuedState = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
        const firstPrompt = maybeResolveReactionQueue(queuedState, dummyRandom, 1000);
        expect(getPromptSourceId(getSimpleChoicePrompt(firstPrompt!.state, 'smashup_reaction_choose'))).toBe('smashup_reaction_choose');

        const firstResolved = resolveReactionPromptBySource(firstPrompt!.state, 'base_sakura_garden_pod');
        const secondResolved = maybeResolveReactionPromptBySource(firstResolved.finalState, 'samurai_samurai_chan_pod');

        const drawEvents = [...firstResolved.events, ...secondResolved.events].filter(event => event.type === SU_EVENTS.CARDS_DRAWN) as any[];
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.every(event => event.payload.playerId === '0' && event.payload.count === 1)).toBe(true);
    });

    it('base_sakura_garden_pod 与 samurai_samurai_chan_pod 同时触发时两者都会结算抓牌', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': {
                    id: '0', vp: 0, hand: [],
                    deck: [
                        makeCard('draw-1', '0', 'robot_microbot_alpha'),
                        makeCard('draw-2', '0', 'robot_microbot_alpha'),
                    ],
                    discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
            bases: [{
                defId: 'base_sakura_garden_pod',
                minions: [makeMinion('chan-pod-1', '0', 2, 'samurai_samurai_chan_pod')],
                ongoingActions: [],
            }],
        });

        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: core.bases[0].minions[0],
            triggerMinionUid: 'chan-pod-1',
            triggerMinionDefId: 'samurai_samurai_chan_pod',
            destroyerId: '1',
            random: dummyRandom,
            now: 1005,
        });

        expect(queued).toBeDefined();
        const queuedState = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
        const firstPrompt = maybeResolveReactionQueue(queuedState, dummyRandom, 1005);
        expect(getPromptSourceId(getSimpleChoicePrompt(firstPrompt!.state, 'smashup_reaction_choose'))).toBe('smashup_reaction_choose');

        const firstResolved = resolveReactionPromptBySource(firstPrompt!.state, 'base_sakura_garden_pod');
        const secondResolved = maybeResolveReactionPromptBySource(firstResolved.finalState, 'samurai_samurai_chan_pod');

        const drawEvents = [...firstResolved.events, ...secondResolved.events].filter(event => event.type === SU_EVENTS.CARDS_DRAWN) as any[];
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.every(event => event.payload.playerId === '0' && event.payload.count === 1)).toBe(true);
    });

    it('base_sakura_garden_pod reuses the first discard draw trigger', () => {
        const state = makeState({
            bases: [{
                defId: 'base_sakura_garden_pod',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0', vp: 0, hand: [],
                    deck: [makeCard('draw-pod-1', '0', 'robot_microbot_alpha')],
                    discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
        });

        const result = fireTriggers(state, 'onMinionDiscardedFromBase', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: {
                uid: 'dead-pod-1',
                defId: 'samurai_ronin_pod',
                controller: '0',
                owner: '0',
                basePower: 3,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                attachedActions: [],
            },
            triggerMinionUid: 'dead-pod-1',
            triggerMinionDefId: 'samurai_ronin_pod',
            random: dummyRandom,
            now: 1004,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });
});
