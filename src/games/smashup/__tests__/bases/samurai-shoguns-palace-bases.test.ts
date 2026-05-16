import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    runCommand,
    defaultTestRandom,
    makeState,
    makeMinion,
    makeCard,
    resolveDuelChain,
    triggerBaseAbilityWithMS,
    getInteractionsFromResult,
    getPromptSourceId,
    getPromptOption,
    respondCommand,
    SU_EVENTS,
    SMASHUP_FACTION_IDS,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe("Samurai Shogun's Palace bases", () => {
    it('base_shoguns_palace 在本回合首次打出随从到这里后给出决斗提示并让胜者抓两张', () => {
        const result = triggerBaseAbilityWithMS('base_shoguns_palace', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_shoguns_palace',
                    minions: [
                        makeMinion('ally-1', '0', 4, 'samurai_ronin'),
                        makeMinion('enemy-1', '1', 2, 'robot_microbot_alpha'),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [],
                        deck: [makeCard('d1', '0', 'robot_microbot_alpha'), makeCard('d2', '0', 'robot_microbot_beta')],
                        discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_shoguns_palace',
            playerId: '0',
            minionUid: 'ally-1',
            minionDefId: 'samurai_ronin',
            minionPower: 4,
            now: 1000,
        });

        const prompt = getInteractionsFromResult(result)[0];
        expect(getPromptSourceId(prompt)).toBe('base_shoguns_palace');

        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            result.matchState!,
            respondCommand(option.id, '0'),
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(resolved.finalState);
        const drawEvent = duelResolved.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(2);
        expect(duelResolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });

    it('base_shoguns_palace 平局时双方各抓两张牌', () => {
        const result = triggerBaseAbilityWithMS('base_shoguns_palace', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_shoguns_palace',
                    minions: [
                        makeMinion('ally-1', '0', 3, 'samurai_ronin'),
                        makeMinion('enemy-1', '1', 3, 'robot_microbot_alpha'),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [],
                        deck: [makeCard('d1', '0', 'robot_microbot_alpha'), makeCard('d2', '0', 'robot_microbot_beta')],
                        discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.SAMURAI, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [],
                        deck: [makeCard('d3', '1', 'robot_microbot_alpha'), makeCard('d4', '1', 'robot_microbot_beta')],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_shoguns_palace',
            playerId: '0',
            minionUid: 'ally-1',
            minionDefId: 'samurai_ronin',
            minionPower: 3,
            now: 1000,
        });

        const prompt = getInteractionsFromResult(result)[0];
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-1');
        const started = runCommand(
            result.matchState!,
            respondCommand(option.id, '0'),
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(started.finalState);
        const drawEvents = duelResolved.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN) as any[];
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.some(event => event.payload.playerId === '0' && event.payload.count === 2)).toBe(true);
        expect(drawEvents.some(event => event.payload.playerId === '1' && event.payload.count === 2)).toBe(true);
    });

    it('base_shoguns_palace_pod reuses the duel-and-draw base ability', () => {
        const result = triggerBaseAbilityWithMS('base_shoguns_palace_pod', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_shoguns_palace_pod',
                    minions: [
                        makeMinion('ally-pod-1', '0', 4, 'samurai_ronin_pod'),
                        makeMinion('enemy-pod-1', '1', 2, 'robot_microbot_alpha'),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [],
                        deck: [makeCard('d1', '0', 'robot_microbot_alpha'), makeCard('d2', '0', 'robot_microbot_beta')],
                        discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.SAMURAI_POD, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_shoguns_palace_pod',
            playerId: '0',
            minionUid: 'ally-pod-1',
            minionDefId: 'samurai_ronin_pod',
            minionPower: 4,
            now: 1003,
        });

        const prompt = getInteractionsFromResult(result)[0];
        expect(getPromptSourceId(prompt)).toBe('base_shoguns_palace');

        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-pod-1');
        const resolved = runCommand(
            result.matchState!,
            respondCommand(option.id, '0'),
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(resolved.finalState);
        const drawEvent = duelResolved.events.find(event => event.type === SU_EVENTS.CARDS_DRAWN) as any;
        expect(drawEvent).toBeDefined();
        expect(drawEvent.payload.playerId).toBe('0');
        expect(drawEvent.payload.count).toBe(2);
    });
});
