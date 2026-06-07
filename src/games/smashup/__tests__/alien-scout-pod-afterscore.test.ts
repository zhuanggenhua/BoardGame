import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { collectTriggers, fireTriggers } from '../domain/ongoingEffects';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { SU_EVENTS } from '../domain/types';
import {
    getPromptsBySourceId,
    getSimpleChoicePrompt,
    makeBase,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
    respondToPromptOption,
    withOnlyCurrentPrompt,
} from './helpers';

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

const dummyRandom = {
    random: () => 0.5,
    d: () => 1,
    range: (min: number) => min,
    shuffle: <T>(arr: T[]) => [...arr],
};

describe('外星侦察兵 afterScoring', () => {
    it('alien_scout_pod 会创建返回手牌交互', () => {
        const core = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('scout1', 'alien_scout_pod', '1', 3),
                    makeMinion('m1', 'wizard_neophyte', '0', 2),
                ]),
            ],
        });

        const result = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 3 }],
            random: dummyRandom,
            now: 100,
        });

        expect(getSimpleChoicePrompt(result.matchState!, 'alien_scout_return')).toBeDefined();
    });

    it('alien_scout 基础版也会创建返回手牌交互', () => {
        const core = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('scout1', 'alien_scout', '1', 3),
                    makeMinion('m1', 'wizard_neophyte', '0', 2),
                ]),
            ],
        });

        const result = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 3 }],
            random: dummyRandom,
            now: 100,
        });

        expect(getSimpleChoicePrompt(result.matchState!, 'alien_scout_return')).toBeDefined();
    });

    it('同时存在基础版和 POD 版时会创建两个独立交互', () => {
        const core = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('scout1', 'alien_scout', '1', 3),
                    makeMinion('scout2', 'alien_scout_pod', '1', 3),
                    makeMinion('m1', 'wizard_neophyte', '0', 2),
                ]),
            ],
        });

        const result = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 3 }],
            random: dummyRandom,
            now: 100,
        });

        expect(getPromptsBySourceId(result.matchState!, 'alien_scout_return')).toHaveLength(2);
    });

    it('交互解决时若侦察兵已离场，则不会重复返回', () => {
        const core = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('scout1', 'alien_scout', '1', 3),
                    makeMinion('m1', 'wizard_neophyte', '0', 2),
                ]),
            ],
        });

        const result = fireTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 3 }],
            random: dummyRandom,
            now: 101,
        });

        const interaction = getSimpleChoicePrompt(result.matchState!, 'alien_scout_return');

        const staleCore = makeState({
            bases: [
                makeBase('base_great_library', [
                    makeMinion('m1', 'wizard_neophyte', '0', 2),
                ]),
            ],
            players: {
                '0': core.players['0'],
                '1': {
                    ...core.players['1'],
                    discard: [
                        ...core.players['1'].discard,
                        { uid: 'scout1', defId: 'alien_scout', type: 'minion', owner: '1' },
                    ],
                },
            },
        });

        const stalePromptState = withOnlyCurrentPrompt(makeMatchState(staleCore), interaction);
        const resolved = respondToPromptOption(
            stalePromptState,
            option => option.value?.returnIt === true,
            'alien scout return option',
            '1',
            dummyRandom,
        );

        expect(resolved.success, resolved.error).toBe(true);
        expect(resolved.events.some(event => event.type === SU_EVENTS.MINION_RETURNED)).toBe(false);
        expect(resolved.finalState.core.players['1'].hand.some(card => card.uid === 'scout1')).toBe(false);
    });

    it('alien_scout 在对手计分时仍应把 queued afterScoring 选择权交给侦察兵控制者', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            bases: [
                makeBase('base_great_library', [
                    makeMinion('scout1', 'alien_scout', '1', 3),
                    makeMinion('m1', 'wizard_neophyte', '0', 2),
                ]),
                makeBase('base_other'),
            ],
        });

        const queued = collectTriggers(core, 'afterScoring', {
            state: core,
            matchState: makeMatchState(core),
            playerId: '0',
            baseIndex: 0,
            rankings: [{ playerId: '0', power: 10, vp: 3 }],
            random: dummyRandom,
            now: 102,
        });

        expect(queued).toBeDefined();
        const trigger = (queued as any).payload.triggers.find((entry: any) => entry.sourceCardUid === 'scout1');
        expect(trigger).toBeDefined();
        expect(trigger.ownerPlayerId).toBe('1');

        const queuedState = maybeResolveReactionQueue(
            makeMatchState({ ...core, triggerQueue: (queued as any).payload.triggers }),
            dummyRandom,
            102,
        );
        expect(queuedState).toBeDefined();
        expect(getSimpleChoicePrompt(queuedState!.state, 'alien_scout_return')?.playerId).toBe('1');
    });
});
