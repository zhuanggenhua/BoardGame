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
import { respondToPromptOption, withOnlyCurrentPrompt } from '../helpers';

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

    it('线上反馈 69ff0cd0：母舰检查可收回随从时允许读取回合压制标记', () => {
        const state = makeState({
            suppressedCardsUntilTurnStart: [
                { cardUid: 'disabled-card', reason: 'regression-fixture' },
            ] as any,
            bases: [{ defId: 'base_the_mothership', minions: [makeMinion('m1', '0', 2, 'robot_zapbot')], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_the_mothership', 'afterScoring', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_the_mothership',
            playerId: '0',
            rankings: [{ playerId: '0', power: 2, vp: 4 }],
            now: 0,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_the_mothership');
        expect(getPromptSourceId(prompt)).toBe('base_the_mothership');
    });

    it('冠军无力量≤3的随从时不生成 Prompt', () => {
        const state = makeState({
            bases: [{ defId: 'base_the_mothership', minions: [makeMinion('m1', '0', 5, 'test_minion')], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_the_mothership', 'afterScoring', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_the_mothership',
            playerId: '0',
            rankings: [{ playerId: '0', power: 5, vp: 4 }],
            now: 0,
        });

        expect(result.events).toHaveLength(0);
    });

    it('无排名信息时不触发', () => {
        const state = makeState({
            bases: [{ defId: 'base_the_mothership', minions: [], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_the_mothership', 'afterScoring', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_the_mothership',
            playerId: '0',
            now: 0,
        });

        expect(result.events).toHaveLength(0);
    });

    it('POD 版本母舰也应生成收回交互', () => {
        const state = makeState({
            bases: [{ defId: 'base_the_mothership_pod', minions: [makeMinion('m1', '0', 2, 'test_minion')], ongoingActions: [] }],
        });
        const result = triggerBaseAbility('base_the_mothership_pod', 'afterScoring', {
            state,
            matchState: makeMatchState(state),
            baseIndex: 0,
            baseDefId: 'base_the_mothership_pod',
            playerId: '0',
            rankings: [{ playerId: '0', power: 2, vp: 4 }],
            now: 0,
        });

        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_the_mothership');
        expect(prompt.playerId).toBe('0');
    });

    it('所选随从已离开基地时不再回手', () => {
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
            rankings: [{ playerId: '0', power: 2, vp: 4 }],
            now: 0,
        });
        const prompt = getSimpleChoicePrompt(result.matchState!, 'base_the_mothership');
        const staleCore = makeState({
            players: {
                '0': {
                    id: '0', vp: 0, hand: [], deck: [], discard: [{ uid: 'm1', defId: 'd1', type: 'minion', owner: '0' }],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [],
                },
                '1': {
                    id: '1', vp: 0, hand: [], deck: [], discard: [],
                    minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: [],
                },
            } as any,
            bases: [{ defId: 'base_the_mothership', minions: [], ongoingActions: [] }],
        });

        const resolved = respondToPromptOption(
            withOnlyCurrentPrompt(makeMatchState(staleCore), prompt),
            entry => entry.value?.minionUid === 'm1',
            'm1 stale return option',
            '0',
            dummyRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_RETURNED)).toBe(false);
    });
});
