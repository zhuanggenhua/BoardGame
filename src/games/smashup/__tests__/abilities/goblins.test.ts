import { beforeEach, describe, expect, it } from 'vitest';
import type { RandomFn } from '../../../../engine/types';

import { initAllAbilities, resetAbilityInit } from '../../abilities';
import { clearRegistry } from '../../domain/abilityRegistry';
import { isAbilityRuntimeContinuationEvent, resumeAbilityRuntimeContinuationEvent } from '../../domain/abilityRuntime';
import { clearBaseAbilityRegistry, triggerBaseAbility } from '../../domain/baseAbilities';
import { clearInteractionHandlers } from '../../domain/abilityInteractionHandlers';
import { clearOngoingEffectRegistry, fireTriggers } from '../../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../../domain/ongoingModifiers';
import { isSpecialLimitBlocked } from '../../domain/abilityHelpers';
import { SU_COMMANDS, SU_EVENTS } from '../../domain/types';
import { runCommand } from '../testRunner';
import {
    applyEvents,
    invokeRegisteredAbilityContract,
    makeBase,
    makeCard,
    makeMatchState,
    makeMinion,
    makePlayer,
    makeState,
} from '../helpers';

function randomSequence(values: number[]): RandomFn {
    let index = 0;
    return {
        shuffle: <T>(arr: T[]) => [...arr],
        random: () => values[Math.min(index++, values.length - 1)] ?? 0.5,
        d: () => 1,
        range: (min: number) => min,
    };
}

function resumeFirstRuntimeContinuation(state: ReturnType<typeof makeState>, events: unknown[], random: RandomFn) {
    const domainEvents = events.filter(event => !isAbilityRuntimeContinuationEvent(event as any));
    const continuation = events.find(event => isAbilityRuntimeContinuationEvent(event as any));
    if (!continuation) throw new Error('Expected Smash Up ability runtime continuation event.');
    return resumeAbilityRuntimeContinuationEvent(
        makeMatchState(applyEvents(state, domainEvents as any)),
        continuation as any,
        random,
    );
}

