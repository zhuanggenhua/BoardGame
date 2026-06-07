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

describe('base_sakura_garden: 首次己方随从被消灭抽牌', () => {
    it('base_sakura_garden 在本回合第一次有你的随从被消灭时让你抓一张牌', () => {
        const state = makeState({
            bases: [{
                defId: 'base_sakura_garden',
                minions: [],
                ongoingActions: [],
            }],
            players: {
                '0': {
                    id: '0', vp: 0, hand: [],
                    deck: [makeCard('draw-1', '0', 'robot_microbot_alpha')],
                    discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: {
                uid: 'dead-1',
                defId: 'samurai_ronin',
                controller: '0',
                owner: '0',
                basePower: 3,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                attachedActions: [],
            },
            triggerMinionUid: 'dead-1',
            triggerMinionDefId: 'samurai_ronin',
            destroyerId: '1',
            random: dummyRandom,
            now: 1001,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);
    });

    it('base_sakura_garden 与 samurai_honor_the_fallen 同时触发时两者都会结算抓牌', () => {
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
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
            bases: [{
                defId: 'base_sakura_garden',
                minions: [makeMinion('dead-1', '0', 3, 'samurai_ronin')],
                ongoingActions: [{ uid: 'hof-1', defId: 'samurai_honor_the_fallen', ownerId: '0' } as any],
            }],
        });

        const queued = collectTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: core.bases[0].minions[0],
            triggerMinionUid: 'dead-1',
            triggerMinionDefId: 'samurai_ronin',
            destroyerId: '1',
            random: dummyRandom,
            now: 1000,
        });

        expect(queued).toBeDefined();
        const queuedState = makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers });
        const firstPrompt = maybeResolveReactionQueue(queuedState, dummyRandom, 1000);
        expect(getPromptSourceId(getSimpleChoicePrompt(firstPrompt!.state, 'smashup_reaction_choose'))).toBe('smashup_reaction_choose');

        const firstResolved = resolveReactionPromptBySource(firstPrompt!.state, 'samurai_honor_the_fallen');
        const secondResolved = maybeResolveReactionPromptBySource(firstResolved.finalState, 'base_sakura_garden');

        const drawEvents = [...firstResolved.events, ...secondResolved.events].filter(event => event.type === SU_EVENTS.CARDS_DRAWN) as any[];
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.every(event => event.payload.playerId === '0' && event.payload.count === 1)).toBe(true);
    });

    it('base_sakura_garden 同回合第二次有同一玩家的随从被消灭时不应再次抽牌', () => {
        const state = makeState({
            bases: [{
                defId: 'base_sakura_garden',
                minions: [],
                ongoingActions: [],
            }],
            turnDestroyedMinions: [{
                uid: 'prev-1',
                defId: 'samurai_samurai_chan',
                baseIndex: 0,
                owner: '0',
            }],
            players: {
                '0': {
                    id: '0', vp: 0, hand: [],
                    deck: [makeCard('draw-1', '0', 'robot_microbot_alpha')],
                    discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
        });

        const result = fireTriggers(state, 'onMinionDestroyed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            triggerMinion: {
                uid: 'dead-2',
                defId: 'samurai_bushi',
                controller: '0',
                owner: '0',
                basePower: 4,
                powerCounters: 0,
                powerModifier: 0,
                tempPowerModifier: 0,
                talentUsed: false,
                attachedActions: [],
            },
            triggerMinionUid: 'dead-2',
            triggerMinionDefId: 'samurai_bushi',
            destroyerId: '1',
            random: dummyRandom,
            now: 1002,
        });

        expect(result.events.some(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(false);
    });

});
