import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerExtendedBaseAbility,
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
    type BaseAbilityContext,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('Oops Cowboys bases', () => {
    it('base_saloon 在此处有随从被消灭后让场上留有随从的玩家各抽一张', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_saloon',
                    minions: [
                        makeMinion('m1', '0', 3),
                        makeMinion('m2', '1', 4),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [],
                        deck: [makeCard('d0', '0', 'robot_microbot_alpha')],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.COWBOYS, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0,
                        hand: [],
                        deck: [makeCard('d1', '1', 'robot_microbot_beta')],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.COWBOYS, SMASHUP_FACTION_IDS.PIRATES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_saloon',
            playerId: '0',
            minionUid: 'victim',
            destroyerId: '1',
            now: 1000,
        };

        const { events } = triggerExtendedBaseAbility('base_saloon', 'onMinionDestroyed', ctx);
        const drawEvents = events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.some(event => (event as any).payload.playerId === '0')).toBe(true);
        expect(drawEvents.some(event => (event as any).payload.playerId === '1')).toBe(true);
    });

    it('base_so_so_corral 在打出随从后给出决斗提示并按结果消灭失败者', () => {
        const result = triggerBaseAbilityWithMS('base_so_so_corral', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_so_so_corral',
                    minions: [
                        makeMinion('ally-1', '0', 4, 'cowboys_gunfighter'),
                        makeMinion('enemy-1', '1', 2, 'robot_microbot_alpha'),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.COWBOYS, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_so_so_corral',
            playerId: '0',
            minionUid: 'ally-1',
            minionDefId: 'cowboys_gunfighter',
            minionPower: 4,
            now: 1001,
        });

        const prompt = getInteractionsFromResult(result)[0];
        expect(getPromptSourceId(prompt)).toBe('base_so_so_corral');

        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-1');
        const resolved = runCommand(
            result.matchState!,
            respondCommand(option.id, '0'),
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(resolved.finalState);
        expect(duelResolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(duelResolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
    });

    it('base_saloon_pod reuses the destroyed-minion draw trigger', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_saloon_pod',
                    minions: [
                        makeMinion('m1', '0', 3, 'cowboys_gunfighter_pod'),
                        makeMinion('m2', '1', 4, 'robot_microbot_alpha'),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [],
                        deck: [makeCard('d0', '0', 'robot_microbot_alpha')],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.COWBOYS_POD, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0,
                        hand: [],
                        deck: [makeCard('d1', '1', 'robot_microbot_beta')],
                        discard: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_saloon_pod',
            playerId: '0',
            minionUid: 'victim',
            destroyerId: '1',
            now: 1005,
        };

        const { events } = triggerExtendedBaseAbility('base_saloon_pod', 'onMinionDestroyed', ctx);
        const drawEvents = events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents).toHaveLength(2);
        expect(drawEvents.some(event => (event as any).payload.playerId === '0')).toBe(true);
        expect(drawEvents.some(event => (event as any).payload.playerId === '1')).toBe(true);
    });

    it('base_so_so_corral_pod reuses the duel-and-destroy base ability', () => {
        const result = triggerBaseAbilityWithMS('base_so_so_corral_pod', 'onMinionPlayed', {
            state: makeState({
                bases: [{
                    defId: 'base_so_so_corral_pod',
                    minions: [
                        makeMinion('ally-pod-1', '0', 4, 'cowboys_gunfighter_pod'),
                        makeMinion('enemy-pod-1', '1', 2, 'robot_microbot_alpha'),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.COWBOYS_POD, SMASHUP_FACTION_IDS.ALIENS],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.WIZARDS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_so_so_corral_pod',
            playerId: '0',
            minionUid: 'ally-pod-1',
            minionDefId: 'cowboys_gunfighter_pod',
            minionPower: 4,
            now: 1006,
        });

        const prompt = getInteractionsFromResult(result)[0];
        expect(getPromptSourceId(prompt)).toBe('base_so_so_corral');

        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'enemy-pod-1');
        const resolved = runCommand(
            result.matchState!,
            respondCommand(option.id, '0'),
            defaultTestRandom,
        );

        const duelResolved = resolveDuelChain(resolved.finalState);
        expect(duelResolved.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
        expect(duelResolved.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-pod-1')).toBe(false);
    });
});
