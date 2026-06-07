import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    maybeResolveReactionQueue,
    runCommand,
    dummyRandom,
    makeState,
    makeCard,
    makeMatchState,
    expectNoPrompt,
    SU_COMMANDS,
    SU_EVENTS,
    SMASHUP_FACTION_IDS,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_laboratorium: 实验工坊与大法师队列恢复', () => {
    it('线上反馈 69ff7291：大法师打到实验工坊时应自动结算基地和大法师触发，不应留下排序交互', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            players: {
                '0': {
                    id: '0', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.FRANKENSTEIN],
                },
                '1': {
                    id: '1', vp: 0,
                    hand: [makeCard('archmage', '1', 'wizard_archmage')],
                    deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    minionsPlayedPerBase: {},
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
            bases: [{ defId: 'base_laboratorium', minions: [], ongoingActions: [] }],
        });

        const played = runCommand(makeMatchState(core), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '1',
            payload: { cardUid: 'archmage', baseIndex: 0 },
        } as any, dummyRandom);

        expect(played.success).toBe(true);
        expectNoPrompt(played.finalState);
        expect(played.finalState.core.triggerQueue ?? []).toHaveLength(0);
        const archmage = played.finalState.core.bases[0].minions.find(minion => minion.uid === 'archmage');
        expect(archmage?.powerCounters).toBe(1);
        expect(played.finalState.core.players['1'].actionLimit).toBe(2);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload.reason === 'base_laboratorium'
        )).toBe(true);
        expect(played.events.some(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED
            && (event as any).payload.reason === 'wizard_archmage'
        )).toBe(true);
    });

    it('线上反馈 69ff7291：已持久化的旧实验工坊队列也应自动恢复收口', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            players: {
                '0': {
                    id: '0', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 1, minionLimit: 1, actionsPlayed: 1, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.FRANKENSTEIN],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    minionsPlayedPerBase: { 0: 1 },
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
            bases: [{
                defId: 'base_laboratorium',
                minions: [{
                    uid: 'archmage',
                    defId: 'wizard_archmage',
                    controller: '1',
                    owner: '1',
                    basePower: 4,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                    playedThisTurn: true,
                }],
                ongoingActions: [],
            }],
            triggerQueue: [{
                id: 'onMinionPlayed:base_laboratorium:69ff7291:0',
                timing: 'onMinionPlayed',
                sourceDefId: 'base_laboratorium',
                sourceBaseIndex: 0,
                mandatory: true,
                resolutionClass: 'mandatory',
                frameId: 'minion-played-frame:archmage:0:69ff7291',
                sourceEventId: 'minion-played:archmage:0:69ff7291',
                ownerPlayerId: '1',
                witnessRequirement: 'inPlayAtTriggerTime',
                witnessed: true,
                baseIndex: 0,
                triggerMinionUid: 'archmage',
                triggerMinionDefId: 'wizard_archmage',
                triggerMinionPower: 4,
                lkiBase: { baseIndex: 0, defId: 'base_laboratorium' },
            }, {
                id: 'onMinionPlayed:wizard_archmage:69ff7291:0',
                timing: 'onMinionPlayed',
                sourceDefId: 'wizard_archmage',
                sourceCardUid: 'archmage',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
                mandatory: true,
                resolutionClass: 'mandatory',
                frameId: 'minion-played-frame:archmage:0:69ff7291',
                sourceEventId: 'minion-played:archmage:0:69ff7291',
                ownerPlayerId: '1',
                witnessRequirement: 'inPlayAtTriggerTime',
                witnessed: true,
                baseIndex: 0,
                triggerMinionUid: 'archmage',
                triggerMinionDefId: 'wizard_archmage',
                triggerBaseControllersAtTrigger: ['1'],
                lkiMinion: {
                    uid: 'archmage',
                    defId: 'wizard_archmage',
                    owner: '1',
                    controller: '1',
                    baseIndex: 0,
                    basePower: 4,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    attachedActionDefIds: [],
                },
            }],
        } as any);

        const resolved = maybeResolveReactionQueue(makeMatchState(core), dummyRandom, 1000);

        expect(resolved).toBeDefined();
        expectNoPrompt(resolved!.state);
        expect(resolved!.state.core.triggerQueue ?? []).toHaveLength(0);
        const archmage = resolved!.state.core.bases[0].minions.find(minion => minion.uid === 'archmage');
        expect(archmage?.powerCounters).toBe(1);
        expect(resolved!.state.core.players['1'].actionLimit).toBe(2);
        expect(resolved!.events.filter(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toHaveLength(2);
        expect(resolved!.events.some(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload.reason === 'base_laboratorium'
        )).toBe(true);
    });

    it('旧实验工坊队列若不是本回合基地首次随从，不应因 frameId/sourceEventId 误加力量', () => {
        const core = makeState({
            currentPlayerIndex: 1,
            players: {
                '0': {
                    id: '0', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 1, minionLimit: 1, actionsPlayed: 1, actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.PIRATES, SMASHUP_FACTION_IDS.FRANKENSTEIN],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 1, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    minionsPlayedPerBase: { 0: 2 },
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.WIZARDS],
                },
            } as any,
            bases: [{
                defId: 'base_laboratorium',
                minions: [{
                    uid: 'archmage',
                    defId: 'wizard_archmage',
                    controller: '1',
                    owner: '1',
                    basePower: 4,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                    playedThisTurn: true,
                }],
                ongoingActions: [],
            }],
            triggerQueue: [{
                id: 'onMinionPlayed:base_laboratorium:69ff7291:0',
                timing: 'onMinionPlayed',
                sourceDefId: 'base_laboratorium',
                sourceBaseIndex: 0,
                mandatory: true,
                resolutionClass: 'mandatory',
                frameId: 'minion-played-frame:archmage:0:69ff7291',
                sourceEventId: 'minion-played:archmage:0:69ff7291',
                ownerPlayerId: '1',
                witnessRequirement: 'inPlayAtTriggerTime',
                witnessed: true,
                baseIndex: 0,
                triggerMinionUid: 'archmage',
                triggerMinionDefId: 'wizard_archmage',
                triggerMinionPower: 4,
                lkiBase: { baseIndex: 0, defId: 'base_laboratorium' },
            }, {
                id: 'onMinionPlayed:wizard_archmage:69ff7291:0',
                timing: 'onMinionPlayed',
                sourceDefId: 'wizard_archmage',
                sourceCardUid: 'archmage',
                sourceControllerId: '1',
                sourceBaseIndex: 0,
                mandatory: true,
                resolutionClass: 'mandatory',
                frameId: 'minion-played-frame:archmage:0:69ff7291',
                sourceEventId: 'minion-played:archmage:0:69ff7291',
                ownerPlayerId: '1',
                witnessRequirement: 'inPlayAtTriggerTime',
                witnessed: true,
                baseIndex: 0,
                triggerMinionUid: 'archmage',
                triggerMinionDefId: 'wizard_archmage',
                triggerBaseControllersAtTrigger: ['1'],
                lkiMinion: {
                    uid: 'archmage',
                    defId: 'wizard_archmage',
                    owner: '1',
                    controller: '1',
                    baseIndex: 0,
                    basePower: 4,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    attachedActionDefIds: [],
                },
            }],
        } as any);

        const resolved = maybeResolveReactionQueue(makeMatchState(core), dummyRandom, 1000);

        expect(resolved).toBeDefined();
        expectNoPrompt(resolved!.state);
        expect(resolved!.state.core.triggerQueue ?? []).toHaveLength(0);
        const archmage = resolved!.state.core.bases[0].minions.find(minion => minion.uid === 'archmage');
        expect(archmage?.powerCounters).toBe(0);
        expect(resolved!.state.core.players['1'].actionLimit).toBe(2);
        expect(resolved!.events.filter(event => event.type === SU_EVENTS.TRIGGER_CONSUMED)).toHaveLength(2);
        expect(resolved!.events.some(event =>
            event.type === SU_EVENTS.POWER_COUNTER_ADDED
            && (event as any).payload.reason === 'base_laboratorium'
        )).toBe(false);
    });

});
