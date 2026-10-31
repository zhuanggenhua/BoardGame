import type { GameEvent, MatchState } from '../../../engine/types';
import { completeResolutionFrame, getActiveResolutionFrame, pushResolutionFrame } from '../../../engine/systems/resolutionStack';
import { TOKEN_IDS } from './ids';
import { hasSpentTreantTreeSpiritThisTurn } from './passiveAbility';
import { isPurifiableDebuffId } from './statusRemoval';
import {
    INCOMING_DEBUFF_PURIFY_CHOICE_SOURCE_ID,
    INCOMING_DEBUFF_DECLINE_PURIFY_CUSTOM_ID,
    INCOMING_DEBUFF_USE_PURIFY_CUSTOM_ID,
} from './incomingDebuffPurifyChoice';
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

const incomingPurifiableDebuff = (
    core: DiceThroneCore,
    defenderId: string,
    event: GameEvent,
): boolean => {
    if (!incomingDebuff(core, defenderId, event)) return false;
    const payload = event.payload as { statusId?: string; tokenId?: string };
    const debuffId = payload.statusId ?? payload.tokenId;
    return typeof debuffId === 'string' && isPurifiableDebuffId(core, debuffId);
};

const getStatusApplicationStart = (events: DiceThroneEvent[], index: number): number => {
    const applicationId = (events[index] as DiceThroneEvent & { statusApplicationId?: string }).statusApplicationId;
    let start = index;
    while (applicationId && start > 0) {
        const previous = events[start - 1] as DiceThroneEvent & { statusApplicationId?: string };
        if (previous.statusApplicationId !== applicationId || previous.type === 'STATUS_APPLIED') break;
        start -= 1;
    }
    return start;
};

