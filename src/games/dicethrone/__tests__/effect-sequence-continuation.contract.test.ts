import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../../engine/types';
import { attachEffectSequenceContinuation } from '../domain/attackEffectContinuationTypes';
import { beginEffectSequenceContinuation, resumeCompletedEffectSequence } from '../domain/attackEffectContinuation';
import type { DiceThroneEvent } from '../domain/types';
import { createHeroMatchup, fixedRandom } from './test-utils';

const blockerCases: Array<{
    name: string;
    request: GameEvent;
    blockerId: string;
    completion: GameEvent;
}> = [
    {
        name: 'choice',
        request: { type: 'CHOICE_REQUESTED', payload: { playerId: '1', sourceAbilityId: 'nested-choice' }, timestamp: 10 },
        blockerId: 'choice-1',
        completion: { type: 'CHOICE_RESOLVED', payload: { sourceAbilityId: 'nested-choice', interactionId: 'choice-1' }, timestamp: 11 },
    },
    {
        name: 'interaction',
        request: { type: 'INTERACTION_REQUESTED', payload: { interaction: { id: 'interaction-1' } }, timestamp: 10 },
        blockerId: 'interaction-1',
        completion: { type: 'SYS_INTERACTION_RESOLVED', payload: { interactionId: 'interaction-1' }, timestamp: 11 },
    },
    {
        name: 'token response',
        request: { type: 'TOKEN_RESPONSE_REQUESTED', payload: { pendingDamage: { id: 'damage-1' } }, timestamp: 10 },
        blockerId: 'dt-token-response-damage-1',
        completion: { type: 'TOKEN_RESPONSE_CLOSED', payload: { pendingDamageId: 'damage-1' }, timestamp: 11 },
    },
    {
        name: 'bonus dice',
        request: { type: 'BONUS_DICE_REROLL_REQUESTED', payload: { settlement: { id: 'settlement-1' } }, timestamp: 10 },
        blockerId: 'dt-bonus-dice-settlement-1',
        completion: { type: 'BONUS_DICE_SETTLED', payload: { settlementId: 'settlement-1' }, timestamp: 11 },
    },
    {
        name: 'compare roll',
        request: { type: 'COMPARE_ROLL_REQUESTED', payload: { context: { id: 'roll-1' } }, timestamp: 10 },
        blockerId: 'dt-compare-roll-roll-1',
        completion: { type: 'COMPARE_ROLL_SETTLED', payload: { contextId: 'roll-1' }, timestamp: 11 },
    },
    {
        name: 'Strange operation',
        request: { type: 'STRANGE_OPERATION_REQUESTED', payload: { playerId: '0', sourceId: 'strange-omen', continuationRequestId: 'strange-request-1' }, timestamp: 10 },
        blockerId: 'strange-request-1',
        completion: { type: 'STRANGE_OPERATION_RESOLVED', payload: { playerId: '0', sourceId: 'strange-omen', continuationRequestIds: ['strange-request-1'] }, timestamp: 11 },
    },
    {
        name: 'defender selection',
        request: { type: 'DEFENDER_SELECTION_REQUESTED', payload: { attackerId: '0', sourceAbilityId: 'attack' }, timestamp: 10 },
        blockerId: 'defender-selection-1',
        completion: { type: 'DEFENDER_SELECTION_RESOLVED', payload: { interactionId: 'defender-selection-1', attackerId: '0', sourceAbilityId: 'attack' }, timestamp: 11 },
    },
];

const attachTailDamage = (event: GameEvent, sequenceId: string) => {
    attachEffectSequenceContinuation(event as DiceThroneEvent, {
        kind: 'effect-sequence',
        sequenceId,
        effects: [{
            description: 'complete the effect tail',
            timing: 'immediate',
            action: { type: 'damage', target: 'opponent', value: 3 },
        } as any],
        timing: 'immediate',
        context: {
            attackerId: '0',
            defenderId: '1',
            sourceAbilityId: sequenceId,
            damageDealt: 0,
        },
        checkpoint: {
            nextEffectIndex: 0,
            bonusApplied: false,
            nyraAttackBonusApplied: false,
            passedFirstDamage: false,
            accumulatedBonusDamage: 0,
            damageDealt: 0,
        },
    });
};

const createState = () => createHeroMatchup('monk', 'barbarian')(['0', '1'], fixedRandom);

describe('通用效果续接帧 blocker 合同', () => {
    it.each(blockerCases)('$name 收口后恰好恢复一次剩余伤害', ({ name, request, blockerId, completion }) => {
        let state = createState();
        attachTailDamage(request, `tail-${name}`);
        state = beginEffectSequenceContinuation(state, request, blockerId).state;

        const resumed = resumeCompletedEffectSequence(state, [completion], fixedRandom, 12);
        expect(resumed?.events.filter((event) => event.type === 'DAMAGE_DEALT')).toHaveLength(1);
        expect(resumed?.state.sys.resolution?.frames ?? []).toHaveLength(0);
        expect(resumeCompletedEffectSequence(resumed!.state, [completion], fixedRandom, 13)).toBeUndefined();
    });

    it('同一效果序列的多个 blocker 全部收口后才恢复后缀', () => {
        let state = createState();
        const [choice, strangeOperation] = [blockerCases[0], blockerCases[5]];
        attachTailDamage(choice.request, 'multi-blocker-tail');
        state = beginEffectSequenceContinuation(state, choice.request, choice.blockerId).state;
        attachTailDamage(strangeOperation.request, 'multi-blocker-tail');
        state = beginEffectSequenceContinuation(state, strangeOperation.request, strangeOperation.blockerId).state;

        const first = resumeCompletedEffectSequence(state, [choice.completion], fixedRandom, 12);
        expect(first?.events).toEqual([]);
        expect(first?.state.sys.resolution?.frames).toHaveLength(1);

        const last = resumeCompletedEffectSequence(first!.state, [strangeOperation.completion], fixedRandom, 13);
        expect(last?.events.filter((event) => event.type === 'DAMAGE_DEALT')).toHaveLength(1);
        expect(last?.state.sys.resolution?.frames ?? []).toHaveLength(0);
        expect(resumeCompletedEffectSequence(last!.state, [strangeOperation.completion], fixedRandom, 14)).toBeUndefined();
    });
});
