import type { GameEvent } from '../../../engine/types';
import type { EffectResolutionCheckpoint } from './effects';
import type { AbilityEffect, EffectTiming } from './combat';
import type { DamageOrigin } from './tokenTypes';
import type { DiceThroneEvent } from './types';

const ATTACK_EFFECT_BLOCKING_EVENT_TYPES: ReadonlySet<DiceThroneEvent['type']> = new Set([
    'CHOICE_REQUESTED',
    'INTERACTION_REQUESTED',
    'TOKEN_RESPONSE_REQUESTED',
    'COMPARE_ROLL_REQUESTED',
    'STRANGE_OPERATION_REQUESTED',
    'DEFENDER_SELECTION_REQUESTED',
]);

/** One event-type contract for every interaction that suspends an effect sequence. */
export function isAttackEffectSequenceBlocker(event: Pick<DiceThroneEvent, 'type'>): boolean {
    return ATTACK_EFFECT_BLOCKING_EVENT_TYPES.has(event.type);
}

/** Stable ID for correlating an effect-backed asynchronous request with its resolver. */
export function getEffectSequenceBlockerId(event: GameEvent): string | undefined {
    const payload = event.resolutionContinuation?.payload;
    if (!payload || typeof payload !== 'object') return undefined;
    const cursorId = (payload as { cursorId?: unknown }).cursorId;
    return typeof cursorId === 'string' && cursorId.length > 0
        ? `dt-effect-blocker:${cursorId}`
        : undefined;
}

export type AttackEffectContinuationStage =
    | 'preDefense'
    | 'defenseWithDamage'
    | 'defensePostDamage'
    | 'attackWithDamage'
    | 'attackPostDamage';

export interface AttackEffectContinuationPayload {
    kind: 'attack-effect-sequence';
    cursorId: string;
    stage: AttackEffectContinuationStage;
    attackerId: string;
    defenderId?: string;
    attackSourceAbilityId?: string;
    effectSourceAbilityId: string;
    checkpoint: EffectResolutionCheckpoint;
    resolverOptions?: {
        bonusDamage?: number;
        bonusDamageOnce?: boolean;
        skipDamage?: boolean;
        skipNonDamage?: boolean;
        continueAfterFirstDamage?: boolean;
    };
}

export interface EffectSequenceContinuationPayload {
    kind: 'effect-sequence';
    cursorId: string;
    sequenceId: string;
    effects: AbilityEffect[];
    timing: EffectTiming;
    context: {
        attackerId: string;
        defenderId: string;
        sourceAbilityId: string;
        damageDealt: number;
        accumulatedBonusDamage?: number;
        timestamp?: number;
        isDefensiveContext?: boolean;
        damageOrigin?: DamageOrigin;
        isAttackModifierCard?: boolean;
    };
    checkpoint: EffectResolutionCheckpoint;
    resolverOptions?: {
        bonusDamage?: number;
        bonusDamageOnce?: boolean;
        skipDamage?: boolean;
        skipNonDamage?: boolean;
        continueAfterFirstDamage?: boolean;
    };
}

type AttackEffectContinuationInput = Omit<AttackEffectContinuationPayload, 'cursorId'> & { cursorId?: string };
type EffectSequenceContinuationInput = Omit<EffectSequenceContinuationPayload, 'cursorId'> & { cursorId?: string };

export function attachAttackEffectContinuation(
    event: DiceThroneEvent,
    payload: AttackEffectContinuationInput,
): void {
    const cursorId = payload.cursorId ?? [
        payload.attackerId,
        payload.defenderId ?? 'no-defender',
        payload.attackSourceAbilityId ?? 'no-ability',
        payload.stage,
        String(payload.checkpoint.nextEffectIndex),
    ].join(':');
    (event as GameEvent).resolutionContinuation = {
        ownerGame: 'dicethrone',
        ownerSystem: 'dicethrone-events',
        action: 'resume-attack-effect-sequence',
        payload: { ...payload, cursorId },
    };
}

export function attachEffectSequenceContinuation(
    event: DiceThroneEvent,
    payload: EffectSequenceContinuationInput,
): void {
    const cursorId = payload.cursorId ?? `${payload.sequenceId}:${payload.timing}:${payload.checkpoint.nextEffectIndex}`;
    (event as GameEvent).resolutionContinuation = {
        ownerGame: 'dicethrone',
        ownerSystem: 'dicethrone-events',
        action: 'resume-effect-sequence',
        payload: { ...payload, cursorId },
    };
}

export function readAttackEffectContinuation(
    event: GameEvent,
): AttackEffectContinuationPayload | undefined {
    const continuation = event.resolutionContinuation;
    if (continuation?.ownerGame !== 'dicethrone'
        || continuation.ownerSystem !== 'dicethrone-events'
        || continuation.action !== 'resume-attack-effect-sequence'
        || !continuation.payload
        || typeof continuation.payload !== 'object') {
        return undefined;
    }
    const payload = continuation.payload as Partial<AttackEffectContinuationPayload>;
    if (payload.kind !== 'attack-effect-sequence'
        || typeof payload.cursorId !== 'string'
        || typeof payload.stage !== 'string'
        || typeof payload.attackerId !== 'string'
        || typeof payload.effectSourceAbilityId !== 'string'
        || !payload.checkpoint
        || typeof payload.checkpoint.nextEffectIndex !== 'number'
        || payload.checkpoint.nextEffectIndex < 0) {
        throw new Error('[DiceThrone] 攻击效果续接事件缺少有效游标');
    }
    return payload as AttackEffectContinuationPayload;
}

export function readEffectSequenceContinuation(
    event: GameEvent,
): EffectSequenceContinuationPayload | undefined {
    const continuation = event.resolutionContinuation;
    if (continuation?.ownerGame !== 'dicethrone'
        || continuation.ownerSystem !== 'dicethrone-events'
        || continuation.action !== 'resume-effect-sequence'
        || !continuation.payload
        || typeof continuation.payload !== 'object') {
        return undefined;
    }
    const payload = continuation.payload as Partial<EffectSequenceContinuationPayload>;
    if (payload.kind !== 'effect-sequence'
        || typeof payload.cursorId !== 'string'
        || typeof payload.sequenceId !== 'string'
        || !Array.isArray(payload.effects)
        || typeof payload.timing !== 'string'
        || !payload.context
        || typeof payload.context.attackerId !== 'string'
        || typeof payload.context.defenderId !== 'string'
        || typeof payload.context.sourceAbilityId !== 'string'
        || !payload.checkpoint
        || typeof payload.checkpoint.nextEffectIndex !== 'number'
        || payload.checkpoint.nextEffectIndex < 0) {
        throw new Error('[DiceThrone] 效果序列续接事件缺少有效游标');
    }
    return payload as EffectSequenceContinuationPayload;
}
