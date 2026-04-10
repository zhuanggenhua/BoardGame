import type { MatchState } from '../../../engine/types';
import { createSimpleChoice, queueInteraction } from '../../../engine/systems/InteractionSystem';
import { getBaseDef, getCardDef, getMinionLikePower } from '../data/cards';
import { validate } from './commands';
import { execute } from './reducer';
import { reduce } from './reduce';
import { buildBaseTargetOptions, buildMinionTargetOptions, createSkipOption, grantExtraAction, grantExtraMinion } from './abilityHelpers';
import { registerInteractionHandler } from './abilityInteractionHandlers';
import { SU_COMMANDS, SU_EVENTS, type ActionCardDef, type FusionCardDef, type LimitModifiedEvent, type MinionOnBase, type SmashUpCore } from './types';
import { isCardActionLike, isCardMinionLike } from './utils';

type ImmediateExtraLimitPayload = LimitModifiedEvent['payload'] & { playTiming: 'immediate' };
type ImmediateExtraMinionPayload = ImmediateExtraLimitPayload & { limitType: 'minion' };
type ImmediateExtraActionPayload = ImmediateExtraLimitPayload & { limitType: 'action' };

type ImmediateMinionCardChoice = { cardUid: string; defId: string };
type ImmediateActionCardChoice = { cardUid: string; defId: string };
type ImmediateBaseChoice = { baseIndex: number };
type ImmediateMinionTargetChoice = { baseIndex: number; minionUid: string };

let immediateExtraPromptCounter = 0;

function buildValidationState(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraLimitPayload,
): MatchState<SmashUpCore> {
    const bankedExtra = extra.limitType === 'minion'
        ? grantExtraMinion(
            extra.playerId,
            extra.reason,
            0,
            extra.restrictToBase,
            {
                powerMax: extra.powerMax,
                sameNameOnly: extra.sameNameOnly,
                sameNameDefId: extra.sameNameDefId,
            },
        )
        : grantExtraAction(extra.playerId, extra.reason, 0);

    return {
        ...state,
        core: reduce(state.core, bankedExtra),
        sys: {
            ...state.sys,
            phase: 'playCards',
            responseWindow: undefined,
        },
    };
}

function buildImmediateExtraMinionCardOptions(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraMinionPayload,
) {
    const validationState = buildValidationState(state, extra);
    const player = state.core.players[extra.playerId];
    if (!player) return [createSkipOption('放弃这次额外随从') as any];

    const options = player.hand
        .filter(card => isCardMinionLike(card))
        .flatMap((card, index) => {
            const validBaseIndices = state.core.bases
                .map((_, baseIndex) => baseIndex)
                .filter(baseIndex => validate(validationState, {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: extra.playerId,
                    payload: { cardUid: card.uid, baseIndex },
                }).valid);

            if (validBaseIndices.length === 0) return [];

            const def = getCardDef(card.defId);
            const power = getMinionLikePower(card.defId) ?? 0;
            return [{
                id: `card-${index}`,
                label: `${def?.name ?? card.defId} (力量 ${power})`,
                value: { cardUid: card.uid, defId: card.defId } satisfies ImmediateMinionCardChoice,
                displayMode: 'card' as const,
                _source: 'hand' as const,
            }];
        });

    return [...options, createSkipOption('放弃这次额外随从') as any];
}

