import type { MatchState } from '../../../engine/types';
import { getBaseDef, getCardDef, getMinionLikePower } from '../data/cards';
import { validate, type SmashUpValidateOptions } from './commands';
import { execute } from './reducer';
import {
    buildBaseTargetOptions,
    buildMinionTargetOptions,
    createSkipOption,
    getSetAsideTitansPlayableAs,
    grantExtraAction,
    grantExtraMinion,
} from './abilityHelpers';
import {
    attachDeferredInteractionSnapshot,
    createAbilityRuntimeSimpleChoice,
    createPromptProgram,
    executeAbilityProgram,
    readDeferredInteractionSnapshot,
} from './abilityRuntime';
import {
    SU_COMMANDS,
    SU_EVENTS,
    type ActionCardDef,
    type FusionCardDef,
    type LimitModifiedEvent,
    type SmashUpCore,
    type SmashUpEvent,
} from './types';
import { isOperationRestricted } from './ongoingEffects';
import { getActionPlayTargetMode } from './playLegality';
import {
    isCardActionLike,
    isCardMinionLike,
    isSameNameDefId,
} from './utils';

type ImmediateExtraLimitPayload = LimitModifiedEvent['payload'] & { playTiming: 'immediate' };
type ImmediateExtraMinionPayload = ImmediateExtraLimitPayload & { limitType: 'minion' };
type ImmediateExtraActionPayload = ImmediateExtraLimitPayload & { limitType: 'action' };

type ImmediateMinionCardChoice =
    | { cardUid: string; defId: string; source?: 'hand' | 'deck' | 'stored' }
    | { titanUid: string; defId: string; playKind: 'minion' };
type ImmediateActionCardChoice = { cardUid: string; defId: string; source?: 'hand' | 'stored' };
type ImmediateBaseChoice = { baseIndex: number };
type ImmediateMinionTargetChoice = { baseIndex: number; minionUid: string };

let immediateExtraPromptCounter = 0;

function isBaseModifierActionLike(def: ActionCardDef | FusionCardDef): boolean {
    if (def.type === 'fusion') {
        return def.actionSubtype === 'ongoing' && (def.actionOngoingTarget ?? 'base') === 'base';
    }
    return def.subtype === 'ongoing' && (def.ongoingTarget ?? 'base') === 'base';
}

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
        payload.restrictToCardUid ?? '__any_card_uid__',
        payload.restrictToCardDefId ?? '__any_card_def__',
        payload.restrictToBaseModifier ? 'base_modifier_only' : 'any_action_kind',
        payload.specificCardUid ?? '__any_card__',
        payload.sameNameDefId ?? '__any_name__',
        payload.sameNameOnly ? 'same_name' : 'not_same_name',
        payload.powerMax ?? '__any_power__',
        payload.specialActionWindow ?? '__any_window__',
        event.timestamp ?? 0,
    ].join('|');
}

function matchesImmediateExtraMinionConstraint(
    defId: string,
    power: number,
    extra: ImmediateExtraMinionPayload,
): boolean {
    if (extra.sameNameOnly && extra.sameNameDefId && !isSameNameDefId(defId, extra.sameNameDefId)) {
        return false;
    }
    if (extra.powerMax !== undefined && power > extra.powerMax) {
        return false;
    }
    return true;
}

function buildImmediateExtraValidateOptions(
    extra: ImmediateExtraLimitPayload,
): SmashUpValidateOptions {
    return {
        playContext: {
            phase: 'playCards',
            currentPlayerId: extra.playerId,
            ignoreReactionWindow: true,
            immediateExtra: {
                limitType: extra.limitType,
                playerId: extra.playerId,
                ...(extra.restrictToBase !== undefined ? { restrictToBase: extra.restrictToBase } : {}),
                ...(extra.restrictToMinionUid !== undefined ? { restrictToMinionUid: extra.restrictToMinionUid } : {}),
                ...(extra.restrictToCardUid !== undefined ? { restrictToCardUid: extra.restrictToCardUid } : {}),
                ...(extra.restrictToCardDefId !== undefined ? { restrictToCardDefId: extra.restrictToCardDefId } : {}),
                ...(extra.restrictToBaseModifier ? { restrictToBaseModifier: true } : {}),
                ...(extra.specialActionWindow ? { specialActionWindow: extra.specialActionWindow } : {}),
                ...(extra.powerMax !== undefined ? { powerMax: extra.powerMax } : {}),
                ...(extra.sameNameOnly ? { sameNameOnly: true } : {}),
                ...(extra.sameNameDefId ? { sameNameDefId: extra.sameNameDefId } : {}),
                ...(extra.specificCardUid ? { specificCardUid: extra.specificCardUid } : {}),
            },
        },
    };
}

