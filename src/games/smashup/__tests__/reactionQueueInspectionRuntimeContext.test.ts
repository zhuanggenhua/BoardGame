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
            inspectionZone: 'hand' as const,
            ownerCards: {
                hand: [makeCard('dyn-1', 'cowboys_dynamite_surprise', 'action', '0')],
                deck: [],
            },
            expectedZone: 'hand' as const,
        },
        {
            label: '被另一位玩家翻开牌库顶',
            inspectionZone: 'deck' as const,
            ownerCards: {
                hand: [],
                deck: [makeCard('dyn-1', 'cowboys_dynamite_surprise', 'action', '0')],
            },
            expectedZone: 'deck' as const,
        },
    ])('queued onDeckInspected trigger 在 $label 时仍应保留 inspection 上下文并打出炸药惊喜', ({ inspectionZone, ownerCards, expectedZone }) => {
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
            sourceDefId: 'cowboys_dynamite_surprise',
            mandatory: false,
            resolutionClass: 'optional',
            ownerPlayerId: '0',
            eventPlayerId: '1',
            witnessRequirement: 'zoneCardAtTriggerTime',
            witnessed: true,
            reason: `queued_inspection_${inspectionZone}`,
            inspectionCards: [{ uid: 'dyn-1', defId: 'cowboys_dynamite_surprise' }],
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
});