function buildImmediateExtraMinionBaseOptions(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraMinionPayload,
    choice: ImmediateMinionCardChoice,
) {
    const validationState = buildValidationState(state, extra);
    const candidates = state.core.bases
        .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}` }))
        .filter(candidate => validate(validationState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: extra.playerId,
            payload: { cardUid: choice.cardUid, baseIndex: candidate.baseIndex },
        }).valid);

    return buildBaseTargetOptions(candidates, state.core);
}

function buildImmediateExtraActionCardOptions(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraActionPayload,
) {
    const validationState = buildValidationState(state, extra);
    const player = state.core.players[extra.playerId];
    if (!player) return [createSkipOption('放弃这次额外战术') as any];

    const options = player.hand
        .filter(card => isCardActionLike(card))
        .flatMap((card, index) => {
            const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
            if (!def) return [];

            const targetMode = getImmediateActionTargetMode(def);
            const playable = targetMode === 'none'
                ? validate(validationState, {
                    type: SU_COMMANDS.PLAY_ACTION,
                    playerId: extra.playerId,
                    payload: { cardUid: card.uid },
                }).valid
                : targetMode === 'base'
                    ? state.core.bases.some((_, baseIndex) => validate(validationState, {
                        type: SU_COMMANDS.PLAY_ACTION,
                        playerId: extra.playerId,
                        payload: { cardUid: card.uid, targetBaseIndex: baseIndex },
                    }).valid)
                    : state.core.bases.some((base, baseIndex) => base.minions.some(minion => validate(validationState, {
                        type: SU_COMMANDS.PLAY_ACTION,
                        playerId: extra.playerId,
                        payload: { cardUid: card.uid, targetBaseIndex: baseIndex, targetMinionUid: minion.uid },
                    }).valid));

            if (!playable) return [];

            return [{
                id: `card-${index}`,
                label: def.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId } satisfies ImmediateActionCardChoice,
                displayMode: 'card' as const,
                _source: 'hand' as const,
            }];
        });

    return [...options, createSkipOption('放弃这次额外战术') as any];
}

function getImmediateActionTargetMode(def: ActionCardDef | FusionCardDef): 'none' | 'base' | 'minion' {
    const subtype = (def as any).type === 'fusion'
        ? (def as FusionCardDef).actionSubtype
        : (def as ActionCardDef).subtype;

    if (subtype !== 'ongoing') return 'none';

    const ongoingTarget = (def as any).type === 'fusion'
        ? ((def as FusionCardDef).actionOngoingTarget ?? 'base')
        : ((def as ActionCardDef).ongoingTarget ?? 'base');

    return ongoingTarget === 'minion' ? 'minion' : 'base';
}

function buildImmediateExtraActionBaseOptions(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraActionPayload,
    choice: ImmediateActionCardChoice,
) {
    const validationState = buildValidationState(state, extra);
    const candidates = state.core.bases
        .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}` }))
        .filter(candidate => validate(validationState, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: extra.playerId,
            payload: { cardUid: choice.cardUid, targetBaseIndex: candidate.baseIndex },
        }).valid);

    return buildBaseTargetOptions(candidates, state.core);
}

function buildImmediateExtraActionMinionOptions(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraActionPayload,
    choice: ImmediateActionCardChoice,
) {
    const validationState = buildValidationState(state, extra);
    const candidates: Array<{ uid: string; defId: string; baseIndex: number; label: string }> = [];

    for (let baseIndex = 0; baseIndex < state.core.bases.length; baseIndex += 1) {
        const base = state.core.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            if (!validate(validationState, {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: extra.playerId,
                payload: { cardUid: choice.cardUid, targetBaseIndex: baseIndex, targetMinionUid: minion.uid },
            }).valid) {
                continue;
            }

            const def = getCardDef(minion.defId);
            candidates.push({
                uid: minion.uid,
                defId: minion.defId,
                baseIndex,
                label: `${def?.name ?? minion.defId} @ ${baseName}`,
            });
        }
    }

    return buildMinionTargetOptions(candidates, { state: state.core });
}

