import type { GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { completeResolutionFrame, getActiveResolutionFrame, getResolutionFrameById, getResolutionFrames, pushResolutionFrame, updateResolutionFrame } from '../../../engine/systems/resolutionStack';
import type { DiceThroneCore, DiceThroneEvent } from './types';
import { resolveEffectsToEvents } from './effects';
import {
    readAttackEffectContinuation,
    readEffectSequenceContinuation,
    type AttackEffectContinuationPayload,
    type EffectSequenceContinuationPayload,
} from './attackEffectContinuationTypes';
import { resumeAttackEffectSequence } from './attack';

const FRAME_KIND = 'dicethrone:effect-sequence';

interface AttackEffectFrameAction {
    kind: 'attack-effect-sequence';
    cursor: AttackEffectContinuationPayload;
}

interface EffectSequenceFrameAction {
    kind: 'effect-sequence';
    cursor: EffectSequenceContinuationPayload;
}

type EffectFrameAction = AttackEffectFrameAction | EffectSequenceFrameAction;

interface AttackEffectBlocker {
    id: string;
    type: string;
    playerId?: string;
    sourceId?: string;
    sourceAbilityId?: string;
    attackerId?: string;
    pendingDamageId?: string;
    contextId?: string;
    settlementId?: string;
}

function createBlocker(event: GameEvent, blockerId: string): AttackEffectBlocker {
    const payload = event.payload as Record<string, unknown> | undefined;
    return {
        id: blockerId,
        type: event.type,
        ...(typeof payload?.playerId === 'string' ? { playerId: payload.playerId } : {}),
        ...(typeof payload?.sourceId === 'string' ? { sourceId: payload.sourceId } : {}),
        ...(typeof payload?.sourceAbilityId === 'string' ? { sourceAbilityId: payload.sourceAbilityId } : {}),
        ...(typeof payload?.attackerId === 'string' ? { attackerId: payload.attackerId } : {}),
        ...(typeof payload?.pendingDamageId === 'string' ? { pendingDamageId: payload.pendingDamageId } : {}),
        ...(typeof payload?.settlementId === 'string' ? { settlementId: payload.settlementId } : {}),
        ...(payload?.context && typeof payload.context === 'object'
            && typeof (payload.context as { id?: unknown }).id === 'string'
            ? { contextId: (payload.context as { id: string }).id }
            : {}),
    };
}

function getAction(frame: NonNullable<ReturnType<typeof getActiveResolutionFrame>>): EffectFrameAction | undefined {
    const action = frame.deferredActions?.[0] as Partial<EffectFrameAction> | undefined;
    return (action?.kind === 'attack-effect-sequence' || action?.kind === 'effect-sequence') && action.cursor
        ? action as EffectFrameAction
        : undefined;
}

export function beginEffectSequenceContinuation(
    state: MatchState<DiceThroneCore>,
    event: GameEvent,
    blockerId: string,
): { state: MatchState<DiceThroneCore>; frameId?: string } {
    const attackCursor = readAttackEffectContinuation(event);
    const effectCursor = attackCursor ? undefined : readEffectSequenceContinuation(event);
    const cursorId = attackCursor?.cursorId ?? effectCursor?.cursorId;
    const cursorKind = attackCursor ? 'attack-effect-sequence' : effectCursor ? 'effect-sequence' : undefined;
    const cursor = attackCursor ?? effectCursor;
    if (!cursor || !cursorId || !cursorKind) return { state };

    const frameId = `dt-effect-sequence-${cursorId}`;
    const existingFrame = getResolutionFrameById(state, frameId);
    if (existingFrame) {
        const blockers = (existingFrame.metadata?.blockers as AttackEffectBlocker[] | undefined) ?? [];
        const blocker = createBlocker(event, blockerId);
        const nextBlockers = blockers.some((item) => item.id === blockerId && item.type === event.type)
            ? blockers
            : [...blockers, blocker];
        return {
            frameId,
            state: updateResolutionFrame(state, frameId, (frame) => ({
                ...frame,
                metadata: { ...frame.metadata, blockers: nextBlockers },
            })),
        };
    }
    if (attackCursor) {
        const pending = state.core.pendingAttack;
        if (!pending
            || pending.attackerId !== attackCursor.attackerId
            || pending.defenderId !== attackCursor.defenderId
            || pending.sourceAbilityId !== attackCursor.attackSourceAbilityId) {
            throw new Error('[DiceThrone] 攻击效果续接帧无法绑定当前 pendingAttack');
        }
    }

    return {
        frameId,
        state: pushResolutionFrame(state, {
            id: frameId,
            kind: FRAME_KIND,
            ownerGame: 'dicethrone',
            ownerSystem: 'dicethrone-events',
            ordering: 'nested-body',
            status: 'running',
            phase: state.sys.phase,
            phaseGate: 'block-advance-when-blocked',
            deferredActions: [{ kind: cursorKind, cursor }],
            metadata: {
                blockers: [createBlocker(event, blockerId)],
                ...(attackCursor ? {
                    stage: attackCursor.stage,
                    attackerId: attackCursor.attackerId,
                    defenderId: attackCursor.defenderId,
                    attackSourceAbilityId: attackCursor.attackSourceAbilityId,
                    effectSourceAbilityId: attackCursor.effectSourceAbilityId,
                } : {
                    stage: effectCursor!.timing,
                    attackerId: effectCursor!.context.attackerId,
                    defenderId: effectCursor!.context.defenderId,
                    effectSourceAbilityId: effectCursor!.context.sourceAbilityId,
                    sequenceId: effectCursor!.sequenceId,
                }),
            },
        }),
    };
}

function hasLiveFrameBlocker(
    state: MatchState<DiceThroneCore>,
    frameId: string,
    frame: NonNullable<ReturnType<typeof getActiveResolutionFrame>>,
): boolean {
    const interactions = state.sys.interaction;
    if (interactions?.current?.resolutionFrameId === frameId
        || interactions?.queue.some((interaction) => interaction.resolutionFrameId === frameId)) {
        return true;
    }
    if (state.sys.responseWindow?.current?.resolutionFrameId === frameId) return true;
    const currentRoll = state.core.currentRollContext;
    if (currentRoll?.policy.blocksPhaseFlow === true && currentRoll.status !== 'settled') {
        const currentContextId = (currentRoll as { id?: unknown }).id;
        if ((frame.metadata?.blockers as AttackEffectBlocker[] | undefined)?.some((blocker) => (
            blocker.type === 'COMPARE_ROLL_REQUESTED' && blocker.contextId === currentContextId
        ))) return true;
    }
    return getResolutionFrames(state).some((frame) => frame.parentFrameId === frameId);
}

function applyFrameCompletionSignals(
    state: MatchState<DiceThroneCore>,
    frame: NonNullable<ReturnType<typeof getActiveResolutionFrame>>,
    events: GameEvent[],
): MatchState<DiceThroneCore> {
    const blockers = (frame.metadata?.blockers as AttackEffectBlocker[] | undefined) ?? [];
    if (blockers.length === 0) return state;
    const completed = new Set((frame.metadata?.completedBlockerIds as string[] | undefined) ?? []);
    const previousCompleted = new Set(completed);
    for (const blocker of blockers) {
        const resolved = events.some((event) => {
            if (blocker.type === 'CHOICE_REQUESTED') {
                return event.type === 'CHOICE_RESOLVED'
                    && (event.payload as { interactionId?: unknown }).interactionId === blocker.id;
            }
            if (blocker.type === 'TOKEN_RESPONSE_REQUESTED') {
                const pendingDamageId = blocker.id.startsWith('dt-token-response-')
                    ? blocker.id.slice('dt-token-response-'.length)
                    : blocker.pendingDamageId;
                return event.type === 'TOKEN_RESPONSE_CLOSED'
                    && (event.payload as { pendingDamageId?: unknown }).pendingDamageId === pendingDamageId;
            }
            if (blocker.type === 'BONUS_DICE_REROLL_REQUESTED') {
                const settlementId = blocker.id.startsWith('dt-bonus-dice-')
                    ? blocker.id.slice('dt-bonus-dice-'.length)
                    : blocker.settlementId;
                const payload = event.payload as { settlementId?: unknown };
                return event.type === 'BONUS_DICE_SETTLED'
                    && typeof settlementId === 'string'
                    && payload.settlementId === settlementId;
            }
            if (blocker.type === 'COMPARE_ROLL_REQUESTED') {
                const contextId = blocker.id.startsWith('dt-compare-roll-')
                    ? blocker.id.slice('dt-compare-roll-'.length)
                    : blocker.contextId;
                return event.type === 'COMPARE_ROLL_SETTLED'
                    && (event.payload as { contextId?: unknown }).contextId === contextId;
            }
            if (blocker.type === 'STRANGE_OPERATION_REQUESTED') {
                const payload = event.payload as { continuationRequestIds?: unknown };
                return event.type === 'STRANGE_OPERATION_RESOLVED'
                    && Array.isArray(payload.continuationRequestIds)
                    && payload.continuationRequestIds.includes(blocker.id);
            }
            if (blocker.type === 'DEFENDER_SELECTION_REQUESTED') {
                const payload = event.payload as { interactionId?: unknown };
                return event.type === 'DEFENDER_SELECTION_RESOLVED'
                    && payload.interactionId === blocker.id;
            }
            if (event.type === 'SYS_INTERACTION_RESOLVED' || event.type === 'SYS_INTERACTION_CONFIRMED') {
                const interactionId = (event.payload as { interactionId?: unknown }).interactionId;
                return interactionId === blocker.id;
            }
            return false;
        });
        if (resolved) completed.add(blocker.id);
    }
    if (completed.size === previousCompleted.size
        && [...completed].every((blockerId) => previousCompleted.has(blockerId))) return state;
    return updateResolutionFrame(state, frame.id, (current) => ({
        ...current,
        metadata: { ...current.metadata, completedBlockerIds: [...completed] },
    }));
}

export function resumeCompletedEffectSequence(
    state: MatchState<DiceThroneCore>,
    events: GameEvent[],
    random: RandomFn,
    timestamp: number,
): { state: MatchState<DiceThroneCore>; events: DiceThroneEvent[] } | undefined {
    let frame = getActiveResolutionFrame(state);
    if (frame?.kind !== FRAME_KIND || frame.status === 'blocked' || frame.status === 'suspended') return undefined;
    state = applyFrameCompletionSignals(state, frame, events);
    frame = getResolutionFrameById(state, frame.id);
    if (!frame) return undefined;
    const blockers = (frame.metadata?.blockers as AttackEffectBlocker[] | undefined) ?? [];
    const completed = new Set((frame.metadata?.completedBlockerIds as string[] | undefined) ?? []);
    if (completed.size !== blockers.length || hasLiveFrameBlocker(state, frame.id, frame)) {
        return { state, events: [] };
    }

    const action = getAction(frame);
    if (!action) throw new Error('[DiceThrone] 效果续接帧缺少唯一游标');
    const resumedState = completeResolutionFrame(state, frame.id);
    if (action.kind === 'effect-sequence') {
        const cursor = action.cursor;
        return {
            state: resumedState,
            events: resolveEffectsToEvents(cursor.effects, cursor.timing, {
                ...cursor.context,
                state: resumedState.core,
                damageDealt: cursor.checkpoint.damageDealt,
                accumulatedBonusDamage: cursor.checkpoint.accumulatedBonusDamage,
                damageOrigin: cursor.context.damageOrigin,
                resolutionSequenceId: cursor.sequenceId,
            }, {
                ...cursor.resolverOptions,
                random,
                startEffectIndex: cursor.checkpoint.nextEffectIndex,
                checkpoint: cursor.checkpoint,
            }),
        };
    }
    const cursor = action.cursor;
    const pending = state.core.pendingAttack;
    if (!pending
        || pending.attackerId !== cursor.attackerId
        || pending.defenderId !== cursor.defenderId
        || pending.sourceAbilityId !== cursor.attackSourceAbilityId) {
        throw new Error('[DiceThrone] 攻击效果续接帧恢复时 pendingAttack 已变化');
    }
    return {
        state: resumedState,
        events: resumeAttackEffectSequence(resumedState.core, cursor, random, timestamp),
    };
}
