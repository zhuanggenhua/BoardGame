import { beforeAll, describe, expect, it } from 'vitest';
import {
    initAllAbilities,
    triggerBaseAbility,
    makeState,
    makeMinion,
    makeMatchState,
    getPromptOption,
    getPromptOptions,
    getPromptSourceId,
    getSimpleChoicePrompt,
    respondCommand,
    runCommand,
    dummyRandom,
    SU_EVENTS,
    type MinionDestroyedEvent,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

function makePlayers() {
    return {
        '0': {
            id: '0', vp: 0, hand: [], deck: [], discard: [],
            minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
            factions: [],
        },
        '1': {
            id: '1', vp: 0, hand: [], deck: [], discard: [],
            minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
            factions: [],
        },
    } as any;
}

describe('base_ninja_dojo 忍者道场 afterScoring', () => {
    it('基地有随从时产生可选择消灭或跳过的交互', () => {
        const own = makeMinion('m1', '0', 3, 'test_minion');
        const enemy = makeMinion('m2', '1', 4, 'test_minion');
        const state = makeState({
            players: makePlayers(),
            bases: [{ defId: 'base_ninja_dojo', minions: [own, enemy], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_ninja_dojo', 'afterScoring', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_ninja_dojo',
            playerId: '0',
            rankings: [{ playerId: '0', power: 3, vp: 3 }],
            now: 0,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_ninja_dojo');
        expect(getPromptSourceId(prompt)).toBe('base_ninja_dojo');
        expect(getPromptOptions(prompt)).toHaveLength(3);
    });

    it('响应交互后消灭所选随从', () => {
        const minion = makeMinion('m1', '1', 4, 'test_minion');
        const state = makeState({
            players: makePlayers(),
            bases: [{ defId: 'base_ninja_dojo', minions: [minion], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_ninja_dojo', 'afterScoring', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_ninja_dojo',
            playerId: '0',
            rankings: [{ playerId: '0', power: 3, vp: 3 }],
            now: 0,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_ninja_dojo');
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'm1', 'm1 destroy option');
        const response = runCommand(result.matchState!, respondCommand(option.id, '0'), dummyRandom);

        expect(response.success).toBe(true);
        const destroyed = response.events.find(event => event.type === SU_EVENTS.MINION_DESTROYED) as MinionDestroyedEvent | undefined;
        expect(destroyed).toBeDefined();
        expect(destroyed!.payload.minionUid).toBe('m1');
    });
});