function buildImmediateExtraInteraction(
    extra: ImmediateExtraLimitPayload,
): ReturnType<typeof createSimpleChoice> {
    const id = `smashup_immediate_extra_${immediateExtraPromptCounter++}`;
    const isMinion = extra.limitType === 'minion';
    const interaction = createSimpleChoice(
        id,
        extra.playerId,
        isMinion ? '立刻打出一个额外随从，或放弃这次机会' : '立刻打出一张额外战术，或放弃这次机会',
        [isMinion ? createSkipOption('放弃这次额外随从') : createSkipOption('放弃这次额外战术')] as any[],
        {
            sourceId: isMinion ? 'smashup_immediate_extra_minion' : 'smashup_immediate_extra_action',
            targetType: 'hand',
            autoResolveIfSingle: false,
        },
    );

    (interaction.data as any).continuationContext = { extra };
    (interaction.data as any).autoRefresh = 'hand';
    (interaction.data as any).responseValidationMode = 'live';
    (interaction.data as any).optionsGenerator = (state: MatchState<SmashUpCore>, data: { continuationContext?: { extra?: ImmediateExtraLimitPayload } }) => {
        const latestExtra = data?.continuationContext?.extra;
        if (!latestExtra) {
            return [isMinion ? createSkipOption('放弃这次额外随从') : createSkipOption('放弃这次额外战术')] as any[];
        }

        return latestExtra.limitType === 'minion'
            ? buildImmediateExtraMinionCardOptions(state, latestExtra)
            : buildImmediateExtraActionCardOptions(state, latestExtra);
    };

    return interaction;
}

function executeImmediateExtraMinionPlay(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraMinionPayload,
    choice: ImmediateMinionCardChoice,
    baseIndex: number,
    timestamp: number,
    random: Parameters<typeof execute>[2],
) {
    const validationState = buildValidationState(state, extra);
    const validation = validate(validationState, {
        type: SU_COMMANDS.PLAY_MINION,
        playerId: extra.playerId,
        payload: { cardUid: choice.cardUid, baseIndex },
    });
    if (!validation.valid) {
        return { state, events: [] };
    }

    const execState: MatchState<SmashUpCore> = { ...state, sys: { ...state.sys } };
    const events = execute(execState, {
        type: SU_COMMANDS.PLAY_MINION,
        playerId: extra.playerId,
        payload: { cardUid: choice.cardUid, baseIndex },
        timestamp,
    }, random);

    return {
        state: execState,
        events: [
            grantExtraMinion(
                extra.playerId,
                extra.reason,
                timestamp,
                extra.restrictToBase,
                {
                    powerMax: extra.powerMax,
                    sameNameOnly: extra.sameNameOnly,
                    sameNameDefId: extra.sameNameDefId,
                },
            ),
            ...events,
        ],
    };
}

function executeImmediateExtraActionPlay(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraActionPayload,
    choice: ImmediateActionCardChoice,
    timestamp: number,
    random: Parameters<typeof execute>[2],
    targetBaseIndex?: number,
    targetMinionUid?: string,
) {
    const validationState = buildValidationState(state, extra);
    const validation = validate(validationState, {
        type: SU_COMMANDS.PLAY_ACTION,
        playerId: extra.playerId,
        payload: { cardUid: choice.cardUid, targetBaseIndex, targetMinionUid },
    });
    if (!validation.valid) {
        return { state, events: [] };
    }

    const execState: MatchState<SmashUpCore> = { ...state, sys: { ...state.sys } };
    const events = execute(execState, {
        type: SU_COMMANDS.PLAY_ACTION,
        playerId: extra.playerId,
        payload: { cardUid: choice.cardUid, targetBaseIndex, targetMinionUid },
        timestamp,
    }, random);

    return {
        state: execState,
        events: [grantExtraAction(extra.playerId, extra.reason, timestamp), ...events],
    };
}

export function queueImmediateExtraPlayInteractions(
    state: MatchState<SmashUpCore>,
    events: LimitModifiedEvent[],
): MatchState<SmashUpCore> {
    let nextState = state;

    for (const event of events) {
        if (event.payload.playTiming !== 'immediate' || event.payload.delta <= 0) continue;
        nextState = queueInteraction(nextState, buildImmediateExtraInteraction(event.payload as ImmediateExtraLimitPayload));
    }

    return nextState;
}