function buildImmediateExtraMinionCardOptions(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraMinionPayload,
) {
    const validateOptions = buildImmediateExtraValidateOptions(extra);
    const player = state.core.players[extra.playerId];
    if (!player) return [createSkipOption('放弃这次额外随从', 'ui.immediate_extra_minion_skip_option') as any];

    const buildCardOptions = (
        cards: typeof player.hand,
        source: 'hand' | 'deck' | 'stored',
        idPrefix: string,
    ) => cards
        .filter(card => isCardMinionLike(card))
        .filter(card => !extra.specificCardUid || card.uid === extra.specificCardUid)
        .filter(card => !extra.sameNameDefId || isSameNameDefId(card.defId, extra.sameNameDefId))
        .filter(card => source !== 'stored' || (card.counters ?? 0) <= 0)
        .flatMap((card, index) => {
            const power = getMinionLikePower(card.defId) ?? 0;
            if (!matchesImmediateExtraMinionConstraint(card.defId, power, extra)) return [];
            const validBaseIndices = state.core.bases
                .map((_, baseIndex) => baseIndex)
                .filter(baseIndex => validate(state, {
                    type: SU_COMMANDS.PLAY_MINION,
                    playerId: extra.playerId,
                    payload: {
                        cardUid: card.uid,
                        baseIndex,
                        ...(source === 'deck' ? { fromDeck: true } : {}),
                        ...(source === 'stored' ? { fromStored: true } : {}),
                    },
                }, validateOptions).valid);

            if (validBaseIndices.length === 0) return [];

            const def = getCardDef(card.defId);
            return [{
                id: `${idPrefix}-${index}`,
                label: `${def?.name ?? card.defId} (力量 ${power})`,
                value: { cardUid: card.uid, defId: card.defId, source } satisfies ImmediateMinionCardChoice,
                displayMode: 'card' as const,
                _source: source as const,
            }];
        });
    const handOptions = buildCardOptions(player.hand, 'hand', 'card');
    const deckOptions = buildCardOptions(player.deck, 'deck', 'deck-card');
    const storedOptions = buildCardOptions(player.storedCards ?? [], 'stored', 'stored-card');

    const titanOptions = extra.specificCardUid ? [] : getSetAsideTitansPlayableAs(state.core, extra.playerId, 'minion')
        .filter(titan => !extra.sameNameDefId || isSameNameDefId(titan.defId, extra.sameNameDefId))
        .flatMap((titan, index) => {
            const power = getMinionLikePower(titan.defId) ?? 0;
            if (!matchesImmediateExtraMinionConstraint(titan.defId, power, extra)) return [];
            const validBaseIndices = state.core.bases
                .map((_, baseIndex) => baseIndex)
                .filter(baseIndex => validate(state, {
                    type: SU_COMMANDS.ACTIVATE_SPECIAL,
                    playerId: extra.playerId,
                    payload: { titanUid: titan.uid, baseIndex },
                }, validateOptions).valid);

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

    return [...handOptions, ...deckOptions, ...storedOptions, ...titanOptions, createSkipOption('放弃这次额外随从', 'ui.immediate_extra_minion_skip_option') as any];
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
    const validateOptions = buildImmediateExtraValidateOptions(extra);
    if ('titanUid' in choice) {
        const candidates = state.core.bases
            .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}` }))
            .filter(candidate => extra.restrictToBase === undefined || candidate.baseIndex === extra.restrictToBase)
            .filter(candidate => validate(state, {
                type: SU_COMMANDS.ACTIVATE_SPECIAL,
                playerId: extra.playerId,
                payload: { titanUid: choice.titanUid, baseIndex: candidate.baseIndex },
            }, validateOptions).valid);

        return buildBaseTargetOptions(candidates, state.core);
    }

    const candidates = state.core.bases
        .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}` }))
        .filter(candidate => extra.restrictToBase === undefined || candidate.baseIndex === extra.restrictToBase)
        .filter(candidate => validate(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: extra.playerId,
            payload: {
                cardUid: choice.cardUid,
                baseIndex: candidate.baseIndex,
                ...(choice.source === 'deck' ? { fromDeck: true } : {}),
                ...(choice.source === 'stored' ? { fromStored: true } : {}),
            },
        }, validateOptions).valid);

    return buildBaseTargetOptions(candidates, state.core);
}

