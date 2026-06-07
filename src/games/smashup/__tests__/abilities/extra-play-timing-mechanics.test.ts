import { beforeAll, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';
import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { SU_EVENTS } from '../../domain/types';
import {
    getSimpleChoicePrompt,
    invokeRegisteredAbilityContract,
    makeMatchState,
    makePlayer,
    makeState,
    respondToPromptOption,
} from '../helpers';

const defaultRandom: RandomFn = {
    shuffle: (arr: any[]) => [...arr],
    random: () => 0.5,
    d: (_max: number) => 1,
    range: (_min: number, _max: number) => _min,
};

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('额外出牌时序机制', () => {
    it('cthulhu_whispers_in_darkness 的离阶段额外行动标记为 immediate', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            madnessDeck: ['mad-1'],
        });
        const matchState = makeMatchState(state);
        matchState.sys.phase = 'startTurn';

        const result = invokeRegisteredAbilityContract('cthulhu_whispers_in_darkness', 'onPlay', {
            state,
            matchState,
            playerId: '0',
            cardUid: 'a1',
            defId: 'cthulhu_whispers_in_darkness',
            baseIndex: 0,
            random: defaultRandom,
            now: 0,
        });

        const limitEvents = result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(2);
        expect(limitEvents.every(event => (event as any).payload.playTiming === 'immediate')).toBe(true);
    });

    it('miskatonic_those_meddling_kids_pod_mode 的离阶段额外行动标记为 immediate', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            madnessDeck: ['mad-1'],
        });
        const matchState = makeMatchState(state);
        matchState.sys.phase = 'startTurn';

        const firstStep = invokeRegisteredAbilityContract('miskatonic_those_meddling_kids_pod', 'onPlay', {
            state,
            matchState,
            playerId: '0',
            cardUid: 'tmk-pod',
            defId: 'miskatonic_those_meddling_kids_pod',
            random: defaultRandom,
            now: 0,
        });

        getSimpleChoicePrompt(firstStep.matchState ?? matchState, 'miskatonic_those_meddling_kids_pod_mode');
        const result = respondToPromptOption(
            firstStep.matchState ?? matchState,
            option => option.value?.mode === 'madness',
            'miskatonic those meddling kids pod madness mode option',
            '0',
            defaultRandom,
        );
        expect(result.success, result.error).toBe(true);

        const limitEvents = result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(1);
        expect((limitEvents[0] as any).payload.playTiming).toBe('immediate');
    });

    it('innsmouth_recruitment 的离阶段额外随从标记为 immediate', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            madnessDeck: ['mad-1', 'mad-2', 'mad-3'],
        });
        const matchState = makeMatchState(state);
        matchState.sys.phase = 'startTurn';

        const firstStep = invokeRegisteredAbilityContract('innsmouth_recruitment', 'onPlay', {
            state,
            matchState,
            playerId: '0',
            cardUid: 'recruitment-1',
            defId: 'innsmouth_recruitment',
            baseIndex: 0,
            random: defaultRandom,
            now: 0,
        });

        getSimpleChoicePrompt(firstStep.matchState!, 'innsmouth_recruitment');
        const result = respondToPromptOption(
            firstStep.matchState!,
            option => option.value?.count === 2,
            'innsmouth recruitment draw 2 option',
            '0',
            defaultRandom,
        );
        expect(result.success, result.error).toBe(true);

        const limitEvents = result.events.filter(event => event.type === SU_EVENTS.LIMIT_MODIFIED);
        expect(limitEvents).toHaveLength(2);
        expect(limitEvents.every(event => (event as any).payload.playTiming === 'immediate')).toBe(true);
    });
});
