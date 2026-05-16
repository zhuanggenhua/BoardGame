import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerBaseAbility,
    makeState,
    makeMinion,
    makeCard,
    SU_EVENTS,
    SMASHUP_FACTION_IDS,
    type BaseAbilityContext,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_great_library: 有随从的玩家抽牌', () => {
    it('每位有随从的玩家抽一张牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_great_library',
                    minions: [
                        makeMinion('m1', '0', 3),
                        makeMinion('m2', '1', 2),
                    ],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c1', '0')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                    '1': {
                        id: '1', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c2', '1')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_great_library',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_great_library', 'afterScoring', ctx);
        expect(events.length).toBe(2);
        expect(events.every(event => event.type === SU_EVENTS.CARDS_DRAWN)).toBe(true);

        const p0Draw = events.find(event => (event as any).payload.playerId === '0');
        const p1Draw = events.find(event => (event as any).payload.playerId === '1');
        expect(p0Draw).toBeDefined();
        expect(p1Draw).toBeDefined();
    });

    it('没有随从的玩家不抽牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_great_library',
                    minions: [makeMinion('m1', '0', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c1', '0')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                    '1': {
                        id: '1', vp: 0,
                        hand: [], discard: [],
                        deck: [makeCard('c2', '1')],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.NINJAS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_great_library',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_great_library', 'afterScoring', ctx);
        expect(events.length).toBe(1);
        expect((events[0] as any).payload.playerId).toBe('0');
    });

    it('牌库为空的玩家不抽牌', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_great_library',
                    minions: [makeMinion('m1', '0', 3)],
                    ongoingActions: [],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0,
                        hand: [], discard: [],
                        deck: [],
                        minionsPlayed: 0, minionLimit: 1,
                        actionsPlayed: 0, actionLimit: 1,
                        factions: [SMASHUP_FACTION_IDS.ALIENS, SMASHUP_FACTION_IDS.DINOSAURS],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_great_library',
            playerId: '0',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_great_library', 'afterScoring', ctx);
        expect(events.length).toBe(0);
    });
});
