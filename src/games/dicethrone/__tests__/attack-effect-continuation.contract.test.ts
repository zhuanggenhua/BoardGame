import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../../engine/types';
import type { DiceThroneEvent } from '../domain/types';
import { attachAttackEffectContinuation, getEffectSequenceBlockerId, isAttackEffectSequenceBlocker } from '../domain/attackEffectContinuationTypes';
import { beginEffectSequenceContinuation, resumeCompletedEffectSequence } from '../domain/attackEffectContinuation';
import { createHeroMatchup, fixedRandom } from './test-utils';

const baseCursor = {
    kind: 'attack-effect-sequence' as const,
    stage: 'preDefense' as const,
    attackerId: '0',
    defenderId: '1',
    attackSourceAbilityId: 'deep-sea-dive',
    effectSourceAbilityId: 'deep-sea-dive',
    checkpoint: {
        nextEffectIndex: 100,
        bonusApplied: false,
        nyraAttackBonusApplied: false,
        passedFirstDamage: false,
        accumulatedBonusDamage: 0,
        damageDealt: 0,
    },
};

const cases: Array<{
    name: string;
    request: GameEvent;
    blockerId: string;
    completion: GameEvent;
}> = [
    {
        name: '选择',
        request: { type: 'CHOICE_REQUESTED', payload: { playerId: '1', sourceAbilityId: 'status-choice' }, timestamp: 10 },
        blockerId: 'choice-interaction-1',
        completion: { type: 'CHOICE_RESOLVED', payload: { playerId: '1', sourceAbilityId: 'status-choice', interactionId: 'choice-interaction-1' }, timestamp: 11 },
    },
    {
        name: '普通交互',
        request: { type: 'INTERACTION_REQUESTED', payload: { interaction: { id: 'interaction-1' } }, timestamp: 10 },
        blockerId: 'dt-interaction-interaction-1',
        completion: { type: 'SYS_INTERACTION_RESOLVED', payload: { interactionId: 'dt-interaction-interaction-1' }, timestamp: 11 },
    },
    {
        name: 'Token 响应',
        request: { type: 'TOKEN_RESPONSE_REQUESTED', payload: { pendingDamage: { id: 'damage-1' } }, timestamp: 10 },
        blockerId: 'dt-token-response-damage-1',
        completion: { type: 'TOKEN_RESPONSE_CLOSED', payload: { pendingDamageId: 'damage-1' }, timestamp: 11 },
    },
    {
        name: '奖励骰',
        request: { type: 'BONUS_DICE_REROLL_REQUESTED', payload: { settlement: { id: 'settlement-1' } }, timestamp: 10 },
        blockerId: 'dt-bonus-dice-settlement-1',
        completion: { type: 'BONUS_DICE_SETTLED', payload: { settlementId: 'settlement-1' }, timestamp: 11 },
    },
    {
        name: '对掷',
        request: { type: 'COMPARE_ROLL_REQUESTED', payload: { context: { id: 'roll-1' } }, timestamp: 10 },
        blockerId: 'dt-compare-roll-roll-1',
        completion: { type: 'COMPARE_ROLL_SETTLED', payload: { contextId: 'roll-1' }, timestamp: 11 },
    },
    {
        name: '奇异博士操作',
        request: { type: 'STRANGE_OPERATION_REQUESTED', payload: { playerId: '0', sourceId: 'strange-omen', continuationRequestId: 'strange-request-1' }, timestamp: 10 },
        blockerId: 'strange-request-1',
        completion: { type: 'STRANGE_OPERATION_RESOLVED', payload: { playerId: '0', sourceId: 'strange-omen', continuationRequestIds: ['strange-request-1'] }, timestamp: 11 },
    },
    {
        name: '防御者选择',
        request: { type: 'DEFENDER_SELECTION_REQUESTED', payload: { attackerId: '0', sourceAbilityId: 'deep-sea-dive' }, timestamp: 10 },
        blockerId: 'defender-selection-1',
        completion: { type: 'DEFENDER_SELECTION_RESOLVED', payload: { interactionId: 'defender-selection-1', attackerId: '0', chooserPlayerId: '0', defenderId: '1', sourceAbilityId: 'deep-sea-dive' }, timestamp: 11 },
    },
];

function tagged(event: GameEvent): DiceThroneEvent {
    attachAttackEffectContinuation(event as DiceThroneEvent, baseCursor);
    return event as DiceThroneEvent;
}

function createState() {
    const state = createHeroMatchup('cursed_pirate', 'barbarian')(['0', '1'], fixedRandom);
    state.core.pendingAttack = {
        attackerId: '0', defenderId: '1', sourceAbilityId: 'deep-sea-dive', isDefendable: true, damage: 8,
    };
    return state;
}