export function registerImmediateExtraPlayInteractionHandlers(): void {
    registerInteractionHandler('smashup_immediate_extra_minion', (state, playerId, value, interactionData, random, timestamp) => {
        if ((value as { skip?: boolean })?.skip) return { state, events: [] };

        const choice = value as ImmediateMinionCardChoice;
        const extra = (interactionData?.continuationContext as { extra?: ImmediateExtraMinionPayload } | undefined)?.extra;
        if (!choice.cardUid || !extra || extra.playerId !== playerId) return { state, events: [] };

        const baseOptions = buildImmediateExtraMinionBaseOptions(state, extra, choice);
        if (baseOptions.length === 0) return { state, events: [] };
        if (baseOptions.length === 1) {
            const selected = baseOptions[0].value as ImmediateBaseChoice;
            return executeImmediateExtraMinionPlay(state, extra, choice, selected.baseIndex, timestamp, random);
        }

            const interaction = createSimpleChoice(
                `smashup_immediate_extra_minion_base_${immediateExtraPromptCounter++}`,
                playerId,
                '选择要打出该额外随从的基地',
                [...baseOptions, createSkipOption('放弃这次额外随从')] as any[],
                { sourceId: 'smashup_immediate_extra_minion_base', targetType: 'base', autoResolveIfSingle: false },
            );
        (interaction.data as any).continuationContext = { extra, choice };
        (interaction.data as any).optionsGenerator = (latestState: MatchState<SmashUpCore>, data: { continuationContext?: { extra?: ImmediateExtraMinionPayload; choice?: ImmediateMinionCardChoice } }) => {
            const latestExtra = data?.continuationContext?.extra;
            const latestChoice = data?.continuationContext?.choice;
            if (!latestExtra || !latestChoice) return [];
                return [...buildImmediateExtraMinionBaseOptions(latestState, latestExtra, latestChoice), createSkipOption('放弃这次额外随从')] as any[];
            };

        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('smashup_immediate_extra_minion_base', (state, playerId, value, interactionData, random, timestamp) => {
        if ((value as { skip?: boolean })?.skip) return { state, events: [] };
        const { baseIndex } = value as ImmediateBaseChoice;
        const ctx = interactionData?.continuationContext as { extra?: ImmediateExtraMinionPayload; choice?: ImmediateMinionCardChoice } | undefined;
        if (baseIndex === undefined || !ctx?.extra || !ctx.choice || ctx.extra.playerId !== playerId) return { state, events: [] };
        return executeImmediateExtraMinionPlay(state, ctx.extra, ctx.choice, baseIndex, timestamp, random);
    });

    registerInteractionHandler('smashup_immediate_extra_action', (state, playerId, value, interactionData, random, timestamp) => {
        if ((value as { skip?: boolean })?.skip) return { state, events: [] };

        const choice = value as ImmediateActionCardChoice;
        const extra = (interactionData?.continuationContext as { extra?: ImmediateExtraActionPayload } | undefined)?.extra;
        if (!choice.cardUid || !extra || extra.playerId !== playerId) return { state, events: [] };

        const def = getCardDef(choice.defId) as ActionCardDef | FusionCardDef | undefined;
        if (!def) return { state, events: [] };

        const targetMode = getImmediateActionTargetMode(def);
        if (targetMode === 'none') {
            return executeImmediateExtraActionPlay(state, extra, choice, timestamp, random);
        }

        if (targetMode === 'base') {
            const baseOptions = buildImmediateExtraActionBaseOptions(state, extra, choice);
            if (baseOptions.length === 0) return { state, events: [] };
            if (baseOptions.length === 1) {
                const selected = baseOptions[0].value as ImmediateBaseChoice;
                return executeImmediateExtraActionPlay(state, extra, choice, timestamp, random, selected.baseIndex);
            }

            const interaction = createSimpleChoice(
                `smashup_immediate_extra_action_base_${immediateExtraPromptCounter++}`,
                playerId,
                '选择该额外战术的目标基地',
                [...baseOptions, createSkipOption('放弃这次额外战术')] as any[],
                { sourceId: 'smashup_immediate_extra_action_base', targetType: 'base', autoResolveIfSingle: false },
            );
            (interaction.data as any).continuationContext = { extra, choice };
            (interaction.data as any).optionsGenerator = (latestState: MatchState<SmashUpCore>, data: { continuationContext?: { extra?: ImmediateExtraActionPayload; choice?: ImmediateActionCardChoice } }) => {
                const latestExtra = data?.continuationContext?.extra;
                const latestChoice = data?.continuationContext?.choice;
                if (!latestExtra || !latestChoice) return [];
                return [...buildImmediateExtraActionBaseOptions(latestState, latestExtra, latestChoice), createSkipOption('放弃这次额外战术')] as any[];
            };

            return { state: queueInteraction(state, interaction), events: [] };
        }

        const minionOptions = buildImmediateExtraActionMinionOptions(state, extra, choice);
        if (minionOptions.length === 0) return { state, events: [] };
        if (minionOptions.length === 1) {
            const selected = minionOptions[0].value as ImmediateMinionTargetChoice;
            return executeImmediateExtraActionPlay(state, extra, choice, timestamp, random, selected.baseIndex, selected.minionUid);
        }

        const interaction = createSimpleChoice(
            `smashup_immediate_extra_action_minion_${immediateExtraPromptCounter++}`,
            playerId,
            '选择该额外战术的目标随从',
            [...minionOptions, createSkipOption('放弃这次额外战术')] as any[],
            { sourceId: 'smashup_immediate_extra_action_minion', targetType: 'minion', autoResolveIfSingle: false },
        );
        (interaction.data as any).continuationContext = { extra, choice };
        (interaction.data as any).optionsGenerator = (latestState: MatchState<SmashUpCore>, data: { continuationContext?: { extra?: ImmediateExtraActionPayload; choice?: ImmediateActionCardChoice } }) => {
            const latestExtra = data?.continuationContext?.extra;
            const latestChoice = data?.continuationContext?.choice;
            if (!latestExtra || !latestChoice) return [];
            return [...buildImmediateExtraActionMinionOptions(latestState, latestExtra, latestChoice), createSkipOption('放弃这次额外战术')] as any[];
        };

        return { state: queueInteraction(state, interaction), events: [] };
    });

    registerInteractionHandler('smashup_immediate_extra_action_base', (state, playerId, value, interactionData, random, timestamp) => {
        if ((value as { skip?: boolean })?.skip) return { state, events: [] };
        const { baseIndex } = value as ImmediateBaseChoice;
        const ctx = interactionData?.continuationContext as { extra?: ImmediateExtraActionPayload; choice?: ImmediateActionCardChoice } | undefined;
        if (baseIndex === undefined || !ctx?.extra || !ctx.choice || ctx.extra.playerId !== playerId) return { state, events: [] };
        return executeImmediateExtraActionPlay(state, ctx.extra, ctx.choice, timestamp, random, baseIndex);
    });

    registerInteractionHandler('smashup_immediate_extra_action_minion', (state, playerId, value, interactionData, random, timestamp) => {
        if ((value as { skip?: boolean })?.skip) return { state, events: [] };
        const { baseIndex, minionUid } = value as ImmediateMinionTargetChoice;
        const ctx = interactionData?.continuationContext as { extra?: ImmediateExtraActionPayload; choice?: ImmediateActionCardChoice } | undefined;
        if (baseIndex === undefined || !minionUid || !ctx?.extra || !ctx.choice || ctx.extra.playerId !== playerId) return { state, events: [] };
        return executeImmediateExtraActionPlay(state, ctx.extra, ctx.choice, timestamp, random, baseIndex, minionUid);
    });
}
