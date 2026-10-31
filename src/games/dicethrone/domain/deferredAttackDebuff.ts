import type { GameEvent, MatchState } from '../../../engine/types';
import { completeResolutionFrame, getActiveResolutionFrame, pushResolutionFrame } from '../../../engine/systems/resolutionStack';
import { STATUS_IDS, TOKEN_IDS } from './ids';
import { hasSpentTreantTreeSpiritThisTurn } from './passiveAbility';
import {
    DAZE_EXTRA_ATTACK_CHOICE_SOURCE_ID,
    DAZE_EXTRA_ATTACK_CONTINUE_CUSTOM_ID,
    DAZE_EXTRA_ATTACK_USE_PURIFY_CUSTOM_ID,
} from './dazeExtraAttackChoice';
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

const incomingDaze = (
    core: DiceThroneCore,
    defenderId: string,
    sourceAbilityId: string,
    event: GameEvent,
): boolean => {
    if (event.type !== 'STATUS_APPLIED' || !incomingDebuff(core, defenderId, event)) return false;
    const payload = event.payload as { targetId?: string; statusId?: string; sourceAbilityId?: string };
    return payload.targetId === defenderId
        && payload.statusId === STATUS_IDS.DAZE
        && payload.sourceAbilityId === sourceAbilityId;
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
    options: { allowPurifyDaze?: boolean; allowTreant?: boolean } = {},
): { state: MatchState<DiceThroneCore>; events: DiceThroneEvent[] } {
    const attack = state.core.pendingAttack;
    const defenderId = attack?.defenderId;
    if (!attack || !attack.sourceAbilityId || !defenderId
        || !['offensiveRoll', 'targetingRoll'].includes(state.sys.phase ?? '')) {
        return { state, events: followups };
    }

    const purifyStacks = state.core.players[defenderId]?.tokens[TOKEN_IDS.PURIFY] ?? 0;
    const dazeIndex = options.allowPurifyDaze === false || purifyStacks <= 0
        ? -1
        : followups.findIndex(event => incomingDaze(state.core, defenderId, attack.sourceAbilityId!, event));
    const currentDaze = (state.core.players[defenderId]?.statusEffects[STATUS_IDS.DAZE] ?? 0)
        + (state.core.players[defenderId]?.tokens[STATUS_IDS.DAZE] ?? 0);
    if (dazeIndex >= 0 && currentDaze === 0) {
        const start = getStatusApplicationStart(followups, dazeIndex);
        const frameId = 'dt-purify-daze-' + attack.sourceAbilityId + '-' + defenderId + '-' + timestamp;
        const nextState = pushResolutionFrame(state, {
            id: frameId, kind: FRAME_KIND, ownerGame: 'dicethrone', ownerSystem: 'dicethrone-events',
            ordering: 'nested-body', status: 'running', phase: state.sys.phase,
            phaseGate: 'block-advance-when-blocked',
            deferredEvents: followups.slice(start),
            metadata: { defenderId, responseType: 'purify-daze', candidateIndex: dazeIndex - start },
        });
        const choice: ChoiceRequestedEvent = {
            type: 'CHOICE_REQUESTED',
            payload: {
                playerId: defenderId,
                sourceAbilityId: DAZE_EXTRA_ATTACK_CHOICE_SOURCE_ID,
                titleKey: 'choices.dazeExtraAttack.title',
                options: [
                    {
                        value: 1,
                        customId: DAZE_EXTRA_ATTACK_USE_PURIFY_CUSTOM_ID,
                        labelKey: 'choices.dazeExtraAttack.usePurify',
                    },
                    {
                        value: 0,
                        customId: DAZE_EXTRA_ATTACK_CONTINUE_CUSTOM_ID,
                        labelKey: 'choices.dazeExtraAttack.continue',
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
        choice.payload.customId === DAZE_EXTRA_ATTACK_USE_PURIFY_CUSTOM_ID
        || choice.payload.customId === DAZE_EXTRA_ATTACK_CONTINUE_CUSTOM_ID
    ) {
        if (
            choice.payload.sourceAbilityId !== DAZE_EXTRA_ATTACK_CHOICE_SOURCE_ID
            || choice.payload.interactionBacked !== true
        ) return undefined;
        const frame = getActiveResolutionFrame(state);
        const defenderId = frame?.metadata?.defenderId;
        const candidateIndex = frame?.metadata?.candidateIndex;
        const attackSourceId = state.core.pendingAttack?.sourceAbilityId;
        if (
            frame?.kind !== FRAME_KIND
            || frame.metadata?.responseType !== 'purify-daze'
            || typeof defenderId !== 'string'
            || defenderId !== choice.payload.playerId
            || typeof candidateIndex !== 'number'
            || typeof attackSourceId !== 'string'
        ) return undefined;

        const events = (frame.deferredEvents ?? []) as DiceThroneEvent[];
        const index = candidateIndex;
        if (!incomingDaze(state.core, defenderId, attackSourceId, events[index])) return undefined;
        const purifyStacks = state.core.players[defenderId]?.tokens[TOKEN_IDS.PURIFY] ?? 0;
        const usePurify = choice.payload.customId === DAZE_EXTRA_ATTACK_USE_PURIFY_CUSTOM_ID
            && choice.payload.value === 1
            && purifyStacks > 0;
        const continueWithDaze = choice.payload.customId === DAZE_EXTRA_ATTACK_CONTINUE_CUSTOM_ID
            && choice.payload.value === 0;
        if (!usePurify && !continueWithDaze) return undefined;

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
            allowPurifyDaze: false,
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
