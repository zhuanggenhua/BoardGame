import type { MatchState } from '../../../engine/types';
import { getBaseDef, getCardDef, getMinionLikePower } from '../data/cards';
import { validate } from './commands';
import { execute } from './reducer';
import { reduce } from './reduce';
import {
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    createSkipOption,
    getSetAsideTitansPlayableAs,
    grantExtraAction,
    grantExtraMinion,
} from './abilityHelpers';
import { createAbilityRuntimeSimpleChoice, createPromptProgram, executeAbilityProgram } from './abilityRuntime';
import {
    SU_COMMANDS,
    SU_EVENTS,
    type ActionCardDef,
    type FusionCardDef,
    type LimitModifiedEvent,
    type MinionOnBase,
    type SmashUpCore,
    type SmashUpEvent,
} from './types';
import { isOperationRestricted } from './ongoingEffects';
import {
    actionLikeNeedsPlayBase,
    actionLikeNeedsPlayMinion,
    isCardActionLike,
    isCardMinionLike,
    isSameNameDefId,
} from './utils';

type ImmediateExtraLimitPayload = LimitModifiedEvent['payload'] & { playTiming: 'immediate' };
type ImmediateExtraMinionPayload = ImmediateExtraLimitPayload & { limitType: 'minion' };
type ImmediateExtraActionPayload = ImmediateExtraLimitPayload & { limitType: 'action' };

type ImmediateMinionCardChoice =
    | { cardUid: string; defId: string }
    | { titanUid: string; defId: string; playKind: 'minion' };
type ImmediateActionCardChoice = { cardUid: string; defId: string };
type ImmediateBaseChoice = { baseIndex: number };
type ImmediateMinionTargetChoice = { baseIndex: number; minionUid: string };

let immediateExtraPromptCounter = 0;

function buildImmediateExtraEventKey(event: LimitModifiedEvent): string {
    const payload = event.payload as ImmediateExtraLimitPayload;
    return [
        payload.playerId,
        payload.limitType,
        payload.reason,
        payload.playTiming,
        payload.delta,
        payload.restrictToBase ?? '__any_base__',
        payload.restrictToMinionUid ?? '__any_minion__',
        payload.specificCardUid ?? '__any_card__',
        payload.sameNameDefId ?? '__any_name__',
        payload.sameNameOnly ? 'same_name' : 'not_same_name',
        payload.powerMax ?? '__any_power__',
        payload.specialActionWindow ?? '__any_window__',
        event.timestamp ?? 0,
    ].join('|');
}

