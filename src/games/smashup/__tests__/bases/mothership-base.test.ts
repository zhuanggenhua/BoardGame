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
    type MinionReturnedEvent,
} from './base-contract-helpers';

beforeAll(() => {
    initAllAbilities();
});

describe('base_the_mothership 母舰 afterScoring', () => {
    it('冠军有力量 <=3 随从时产生可选回手交互', () => {
        const small = makeMinion('m1', '0', 2, 'test_minion');
        const large = makeMinion('m2', '0', 5, 'test_minion');
        const state = makeState({
            bases: [{ defId: 'base_the_mothership', minions: [small, large], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_the_mothership', 'afterScoring', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_the_mothership',
            playerId: '0',
            rankings: [{ playerId: '0', power: 7, vp: 3 }],
            now: 0,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_the_mothership');
        expect(getPromptSourceId(prompt)).toBe('base_the_mothership');
        expect(getPromptOptions(prompt)).toHaveLength(2);
    });

    it('响应交互后收回所选随从', () => {
        const minion = makeMinion('m1', '0', 2, 'test_minion');
        const state = makeState({
            bases: [{ defId: 'base_the_mothership', minions: [minion], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_the_mothership', 'afterScoring', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_the_mothership',
            playerId: '0',
            rankings: [{ playerId: '0', power: 2, vp: 3 }],
            now: 0,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_the_mothership');
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'm1', 'm1 return option');
        const response = runCommand(result.matchState!, respondCommand(option.id, '0'), dummyRandom);

        expect(response.success).toBe(true);
        const returned = response.events.find(event => event.type === SU_EVENTS.MINION_RETURNED) as MinionReturnedEvent | undefined;
        expect(returned).toBeDefined();
        expect(returned!.payload.minionUid).toBe('m1');
        expect(returned!.payload.toPlayerId).toBe('0');
    });
});
