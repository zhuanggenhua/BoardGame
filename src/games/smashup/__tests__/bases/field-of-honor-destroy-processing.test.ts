import { beforeAll, describe, expect, it } from 'vitest';
import {
    defaultTestRandom,
    getPromptOption,
    getSimpleChoicePrompt,
    initAllAbilities,
    makeCard,
    makeMatchState,
    makeMinion,
    makeState,
    resolveDestroyedMinions,
    respondCommand,
    runCommand,
    SMASHUP_FACTION_IDS,
    SU_COMMANDS,
    SU_EVENTS,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_the_field_of_honor: 消灭事件管线', () => {
    it('同一张牌一次性消灭多个随从只给 1VP（按 FAQ，管线层 batch）', () => {
        const core = makeState({
            bases: [{
                defId: 'base_the_field_of_honor',
                minions: [
                    makeMinion('victim-1', '1', 2, 'v1'),
                    makeMinion('victim-2', '1', 2, 'v2'),
                ],
                ongoingActions: [],
            }],
            players: {
                '0': { id: '0', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
                '1': { id: '1', vp: 0, hand: [], discard: [], deck: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: [] },
            },
        });

        const result = resolveDestroyedMinions({
            state: makeMatchState(core),
            currentPlayerId: '0',
            destroyed: [
                { minionUid: 'victim-1', minionDefId: 'v1', ownerId: '1', destroyerId: '0', reason: 'powderkeg' },
                { minionUid: 'victim-2', minionDefId: 'v2', ownerId: '1', destroyerId: '0', reason: 'powderkeg' },
            ],
            random: defaultTestRandom,
            now: 1000,
        });

        const vpEvents = result.events.filter(event => event.type === SU_EVENTS.VP_AWARDED);
        expect(vpEvents).toHaveLength(1);
        expect((vpEvents[0] as any).payload.playerId).toBe('0');
        expect((vpEvents[0] as any).payload.amount).toBe(1);
    });

    it('robot_microbot_guard 在荣耀之地消灭 1 个随从时只给 1VP', () => {
        const core = makeState({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [makeCard('guard', '0', 'robot_microbot_guard')],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.WIZARDS],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.ROBOTS, SMASHUP_FACTION_IDS.WIZARDS],
                },
            },
            bases: [{
                defId: 'base_the_field_of_honor',
                minions: [
                    makeMinion('ally-a', '0', 1, 'robot_microbot_alpha'),
                    makeMinion('ally-b', '0', 1, 'robot_microbot_beta'),
                    makeMinion('enemy-target', '1', 2, 'robot_microbot_reclaimer'),
                ],
                ongoingActions: [],
            }],
        });

        const played = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'guard', baseIndex: 0 } },
            defaultTestRandom,
        );

        const prompt = getSimpleChoicePrompt(played.finalState, 'robot_microbot_guard');
        const targetOption = getPromptOption(prompt, option => option.value?.minionUid === 'enemy-target');
        const resolved = runCommand(
            played.finalState,
            respondCommand(targetOption.id, '0'),
            defaultTestRandom,
        );

        const vpEvents = resolved.events.filter(event => event.type === SU_EVENTS.VP_AWARDED);
        expect(vpEvents).toHaveLength(1);
        expect((vpEvents[0] as any).payload.playerId).toBe('0');
        expect((vpEvents[0] as any).payload.amount).toBe(1);
        expect(resolved.finalState.core.players['0'].vp).toBe(1);
        expect(resolved.finalState.core.players['1'].vp).toBe(0);
    });

    it('destroyerId 缺失时，VP 仍应判给当前操作者控制的随从一侧', () => {
        const victim = makeMinion('victim', '1', 3, 'victim_minion');
        victim.owner = '0';
        const core = makeState({
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.BEAR_CAVALRY, SMASHUP_FACTION_IDS.NINJAS],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: [SMASHUP_FACTION_IDS.BEAR_CAVALRY, SMASHUP_FACTION_IDS.NINJAS],
                },
            },
            bases: [{
                defId: 'base_the_field_of_honor',
                minions: [victim],
                ongoingActions: [],
            }],
        });

        const result = resolveDestroyedMinions({
            state: makeMatchState(core),
            currentPlayerId: '1',
            destroyed: [{
                minionUid: 'victim',
                minionDefId: victim.defId,
                ownerId: '0',
                reason: 'integration_destroy',
            }],
            now: 1000,
        });

        const vpEvents = result.events.filter(event => event.type === SU_EVENTS.VP_AWARDED);
        expect(vpEvents).toHaveLength(1);
        expect((vpEvents[0] as any).payload.playerId).toBe('1');
        expect((vpEvents[0] as any).payload.amount).toBe(1);
    });
});
