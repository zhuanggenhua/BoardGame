import type { GameEvent, MatchState } from '../../../engine/types';
import { completeResolutionFrame, getActiveResolutionFrame, pushResolutionFrame } from '../../../engine/systems/resolutionStack';
import { TOKEN_IDS } from './ids';
import { hasSpentTreantTreeSpiritThisTurn } from './passiveAbility';
import type { ChoiceRequestedEvent, ChoiceResolvedEvent, DiceThroneCore, DiceThroneEvent } from './types';

const FRAME_KIND = 'dicethrone:attack-debuff-prevention';
const PREVENT = 'treant-divine-deferred-prevent';
const SKIP = 'treant-divine-deferred-skip';

const incomingDebuff = (core: DiceThroneCore, defenderId: string, event: GameEvent): boolean => {
    if (event.type !== 'STATUS_APPLIED' && event.type !== 'TOKEN_GRANTED') return false;
    const payload = event.payload as { targetId?: string; statusId?: string; tokenId?: string };
    const id = payload.statusId ?? payload.tokenId;
    return payload.targetId === defenderId && !!id
        && core.tokenDefinitions.some(definition => definition.id === id && definition.category === 'debuff');
};

/** 选择后的前置效果也属于父攻击；先保存未提交事件，再请求防守方决策。 */
export function deferAttackDebuffFollowups(
    state: MatchState<DiceThroneCore>,
    followups: DiceThroneEvent[],
    timestamp: number,
): { state: MatchState<DiceThroneCore>; events: DiceThroneEvent[] } {
    const attack = state.core.pendingAttack;
    const defenderId = attack?.defenderId;
    if (!attack || !attack.sourceAbilityId || !defenderId || !['offensiveRoll', 'targetingRoll'].includes(state.sys.phase ?? '')
        || (state.core.players[defenderId]?.tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0) <= 0
        || hasSpentTreantTreeSpiritThisTurn(state.core, defenderId, TOKEN_IDS.TREANT_DIVINE)) {
        return { state, events: followups };
    }
    const indices = followups.flatMap((event, index) => incomingDebuff(state.core, defenderId, event)
        && (event.payload as { sourceAbilityId?: string }).sourceAbilityId === attack.sourceAbilityId ? [index] : []);
    const index = indices[0] ?? -1;
    if (index < 0) return { state, events: followups };
    const applicationId = (followups[index] as DiceThroneEvent & { statusApplicationId?: string }).statusApplicationId;
    let start = index;
    while (applicationId && start > 0) {
        const previous = followups[start - 1] as DiceThroneEvent & { statusApplicationId?: string };
        if (previous.statusApplicationId !== applicationId || previous.type === 'STATUS_APPLIED') break;
        start -= 1;
    }
    const frameId = `dt-debuff-${attack.sourceAbilityId ?? 'attack'}-${defenderId}-${timestamp}`;
    const nextState = pushResolutionFrame(state, {
        id: frameId, kind: FRAME_KIND, ownerGame: 'dicethrone', ownerSystem: 'dicethrone-events',
        ordering: 'nested-body', status: 'running', phase: state.sys.phase,
        phaseGate: 'block-advance-when-blocked',
        deferredEvents: followups.slice(start),
        metadata: { defenderId, candidateIndices: indices.map(candidate => candidate - start) },
    });
    const choice: ChoiceRequestedEvent = {
        type: 'CHOICE_REQUESTED',
        payload: {
            playerId: defenderId, sourceAbilityId: TOKEN_IDS.TREANT_DIVINE,
            titleKey: 'choices.treantDivinePreventDebuff.title',
            options: [
                ...indices.map(candidate => {
                    const event = followups[candidate];
                    const payload = event.payload as { statusId?: string; tokenId?: string };
                    const labelKey = indices.length === 1
                        ? 'choices.treantDivinePreventDebuff.prevent'
                        : payload.statusId ? `statusEffects.${payload.statusId}.name` : `tokens.${payload.tokenId}.name`;
                    return { value: candidate - start + 1, customId: PREVENT, labelKey };
                }),
                { value: 0, customId: SKIP, labelKey: 'choices.treantDivinePreventDebuff.skip' },
            ],
        },
        sourceCommandType: 'CHOICE_RESOLVED', timestamp,
    };
    return { state: nextState, events: [...followups.slice(0, start), choice] };
}

export function resumeAttackDebuffFollowups(
    state: MatchState<DiceThroneCore>,
    choice: ChoiceResolvedEvent,
): { state: MatchState<DiceThroneCore>; events: DiceThroneEvent[] } | undefined {
    if (choice.payload.customId !== PREVENT && choice.payload.customId !== SKIP) return undefined;
    if (choice.payload.sourceAbilityId !== TOKEN_IDS.TREANT_DIVINE || choice.payload.interactionBacked !== true) return undefined;
    const frame = getActiveResolutionFrame(state);
    const defenderId = frame?.metadata?.defenderId;
    if (frame?.kind !== FRAME_KIND || typeof defenderId !== 'string' || defenderId !== choice.payload.playerId) return undefined;
    const events = (frame.deferredEvents ?? []) as DiceThroneEvent[];
    const index = choice.payload.value - 1;
    const candidates = frame.metadata?.candidateIndices;
    const stacks = state.core.players[defenderId]?.tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0;
    const prevent = choice.payload.customId === PREVENT && stacks > 0
        && !hasSpentTreantTreeSpiritThisTurn(state.core, defenderId, TOKEN_IDS.TREANT_DIVINE)
        && Array.isArray(candidates) && candidates.includes(index) && incomingDebuff(state.core, defenderId, events[index]);
    const applicationId = prevent ? (events[index] as DiceThroneEvent & { statusApplicationId?: string }).statusApplicationId : undefined;
    let start = index;
    while (applicationId && start > 0) {
        const previous = events[start - 1] as DiceThroneEvent & { statusApplicationId?: string };
        if (previous.statusApplicationId !== applicationId || previous.type === 'STATUS_APPLIED') break;
        start -= 1;
    }
    const resumed = prevent ? [
        {
            type: 'TOKEN_CONSUMED', payload: {
                playerId: defenderId, tokenId: TOKEN_IDS.TREANT_DIVINE,
                amount: 1, newTotal: stacks - 1, sourceAbilityId: TOKEN_IDS.TREANT_DIVINE,
            }, sourceCommandType: 'CHOICE_RESOLVED', timestamp: choice.timestamp,
        } as DiceThroneEvent,
        ...events.slice(0, start),
        ...events.slice(index + 1),
    ] : events;
    return { state: completeResolutionFrame(state, frame.id), events: resumed };
}

/** 延迟事件可能包含私有状态，不投影到任何客户端。 */
export function hideDeferredAttackDebuffFrames(state: MatchState<DiceThroneCore>): {
    resolution?: MatchState<DiceThroneCore>['sys']['resolution'];
} {
    if (!state.sys.resolution) return {};
    return { resolution: {
        ...state.sys.resolution,
        frames: state.sys.resolution.frames.map(frame => frame.kind === FRAME_KIND
            ? { ...frame, deferredEvents: undefined, deferredActions: undefined, metadata: undefined }
            : frame),
    } };
}
