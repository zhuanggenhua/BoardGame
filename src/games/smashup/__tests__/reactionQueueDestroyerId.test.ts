import { beforeAll, describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore, TriggerInstance } from '../domain/types';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { defaultTestRandom } from './testRunner';
import {
    getFirstPrompt,
    getPromptHandlerData,
    getPromptSourceId,
    getPromptsBySourceId,
    getReactionPromptOptionBySourceDefId,
    makeMatchState,
    makePlayer,
    makeState,
    respondToPrompt,
} from './helpers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('reaction queue: preserves destroyerId context', () => {
    it('vampire_mad_monster_party_pod trigger works when resolved from queue', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a-mmp', defId: 'vampire_mad_monster_party_pod', type: 'action', owner: '0' } as any],
                }),
                '1': makePlayer('1'),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_b', minions: [], ongoingActions: [] },
            ],
        });

        const trigger: TriggerInstance = {
            id: 't-mmp',
            timing: 'onMinionDestroyed',
            sourceDefId: 'vampire_mad_monster_party_pod',
            mandatory: false,
            ownerPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 1,
            triggerMinionUid: 'dead1',
            triggerMinionDefId: 'test_dead',
            destroyerId: '0',
            reason: 'test_destroy',
        };

        const ms: MatchState<SmashUpCore> = makeMatchState({ ...(core as any), triggerQueue: [trigger] });
        const rq = maybeResolveReactionQueue(ms, defaultTestRandom, 1);
        expect(rq).toBeDefined();

        const after = rq!.state;
        const first = getFirstPrompt(after);
        expect(first).toBeDefined();

        if (getPromptSourceId(first) === 'smashup_reaction_choose') {
            const option = getReactionPromptOptionBySourceDefId(after, first, 'vampire_mad_monster_party_pod');
            expect(option).toBeDefined();
            const resolved = respondToPrompt(
                after,
                option.id,
                '0',
                defaultTestRandom as any,
            );
            const nextState = resolved.finalState;
            const prompt = getPromptsBySourceId(nextState, 'vampire_mad_monster_party_pod_play')[0];
            expect(prompt).toBeDefined();
            expect(getPromptHandlerData(prompt)?.displayCard).toEqual({ defId: 'vampire_mad_monster_party_pod', cardUid: 'a-mmp' });
        } else {
            expect(getPromptSourceId(first)).toBe('vampire_mad_monster_party_pod_play');
            expect(getPromptHandlerData(first)?.displayCard).toEqual({ defId: 'vampire_mad_monster_party_pod', cardUid: 'a-mmp' });
        }
    });

    it('vampire_buffet_pod trigger prompt includes the playable card preview context', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'a-buffet', defId: 'vampire_buffet_pod', type: 'action', owner: '0' } as any],
                }),
                '1': makePlayer('1'),
            },
            bases: [{ defId: 'base_a', minions: [], ongoingActions: [] }],
        });

        const trigger: TriggerInstance = {
            id: 't-buffet',
            timing: 'onMinionDestroyed',
            sourceDefId: 'vampire_buffet_pod',
            mandatory: false,
            ownerPlayerId: '0',
            witnessRequirement: 'inPlayAtTriggerTime',
            witnessed: true,
            baseIndex: 0,
            triggerMinionUid: 'dead1',
            triggerMinionDefId: 'test_dead',
            destroyerId: '0',
            reason: 'test_destroy',
        };

        const ms: MatchState<SmashUpCore> = makeMatchState({ ...(core as any), triggerQueue: [trigger] });
        const rq = maybeResolveReactionQueue(ms, defaultTestRandom, 1);
        expect(rq).toBeDefined();

        const first = getFirstPrompt(rq!.state);
        expect(first).toBeDefined();
        if (getPromptSourceId(first) === 'smashup_reaction_choose') {
            const option = getReactionPromptOptionBySourceDefId(rq!.state, first, 'vampire_buffet_pod');
            const resolved = respondToPrompt(
                rq!.state,
                option.id,
                '0',
                defaultTestRandom as any,
            );
            const prompt = getPromptsBySourceId(resolved.finalState, 'vampire_buffet_pod_play')[0];
            expect(getPromptHandlerData(prompt)?.displayCard).toEqual({ defId: 'vampire_buffet_pod', cardUid: 'a-buffet' });
        } else {
            expect(getPromptSourceId(first)).toBe('vampire_buffet_pod_play');
            expect(getPromptHandlerData(first)?.displayCard).toEqual({ defId: 'vampire_buffet_pod', cardUid: 'a-buffet' });
        }
    });
});

