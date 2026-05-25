import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry, registerBaseAbility } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { findInteractionOption, makeCard, makeMatchState, makeMinion, makePlayer, makeState, applyEvents, resolveInteractionChain } from './helpers';
import { runCommand, defaultTestRandom } from './testRunner';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { INTERACTION_COMMANDS } from '../../../engine/systems/InteractionSystem';
import { buildBuryCardEvents, buildBuriedCardReturnedToHandEvent } from '../domain/bury';

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
        const interaction = enter.finalState.sys.interaction.current;
        expect(interaction?.data?.sourceId).toBe('bury_uncover_start_turn');
        const opt = (interaction as any).data.options.find((o: any) => o.value?.cardUid === 'b1');
        expect(opt).toBeTruthy();

        const res = runCommand(
            enter.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: opt.id } } as any,
            defaultTestRandom,
        );
        // buried card removed
        expect(res.finalState.core.bases[0].buriedCards?.length ?? 0).toBe(0);
        // minion now in play
        expect(res.finalState.core.bases[0].minions.some(m => m.uid === 'b1')).toBe(true);
    });

    it('uncovering a borrowed buried minion should preserve true owner when played', () => {
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
                    uid: 'borrowed-buried-minion',
                    defId: 'robot_warbot',
                    trueOwnerId: '1',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            }],
        });

        const enter = runCommand(
            makeMatchState(core),
            { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: {}, timestamp: 11 } as any,
            defaultTestRandom,
        );
        const interaction = enter.finalState.sys.interaction.current as any;
        expect(interaction?.data?.sourceId).toBe('bury_uncover_start_turn');
        const option = interaction.data.options.find((entry: any) => entry.value?.cardUid === 'borrowed-buried-minion');
        expect(option).toBeTruthy();

        const resolved = runCommand(
            enter.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: option.id }, timestamp: 12 } as any,
            defaultTestRandom,
        );

        const playedEvent = resolved.events.find(event => event.type === SU_EVENTS.MINION_PLAYED) as any;
        expect(playedEvent?.payload?.ownerId).toBe('1');
        const playedMinion = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'borrowed-buried-minion');
        expect(playedMinion?.controller).toBe('0');
        expect(playedMinion?.owner).toBe('1');
        expect(resolved.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'borrowed-buried-minion') ?? false).toBe(false);
    });

    it('uncovered buried action should respect queued base onActionPlayed canTrigger instead of direct execution', () => {
        registerBaseAbility('base_bury_queue_test', 'onActionPlayed', (ctx) => ({
            events: [{
                type: SU_EVENTS.ABILITY_FEEDBACK,
                payload: { playerId: ctx.playerId, messageKey: 'base_bury_queue_test_ran', tone: 'info' },
                timestamp: ctx.now,
            } as any],
        }), {
            canTrigger: () => false,
        });

        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', { hand: [], deck: [], discard: [], factions: ['zombies'] as any }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_bury_queue_test',
                minions: [],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'buried-overrun',
                    defId: 'zombie_overrun',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            }],
        });

        const enter = runCommand(
            makeMatchState(core),
            { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: {}, timestamp: 30 } as any,
            defaultTestRandom,
        );

        const interaction = enter.finalState.sys.interaction.current as any;
        expect(interaction?.data?.sourceId).toBe('bury_uncover_start_turn');
        const option = interaction.data.options.find((entry: any) => entry.value?.cardUid === 'buried-overrun');
        expect(option).toBeTruthy();

        const resolved = runCommand(
            enter.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: option.id }, timestamp: 31 } as any,
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.events).not.toContainEqual(expect.objectContaining({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: expect.objectContaining({ messageKey: 'base_bury_queue_test_ran' }),
        }));
    });

    it('uncovering a buried ongoing action should preserve target context for queued onActionPlayed base abilities', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    deck: [{ uid: 'drawn-curse', defId: 'robot_warbot', type: 'minion', owner: '0' } as any],
                    discard: [],
                    factions: ['ancient_egyptians', 'robots'] as any,
                }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_enchanted_glade',
                minions: [makeMinion('curse-target', 'robot_warbot', '0', 3, { powerCounters: 1 })],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'buried-curse',
                    defId: 'ancient_egyptians_ancient_curse_pod',
                    trueOwnerId: '0',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            }],
        });

        const enter = runCommand(
            makeMatchState(core),
            { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: {}, timestamp: 40 } as any,
            defaultTestRandom,
        );

        const resolved = resolveInteractionChain(enter.finalState, (prompt) => {
            if (prompt?.data?.sourceId === 'bury_uncover_start_turn') {
                const option = findInteractionOption(prompt, entry => entry?.value?.cardUid === 'buried-curse');
                expect(option).toBeDefined();
                return { optionId: option.id };
            }
            if (prompt?.data?.sourceId === 'ancient_egyptians_ancient_curse_confirm') {
                const option = findInteractionOption(prompt, entry => entry?.value?.apply === true);
                expect(option).toBeDefined();
                return { optionId: option.id };
            }
            throw new Error(`未处理的埋葬翻开交互 sourceId: ${prompt?.data?.sourceId ?? 'unknown'}`);
        });

        const actionPlayed = resolved.events.find(event => event.type === SU_EVENTS.ACTION_PLAYED) as any;
        expect(actionPlayed?.payload).toEqual(expect.objectContaining({
            targetBaseIndex: 0,
            targetType: 'minion',
            targetMinionUid: 'curse-target',
        }));
        expect(resolved.events).toContainEqual(expect.objectContaining({
            type: SU_EVENTS.CARDS_DRAWN,
            payload: expect.objectContaining({
                playerId: '0',
                cardUids: ['drawn-curse'],
            }),
        }));
    });

    it('uncovering a borrowed buried ongoing action should preserve true owner when attaching', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [],
                    deck: [],
                    discard: [],
                    factions: ['ancient_egyptians', 'robots'] as any,
                }),
                '1': makePlayer('1', { hand: [], deck: [], discard: [] }),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('curse-target', 'robot_warbot', '0', 3)],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'borrowed-buried-curse',
                    defId: 'ancient_egyptians_ancient_curse_pod',
                    trueOwnerId: '1',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            }],
        });

        const enter = runCommand(
            makeMatchState(core),
            { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: {}, timestamp: 41 } as any,
            defaultTestRandom,
        );

        const resolved = resolveInteractionChain(enter.finalState, (prompt) => {
            if (prompt?.data?.sourceId === 'bury_uncover_start_turn') {
                const option = findInteractionOption(prompt, entry => entry?.value?.cardUid === 'borrowed-buried-curse');
                expect(option).toBeDefined();
                return { optionId: option.id };
            }
            if (prompt?.data?.sourceId === 'ancient_egyptians_ancient_curse_confirm') {
                const option = findInteractionOption(prompt, entry => entry?.value?.apply === false);
                expect(option).toBeDefined();
                return { optionId: option.id };
            }
            throw new Error(`未处理的埋葬翻开交互 sourceId: ${prompt?.data?.sourceId ?? 'unknown'}`);
        });

        const attachedEvent = resolved.events.find(event =>
            event.type === SU_EVENTS.ONGOING_ATTACHED
            && (event as any).payload?.cardUid === 'borrowed-buried-curse'
        ) as any;
        expect(attachedEvent?.payload?.ownerId).toBe('1');

        const host = resolved.finalState.core.bases[0].minions.find(minion => minion.uid === 'curse-target');
        expect(host?.attachedActions.find(action => action.uid === 'borrowed-buried-curse')?.ownerId).toBe('1');
        expect(resolved.finalState.core.bases[0].buriedCards?.some(card => card.uid === 'borrowed-buried-curse') ?? false).toBe(false);
    });

    it('uncovering a borrowed buried ongoing action onto Brownie should preserve sourcePlayerId for onMinionAffected triggers', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            turnNumber: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('p0-hand-a', 'sharks_mako', 'minion', '0')],
                    deck: [],
                    discard: [],
                }),
                '1': makePlayer('1', {
                    hand: [makeCard('p1-hand-a', 'robot_microbot', 'minion', '1')],
                    deck: [],
                    discard: [],
                }),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('brownie-target', 'trickster_brownie', '1', 2)],
                ongoingActions: [],
                buriedCards: [{
                    uid: 'borrowed-buried-brownie-curse',
                    defId: 'ancient_egyptians_ancient_curse_pod',
                    trueOwnerId: '1',
                    controllerId: '0',
                    buriedFrom: 'hand',
                }],
            }],
        });

        const enter = runCommand(
            makeMatchState(core),
            { type: 'ADVANCE_PHASE' as any, playerId: '1', payload: {}, timestamp: 51 } as any,
            defaultTestRandom,
        );

        const resolved = resolveInteractionChain(enter.finalState, (prompt) => {
            if (prompt?.data?.sourceId === 'bury_uncover_start_turn') {
                const option = findInteractionOption(prompt, entry => entry?.value?.cardUid === 'borrowed-buried-brownie-curse');
                expect(option).toBeDefined();
                return { optionId: option.id };
            }
            if (prompt?.data?.sourceId === 'ancient_egyptians_ancient_curse_confirm') {
                const option = findInteractionOption(prompt, entry => entry?.value?.apply === false);
                expect(option).toBeDefined();
                return { optionId: option.id };
            }
            throw new Error(`未处理的埋葬翻开交互 sourceId: ${prompt?.data?.sourceId ?? 'unknown'}`);
        });

        const attachedEvent = resolved.events.find(event =>
            event.type === SU_EVENTS.ONGOING_ATTACHED
            && (event as any).payload?.cardUid === 'borrowed-buried-brownie-curse'
        ) as any;
        expect(attachedEvent?.payload).toEqual(expect.objectContaining({
            ownerId: '1',
            sourcePlayerId: '0',
            targetType: 'minion',
            targetBaseIndex: 0,
            targetMinionUid: 'brownie-target',
        }));

        const queued = resolved.events.find(event => event.type === SU_EVENTS.TRIGGER_QUEUED) as any;
        expect(queued).toBeDefined();
        const brownieTrigger = queued?.payload?.triggers?.find((trigger: any) => trigger.sourceDefId === 'trickster_brownie');
        expect(brownieTrigger).toEqual(expect.objectContaining({
            sourceDefId: 'trickster_brownie',
            sourceCardUid: 'brownie-target',
            sourceControllerId: '1',
            ownerPlayerId: '1',
            eventPlayerId: '0',
        }));
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

        const interaction = enter.finalState.sys.interaction.current as any;
        expect(interaction?.data?.sourceId).toBe('bury_uncover_start_turn');
        const option = interaction.data.options.find((entry: any) => entry.value?.cardUid === 'wl-buried');
        expect(option).toBeTruthy();

        const resolved = runCommand(
            enter.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: option.id }, timestamp: 11 } as any,
            defaultTestRandom,
        );

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

        const interaction = enter.finalState.sys.interaction.current as any;
        expect(interaction?.data?.sourceId).toBe('bury_uncover_start_turn');
        const option = interaction.data.options.find((entry: any) => entry.value?.cardUid === 'curse-1');
        expect(option).toBeTruthy();

        const resolved = runCommand(
            enter.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: option.id }, timestamp: 21 } as any,
            defaultTestRandom,
        );

        expect(resolved.success).toBe(true);
        expect(resolved.finalState.core.bases[0].buriedCards?.length ?? 0).toBe(0);
        expect(resolved.finalState.core.bases[0].ongoingActions).toHaveLength(0);
        expect(resolved.finalState.core.players['0'].discard.some(card => card.uid === 'curse-1')).toBe(true);
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
        const interaction = enter.finalState.sys.interaction.current as any;
        const option = interaction.data.options.find((entry: any) => entry.value?.cardUid === 'yk');
        const resolved = runCommand(
            enter.finalState,
            { type: INTERACTION_COMMANDS.RESPOND, playerId: '0', payload: { optionId: option.id } } as any,
            defaultTestRandom,
        );

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

