import { beforeEach, describe, expect, it } from 'vitest';
import type { MatchState } from '../../../engine/types';
import type { SmashUpCore, TriggerInstance } from '../domain/types';
import { clearRegistry } from '../domain/abilityRegistry';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { maybeResolveReactionQueue } from '../domain/reactionQueue';
import { defaultTestRandom, runCommand } from './testRunner';
import { getInteractionsFromMS, makeBase, makeCard, makeMatchState, makeMinion, makePlayer, makeState } from './helpers';

describe('reaction queue: preserves inspection runtime context', () => {
    beforeEach(() => {
        clearRegistry();
        clearBaseAbilityRegistry();
        clearInteractionHandlers();
        resetAbilityInit();
        initAllAbilities();
    });

    it.each([
        {
            label: '被另一位玩家展示手牌',
            defId: 'cowboys_dynamite_surprise',
            inspectionZone: 'hand' as const,
            ownerCards: {
                hand: [makeCard('dyn-1', 'cowboys_dynamite_surprise', 'action', '0')],
                deck: [],
            },
            expectedZone: 'hand' as const,
        },
        {
            label: '被另一位玩家翻开牌库顶',
            defId: 'cowboys_dynamite_surprise',
            inspectionZone: 'deck' as const,
            ownerCards: {
                hand: [],
                deck: [makeCard('dyn-1', 'cowboys_dynamite_surprise', 'action', '0')],
            },
            expectedZone: 'deck' as const,
        },
        {
            label: '被另一位玩家展示手牌（POD）',
            defId: 'cowboys_dynamite_surprise_pod',
            inspectionZone: 'hand' as const,
            ownerCards: {
                hand: [makeCard('dyn-1', 'cowboys_dynamite_surprise_pod', 'action', '0')],
                deck: [],
            },
            expectedZone: 'hand' as const,
        },
        {
            label: '被另一位玩家翻开牌库顶（POD）',
            defId: 'cowboys_dynamite_surprise_pod',
            inspectionZone: 'deck' as const,
            ownerCards: {
                hand: [],
                deck: [makeCard('dyn-1', 'cowboys_dynamite_surprise_pod', 'action', '0')],
            },
            expectedZone: 'deck' as const,
        },
    ])('queued onDeckInspected trigger 在 $label 时仍应保留 inspection 上下文并打出炸药惊喜', ({ defId, inspectionZone, ownerCards, expectedZone }) => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', ownerCards),
                '1': makePlayer('1'),
            },
            bases: [{
                defId: 'base_a',
                minions: [makeMinion('enemy-1', 'robot_microbot_alpha', '1', 4)],
                ongoingActions: [],
            }],
        });

        const trigger: TriggerInstance = {
            id: `queued-dynamite-${inspectionZone}`,
            timing: 'onDeckInspected',
            sourceDefId: defId,
            mandatory: false,
            resolutionClass: 'optional',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'zoneCardAtTriggerTime',
            witnessed: true,
            reason: `queued_inspection_${inspectionZone}`,
            inspectionCards: [{ uid: 'dyn-1', defId }],
            inspectionZone,
            inspectionTargetPlayerIds: ['0'],
            inspectionCausePlayerId: '1',
        };

        const ms: MatchState<SmashUpCore> = makeMatchState({
            ...(core as SmashUpCore),
            triggerQueue: [trigger],
        });

        const resolved = maybeResolveReactionQueue(ms, defaultTestRandom, 1000);
        expect(resolved).toBeDefined();

        let promptState = resolved!.state;
        const firstInteraction = getInteractionsFromMS(promptState)[0] as any;
        if (firstInteraction?.data?.sourceId === 'smashup_reaction_choose') {
            const option = firstInteraction.data.options.find((entry: any) => entry.value?.kind === 'trigger');
            expect(option).toBeDefined();
            const chosen = runCommand(
                promptState,
                {
                    type: 'SYS_INTERACTION_RESPOND' as any,
                    playerId: firstInteraction.playerId,
                    payload: { optionId: option.id },
                } as any,
                defaultTestRandom,
            );
            promptState = chosen.finalState;
        }

        const prompt = getInteractionsFromMS(promptState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cowboys_dynamite_surprise_seen');
        expect(prompt?.playerId).toBe('0');

        const target = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        expect(target).toBeDefined();

        const responded = runCommand(promptState, {
            type: 'SYS_INTERACTION_RESPOND' as any,
            playerId: '0',
            payload: { optionId: target.id },
        } as any, defaultTestRandom);

        if (expectedZone === 'hand') {
            expect(responded.finalState.core.players['0'].hand.some(card => card.uid === 'dyn-1')).toBe(false);
        } else {
            expect(responded.finalState.core.players['0'].deck.some(card => card.uid === 'dyn-1')).toBe(false);
        }
        expect(responded.finalState.core.players['0'].discard.some(card => card.uid === 'dyn-1')).toBe(true);
        expect(responded.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
    });

    it('queued onDeckInspected trigger 在同次 inspection 同时暴露两张 Dynamite Surprise 时，应按 sourceCardUid 只打出被排队的那张', () => {
        const core = makeState({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 1,
            players: {
                '0': makePlayer('0', {
                    hand: [
                        makeCard('dyn-a', 'cowboys_dynamite_surprise', 'action', '0'),
                        makeCard('dyn-b', 'cowboys_dynamite_surprise', 'action', '0'),
                    ],
                }),
                '1': makePlayer('1'),
            },
            bases: [makeBase('base_a', [
                makeMinion('enemy-1', 'robot_microbot_alpha', '1', 4),
            ])],
        });

        const trigger: TriggerInstance = {
            id: 'queued-dynamite-hand-multi-source',
            timing: 'onDeckInspected',
            sourceDefId: 'cowboys_dynamite_surprise',
            sourceCardUid: 'dyn-b',
            sourceControllerId: '0',
            mandatory: false,
            resolutionClass: 'optional',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'zoneCardAtTriggerTime',
            witnessed: true,
            reason: 'queued_inspection_same_owner_multi_source',
            inspectionCards: [
                { uid: 'dyn-a', defId: 'cowboys_dynamite_surprise' },
                { uid: 'dyn-b', defId: 'cowboys_dynamite_surprise' },
            ],
            inspectionZone: 'hand',
            inspectionTargetPlayerIds: ['0'],
            inspectionCausePlayerId: '1',
        };

        const resolved = maybeResolveReactionQueue(
            makeMatchState({
                ...(core as SmashUpCore),
                triggerQueue: [trigger],
            }),
            defaultTestRandom,
            1300,
        );
        expect(resolved).toBeDefined();

        let promptState = resolved!.state;
        const firstInteraction = getInteractionsFromMS(promptState)[0] as any;
        if (firstInteraction?.data?.sourceId === 'smashup_reaction_choose') {
            const option = firstInteraction.data.options.find((entry: any) => entry.value?.kind === 'trigger');
            expect(option).toBeDefined();
            const chosen = runCommand(
                promptState,
                {
                    type: 'SYS_INTERACTION_RESPOND' as any,
                    playerId: firstInteraction.playerId,
                    payload: { optionId: option.id },
                } as any,
                defaultTestRandom,
            );
            promptState = chosen.finalState;
        }

        const prompt = getInteractionsFromMS(promptState)[0] as any;
        expect(prompt?.data?.sourceId).toBe('cowboys_dynamite_surprise_seen');
        expect(prompt?.playerId).toBe('0');

        const target = prompt.data.options.find((entry: any) => entry.value?.minionUid === 'enemy-1');
        expect(target).toBeDefined();

        const responded = runCommand(promptState, {
            type: 'SYS_INTERACTION_RESPOND' as any,
            playerId: '0',
            payload: { optionId: target.id },
        } as any, defaultTestRandom);

        expect(responded.finalState.core.players['0'].hand.some(card => card.uid === 'dyn-a')).toBe(true);
        expect(responded.finalState.core.players['0'].hand.some(card => card.uid === 'dyn-b')).toBe(false);
        expect(responded.finalState.core.players['0'].discard.some(card => card.uid === 'dyn-a')).toBe(false);
        expect(responded.finalState.core.players['0'].discard.some(card => card.uid === 'dyn-b')).toBe(true);
        expect(responded.finalState.core.bases[0].minions.some(minion => minion.uid === 'enemy-1')).toBe(false);
    });
});
