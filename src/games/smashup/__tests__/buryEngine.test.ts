import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import {
    applyEvents,
    getPromptOption,
    getSimpleChoicePrompt,
    makeMatchState,
    makePlayer,
    makeState,
    respondToPrompt,
} from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { buildBuryCardEvents, buildBuriedCardReturnedToHandEvent, uncoverBuriedCard } from '../domain/bury';
import { isAbilityRuntimeContinuationEvent, resumeAbilityRuntimeContinuationEvent } from '../domain/abilityRuntime';

beforeAll(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    resetAbilityInit();
    clearInteractionHandlers();
    initAllAbilities();
});

describe('bury engine', () => {
    it('playing You Can Take It With You requires a chosen base and buries onto that base', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', {
                    hand: [{ uid: 'yk-play', defId: 'ancient_egyptians_you_can_take_it_with_you', type: 'action', owner: '0' } as any],
                    deck: [],
                    discard: [],
                    factions: ['ancient_egyptians', 'robots'] as any,
                }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [
                { defId: 'base_a', minions: [], ongoingActions: [] },
                { defId: 'base_pyramids', minions: [], ongoingActions: [] },
            ],
        });

        const result = runCommand(
            makeMatchState(core),
            { type: SU_COMMANDS.PLAY_ACTION, playerId: '0', payload: { cardUid: 'yk-play', targetBaseIndex: 1 } } as any,
            defaultTestRandom,
        );

        expect(result.success).toBe(true);
        expect(result.finalState.core.players['0'].hand.some(card => card.uid === 'yk-play')).toBe(false);
        expect(result.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'yk-play') ?? false).toBe(false);
        expect(result.finalState.core.bases[1].buriedCards?.some(card => card.uid === 'yk-play') ?? false).toBe(true);
    });

    it('at startTurn, player may uncover one buried card and play it as extra', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1, // endTurn -> startTurn will advance to player 0
            turnNumber: 1,
            players: {
                '0': makePlayer('0', { hand: [], deck: [], discard: [] }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'b1',
                    defId: 'robot_warbot',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            }],
        });

        const ms0 = makeMatchState(core);
        const enter = runCommand(ms0, { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: {}, timestamp: 1 } as any, defaultTestRandom);
        // onPhaseEnter(startTurn) should queue uncover interaction
        const interaction = getSimpleChoicePrompt(enter.finalState, 'bury_uncover_start_turn');
        const opt = getPromptOption(interaction, option => option.value?.cardUid === 'b1', 'buried b1 option');

        const res = respondToPrompt(enter.finalState, opt.id, '0', defaultTestRandom);
        // buried card removed
        expect(res.finalState.core.bases[0].buriedCards?.length ?? 0).toBe(0);
        // minion now in play
        expect(res.finalState.core.bases[0].minions.some(m => m.uid === 'b1')).toBe(true);
    });

    it('at startTurn, uncovering a buried onTurnStart minion should still resolve in the same window', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    deck: [{ uid: 'draw-1', defId: 'robot_warbot', type: 'minion', owner: '0' } as any],
                    discard: [],
                }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'wl-buried',
                    defId: 'killer_plant_water_lily_pod',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            }],
        });

        const enter = runCommand(
            makeMatchState(core),
            { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: {}, timestamp: 10 } as any,
            defaultTestRandom,
        );

        const interaction = getSimpleChoicePrompt(enter.finalState, 'bury_uncover_start_turn');
        const option = getPromptOption(interaction, entry => entry.value?.cardUid === 'wl-buried', 'buried Water Lily option');

        const resolved = respondToPrompt(enter.finalState, option.id, '0', defaultTestRandom);

        expect(resolved.success).toBe(true);
        const drawEvents = resolved.events.filter(event => event.type === SU_EVENTS.CARDS_DRAWN);
        expect(drawEvents).toHaveLength(1);
        expect((drawEvents[0] as any).payload.cardUids).toEqual(['draw-1']);
        expect(resolved.finalState.core.players['0'].hand.map(card => card.uid)).toEqual(['draw-1']);
        expect(resolved.finalState.core.bases[0].minions.some(m => m.uid === 'wl-buried')).toBe(true);
        expect(resolved.finalState.sys.phase).toBe('playCards');
    });

    it('uncovering a buried ongoing action without valid minion target should discard it', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', { hand: [], deck: [], discard: [] }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'curse-1',
                    defId: 'ancient_egyptians_ancient_curse_pod',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            }],
        });

        const enter = runCommand(
            makeMatchState(core),
            { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: {}, timestamp: 20 } as any,
            defaultTestRandom,
        );

        const interaction = getSimpleChoicePrompt(enter.finalState, 'bury_uncover_start_turn');
        const option = getPromptOption(interaction, entry => entry.value?.cardUid === 'curse-1', 'buried Ancient Curse option');

        const resolved = respondToPrompt(enter.finalState, option.id, '0', defaultTestRandom);

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].buriedCards?.length ?? 0).toBe(0);
        expect(resolved.finalState.core.bases[0].ongoingActions).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'curse-1')).toBe(true);
    });

    it('bury.uncoverBuriedCard 翻开 fairies_enchantment 后响应 minus 时，应在 prompt state 上看到已附着的 ongoing 并写入 metadata', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [], deck: [], discard: [] }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_a',
                minions: [{
                    uid: 'ally-1',
                    defId: 'robot_microbot_alpha',
                    controller: '0',
                    owner: '0',
                    basePower: 3,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                } as any],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'buried-enchantment',
                    defId: 'fairies_enchantment',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'play',
                }],
            }],
        });

        const uncovered = uncoverBuriedCard({
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'buried-enchantment',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 301,
            reason: 'test_uncover_fairies_enchantment_minus',
        });

        const continuation = uncovered.events.find(event => isAbilityRuntimeContinuationEvent(event as any));
        expect(continuation).toBeDefined();

        const committedCore = applyEvents(
            core,
            uncovered.events.filter(event => !isAbilityRuntimeContinuationEvent(event as any)) as any,
        );
        const committedState = makeMatchState(committedCore);

        expect(committedState.core.bases[0].ongoingActions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                uid: 'buried-enchantment',
                defId: 'fairies_enchantment',
                ownerId: '0',
            }),
        ]));

        const resumed = resumeAbilityRuntimeContinuationEvent(
            committedState,
            continuation as any,
            defaultTestRandom,
        );
        expect(resumed).toBeDefined();
        const prompt = getSimpleChoicePrompt(resumed!.state, 'fairies_enchantment');

        const minusOption = getPromptOption(prompt, option => option.value?.branchId === 'minus', 'buried fairies enchantment minus option');
        const resolved = respondToPrompt(resumed!.state, minusOption.id, '0', defaultTestRandom);

        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ONGOING_ATTACHED,
            payload: expect.objectContaining({
                cardUid: 'buried-enchantment',
                defId: 'fairies_enchantment',
                ownerId: '0',
                targetType: 'base',
                targetBaseIndex: 0,
                metadata: expect.objectContaining({ fairiesEnchantmentMode: 'minus' }),
            }),
        }));
        expect(resolved.finalState.core.bases[0].ongoingActions).toEqual(expect.arrayContaining([
            expect.objectContaining({
                uid: 'buried-enchantment',
                defId: 'fairies_enchantment',
                metadata: expect.objectContaining({ fairiesEnchantmentMode: 'minus' }),
            }),
        ]));
    });

    it('base cleared discards buried cards to true owners without uncovering', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [], deck: [], discard: [] }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'b2',
                    defId: 'robot_warbot',
                    trueOwnerId: '1',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            }],
        });
        const core2 = applyEvents(core, [{
            type: SU_EVENTS.BASE_CLEARED,
            payload: { baseIndex: 0, baseDefId: 'base_a' },
            timestamp: 1,
        } as any]);
        expect(core2.players['1'].discard.some(c => c.uid === 'b2')).toBe(true);
    });

    it('uncovering You Can Take It With You draws three cards and discards the card', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    deck: [
                        { uid: 'd1', defId: 'robot_warbot', type: 'minion', owner: '0' } as any,
                        { uid: 'd2', defId: 'robot_zapbot', type: 'minion', owner: '0' } as any,
                        { uid: 'd3', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' } as any,
                    ],
                    discard: [],
                }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_pyramids',
                minions: [],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'yk',
                    defId: 'ancient_egyptians_you_can_take_it_with_you',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'play',
                }],
            }],
        });

        const enter = runCommand(makeMatchState(core), { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: {}, timestamp: 1 } as any, defaultTestRandom);
        const interaction = getSimpleChoicePrompt(enter.finalState, 'bury_uncover_start_turn');
        const option = getPromptOption(interaction, entry => entry.value?.cardUid === 'yk', 'buried You Can Take It With You option');
        const resolved = respondToPrompt(enter.finalState, option.id, '0', defaultTestRandom);

        expect(resolved.finalState.core.players['0'].hand).toHaveLength(3);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'yk')).toBe(true);
        expect(resolved.finalState.core.bases[0].buriedCards?.length ?? 0).toBe(0);
        expect(resolved.finalState.core.bases[0].minions).toHaveLength(0);
    });

    it('burying a card from play removes the in-play minion and attached action', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [], deck: [], discard: [] }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_a',
                minions: [{
                    uid: 'mummy-1',
                    defId: 'ancient_egyptians_mummy',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [{ uid: 'attach-1', defId: 'ninja_poison', ownerId: '1' }],
                } as any],
                ongoingActions: [],
            }],
        });

        const events = buildBuryCardEvents({
            core,
            playerId: '0',
            cardUid: 'mummy-1',
            defId: 'ancient_egyptians_mummy',
            baseIndex: 0,
            trueOwnerId: '0',
            buriedFrom: 'play',
            reason: 'test_bury_from_play',
            random: defaultTestRandom,
            now: 10,
        });
        const next = applyEvents(core, events);

        expect(next.bases[0].minions.some(minion => minion.uid === 'mummy-1')).toBe(false);
        expect(next.bases[0].buriedCards?.some(card => card.uid === 'mummy-1')).toBe(true);
        expect(next.players['1'].discard.some(card => card.uid === 'attach-1')).toBe(true);
    });

    it('从埋葬区翻出的随从不能在同一条结算链里立即重新埋葬自己', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [], deck: [], discard: [] }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_a',
                minions: [{
                    uid: 'uncovered-1',
                    defId: 'skeletons_returned_one',
                    controller: '0',
                    owner: '0',
                    basePower: 2,
                    powerCounters: 0,
                    powerModifier: 0,
                    tempPowerModifier: 0,
                    talentUsed: false,
                    attachedActions: [],
                    metadata: { playedFrom: 'buried' },
                } as any],
                ongoingActions: [],
                buriedCards: [],
            }],
        });

        const events = buildBuryCardEvents({
            core,
            playerId: '0',
            cardUid: 'uncovered-1',
            defId: 'skeletons_returned_one',
            baseIndex: 0,
            trueOwnerId: '0',
            buriedFrom: 'play',
            reason: 'immediate_rebury_probe',
            random: defaultTestRandom,
            now: 11,
        });

        expect(events).toEqual([]);
    });

    it('BURIED_CARD_RETURNED_TO_HAND 会把埋葬牌直接移回手牌而不翻开或进弃牌堆', () => {
        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [], deck: [], discard: [] }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_pyramids',
                minions: [],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'buried-return',
                    defId: 'robot_warbot',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            }],
        });

        const event = buildBuriedCardReturnedToHandEvent({
            core,
            playerId: '0',
            cardUid: 'buried-return',
            baseIndex: 0,
            source: 'sphinx-start-turn',
            now: 20,
        });
        expect(event).toBeDefined();

        const next = applyEvents(core, [event!]);
        expect(next.bases[0].buriedCards?.some(card => card.uid === 'buried-return') ?? false).toBe(false);
        expect(next.players['0'].hand).toEqual(expect.arrayContaining([
            expect.objectContaining({
                uid: 'buried-return',
                defId: 'robot_warbot',
                owner: '0',
            }),
        ]));
        expect(next.players['0'].discard).toHaveLength(0);
        expect(next.bases[0].minions).toHaveLength(0);
    });

    it('翻开需要执行的埋葬行动若缺少声明会直接报错', async () => {
        vi.resetModules();
        vi.doMock('../data/cards', async () => {
            const actual = await vi.importActual<typeof import('../data/cards')>('../data/cards');
            return {
                ...actual,
                getCardDef: (defId: string) => {
                    if (defId === 'missing_bury_action') {
                        return {
                            id: defId,
                            name: '缺声明埋葬行动',
                            type: 'action',
                            subtype: 'standard',
                        } as any;
                    }
                    return actual.getCardDef(defId);
                },
            };
        });

        const { uncoverBuriedCard: uncoverBuriedCardWithMock } = await import('../domain/bury');

        const core = makeState({
            players: {
                '0': makePlayer('0', { hand: [], deck: [], discard: [] }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_a',
                minions: [],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'missing-bury-1',
                    defId: 'missing_bury_action',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'play',
                }],
            }],
        });

        expect(() => uncoverBuriedCardWithMock({
            matchState: makeMatchState(core),
            playerId: '0',
            cardUid: 'missing-bury-1',
            baseIndex: 0,
            random: defaultTestRandom,
            now: 200,
            reason: 'test_missing_bury_action',
        })).toThrowError(/SmashUp ability 缺少声明: missing_bury_action::onPlay \(bury\.executeUncoveredAction\)/);

        vi.doUnmock('../data/cards');
        vi.resetModules();
    });
});