function buildImmediateExtraActionCardOptions(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraActionPayload,
) {
    const validateOptions = buildImmediateExtraValidateOptions(extra);
    const player = state.core.players[extra.playerId];
    if (!player) return [createSkipOption('放弃这次额外战术', 'ui.immediate_extra_action_skip_option') as any];

    const buildActionOptions = (
        cards: typeof player.hand,
        source: 'hand' | 'stored',
        idPrefix: string,
    ) => cards
        .filter(card => isCardActionLike(card))
        .filter(card => extra.restrictToCardUid === undefined || card.uid === extra.restrictToCardUid)
        .filter(card => extra.restrictToCardDefId === undefined || card.defId === extra.restrictToCardDefId)
        .filter(card => source !== 'stored' || (card.counters ?? 0) <= 0)
        .flatMap((card, index) => {
            const def = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
            if (!def) return [];
            if (extra.restrictToBaseModifier && !isBaseModifierActionLike(def)) return [];

            const targetMode = getActionPlayTargetMode(def);
            if (extra.restrictToMinionUid && targetMode !== 'minion') return [];
            const playable = (() => {
                if (targetMode === 'none') {
                    return validate(state, {
                        type: SU_COMMANDS.PLAY_ACTION,
                        playerId: extra.playerId,
                        payload: { cardUid: card.uid, ...(source === 'stored' ? { fromStored: true } : {}) },
                    }, validateOptions).valid;
                }
                if (targetMode === 'base') {
                    const baseChecks = state.core.bases.map((_base, baseIndex) => {
                        const blockedByBaseRestriction = extra.restrictToBase !== undefined && extra.restrictToBase !== baseIndex;
                        const blockedByWindowRestriction = !blockedByBaseRestriction
                            && Boolean(
                                extra.specialActionWindow
                                && isOperationRestricted(state.core, baseIndex, extra.playerId, 'play_action', {
                                    activationWindow: extra.specialActionWindow,
                                }),
                            );
                        const validation = !blockedByBaseRestriction && !blockedByWindowRestriction
                            ? validate(state, {
                                type: SU_COMMANDS.PLAY_ACTION,
                                playerId: extra.playerId,
                                payload: { cardUid: card.uid, targetBaseIndex: baseIndex, ...(source === 'stored' ? { fromStored: true } : {}) },
                            }, validateOptions)
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
                    if (extra.specialActionWindow && isOperationRestricted(state.core, baseIndex, extra.playerId, 'play_action', {
                        activationWindow: extra.specialActionWindow,
                    })) return false;
                    return base.minions.some(minion => validate(state, {
                        type: SU_COMMANDS.PLAY_ACTION,
                        playerId: extra.playerId,
                        payload: { cardUid: card.uid, targetBaseIndex: baseIndex, targetMinionUid: minion.uid, ...(source === 'stored' ? { fromStored: true } : {}) },
                    }, validateOptions).valid);
                });
            })();

            if (!playable) return [];

            return [{
                id: `${idPrefix}-${index}`,
                label: def.name ?? card.defId,
                value: { cardUid: card.uid, defId: card.defId, source } satisfies ImmediateActionCardChoice,
                displayMode: 'card' as const,
                _source: source as const,
            }];
        });
    const options = [
        ...buildActionOptions(player.hand, 'hand', 'card'),
        ...buildActionOptions(player.storedCards ?? [], 'stored', 'stored-card'),
    ];

    return [...options, createSkipOption('放弃这次额外战术', 'ui.immediate_extra_action_skip_option') as any];
}

function buildImmediateExtraActionBaseOptions(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraActionPayload,
    choice: ImmediateActionCardChoice,
) {
    const validateOptions = buildImmediateExtraValidateOptions(extra);
    const candidates = state.core.bases
        .map((base, baseIndex) => ({ baseIndex, label: getBaseDef(base.defId)?.name ?? `基地 ${baseIndex + 1}` }))
        .filter(candidate => extra.restrictToBase === undefined || candidate.baseIndex === extra.restrictToBase)
        .filter(candidate => !extra.specialActionWindow || !isOperationRestricted(state.core, candidate.baseIndex, extra.playerId, 'play_action', {
            activationWindow: extra.specialActionWindow,
        }))
        .filter(candidate => validate(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: extra.playerId,
            payload: { cardUid: choice.cardUid, targetBaseIndex: candidate.baseIndex, ...(choice.source === 'stored' ? { fromStored: true } : {}) },
        }, validateOptions).valid);

    return buildBaseTargetOptions(candidates, state.core);
}

