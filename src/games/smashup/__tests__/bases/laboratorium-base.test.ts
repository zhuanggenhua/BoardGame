import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerBaseAbility,
    makeState,
    makeMinion,
    SU_EVENTS,
    SMASHUP_FACTION_IDS,
    type BaseAbilityContext,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_laboratorium: 实验工坊 - 当前玩家回合内基地全局首次随从', () => {
    it('当前玩家回合内首次打出到该基地时触发 +1 指示物', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{ defId: 'base_laboratorium', minions: [makeMinion('m1', '0', 3)], ongoingActions: [] }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.WEREWOLVES],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 0 },
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.VAMPIRES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_laboratorium',
            playerId: '0',
            minionUid: 'm1',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_laboratorium', 'onMinionPlayed', ctx);
        expect(events.length).toBe(1);
        expect(events[0].type).toBe(SU_EVENTS.POWER_COUNTER_ADDED);
    });

    it('同一回合内其他玩家已先打出到该基地时不应再次触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{ defId: 'base_laboratorium', minions: [makeMinion('m2', '1', 3)], ongoingActions: [] }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.WEREWOLVES],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.VAMPIRES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_laboratorium',
            playerId: '1',
            minionUid: 'm2',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_laboratorium', 'onMinionPlayed', ctx);
        expect(events.length).toBe(0);
    });

    it('同一玩家本回合第二次打出到该基地时不应触发', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{ defId: 'base_laboratorium', minions: [makeMinion('m3', '1', 3)], ongoingActions: [] }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 0 },
                        factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.WEREWOLVES],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 2, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 2 },
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.VAMPIRES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_laboratorium',
            playerId: '1',
            minionUid: 'm3',
            now: 1000,
        };

        const { events } = triggerBaseAbility('base_laboratorium', 'onMinionPlayed', ctx);
        expect(events.length).toBe(0);
    });

    it('borrowed Infiltrate 由控制者控制时，应阻止 Laboratorium 给控制者打出的首个随从放指示物', () => {
        const ctx: BaseAbilityContext = {
            state: makeState({
                bases: [{
                    defId: 'base_laboratorium',
                    minions: [makeMinion('m4', '0', 3)],
                    ongoingActions: [{ uid: 'inf-lab-1', defId: 'ninja_infiltrate', ownerId: '1', metadata: { sourceControllerId: '0' } } as any],
                }],
                players: {
                    '0': {
                        id: '0', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 1 },
                        factions: [SMASHUP_FACTION_IDS.FRANKENSTEIN, SMASHUP_FACTION_IDS.WEREWOLVES],
                    },
                    '1': {
                        id: '1', vp: 0, hand: [], deck: [], discard: [],
                        minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                        minionsPlayedPerBase: { 0: 0 },
                        factions: [SMASHUP_FACTION_IDS.GIANT_ANTS, SMASHUP_FACTION_IDS.VAMPIRES],
                    },
                } as any,
            }),
            baseIndex: 0,
            baseDefId: 'base_laboratorium',
            playerId: '0',
            minionUid: 'm4',
            now: 1001,
        };

        const { events } = triggerBaseAbility('base_laboratorium', 'onMinionPlayed', ctx);
        expect(events.length).toBe(0);
    });
});