beforeEach(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    clearOngoingEffectRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

describe('哥布林能力', () => {
    it('一点帮助：正面给额外随从，反面给两个额外行动', () => {
        const state = makeState();
        const heads = invokeRegisteredAbilityContract('goblins_a_little_help', 'onPlay', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            cardUid: 'a-little-help',
            defId: 'goblins_a_little_help',
            baseIndex: 0,
            random: randomSequence([0.9]),
            now: 1000,
        });

        expect(heads.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.LIMIT_MODIFIED,
            payload: expect.objectContaining({ playerId: '0', limitType: 'minion', delta: 1 }),
        }));

        const tails = invokeRegisteredAbilityContract('goblins_a_little_help', 'onPlay', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            cardUid: 'a-little-help',
            defId: 'goblins_a_little_help',
            baseIndex: 0,
            random: randomSequence([0.1]),
            now: 1001,
        });

        const actionLimits = tails.events.filter(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED && (event as any).payload.limitType === 'action');
        expect(actionLimits).toHaveLength(2);
    });

    it('Gobbo：打出时按所有在场 Gobbo 投掷硬币，而不是只按刚打出的一个', () => {
        const state = makeState({
            bases: [
                makeBase('base_goblin_town', [
                    makeMinion('new-gobbo', 'goblins_gobbo', '0', 2),
                    makeMinion('existing-gobbo', 'goblins_gobbo', '0', 2),
                ]),
                makeBase('base_goblin_caves', [
                    makeMinion('other-player-gobbo', 'goblins_gobbo', '1', 2),
                ]),
            ],
        });

        const result = invokeRegisteredAbilityContract('goblins_gobbo', 'onPlay', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            cardUid: 'new-gobbo',
            defId: 'goblins_gobbo',
            baseIndex: 0,
            random: randomSequence([0.9]),
            now: 1000,
        });

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({ minionUid: 'new-gobbo', amount: 3 }),
        }));
    });

    it('谁放的屁：连续正面会放置指示物，第一次反面后给额外行动并停止', () => {
        const target = makeMinion('target-1', 'robot_zapbot', '0', 2);
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('smelt-it', 'goblins_he_who_smelt_it', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_goblin_town', minions: [target], ongoingActions: [] })],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: { cardUid: 'smelt-it', targetBaseIndex: 0, targetMinionUid: 'target-1' },
        }, randomSequence([0.9, 0.8, 0.1]));

        const counters = result.events.filter(event => event.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(counters).toHaveLength(2);
        expect(result.events.filter(event =>
            event.type === SU_EVENTS.LIMIT_MODIFIED && (event as any).payload.limitType === 'action',
        )).toHaveLength(1);
    });

    it('哥布林招募员：反面时可把弃牌堆牌洗回牌库', () => {
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    deck: [makeCard('deck-1', 'robot_zapbot', 'minion', '0')],
                    discard: [makeCard('discard-1', 'goblins_gobbo', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({
                defId: 'base_goblin_town',
                minions: [],
                ongoingActions: [{ uid: 'recruiters-1', defId: 'goblins_recruiters', ownerId: '0' }],
            })],
        });

        const result = invokeRegisteredAbilityContract('goblins_a_little_help', 'onPlay', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            cardUid: 'a-little-help',
            defId: 'goblins_a_little_help',
            baseIndex: 0,
            random: randomSequence([0.1, 0.9]),
            now: 1000,
        });

        const reorder = result.events.find(event => event.type === SU_EVENTS.DECK_REORDERED) as any;
        expect(reorder).toBeDefined();
        expect(reorder.payload.deckUids).toContain('discard-1');

        const after = applyEvents(state, result.events);
        expect(after.players['0'].deck.map(card => card.uid)).toContain('discard-1');
        expect(after.players['0'].discard.map(card => card.uid)).not.toContain('discard-1');
    });

    it('哥布林镇：随从打出后正面给该随从 +1 指示物', () => {
        const minion = makeMinion('new-minion', 'goblins_gobbo', '0', 2);
        const state = makeState({
            bases: [makeBase({ defId: 'base_goblin_town', minions: [minion], ongoingActions: [] })],
        });

        const result = triggerBaseAbility('base_goblin_town', 'onMinionPlayed', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            baseDefId: 'base_goblin_town',
            minionUid: 'new-minion',
            random: randomSequence([0.9]),
            now: 1000,
        } as any);

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({ minionUid: 'new-minion', amount: 1 }),
        }));
    });

    it('自己制造好运：在明确偏好正面的硬币场景会从手牌打出并改变结果', () => {
        const host = makeMinion('host-1', 'goblins_gobbo', '0', 2, {
            attachedActions: [{ uid: 'helmet-1', defId: 'goblins_magic_helmet', ownerId: '0' }],
        });
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('luck-1', 'goblins_make_your_own_luck', 'action', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_goblin_town', minions: [host], ongoingActions: [] })],
        });

        const result = fireTriggers(state, 'beforeScoring', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            baseIndex: 0,
            random: randomSequence([0.1]),
            now: 1000,
        });

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ACTION_PLAYED,
            payload: expect.objectContaining({ cardUid: 'luck-1', isExtraAction: true }),
        }));
        expect(result.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_DETACHED,
            payload: expect.objectContaining({ cardUid: 'helmet-1' }),
        }));
    });

    it('占卜师：同回合可弃一张手牌把明确偏好的硬币结果改成正面', () => {
        const diviner = makeMinion('diviner-1', 'goblins_diviner', '0', 4);
        const state = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('new-minion', 'robot_zapbot', 'minion', '0'),
                        makeCard('discard-me', 'robot_zapbot', 'minion', '0'),
                    ],
                    deck: [makeCard('draw-1', 'robot_zapbot', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase({ defId: 'base_goblin_town', minions: [diviner], ongoingActions: [] })],
        });

        const result = runCommand(makeMatchState(state), {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: '0',
            payload: { cardUid: 'new-minion', baseIndex: 0 },
        }, randomSequence([0.1]));

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DISCARDED,
            payload: expect.objectContaining({ cardUids: ['discard-me'] }),
        }));
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_METADATA_UPDATED,
            payload: expect.objectContaining({ minionUid: 'diviner-1' }),
        }));
        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.POWER_COUNTER_ADDED,
            payload: expect.objectContaining({ minionUid: 'new-minion', amount: 1 }),
        }));
    });

    it('爆破手：反面移动时可使用传入目标基地作为目的地', () => {
        const blaster = makeMinion('blaster-1', 'goblins_blaster', '0', 3);
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_goblin_town', minions: [blaster], ongoingActions: [] }),
                makeBase({ defId: 'base_goblin_caves', minions: [], ongoingActions: [] }),
                makeBase({ defId: 'base_round_table', minions: [], ongoingActions: [] }),
            ],
        });
        const random = randomSequence([0.1]);

        const result = invokeRegisteredAbilityContract('goblins_blaster', 'special', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            cardUid: 'blaster-1',
            defId: 'goblins_blaster',
            baseIndex: 0,
            targetBaseIndex: 2,
            random,
            now: 1000,
        } as any);
        const resumed = resumeFirstRuntimeContinuation(state, result.events, random);

        expect(resumed?.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.MINION_MOVED,
            payload: expect.objectContaining({
                minionUid: 'blaster-1',
                fromBaseIndex: 0,
                toBaseIndex: 2,
            }),
        }));
    });

    it('爆破手：首次在基地计分前发动会写入该基地本回合限制，不能重复触发', () => {
        const blaster = makeMinion('blaster-limit', 'goblins_blaster', '0', 3);
        const state = makeState({
            bases: [
                makeBase({ defId: 'base_goblin_town', minions: [blaster], ongoingActions: [] }),
                makeBase({ defId: 'base_goblin_caves', minions: [], ongoingActions: [] }),
            ],
        });

        const result = invokeRegisteredAbilityContract('goblins_blaster', 'special', {
            state,
            matchState: makeMatchState(state),
            playerId: '0',
            cardUid: 'blaster-limit',
            defId: 'goblins_blaster',
            baseIndex: 0,
            random: randomSequence([0.9]),
            now: 1001,
        } as any);

        expect(result.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.SPECIAL_LIMIT_USED,
            payload: expect.objectContaining({
                baseIndex: 0,
                limitGroup: 'goblins_blaster',
                abilityDefId: 'goblins_blaster',
            }),
        }));
        const after = applyEvents(state, result.events);
        expect(after.specialLimitUsed?.goblins_blaster).toEqual([0]);
        expect(isSpecialLimitBlocked(after, 'goblins_blaster', 0)).toBe(true);
    });
});