function buildImmediateExtraActionMinionOptions(
    state: MatchState<SmashUpCore>,
    extra: ImmediateExtraActionPayload,
    choice: ImmediateActionCardChoice,
) {
    const validateOptions = buildImmediateExtraValidateOptions(extra);
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
            if (!validate(state, {
                type: SU_COMMANDS.PLAY_ACTION,
                playerId: extra.playerId,
                payload: { cardUid: choice.cardUid, targetBaseIndex: baseIndex, targetMinionUid: minion.uid, ...(choice.source === 'stored' ? { fromStored: true } : {}) },
            }, validateOptions).valid) {
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
    const validateOptions = buildImmediateExtraValidateOptions(extra);
    if (extra.specificCardUid) {
        if ('titanUid' in choice || choice.cardUid !== extra.specificCardUid) {
            return { matchState: state, events: [] };
        }
    }
    const validation = 'titanUid' in choice
        ? validate(state, {
            type: SU_COMMANDS.ACTIVATE_SPECIAL,
            playerId: extra.playerId,
            payload: { titanUid: choice.titanUid, baseIndex },
        }, validateOptions)
        : validate(state, {
            type: SU_COMMANDS.PLAY_MINION,
            playerId: extra.playerId,
            payload: {
                cardUid: choice.cardUid,
                baseIndex,
                ...(choice.source === 'deck' ? { fromDeck: true } : {}),
                ...(choice.source === 'stored' ? { fromStored: true } : {}),
            },
        }, validateOptions);
    if (!validation.valid) {
        return { matchState: state, events: [] };
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
            payload: {
                cardUid: choice.cardUid,
                baseIndex,
                ...(choice.source === 'deck' ? { fromDeck: true } : {}),
                ...(choice.source === 'stored' ? { fromStored: true } : {}),
            },
            timestamp,
    }, random);
    const needsBankedExtra = 'titanUid' in choice || choice.source === undefined || choice.source === 'hand';

    return {
        matchState: execState,
        events: [
            ...(needsBankedExtra ? [grantExtraMinion(
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
                )] : []),
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
        return { matchState: state, events: [] };
    }
    if (extra.restrictToBase !== undefined && targetBaseIndex !== extra.restrictToBase) {
        return { matchState: state, events: [] };
    }
    const choiceDef = getCardDef(choice.defId) as ActionCardDef | FusionCardDef | undefined;
    if (!choiceDef) {
        return { matchState: state, events: [] };
    }
    if (extra.restrictToCardUid !== undefined && choice.cardUid !== extra.restrictToCardUid) {
        return { matchState: state, events: [] };
    }
    if (extra.restrictToCardDefId !== undefined && choice.defId !== extra.restrictToCardDefId) {
        return { matchState: state, events: [] };
    }
    if (extra.restrictToBaseModifier && !isBaseModifierActionLike(choiceDef)) {
        return { matchState: state, events: [] };
    }
    const validateOptions = buildImmediateExtraValidateOptions(extra);
    const validation = validate(state, {
        type: SU_COMMANDS.PLAY_ACTION,
        playerId: extra.playerId,
        payload: { cardUid: choice.cardUid, targetBaseIndex, targetMinionUid, ...(choice.source === 'stored' ? { fromStored: true } : {}) },
    }, validateOptions);
    if (!validation.valid) {
        return { matchState: state, events: [] };
    }

    const execState: MatchState<SmashUpCore> = { ...state, sys: { ...state.sys } };
    const events = execute(execState, {
        type: SU_COMMANDS.PLAY_ACTION,
        playerId: extra.playerId,
        payload: { cardUid: choice.cardUid, targetBaseIndex, targetMinionUid, ...(choice.source === 'stored' ? { fromStored: true } : {}) },
        timestamp,
    }, random);
    const needsBankedExtra = choice.source !== 'stored';
    return {
        matchState: execState,
        events: [...(needsBankedExtra ? [grantExtraAction(extra.playerId, extra.reason, timestamp)] : []), ...events],
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
                createSkipOption('放弃这次额外随从', 'ui.immediate_extra_minion_skip_option') as any,
            ],
            {
                sourceId: 'smashup_immediate_extra_minion_base',
                targetType: 'base',
                autoResolveIfSingle: false,
                titleKey: 'ui.immediate_extra_minion_base_title',
            },
        );
        const interactionWithSnapshot = attachDeferredInteractionSnapshot(interaction, {
            extra: context.extra,
            choice: context.choice,
        });
        (interactionWithSnapshot.data as any).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
            data: Record<string, unknown> | undefined,
        ) => {
            const snapshot = readDeferredInteractionSnapshot<{
                extra?: ImmediateExtraMinionPayload;
                choice?: ImmediateMinionCardChoice;
            }>(data);
            const latestExtra = snapshot?.extra;
            const latestChoice = snapshot?.choice;
            if (!latestExtra || !latestChoice) return [];
            return [
                ...buildImmediateExtraMinionBaseOptions(latestState, latestExtra, latestChoice),
                createSkipOption('放弃这次额外随从', 'ui.immediate_extra_minion_skip_option') as any,
            ];
        };
        return interactionWithSnapshot;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        if ((value as { skip?: boolean })?.skip) {
            return {
                matchState: state,
                events: buildMinionSkipEvents(playerId, context.extra, timestamp),
            };
        }
        const { baseIndex } = value as ImmediateBaseChoice;
        if (baseIndex === undefined || context.extra.playerId !== playerId) {
            return { matchState: state, events: [] };
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
                titleKey: 'ui.immediate_extra_minion_title',
            },
        );
        const interactionWithSnapshot = attachDeferredInteractionSnapshot(interaction, { extra: context.extra });
        (interactionWithSnapshot.data as any).autoRefresh = 'hand';
        (interactionWithSnapshot.data as any).responseValidationMode = 'live';
        (interactionWithSnapshot.data as any).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
            data: Record<string, unknown> | undefined,
        ) => {
            const snapshot = readDeferredInteractionSnapshot<{ extra?: ImmediateExtraMinionPayload }>(data);
            const latestExtra = snapshot?.extra;
            if (!latestExtra) {
                return [createSkipOption('放弃这次额外随从', 'ui.immediate_extra_minion_skip_option') as any];
            }
            return buildImmediateExtraMinionCardOptions(latestState, latestExtra) as any[];
        };
        return interactionWithSnapshot;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        if ((value as { skip?: boolean })?.skip) {
            return {
                matchState: state,
                events: buildMinionSkipEvents(playerId, context.extra, timestamp),
            };
        }

        const choice = value as ImmediateMinionCardChoice;
        if ((!('cardUid' in choice) && !('titanUid' in choice)) || context.extra.playerId !== playerId) {
            return { matchState: state, events: [] };
        }

        const baseOptions = buildImmediateExtraMinionBaseOptions(state, context.extra, choice);
        if (baseOptions.length === 0) {
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
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
                createSkipOption('放弃这次额外战术', 'ui.immediate_extra_action_skip_option') as any,
            ],
            {
                sourceId: 'smashup_immediate_extra_action_base',
                targetType: 'base',
                autoResolveIfSingle: false,
                titleKey: 'ui.immediate_extra_action_base_title',
            },
        );
        const interactionWithSnapshot = attachDeferredInteractionSnapshot(interaction, {
            extra: context.extra,
            choice: context.choice,
        });
        (interactionWithSnapshot.data as any).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
            data: Record<string, unknown> | undefined,
        ) => {
            const snapshot = readDeferredInteractionSnapshot<{
                extra?: ImmediateExtraActionPayload;
                choice?: ImmediateActionCardChoice;
            }>(data);
            const latestExtra = snapshot?.extra;
            const latestChoice = snapshot?.choice;
            if (!latestExtra || !latestChoice) return [];
            return [
                ...buildImmediateExtraActionBaseOptions(latestState, latestExtra, latestChoice),
                createSkipOption('放弃这次额外战术', 'ui.immediate_extra_action_skip_option') as any,
            ];
        };
        return interactionWithSnapshot;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        if ((value as { skip?: boolean })?.skip) {
            return { matchState: state, events: [] };
        }
        const { baseIndex } = value as ImmediateBaseChoice;
        if (baseIndex === undefined || context.extra.playerId !== playerId) {
            return { matchState: state, events: [] };
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
                createSkipOption('放弃这次额外战术', 'ui.immediate_extra_action_skip_option') as any,
            ],
            {
                sourceId: 'smashup_immediate_extra_action_minion',
                targetType: 'minion',
                autoResolveIfSingle: false,
                titleKey: 'ui.immediate_extra_action_minion_title',
            },
        );
        const interactionWithSnapshot = attachDeferredInteractionSnapshot(interaction, {
            extra: context.extra,
            choice: context.choice,
        });
        (interactionWithSnapshot.data as any).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
            data: Record<string, unknown> | undefined,
        ) => {
            const snapshot = readDeferredInteractionSnapshot<{
                extra?: ImmediateExtraActionPayload;
                choice?: ImmediateActionCardChoice;
            }>(data);
            const latestExtra = snapshot?.extra;
            const latestChoice = snapshot?.choice;
            if (!latestExtra || !latestChoice) return [];
            return [
                ...buildImmediateExtraActionMinionOptions(latestState, latestExtra, latestChoice),
                createSkipOption('放弃这次额外战术', 'ui.immediate_extra_action_skip_option') as any,
            ];
        };
        return interactionWithSnapshot;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        if ((value as { skip?: boolean })?.skip) {
            return { matchState: state, events: [] };
        }
        const { baseIndex, minionUid } = value as ImmediateMinionTargetChoice;
        if (baseIndex === undefined || !minionUid || context.extra.playerId !== playerId) {
            return { matchState: state, events: [] };
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
                titleKey: 'ui.immediate_extra_action_title',
            },
        );
        const interactionWithSnapshot = attachDeferredInteractionSnapshot(interaction, { extra: context.extra });
        (interactionWithSnapshot.data as any).autoRefresh = 'hand';
        (interactionWithSnapshot.data as any).responseValidationMode = 'live';
        (interactionWithSnapshot.data as any).optionsGenerator = (
            latestState: MatchState<SmashUpCore>,
            data: Record<string, unknown> | undefined,
        ) => {
            const snapshot = readDeferredInteractionSnapshot<{ extra?: ImmediateExtraActionPayload }>(data);
            const latestExtra = snapshot?.extra;
            if (!latestExtra) {
                return [createSkipOption('放弃这次额外战术', 'ui.immediate_extra_action_skip_option') as any];
            }
            return buildImmediateExtraActionCardOptions(latestState, latestExtra) as any[];
        };
        return interactionWithSnapshot;
    },
    onResolve: ({ context, state, playerId, value, random, timestamp }) => {
        if ((value as { skip?: boolean })?.skip) {
            return { matchState: state, events: [] };
        }

        const choice = value as ImmediateActionCardChoice;
        if (!choice.cardUid || context.extra.playerId !== playerId) {
            return { matchState: state, events: [] };
        }

        const def = getCardDef(choice.defId) as ActionCardDef | FusionCardDef | undefined;
        if (!def) {
            return { matchState: state, events: [] };
        }

        const targetMode = getActionPlayTargetMode(def);
        if (targetMode === 'none') {
            return executeImmediateExtraActionPlay(state, context.extra, choice, timestamp, random);
        }

        if (targetMode === 'base') {
            const baseOptions = buildImmediateExtraActionBaseOptions(state, context.extra, choice);
            if (baseOptions.length === 0) {
                return { matchState: state, events: [] };
            }
            return {
                matchState: state,
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
            return { matchState: state, events: [] };
        }
        return {
            matchState: state,
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
