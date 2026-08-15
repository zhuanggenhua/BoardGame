import { beforeAll, describe, expect, it } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { scoreBaseViaFlow } from './helpers';
import type { SmashUpCore } from '../domain/types';
import { SU_EVENTS } from '../domain/types';

function makePlayer(id: string) {
    return {
        id,
        vp: 0,
        hand: [],
        deck: [],
        discard: [],
        minionsPlayed: 0,
        minionLimit: 1,
        actionsPlayed: 0,
        actionLimit: 1,
        factions: ['innsmouth', 'giant_ants'] as [string, string],
    };
}

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

describe('afterScoring 未注册 trigger 守门', () => {
    it('不会再走旧直执链，而是只反馈并消费 armed special', () => {
        const state: SmashUpCore = {
            players: {
                '0': makePlayer('0'),
                '1': makePlayer('1'),
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_the_jungle',
                    minions: [
                        {
                            uid: 'm1',
                            defId: 'test_minion',
                            controller: '0',
                            owner: '0',
                            basePower: 12,
                            powerCounters: 0,
                            powerModifier: 0,
                            tempPowerModifier: 0,
                            talentUsed: false,
                            attachedActions: [],
                        },
                    ],
                    ongoingActions: [],
                },
            ],
            baseDeck: [],
            turnNumber: 1,
            nextUid: 10,
            pendingAfterScoringSpecials: [
                {
                    sourceDefId: 'unknown_after_scoring_special',
                    playerId: '0',
                    baseIndex: 0,
                    cardUid: 'card-1',
                },
            ],
        };

        const result = scoreBaseViaFlow(state, 0, [], '0', 1000);
        const feedbackEvents = result.events.filter(event => event.type === SU_EVENTS.ABILITY_FEEDBACK);
        const consumedEvents = result.events.filter(event => event.type === SU_EVENTS.SPECIAL_AFTER_SCORING_CONSUMED);

        expect(feedbackEvents).toHaveLength(1);
        expect((feedbackEvents[0] as any).payload.sourceDefId).toBe('unknown_after_scoring_special');
        expect(consumedEvents).toHaveLength(1);
        expect((consumedEvents[0] as any).payload.cardUid).toBe('card-1');
    });
});
