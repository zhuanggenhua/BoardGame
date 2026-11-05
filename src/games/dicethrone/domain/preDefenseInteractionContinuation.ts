import type { MatchState, RandomFn } from '../../../engine/types';
import { completeResolutionFrame, getActiveResolutionFrame, pushResolutionFrame } from '../../../engine/systems/resolutionStack';
import { resolveOffensivePreDefenseEffects } from './attack';
import { deferAttackDebuffFollowups } from './deferredAttackDebuff';
import type { DiceThroneCore, DiceThroneEvent, InteractionRequestedEvent } from './types';

const FRAME_KIND = 'dicethrone:pre-defense-interaction';

export function beginPreDefenseInteraction(
    state: MatchState<DiceThroneCore>,
    request: InteractionRequestedEvent,
    interactionId: string,
): { state: MatchState<DiceThroneCore>; frameId?: string } {
    const continuation = request.payload.preDefenseContinuation;
    if (!continuation) return { state };
    const frameId = `dt-pre-defense-${interactionId}`;
    return {
        frameId,
        state: pushResolutionFrame(state, {
            id: frameId, kind: FRAME_KIND, ownerGame: 'dicethrone', ownerSystem: 'dicethrone-events',
            ordering: 'nested-body', status: 'running', phase: state.sys.phase,
            phaseGate: 'block-advance-when-blocked',
            deferredActions: [{ kind: 'pre-defense-effects', nextEffectIndex: continuation.nextEffectIndex }],
            metadata: { interactionId, sourceAbilityId: continuation.sourceAbilityId },
        }),
    };
}

export function resumePreDefenseInteraction(
    state: MatchState<DiceThroneCore>,
    interactionId: string,
    random: RandomFn,
    timestamp: number,
): { state: MatchState<DiceThroneCore>; events: DiceThroneEvent[] } | undefined {
    const frame = getActiveResolutionFrame(state);
    if (frame?.kind !== FRAME_KIND || frame.metadata?.interactionId !== interactionId) return undefined;
    const action = frame.deferredActions?.[0] as { kind?: string; nextEffectIndex?: number } | undefined;
    if (action?.kind !== 'pre-defense-effects' || typeof action.nextEffectIndex !== 'number'
        || state.core.pendingAttack?.sourceAbilityId !== frame.metadata?.sourceAbilityId) {
        throw new Error('[DiceThrone] 攻击前置交互续接帧不匹配当前攻击');
    }
    const resumedState = completeResolutionFrame(state, frame.id);
    const events = resolveOffensivePreDefenseEffects(resumedState.core, random, timestamp, action.nextEffectIndex);
    return deferAttackDebuffFollowups(resumedState, events, timestamp);
}
