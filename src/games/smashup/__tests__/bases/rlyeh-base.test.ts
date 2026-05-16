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

describe('base_rlyeh 拉莱耶 onTurnStart', () => {
    it('有己方随从时产生可选择消灭或跳过的交互', () => {
        const minion = makeMinion('m1', '0', 3, 'test_minion');
        const state = makeState({
            players: makePlayers(),
            bases: [{ defId: 'base_rlyeh', minions: [minion], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_rlyeh', 'onTurnStart', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_rlyeh',
            playerId: '0',
            now: 0,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_rlyeh');
        expect(getPromptSourceId(prompt)).toBe('base_rlyeh');
        const options = getPromptOptions(prompt);
        expect(options).toHaveLength(2);
        expect(options[0].value.skip).toBe(true);
    });

    it('无己方随从时不产生事件或交互', () => {
        const enemy = makeMinion('e1', '1', 3, 'test_minion');
        const state = makeState({
            players: makePlayers(),
            bases: [{ defId: 'base_rlyeh', minions: [enemy], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_rlyeh', 'onTurnStart', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_rlyeh',
            playerId: '0',
            now: 0,
        });

        expect(result.events).toHaveLength(0);
        expect(result.matchState).toBeUndefined();
    });

    it('响应交互选择消灭时产生 MINION_DESTROYED', () => {
        const minion = makeMinion('m1', '0', 3, 'test_minion');
        const state = makeState({
            players: makePlayers(),
            bases: [{ defId: 'base_rlyeh', minions: [minion], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_rlyeh', 'onTurnStart', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_rlyeh',
            playerId: '0',
            now: 0,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_rlyeh');
        const option = getPromptOption(prompt, entry => entry.value?.minionUid === 'm1', 'm1 destroy option');
        const response = runCommand(result.matchState!, respondCommand(option.id, '0'), dummyRandom);

        expect(response.success).toBe(true);
        expect(response.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(true);
    });

    it('响应交互选择不消灭时不产生事件', () => {
        const minion = makeMinion('m1', '0', 3, 'test_minion');
        const state = makeState({
            players: makePlayers(),
            bases: [{ defId: 'base_rlyeh', minions: [minion], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_rlyeh', 'onTurnStart', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_rlyeh',
            playerId: '0',
            now: 0,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_rlyeh');
        const option = getPromptOption(prompt, entry => entry.value?.skip === true, 'skip option');
        const response = runCommand(result.matchState!, respondCommand(option.id, '0'), dummyRandom);

        expect(response.success).toBe(true);
        expect(response.events.some(event => event.type === SU_EVENTS.MINION_DESTROYED)).toBe(false);
    });
});