/** 选择后的前置效果也属于父攻击；先保存未提交事件，再请求防守方决策。 */
export function deferAttackDebuffFollowups(
    state: MatchState<DiceThroneCore>,
    followups: DiceThroneEvent[],
    timestamp: number,
    options: { purifyStartIndex?: number; allowTreant?: boolean } = {},
): { state: MatchState<DiceThroneCore>; events: DiceThroneEvent[] } {
    const attack = state.core.pendingAttack;
    const defenderId = attack?.defenderId;
    if (!attack || !attack.sourceAbilityId || !defenderId
        || !['offensiveRoll', 'targetingRoll'].includes(state.sys.phase ?? '')) {
        return { state, events: followups };
    }

    const purifyStacks = state.core.players[defenderId]?.tokens[TOKEN_IDS.PURIFY] ?? 0;
    const purifyStartIndex = Math.max(0, options.purifyStartIndex ?? 0);
    const purifyIndex = purifyStacks <= 0
        ? -1
        : followups.findIndex((event, index) => index >= purifyStartIndex
            && incomingPurifiableDebuff(state.core, defenderId, event));
    if (purifyIndex >= 0) {
        const start = getStatusApplicationStart(followups, purifyIndex);
        const frameId = 'dt-purify-debuff-' + attack.sourceAbilityId + '-' + defenderId + '-' + timestamp + '-' + purifyIndex;
        const nextState = pushResolutionFrame(state, {
            id: frameId, kind: FRAME_KIND, ownerGame: 'dicethrone', ownerSystem: 'dicethrone-events',
            ordering: 'nested-body', status: 'running', phase: state.sys.phase,
            phaseGate: 'block-advance-when-blocked',
            deferredEvents: followups.slice(start),
            metadata: { defenderId, responseType: 'purify-debuff', candidateIndex: purifyIndex - start },
        });
        const choice: ChoiceRequestedEvent = {
            type: 'CHOICE_REQUESTED',
            payload: {
                playerId: defenderId,
                sourceAbilityId: INCOMING_DEBUFF_PURIFY_CHOICE_SOURCE_ID,
                titleKey: 'choices.purifyIncomingDebuff.title',
                options: [
                    {
                        value: 1,
                        customId: INCOMING_DEBUFF_USE_PURIFY_CUSTOM_ID,
                        labelKey: 'choices.purifyIncomingDebuff.usePurify',
                    },
                    {
                        value: 0,
                        customId: INCOMING_DEBUFF_DECLINE_PURIFY_CUSTOM_ID,
                        labelKey: 'choices.purifyIncomingDebuff.decline',
                    },
                ],
            },
            sourceCommandType: 'CHOICE_RESOLVED',
            timestamp,
        };
        return { state: nextState, events: [...followups.slice(0, start), choice] };
    }

    if (options.allowTreant === false || attack.treantDivinePreventDebuffChoice) {
        return { state, events: followups };
    }
    if ((state.core.players[defenderId]?.tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0) <= 0
        || hasSpentTreantTreeSpiritThisTurn(state.core, defenderId, TOKEN_IDS.TREANT_DIVINE)) {
        return { state, events: followups };
    }

    const indices = followups.flatMap((event, index) => incomingDebuff(state.core, defenderId, event)
        && (event.payload as { sourceAbilityId?: string }).sourceAbilityId === attack.sourceAbilityId ? [index] : []);
    const index = indices[0] ?? -1;
    if (index < 0) return { state, events: followups };
    const start = getStatusApplicationStart(followups, index);
    const frameId = `dt-debuff-${attack.sourceAbilityId ?? 'attack'}-${defenderId}-${timestamp}`;
    const nextState = pushResolutionFrame(state, {
        id: frameId, kind: FRAME_KIND, ownerGame: 'dicethrone', ownerSystem: 'dicethrone-events',
        ordering: 'nested-body', status: 'running', phase: state.sys.phase,
        phaseGate: 'block-advance-when-blocked',
        deferredEvents: followups.slice(start),
        metadata: { defenderId, responseType: 'treant', candidateIndices: indices.map(candidate => candidate - start) },
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
    if (
        choice.payload.customId === INCOMING_DEBUFF_USE_PURIFY_CUSTOM_ID
        || choice.payload.customId === INCOMING_DEBUFF_DECLINE_PURIFY_CUSTOM_ID
    ) {
        if (
            choice.payload.sourceAbilityId !== INCOMING_DEBUFF_PURIFY_CHOICE_SOURCE_ID
            || choice.payload.interactionBacked !== true
        ) return undefined;
        const frame = getActiveResolutionFrame(state);
        const defenderId = frame?.metadata?.defenderId;
        const candidateIndex = frame?.metadata?.candidateIndex;
        if (
            frame?.kind !== FRAME_KIND
            || (frame.metadata?.responseType !== 'purify-debuff'
                && frame.metadata?.responseType !== 'purify-daze')
            || typeof defenderId !== 'string'
            || defenderId !== choice.payload.playerId
            || typeof candidateIndex !== 'number'
        ) return undefined;

        const events = (frame.deferredEvents ?? []) as DiceThroneEvent[];
        const index = candidateIndex;
        if (!incomingPurifiableDebuff(state.core, defenderId, events[index])) return undefined;
        const purifyStacks = state.core.players[defenderId]?.tokens[TOKEN_IDS.PURIFY] ?? 0;
        const usePurify = choice.payload.customId === INCOMING_DEBUFF_USE_PURIFY_CUSTOM_ID
            && choice.payload.value === 1
            && purifyStacks > 0;
        const declinePurify = choice.payload.customId === INCOMING_DEBUFF_DECLINE_PURIFY_CUSTOM_ID
            && choice.payload.value === 0;
        if (!usePurify && !declinePurify) return undefined;

        const start = getStatusApplicationStart(events, index);
        const resumedEvents = usePurify
            ? [
                {
                    type: 'TOKEN_CONSUMED',
                    payload: {
                        playerId: defenderId,
                        tokenId: TOKEN_IDS.PURIFY,
                        amount: 1,
                        newTotal: purifyStacks - 1,
                        sourceAbilityId: TOKEN_IDS.PURIFY,
                    },
                    sourceCommandType: 'CHOICE_RESOLVED',
                    timestamp: choice.timestamp,
                } as DiceThroneEvent,
                ...events.slice(0, start),
                ...events.slice(index + 1),
            ]
            : events;
        const resumedState = completeResolutionFrame(state, frame.id);
        return deferAttackDebuffFollowups(resumedState, resumedEvents, choice.timestamp, {
            purifyStartIndex: usePurify ? start : index + 1,
        });
    }

    if (choice.payload.customId !== PREVENT && choice.payload.customId !== SKIP) return undefined;
    if (choice.payload.sourceAbilityId !== TOKEN_IDS.TREANT_DIVINE || choice.payload.interactionBacked !== true) return undefined;
    const frame = getActiveResolutionFrame(state);
    const defenderId = frame?.metadata?.defenderId;
    if (frame?.kind !== FRAME_KIND || typeof defenderId !== 'string' || defenderId !== choice.payload.playerId) return undefined;
    if (frame.metadata?.responseType !== 'treant') return undefined;
    const events = (frame.deferredEvents ?? []) as DiceThroneEvent[];
    const index = choice.payload.value - 1;
    const candidates = frame.metadata?.candidateIndices;
    const stacks = state.core.players[defenderId]?.tokens[TOKEN_IDS.TREANT_DIVINE] ?? 0;
    const prevent = choice.payload.customId === PREVENT && stacks > 0
        && !hasSpentTreantTreeSpiritThisTurn(state.core, defenderId, TOKEN_IDS.TREANT_DIVINE)
        && Array.isArray(candidates) && candidates.includes(index) && incomingDebuff(state.core, defenderId, events[index]);
    const start = prevent ? getStatusApplicationStart(events, index) : index;
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