describe('攻击效果续接帧完成信号合同', () => {
    it.each(cases)('$name 收口后只恢复一次并移除帧', ({ request, blockerId, completion }) => {
        let state = createState();
        state = beginEffectSequenceContinuation(state, tagged(request), blockerId).state;

        const resumed = resumeCompletedEffectSequence(state, [completion], fixedRandom, 12);
        expect(resumed?.events.filter((event) => event.type === 'ATTACK_PRE_DEFENSE_RESOLVED')).toHaveLength(1);
        expect(resumed?.state.sys.resolution?.frames ?? []).toHaveLength(0);
        expect(resumeCompletedEffectSequence(resumed!.state, [completion], fixedRandom, 13)).toBeUndefined();
    });

    it('同一游标的多个阻塞都完成前不恢复，最后一个信号持久化后只恢复一次', () => {
        let state = createState();
        state = beginEffectSequenceContinuation(state, tagged(cases[0].request), cases[0].blockerId).state;
        state = beginEffectSequenceContinuation(state, tagged(cases[5].request), cases[5].blockerId).state;

        const first = resumeCompletedEffectSequence(state, [cases[0].completion], fixedRandom, 12);
        expect(first?.events).toEqual([]);

        const second = resumeCompletedEffectSequence(first!.state, [cases[5].completion], fixedRandom, 13);
        expect(second?.events.filter((event) => event.type === 'ATTACK_PRE_DEFENSE_RESOLVED')).toHaveLength(1);
        expect(second?.state.sys.resolution?.frames ?? []).toHaveLength(0);
        expect(resumeCompletedEffectSequence(second!.state, [cases[5].completion], fixedRandom, 14)).toBeUndefined();
    });

    it('同源的多个选择只由各自 interactionId 完成，不串解其他选择', () => {
        const firstRequest: GameEvent = {
            type: 'CHOICE_REQUESTED',
            payload: { playerId: '1', sourceAbilityId: 'status-choice' },
            timestamp: 10,
        };
        const secondRequest: GameEvent = {
            type: 'CHOICE_REQUESTED',
            payload: { playerId: '1', sourceAbilityId: 'status-choice' },
            timestamp: 10,
        };
        const firstCompletion: GameEvent = {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '1', sourceAbilityId: 'status-choice', interactionId: 'choice-one' },
            timestamp: 11,
        };
        const secondCompletion: GameEvent = {
            type: 'CHOICE_RESOLVED',
            payload: { playerId: '1', sourceAbilityId: 'status-choice', interactionId: 'choice-two' },
            timestamp: 12,
        };

        let state = createState();
        state = beginEffectSequenceContinuation(state, tagged(firstRequest), 'choice-one').state;
        state = beginEffectSequenceContinuation(state, tagged(secondRequest), 'choice-two').state;

        const first = resumeCompletedEffectSequence(state, [firstCompletion], fixedRandom, 13);
        expect(first?.events).toEqual([]);
        expect(first?.state.sys.resolution?.frames?.[0].metadata?.completedBlockerIds).toEqual(['choice-one']);

        const wrongChoice = resumeCompletedEffectSequence(first!.state, [{
            ...secondCompletion,
            payload: { ...secondCompletion.payload, interactionId: 'unrelated-choice' },
        }], fixedRandom, 14);
        expect(wrongChoice?.events).toEqual([]);
        expect(wrongChoice?.state.sys.resolution?.frames).toHaveLength(1);

        const second = resumeCompletedEffectSequence(wrongChoice!.state, [secondCompletion], fixedRandom, 15);
        expect(second?.events.filter((event) => event.type === 'ATTACK_PRE_DEFENSE_RESOLVED')).toHaveLength(1);
        expect(second?.state.sys.resolution?.frames ?? []).toHaveLength(0);
    });

    it('奖励骰同源能力的旧结算不能替代本次 settlementId', () => {
        let state = createState();
        const request = tagged({
            type: 'BONUS_DICE_REROLL_REQUESTED',
            payload: { settlement: { id: 'current-settlement', sourceAbilityId: 'same-ability' } },
            timestamp: 10,
        });
        state = beginEffectSequenceContinuation(state, request, 'dt-bonus-dice-current-settlement').state;

        const stale = resumeCompletedEffectSequence(state, [{
            type: 'BONUS_DICE_SETTLED',
            payload: { sourceAbilityId: 'same-ability' },
            timestamp: 11,
        }], fixedRandom, 12);
        expect(stale?.events).toEqual([]);
        expect(stale?.state.sys.resolution?.frames).toHaveLength(1);

        const current = resumeCompletedEffectSequence(stale!.state, [{
            type: 'BONUS_DICE_SETTLED',
            payload: { settlementId: 'current-settlement', sourceAbilityId: 'same-ability' },
            timestamp: 13,
        }], fixedRandom, 14);
        expect(current?.events.filter((event) => event.type === 'ATTACK_PRE_DEFENSE_RESOLVED')).toHaveLength(1);
    });

    it('效果游标为异步请求提供稳定且分步唯一的 blocker ID', () => {
        const first = {
            type: 'STRANGE_OPERATION_REQUESTED',
            payload: { playerId: '0', sourceId: 'same-spell' },
            timestamp: 10,
        } as DiceThroneEvent;
        const second = {
            type: 'STRANGE_OPERATION_REQUESTED',
            payload: { playerId: '0', sourceId: 'same-spell' },
            timestamp: 10,
        } as DiceThroneEvent;
        attachAttackEffectContinuation(first, { ...baseCursor, checkpoint: { ...baseCursor.checkpoint, nextEffectIndex: 1 } });
        attachAttackEffectContinuation(second, { ...baseCursor, checkpoint: { ...baseCursor.checkpoint, nextEffectIndex: 2 } });

        expect(getEffectSequenceBlockerId(first)).toBeTruthy();
        expect(getEffectSequenceBlockerId(first)).not.toBe(getEffectSequenceBlockerId(second));
    });

    it('同源的多个奇异博士操作只由携带请求 ID 的结算事件完成', () => {
        const request = (continuationRequestId: string): GameEvent => ({
            type: 'STRANGE_OPERATION_REQUESTED',
            payload: { playerId: '0', sourceId: 'same-spell', continuationRequestId },
            timestamp: 10,
        });
        const completion = (continuationRequestIds: string[]): GameEvent => ({
            type: 'STRANGE_OPERATION_RESOLVED',
            payload: { playerId: '0', sourceId: 'same-spell', continuationRequestIds },
            timestamp: 11,
        });

        let state = createState();
        state = beginEffectSequenceContinuation(state, tagged(request('strange-one')), 'strange-one').state;
        state = beginEffectSequenceContinuation(state, tagged(request('strange-two')), 'strange-two').state;

        const first = resumeCompletedEffectSequence(state, [completion(['strange-one'])], fixedRandom, 12);
        expect(first?.events).toEqual([]);
        expect(first?.state.sys.resolution?.frames?.[0].metadata?.completedBlockerIds).toEqual(['strange-one']);

        const unrelated = resumeCompletedEffectSequence(first!.state, [completion(['other-request'])], fixedRandom, 13);
        expect(unrelated?.events).toEqual([]);
        expect(unrelated?.state.sys.resolution?.frames).toHaveLength(1);

        const second = resumeCompletedEffectSequence(unrelated!.state, [completion(['strange-two'])], fixedRandom, 14);
        expect(second?.events.filter((event) => event.type === 'ATTACK_PRE_DEFENSE_RESOLVED')).toHaveLength(1);
    });

    it('防御者选择只由当前交互 ID 释放，不接受同攻击者同能力的旧结果', () => {
        let state = createState();
        const request: GameEvent = {
            type: 'DEFENDER_SELECTION_REQUESTED',
            payload: { attackerId: '0', sourceAbilityId: 'same-attack' },
            timestamp: 10,
        };
        state = beginEffectSequenceContinuation(state, tagged(request), 'defender-current-interaction').state;

        const stale = resumeCompletedEffectSequence(state, [{
            type: 'DEFENDER_SELECTION_RESOLVED',
            payload: { interactionId: 'defender-stale-interaction', attackerId: '0', sourceAbilityId: 'same-attack' },
            timestamp: 11,
        }], fixedRandom, 12);
        expect(stale?.events).toEqual([]);
        expect(stale?.state.sys.resolution?.frames).toHaveLength(1);

        const current = resumeCompletedEffectSequence(stale!.state, [{
            type: 'DEFENDER_SELECTION_RESOLVED',
            payload: { interactionId: 'defender-current-interaction', attackerId: '0', sourceAbilityId: 'same-attack' },
            timestamp: 13,
        }], fixedRandom, 14);
        expect(current?.events.filter((event) => event.type === 'ATTACK_PRE_DEFENSE_RESOLVED')).toHaveLength(1);
    });
});

describe('攻击效果阻塞事件分类合同', () => {
    it.each([
        'CHOICE_REQUESTED',
        'INTERACTION_REQUESTED',
        'TOKEN_RESPONSE_REQUESTED',
        'COMPARE_ROLL_REQUESTED',
        'STRANGE_OPERATION_REQUESTED',
        'DEFENDER_SELECTION_REQUESTED',
    ] as const)('%s 必须作为单一阻塞事件分类', (type) => {
        expect(isAttackEffectSequenceBlocker({ type })).toBe(true);
    });

    it('非交互事件不构成效果续接阻塞', () => {
        expect(isAttackEffectSequenceBlocker({ type: 'ATTACK_RESOLVED' })).toBe(false);
    });
});