function buildValidationState(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraLimitPayload,
): MatchState<SmashUpCore> {
    const actingPlayerIndex = state.core.turnOrder.indexOf(extra.playerId);
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
                specificCardUid: extra.specificCardUid,
            },
        )
        : grantExtraAction(extra.playerId, extra.reason, 0);

    return {
        ...state,
        core: {
            ...reduce(state.core, bankedExtra),
            currentPlayerIndex: actingPlayerIndex >= 0 ? actingPlayerIndex : state.core.currentPlayerIndex,
        },
        sys: {
            ...state.sys,
            phase: 'playCards',
            responseWindow: undefined,
            // 额外行动只应按正常出牌阶段校验，不应继承当前结算链里残留的 reaction session。
            resolution: undefined,
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

    const handOptions = player.hand
        .filter(card => isCardMinionLike(card))
        .filter(card => !extra.specificCardUid || card.uid === extra.specificCardUid)
        .filter(card => !extra.sameNameDefId || isSameNameDefId(card.defId, extra.sameNameDefId))
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

    const titanOptions = extra.specificCardUid ? [] : getSetAsideTitansPlayableAs(state.core, extra.playerId, 'minion')
        .filter(titan => !extra.sameNameDefId || isSameNameDefId(titan.defId, extra.sameNameDefId))
        .flatMap((titan, index) => {
            const validBaseIndices = state.core.bases
                .map((_, baseIndex) => baseIndex)
                .filter(baseIndex => validate(validationState, {
                    type: SU_COMMANDS.ACTIVATE_SPECIAL,
                    playerId: extra.playerId,
                    payload: { titanUid: titan.uid, baseIndex },
                }).valid);

            if (validBaseIndices.length === 0) return [];

            const def = getCardDef(titan.defId);
            return [{
                id: `setaside-titan-${index}`,
                label: def?.name ?? titan.defId,
                value: {
                    titanUid: titan.uid,
                    defId: titan.defId,
                    playKind: 'minion',
                } satisfies ImmediateMinionCardChoice,
                displayMode: 'card' as const,
                _source: 'hand' as const,
            }];
        });

    return [...handOptions, ...titanOptions, createSkipOption('放弃这次额外随从') as any];
}

function buildImmediateExtraMinionBaseOptions(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraMinionPayload,
    choice: ImmediateMinionCardChoice,
) {
    if (extra.sameNameDefId && !isSameNameDefId(choice.defId, extra.sameNameDefId)) {
        return [];
    }
    if (extra.specificCardUid) {
        if ('titanUid' in choice || choice.cardUid !== extra.specificCardUid) return [];
    }
    const validationState = buildValidationState(state, extra);
    if ('titanUid' in choice) {
        const candidates = state.core.bases
            .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}` }))
            .filter(candidate => validate(validationState, {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: extra.playerId,
                payload: { titanUid: choice.titanUid, baseIndex: candidate.baseIndex },
            }).valid);

        return buildBaseTargetOptions(candidates, state.core);
    }

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
            if (extra.restrictToMinionUid && targetMode !== 'minion') return [];
            const playable = (() => {
                if (targetMode === 'none') {
                    return validate(validationState, {
                        type: SU_COMMANDS.PLAY_ACTION,
                        playerId: extra.playerId,
                        payload: { cardUid: card.uid },
                    }).valid;
                }
                if (targetMode === 'base') {
                    const baseChecks = state.core.bases.map((_base, baseIndex) => {
                        const blockedByBaseRestriction = extra.restrictToBase !== undefined && extra.restrictToBase !== baseIndex;
                        const blockedByWindowRestriction = !blockedByBaseRestriction
                            && Boolean(
                                extra.specialActionWindow
                                && isOperationRestricted(validationState.core, baseIndex, extra.playerId, 'play_action', {
                                    activationWindow: extra.specialActionWindow,
                                }),
                            );
                        const validation = !blockedByBaseRestriction && !blockedByWindowRestriction
                            ? validate(validationState, {
                                type: SU_COMMANDS.PLAY_ACTION,
                                playerId: extra.playerId,
                                payload: { cardUid: card.uid, targetBaseIndex: baseIndex },
                            })
                            : { valid: false, error: blockedByBaseRestriction ? 'restricted_to_other_base' : 'restricted_by_window' };
                        return {
                            baseIndex,
                            blockedByBaseRestriction,
                            blockedByWindowRestriction,
                            valid: validation.valid,
                            error: validation.valid ? null : validation.error ?? null,
                        };
                    });
                    return baseChecks.some(check => check.valid);
                }
                return state.core.bases.some((base, baseIndex) => {
                    if (extra.restrictToBase !== undefined && extra.restrictToBase !== baseIndex) return false;
                    if (extra.specialActionWindow && isOperationRestricted(validationState.core, baseIndex, extra.playerId, 'play_action', {
                        activationWindow: extra.specialActionWindow,
                    })) return false;
                    return base.minions.some(minion => validate(validationState, {
                        type: SU_COMMANDS.PLAY_ACTION,
                        playerId: extra.playerId,
                        payload: { cardUid: card.uid, targetBaseIndex: baseIndex, targetMinionUid: minion.uid },
                    }).valid);
                });
            })();

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

    if (subtype === 'ongoing') {
        const ongoingTarget = (def as any).type === 'fusion'
            ? ((def as FusionCardDef).actionOngoingTarget ?? 'base')
            : ((def as ActionCardDef).ongoingTarget ?? 'base');
        return ongoingTarget === 'minion' ? 'minion' : 'base';
    }

    if (actionLikeNeedsPlayMinion(def)) return 'minion';
    if (actionLikeNeedsPlayBase(def)) return 'base';
    return 'none';
}

function buildImmediateExtraActionBaseOptions(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraActionPayload,
    choice: ImmediateActionCardChoice,
) {
    const validationState = buildValidationState(state, extra);
    const candidates = state.core.bases
        .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}` }))
        .filter(candidate => extra.restrictToBase === undefined || candidate.baseIndex === extra.restrictToBase)
        .filter(candidate => !extra.specialActionWindow || !isOperationRestricted(validationState.core, candidate.baseIndex, extra.playerId, 'play_action', {
            activationWindow: extra.specialActionWindow,
        }))
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
        if (extra.restrictToBase !== undefined && extra.restrictToBase !== baseIndex) continue;
        if (extra.specialActionWindow && isOperationRestricted(state.core, baseIndex, extra.playerId, 'play_action', {
            activationWindow: extra.specialActionWindow,
        })) continue;
        const base = state.core.bases[baseIndex];
        const baseName = getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}`;
        for (const minion of base.minions) {
            if (extra.restrictToMinionUid && minion.uid !== extra.restrictToMinionUid) continue;
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

function executeImmediateExtraMinionPlay(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraMinionPayload,
    choice: ImmediateMinionCardChoice,
    baseIndex: number,
    timestamp: number,
    random: Parameters<typeof execute>[2],
) {
    const validationState = buildValidationState(state, extra);
    if (extra.specificCardUid) {
        if ('titanUid' in choice || choice.cardUid !== extra.specificCardUid) {
            return { state, events: [] };
        }
    }
    const validation = 'titanUid' in choice
        ? validate(validationState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: extra.playerId,
            payload: { titanUid: choice.titanUid, baseIndex },
        })
        : validate(validationState, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: extra.playerId,
            payload: { cardUid: choice.cardUid, baseIndex },
        });
    if (!validation.valid) {
        return { state, events: [] };
    }

    const execState: MatchState<SmashUpCore> = { ...state, sys: { ...state.sys } };
    const events = 'titanUid' in choice
        ? execute(execState, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: extra.playerId,
            payload: { titanUid: choice.titanUid, baseIndex },
            timestamp,
        }, random)
        : execute(execState, {
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
                    specificCardUid: extra.specificCardUid,
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
    if (extra.restrictToMinionUid && targetMinionUid !== extra.restrictToMinionUid) {
        return { state, events: [] };
    }
    if (extra.restrictToBase !== undefined && targetBaseIndex !== extra.restrictToBase) {
        return { state, events: [] };
    }
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

interface ImmediateExtraMinionPromptContext {
    matchState: MatchState<SmashUpCore>;
    extra: ImmediateExtraMinionPayload;
}

interface ImmediateExtraMinionBasePromptContext extends ImmediateExtraMinionPromptContext {
    choice: ImmediateMinionCardChoice;
}

interface ImmediateExtraActionPromptContext {
    matchState: MatchState<SmashUpCore>;
    extra: ImmediateExtraActionPayload;
}

interface ImmediateExtraActionBasePromptContext extends ImmediateExtraActionPromptContext {
    choice: ImmediateActionCardChoice;
}

interface ImmediateExtraActionMinionPromptContext extends ImmediateExtraActionPromptContext {
    choice: ImmediateActionCardChoice;
}

function buildMinionSkipEvents(
    playerId: string,
    extra: ImmediateExtraMinionPayload | undefined,
    timestamp: number,
): SmashUpEvent[] {
    return extra?.consumePendingMinionPlayEffectOnSkip
        ? [{ type: SU_EVENTS.MINION_PLAY_EFFECT_CONSUMED, payload: { playerId }, timestamp } as SmashUpEvent]
        : [];
}

const immediateExtraMinionBasePromptProgram = createPromptProgram<
    ImmediateExtraMinionBasePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'smashup_immediate_extra_minion_base',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `smashup_immediate_extra_minion_base_${immediateExtraPromptCounter++}`,
            context.extra.playerId,
            '选择要打出该额外随从的基地',
            [
                ...buildImmediateExtraMinionBaseOptions(context.matchState, context.extra, context.choice),
                createSkipOption('放弃这次额外随从') as any,
            ],
            {
                sourceId: 'smashup_immediate_extra_minion_base',
                targetType: 'base',
                autoResolveIfSingle: false,
            },
        );
        (interaction.data as any).runtimeContext = {
            extra: context.extra,
            choice: context.choice,
        };
        (interaction.data as any).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
            data: { runtimeContext?: { extra?: ImmediateExtraMinionPayload; choice?: ImmediateMinionCardChoice } },
        ) => {
            const latestExtra = data?.runtimeContext?.extra;
            const latestChoice = data?.runtimeContext?.choice;
            if (!latestExtra || !latestChoice) return [];
            return [
                ...buildImmediateExtraMinionBaseOptions(latestState, latestExtra, latestChoice),
                createSkipOption('放弃这次额外随从') as any,
            ];
        };
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        if ((value as { skip?: boolean })?.skip) {
            return {
                state,
                events: buildMinionSkipEvents(playerId, context.extra, timestamp),
            };
        }
        const { baseIndex } = value as ImmediateBaseChoice;
        if (baseIndex === undefined || context.extra.playerId !== playerId) {
            return { state, events: [] };
        }
        return executeImmediateExtraMinionPlay(state, context.extra, context.choice, baseIndex, timestamp, random);
    },
});

const immediateExtraMinionPromptProgram = createPromptProgram<
    ImmediateExtraMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'smashup_immediate_extra_minion',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `smashup_immediate_extra_${immediateExtraPromptCounter++}`,
            context.extra.playerId,
            '立刻打出一个额外随从，或放弃这次机会',
            buildImmediateExtraMinionCardOptions(context.matchState, context.extra) as any[],
            {
                sourceId: 'smashup_immediate_extra_minion',
                targetType: 'hand',
                autoResolveIfSingle: false,
            },
        );
        (interaction.data as any).runtimeContext = { extra: context.extra };
        (interaction.data as any).autoRefresh = 'hand';
        (interaction.data as any).responseValidationMode = 'live';
        (interaction.data as any).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
            data: { runtimeContext?: { extra?: ImmediateExtraMinionPayload } },
        ) => {
            const latestExtra = data?.runtimeContext?.extra;
            if (!latestExtra) {
                return [createSkipOption('放弃这次额外随从') as any];
            }
            return buildImmediateExtraMinionCardOptions(latestState, latestExtra) as any[];
        };
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        if ((value as { skip?: boolean })?.skip) {
            return {
                state,
                events: buildMinionSkipEvents(playerId, context.extra, timestamp),
            };
        }

        const choice = value as ImmediateMinionCardChoice;
        if ((!('cardUid' in choice) && !('titanUid' in choice)) || context.extra.playerId !== playerId) {
            return { state, events: [] };
        }

        const baseOptions = buildImmediateExtraMinionBaseOptions(state, context.extra, choice);
        if (baseOptions.length === 0) {
            return { state, events: [] };
        }
        if (baseOptions.length === 1) {
            const selected = baseOptions[0].value as ImmediateBaseChoice;
            return executeImmediateExtraMinionPlay(state, context.extra, choice, selected.baseIndex, timestamp, random);
        }

        return {
            state,
            events: [],
            context: {
                matchState: state,
                extra: context.extra,
                choice,
            },
            nextProgram: immediateExtraMinionBasePromptProgram,
        };
    },
});

const immediateExtraActionBasePromptProgram = createPromptProgram<
    ImmediateExtraActionBasePromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'smashup_immediate_extra_action_base',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `smashup_immediate_extra_action_base_${immediateExtraPromptCounter++}`,
            context.extra.playerId,
            '选择该额外战术的目标基地',
            [
                ...buildImmediateExtraActionBaseOptions(context.matchState, context.extra, context.choice),
                createSkipOption('放弃这次额外战术') as any,
            ],
            {
                sourceId: 'smashup_immediate_extra_action_base',
                targetType: 'base',
                autoResolveIfSingle: false,
            },
        );
        (interaction.data as any).runtimeContext = {
            extra: context.extra,
            choice: context.choice,
        };
        (interaction.data as any).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
            data: { runtimeContext?: { extra?: ImmediateExtraActionPayload; choice?: ImmediateActionCardChoice } },
        ) => {
            const latestExtra = data?.runtimeContext?.extra;
            const latestChoice = data?.runtimeContext?.choice;
            if (!latestExtra || !latestChoice) return [];
            return [
                ...buildImmediateExtraActionBaseOptions(latestState, latestExtra, latestChoice),
                createSkipOption('放弃这次额外战术') as any,
            ];
        };
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        if ((value as { skip?: boolean })?.skip) {
            return { state, events: [] };
        }
        const { baseIndex } = value as ImmediateBaseChoice;
        if (baseIndex === undefined || context.extra.playerId !== playerId) {
            return { state, events: [] };
        }
        return executeImmediateExtraActionPlay(state, context.extra, context.choice, timestamp, random, baseIndex);
    },
});

const immediateExtraActionMinionPromptProgram = createPromptProgram<
    ImmediateExtraActionMinionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'smashup_immediate_extra_action_minion',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `smashup_immediate_extra_action_minion_${immediateExtraPromptCounter++}`,
            context.extra.playerId,
            '选择该额外战术的目标随从',
            [
                ...buildImmediateExtraActionMinionOptions(context.matchState, context.extra, context.choice),
                createSkipOption('放弃这次额外战术') as any,
            ],
            {
                sourceId: 'smashup_immediate_extra_action_minion',
                targetType: 'minion',
                autoResolveIfSingle: false,
            },
        );
        (interaction.data as any).runtimeContext = {
            extra: context.extra,
            choice: context.choice,
        };
        (interaction.data as any).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
            data: { runtimeContext?: { extra?: ImmediateExtraActionPayload; choice?: ImmediateActionCardChoice } },
        ) => {
            const latestExtra = data?.runtimeContext?.extra;
            const latestChoice = data?.runtimeContext?.choice;
            if (!latestExtra || !latestChoice) return [];
            return [
                ...buildImmediateExtraActionMinionOptions(latestState, latestExtra, latestChoice),
                createSkipOption('放弃这次额外战术') as any,
            ];
        };
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        if ((value as { skip?: boolean })?.skip) {
            return { state, events: [] };
        }
        const { baseIndex, minionUid } = value as ImmediateMinionTargetChoice;
        if (baseIndex === undefined || !minionUid || context.extra.playerId !== playerId) {
            return { state, events: [] };
        }
        return executeImmediateExtraActionPlay(state, context.extra, context.choice, timestamp, random, baseIndex, minionUid);
    },
});

const immediateExtraActionPromptProgram = createPromptProgram<
    ImmediateExtraActionPromptContext,
    SmashUpCore,
    SmashUpEvent
>({
    sourceId: 'smashup_immediate_extra_action',
    buildInteraction: (context) => {
        const interaction = createAbilityRuntimeSimpleChoice(
            `smashup_immediate_extra_${immediateExtraPromptCounter++}`,
            context.extra.playerId,
            '立刻打出一张额外战术，或放弃这次机会',
            buildImmediateExtraActionCardOptions(context.matchState, context.extra) as any[],
            {
                sourceId: 'smashup_immediate_extra_action',
                targetType: 'hand',
                autoResolveIfSingle: false,
            },
        );
        (interaction.data as any).runtimeContext = { extra: context.extra };
        (interaction.data as any).autoRefresh = 'hand';
        (interaction.data as any).responseValidationMode = 'live';
        (interaction.data as any).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
            data: { runtimeContext?: { extra?: ImmediateExtraActionPayload } },
        ) => {
            const latestExtra = data?.runtimeContext?.extra;
            if (!latestExtra) {
                return [createSkipOption('放弃这次额外战术') as any];
            }
            return buildImmediateExtraActionCardOptions(latestState, latestExtra) as any[];
        };
        return interaction;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        if ((value as { skip?: boolean })?.skip) {
            return { state, events: [] };
        }

        const choice = value as ImmediateActionCardChoice;
        if (!choice.cardUid || context.extra.playerId !== playerId) {
            return { state, events: [] };
        }

        const def = getCardDef(choice.defId) as ActionCardDef | FusionCardDef | undefined;
        if (!def) {
            return { state, events: [] };
        }

        const targetMode = getImmediateActionTargetMode(def);
        if (targetMode === 'none') {
            return executeImmediateExtraActionPlay(state, context.extra, choice, timestamp, random);
        }

        if (targetMode === 'base') {
            const baseOptions = buildImmediateExtraActionBaseOptions(state, context.extra, choice);
            if (baseOptions.length === 0) {
                return { state, events: [] };
            }
            if (baseOptions.length === 1) {
                const selected = baseOptions[0].value as ImmediateBaseChoice;
                return executeImmediateExtraActionPlay(state, context.extra, choice, timestamp, random, selected.baseIndex);
            }
            return {
                state,
                events: [],
                context: {
                    matchState: state,
                    extra: context.extra,
                    choice,
                },
                nextProgram: immediateExtraActionBasePromptProgram,
            };
        }

        const minionOptions = buildImmediateExtraActionMinionOptions(state, context.extra, choice);
        if (minionOptions.length === 0) {
            return { state, events: [] };
        }
        if (minionOptions.length === 1) {
            const selected = minionOptions[0].value as ImmediateMinionTargetChoice;
            return executeImmediateExtraActionPlay(state, context.extra, choice, timestamp, random, selected.baseIndex, selected.minionUid);
        }

        return {
            state,
            events: [],
            context: {
                matchState: state,
                extra: context.extra,
                choice,
            },
            nextProgram: immediateExtraActionMinionPromptProgram,
        };
    },
});

export function queueImmediateExtraPlayInteractions(
    state: MatchState<SmashUpCore>,
    events: LimitModifiedEvent[],
): MatchState<SmashUpCore> {
    let nextState = state;
    const sysAny = nextState.sys as Record<string, unknown>;
    if (!(sysAny._processedImmediateExtraEvents instanceof Set)) {
        sysAny._processedImmediateExtraEvents = new Set<string>();
    }
    const processedImmediateExtraEvents = sysAny._processedImmediateExtraEvents as Set<string>;

    for (const event of events) {
        if (event.payload.playTiming !== 'immediate' || event.payload.delta <= 0) continue;
        const eventKey = buildImmediateExtraEventKey(event);
        if (processedImmediateExtraEvents.has(eventKey)) continue;
        processedImmediateExtraEvents.add(eventKey);
        const payload = event.payload as ImmediateExtraLimitPayload;
        const result = executeAbilityProgram(
            payload.limitType === 'minion'
                ? immediateExtraMinionPromptProgram
                : immediateExtraActionPromptProgram,
            {
                matchState: nextState,
                extra: payload,
            },
        );
        nextState = result.matchState ?? nextState;
    }

    return nextState;
}
