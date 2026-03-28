import type { Command, MatchState, PlayerId } from '../../engine/types';
import { createAiLegalActionId, createActionKindScorer, createScoredLocalAiPolicy } from '../../engine/ai';
import type { AiLegalAction, GameAiRuntime, LocalAiActionScorer } from '../../engine/ai';
import type { InteractionDescriptor as EngineInteractionDescriptor, PromptMultiConfig } from '../../engine/systems/InteractionSystem';
import {
    SU_COMMANDS,
    getCurrentPlayerId,
    type ActionCardDef,
    type CardInstance,
    type FusionCardDef,
    type SmashUpCore,
} from './domain/types';
import { SMASHUP_FACTION_IDS } from './domain/ids';
import { validate } from './domain/commands';
import {
    actionLikeNeedsResponseWindowBase,
    getActionLikeResponseWindowTiming,
    isCardActionLike,
    isCardMinionLike,
} from './domain/utils';
import {
    getEffectiveBreakpoint,
    getPlayerEffectivePowerOnBase,
    getScoringEligibleBaseIndices,
    getTotalEffectivePowerOnBase,
} from './domain/ongoingModifiers';
import { getCardDef, getMinionLikePower, getBaseDef } from './data/cards';

type SmashUpState = MatchState<SmashUpCore>;

type SmashUpInteractionOption = {
    id?: string;
    label?: string;
    value?: unknown;
    disabled?: boolean;
    displayMode?: string;
};

const SELECTABLE_FACTIONS = Object.values(SMASHUP_FACTION_IDS).filter((factionId) => factionId !== SMASHUP_FACTION_IDS.MADNESS);

const FACTION_PRIORITY = [
    SMASHUP_FACTION_IDS.ROBOTS,
    SMASHUP_FACTION_IDS.WIZARDS,
    SMASHUP_FACTION_IDS.ALIENS,
    SMASHUP_FACTION_IDS.DINOSAURS,
    SMASHUP_FACTION_IDS.ZOMBIES,
    SMASHUP_FACTION_IDS.NINJAS,
    SMASHUP_FACTION_IDS.PIRATES,
    SMASHUP_FACTION_IDS.TRICKSTERS,
    SMASHUP_FACTION_IDS.GHOSTS,
    SMASHUP_FACTION_IDS.STEAMPUNKS,
    SMASHUP_FACTION_IDS.KILLER_PLANTS,
    SMASHUP_FACTION_IDS.BEAR_CAVALRY,
    SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU,
    SMASHUP_FACTION_IDS.ELDER_THINGS,
    SMASHUP_FACTION_IDS.INNSMOUTH,
    SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY,
    SMASHUP_FACTION_IDS.FRANKENSTEIN,
    SMASHUP_FACTION_IDS.WEREWOLVES,
    SMASHUP_FACTION_IDS.VAMPIRES,
    SMASHUP_FACTION_IDS.GIANT_ANTS,
    SMASHUP_FACTION_IDS.ALIENS_POD,
    SMASHUP_FACTION_IDS.DINOSAURS_POD,
    SMASHUP_FACTION_IDS.GHOSTS_POD,
    SMASHUP_FACTION_IDS.NINJAS_POD,
    SMASHUP_FACTION_IDS.PIRATES_POD,
    SMASHUP_FACTION_IDS.ROBOTS_POD,
    SMASHUP_FACTION_IDS.TRICKSTERS_POD,
    SMASHUP_FACTION_IDS.WIZARDS_POD,
    SMASHUP_FACTION_IDS.ZOMBIES_POD,
    SMASHUP_FACTION_IDS.BEAR_CAVALRY_POD,
    SMASHUP_FACTION_IDS.STEAMPUNKS_POD,
    SMASHUP_FACTION_IDS.KILLER_PLANTS_POD,
    SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU_POD,
    SMASHUP_FACTION_IDS.ELDER_THINGS_POD,
    SMASHUP_FACTION_IDS.INNSMOUTH_POD,
    SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY_POD,
    SMASHUP_FACTION_IDS.FRANKENSTEIN_POD,
    SMASHUP_FACTION_IDS.WEREWOLVES_POD,
    SMASHUP_FACTION_IDS.VAMPIRES_POD,
    SMASHUP_FACTION_IDS.GIANT_ANTS_POD,
];

const createCommand = (playerId: PlayerId, type: string, payload: unknown = {}): Command => ({
    type,
    playerId,
    payload,
    timestamp: 0,
});

const isCommandValid = (
    state: SmashUpState,
    playerId: PlayerId,
    type: string,
    payload: unknown = {},
): boolean => {
    if (type === 'ADVANCE_PHASE') return true;
    const result = validate(state, createCommand(playerId, type, payload) as never);
    return result.valid;
};

const getBaseLabel = (state: SmashUpState, baseIndex: number): string => {
    const base = state.core.bases[baseIndex];
    if (!base) return `基地 ${baseIndex + 1}`;
    const baseDef = getBaseDef(base.defId);
    return baseDef?.name ?? base.defId;
};

const getCardLabel = (card: CardInstance): string => {
    const cardDef = getCardDef(card.defId);
    return cardDef?.name ?? card.defId;
};

const getFactionPriority = (factionId: string): number => {
    const index = FACTION_PRIORITY.indexOf(factionId as (typeof FACTION_PRIORITY)[number]);
    return index >= 0 ? index : FACTION_PRIORITY.length + 10;
};

const appendAction = (
    actions: AiLegalAction[],
    state: SmashUpState,
    playerId: PlayerId,
    action: AiLegalAction,
    options?: { skipValidation?: boolean },
): void => {
    if (action.commands.length === 0) return;
    if (!options?.skipValidation) {
        const isValid = action.commands.every((command) => isCommandValid(state, playerId, command.type, command.payload));
        if (!isValid) return;
    }
    actions.push(action);
};

const buildSimpleChoicePayload = (
    optionIds: string[],
    multi: PromptMultiConfig | undefined,
    optionValue?: unknown,
): Record<string, unknown> => {
    if (optionIds.length <= 1 && !multi) {
        return optionValue === undefined
            ? { optionId: optionIds[0] }
            : { optionId: optionIds[0], mergedValue: optionValue };
    }
    if (optionIds.length <= 1 && (multi?.min ?? 0) <= 1) {
        return optionValue === undefined
            ? { optionId: optionIds[0] }
            : { optionId: optionIds[0], mergedValue: optionValue };
    }
    return { optionIds };
};

const buildInteractionActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] | null => {
    const current = state.sys.interaction?.current as EngineInteractionDescriptor | undefined;
    if (!current || current.playerId !== playerId) return null;
    if (current.kind !== 'simple-choice') return null;

    const data = current.data as {
        options?: SmashUpInteractionOption[];
        multi?: PromptMultiConfig;
    };
    const options = (data.options ?? []).filter((option): option is Required<Pick<SmashUpInteractionOption, 'id'>> & SmashUpInteractionOption => {
        return typeof option.id === 'string' && option.disabled !== true;
    });
    const minCount = Math.max(1, data.multi?.min ?? 1);

    return options.map((option, index) => ({
        actionId: createAiLegalActionId('interaction', current.id, option.id),
        kind: 'interaction-choice',
        label: option.label ?? `交互选择 ${index + 1}`,
        commands: [{
            type: 'SYS_INTERACTION_RESPOND',
            payload: buildSimpleChoicePayload(
                minCount > 1 ? options.slice(0, minCount).map((item) => item.id) : [option.id],
                data.multi,
                option.value,
            ),
        }],
        metadata: {
            interactionId: current.id,
            optionId: option.id,
            displayMode: option.displayMode,
            optionValue: option.value,
        },
    }));
};

const buildFactionSelectActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] => {
    const selection = state.core.factionSelection;
    if (!selection) return [];
    const taken = new Set(selection.takenFactions);
    const actions: AiLegalAction[] = [];

    for (const factionId of SELECTABLE_FACTIONS) {
        if (taken.has(factionId)) continue;
        appendAction(actions, state, playerId, {
            actionId: createAiLegalActionId('select-faction', factionId),
            kind: 'select-faction',
            label: `选择派系 ${factionId}`,
            commands: [{
                type: SU_COMMANDS.SELECT_FACTION,
                payload: { factionId },
            }],
            metadata: {
                factionId,
                priority: getFactionPriority(factionId),
            },
        });
    }

    return actions;
};

const buildPlayMinionAction = (
    state: SmashUpState,
    playerId: PlayerId,
    card: CardInstance,
    baseIndex: number,
    options?: { fromDiscard?: boolean; inResponseWindow?: boolean },
): AiLegalAction => {
    const power = getMinionLikePower(card.defId) ?? 0;
    const base = state.core.bases[baseIndex];
    const baseTotalPower = base ? getTotalEffectivePowerOnBase(state.core, base, baseIndex) : 0;
    const projectedTotalPower = baseTotalPower + power;
    const breakpoint = getEffectiveBreakpoint(state.core, baseIndex);
    const ownPowerBefore = base ? getPlayerEffectivePowerOnBase(state.core, base, baseIndex, playerId) : 0;

    return {
        actionId: createAiLegalActionId(
            options?.inResponseWindow ? 'response-play-minion' : 'play-minion',
            card.uid,
            options?.fromDiscard ? 'discard' : 'hand',
            baseIndex,
        ),
        kind: options?.inResponseWindow ? 'response-play-minion' : 'play-minion',
        label: `${options?.fromDiscard ? '从弃牌堆打出' : '打出'}随从 ${getCardLabel(card)} 到 ${getBaseLabel(state, baseIndex)}`,
        commands: [{
            type: SU_COMMANDS.PLAY_MINION,
            payload: {
                cardUid: card.uid,
                baseIndex,
                ...(options?.fromDiscard ? { fromDiscard: true } : {}),
            },
        }],
        metadata: {
            cardUid: card.uid,
            defId: card.defId,
            baseIndex,
            power,
            ownPowerBefore,
            baseTotalPower,
            projectedTotalPower,
            breakpoint,
            projectedMargin: projectedTotalPower - breakpoint,
            fromDiscard: options?.fromDiscard === true,
        },
    };
};

const buildPlayActionCandidates = (
    state: SmashUpState,
    card: CardInstance,
    options?: { inResponseWindow?: boolean },
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const cardDef = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
    const responseTiming = cardDef ? getActionLikeResponseWindowTiming(cardDef) : undefined;
    const needsBaseInWindow = cardDef ? actionLikeNeedsResponseWindowBase(cardDef) : false;
    const labelPrefix = options?.inResponseWindow ? '响应打出' : '打出';
    const kind = options?.inResponseWindow ? 'response-play-action' : 'play-action';

    actions.push({
        actionId: createAiLegalActionId(kind, card.uid, 'self'),
        kind,
        label: `${labelPrefix}行动 ${getCardLabel(card)}`,
        commands: [{
            type: SU_COMMANDS.PLAY_ACTION,
            payload: { cardUid: card.uid },
        }],
        metadata: {
            cardUid: card.uid,
            defId: card.defId,
            responseTiming,
            needsBaseInWindow,
        },
    });

    for (let baseIndex = 0; baseIndex < state.core.bases.length; baseIndex += 1) {
        actions.push({
            actionId: createAiLegalActionId(kind, card.uid, 'base', baseIndex),
            kind,
            label: `${labelPrefix}行动 ${getCardLabel(card)} 到 ${getBaseLabel(state, baseIndex)}`,
            commands: [{
                type: SU_COMMANDS.PLAY_ACTION,
                payload: {
                    cardUid: card.uid,
                    targetBaseIndex: baseIndex,
                },
            }],
            metadata: {
                cardUid: card.uid,
                defId: card.defId,
                targetBaseIndex: baseIndex,
                responseTiming,
                needsBaseInWindow,
            },
        });

        for (const minion of state.core.bases[baseIndex].minions) {
            actions.push({
                actionId: createAiLegalActionId(kind, card.uid, 'base', baseIndex, 'minion', minion.uid),
                kind,
                label: `${labelPrefix}行动 ${getCardLabel(card)} 指向 ${minion.defId}`,
                commands: [{
                    type: SU_COMMANDS.PLAY_ACTION,
                    payload: {
                        cardUid: card.uid,
                        targetBaseIndex: baseIndex,
                        targetMinionUid: minion.uid,
                    },
                }],
                metadata: {
                    cardUid: card.uid,
                    defId: card.defId,
                    targetBaseIndex: baseIndex,
                    targetMinionUid: minion.uid,
                    targetMinionDefId: minion.defId,
                    responseTiming,
                    needsBaseInWindow,
                },
            });
        }
    }

    return actions;
};

const buildPlayableCardActions = (
    state: SmashUpState,
    playerId: PlayerId,
    options?: { inResponseWindow?: boolean },
): AiLegalAction[] => {
    const player = state.core.players[playerId];
    if (!player) return [];

    const actions: AiLegalAction[] = [];
    for (const card of player.hand) {
        if (isCardMinionLike(card)) {
            for (let baseIndex = 0; baseIndex < state.core.bases.length; baseIndex += 1) {
                appendAction(actions, state, playerId, buildPlayMinionAction(state, playerId, card, baseIndex, {
                    inResponseWindow: options?.inResponseWindow,
                }));
            }
        }

        if (isCardActionLike(card)) {
            for (const action of buildPlayActionCandidates(state, card, {
                inResponseWindow: options?.inResponseWindow,
            })) {
                appendAction(actions, state, playerId, action);
            }
        }
    }

    for (const card of player.discard) {
        if (!isCardMinionLike(card)) continue;
        for (let baseIndex = 0; baseIndex < state.core.bases.length; baseIndex += 1) {
            appendAction(actions, state, playerId, buildPlayMinionAction(state, playerId, card, baseIndex, {
                fromDiscard: true,
                inResponseWindow: options?.inResponseWindow,
            }));
        }
    }

    return actions;
};

const buildTalentActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];

    state.core.bases.forEach((base, baseIndex) => {
        for (const minion of base.minions) {
            if (minion.controller !== playerId) continue;
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('use-talent', 'minion', minion.uid, baseIndex),
                kind: 'use-talent',
                label: `发动随从天赋 ${minion.defId}`,
                commands: [{
                    type: SU_COMMANDS.USE_TALENT,
                    payload: { minionUid: minion.uid, baseIndex },
                }],
                metadata: {
                    baseIndex,
                    minionUid: minion.uid,
                    defId: minion.defId,
                    sourceType: 'minion',
                },
            });
        }

        for (const ongoing of base.ongoingActions) {
            if (ongoing.ownerId !== playerId) continue;
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('use-talent', 'ongoing', ongoing.uid, baseIndex),
                kind: 'use-talent',
                label: `发动持续行动天赋 ${ongoing.defId}`,
                commands: [{
                    type: SU_COMMANDS.USE_TALENT,
                    payload: { ongoingCardUid: ongoing.uid, baseIndex },
                }],
                metadata: {
                    baseIndex,
                    ongoingCardUid: ongoing.uid,
                    defId: ongoing.defId,
                    sourceType: 'ongoing',
                },
            });
        }

        for (const minion of base.minions) {
            for (const attached of minion.attachedActions) {
                if (attached.ownerId !== playerId) continue;
                appendAction(actions, state, playerId, {
                    actionId: createAiLegalActionId('use-talent', 'attached', attached.uid, baseIndex),
                    kind: 'use-talent',
                    label: `发动附着行动天赋 ${attached.defId}`,
                    commands: [{
                        type: SU_COMMANDS.USE_TALENT,
                        payload: { ongoingCardUid: attached.uid, baseIndex },
                    }],
                    metadata: {
                        baseIndex,
                        ongoingCardUid: attached.uid,
                        defId: attached.defId,
                        sourceType: 'attached',
                    },
                });
            }
        }
    });

    return actions;
};

const buildSpecialActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];

    state.core.bases.forEach((base, baseIndex) => {
        for (const minion of base.minions) {
            if (minion.controller !== playerId) continue;
            appendAction(actions, state, playerId, {
                actionId: createAiLegalActionId('activate-special', minion.uid, baseIndex),
                kind: 'activate-special',
                label: `激活特殊能力 ${minion.defId}`,
                commands: [{
                    type: SU_COMMANDS.ACTIVATE_SPECIAL,
                    payload: { minionUid: minion.uid, baseIndex },
                }],
                metadata: {
                    baseIndex,
                    minionUid: minion.uid,
                    defId: minion.defId,
                    scoringBase: getScoringEligibleBaseIndices(state.core).includes(baseIndex),
                },
            });
        }
    });

    return actions;
};

const buildDiscardActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] => {
    const player = state.core.players[playerId];
    if (!player) return [];
    const excess = player.hand.length - 10;
    if (excess <= 0) return [];

    if (excess === 1) {
        return player.hand.map((card) => ({
            actionId: createAiLegalActionId('discard-to-limit', card.uid),
            kind: 'discard-to-limit',
            label: `弃掉 ${getCardLabel(card)}`,
            commands: [{
                type: SU_COMMANDS.DISCARD_TO_LIMIT,
                payload: { cardUids: [card.uid] },
            }],
            metadata: {
                cardUids: [card.uid],
                discardPriority: -estimateCardKeepValue(card),
            },
        })).filter((action) => isCommandValid(state, playerId, action.commands[0].type, action.commands[0].payload));
    }

    const sorted = [...player.hand].sort((a, b) => estimateCardKeepValue(a) - estimateCardKeepValue(b));
    const discardCards = sorted.slice(0, excess);
    return [{
        actionId: createAiLegalActionId('discard-to-limit', ...discardCards.map((card) => card.uid)),
        kind: 'discard-to-limit',
        label: `弃掉 ${discardCards.map((card) => getCardLabel(card)).join('、')}`,
        commands: [{
            type: SU_COMMANDS.DISCARD_TO_LIMIT,
            payload: { cardUids: discardCards.map((card) => card.uid) },
        }],
        metadata: {
            cardUids: discardCards.map((card) => card.uid),
            discardPriority: -discardCards.reduce((sum, card) => sum + estimateCardKeepValue(card), 0),
        },
    }].filter((action) => isCommandValid(state, playerId, action.commands[0].type, action.commands[0].payload));
};

const buildAdvancePhaseAction = (state: SmashUpState, playerId: PlayerId): AiLegalAction => ({
    actionId: createAiLegalActionId('advance-phase', state.sys.phase, playerId),
    kind: 'advance-phase',
    label: '结束当前阶段',
    commands: [{
        type: 'ADVANCE_PHASE',
        payload: {},
    }],
    metadata: {
        phase: state.sys.phase,
    },
});

const estimateCardKeepValue = (card: CardInstance): number => {
    if (isCardMinionLike(card)) {
        return (getMinionLikePower(card.defId) ?? 1) * 10;
    }

    const cardDef = getCardDef(card.defId) as ActionCardDef | FusionCardDef | undefined;
    if (!cardDef) return 5;

    if (cardDef.type === 'fusion') {
        if (cardDef.actionSubtype === 'ongoing') return 16;
        if (cardDef.actionSubtype === 'special') return 13;
        return 11;
    }

    if (cardDef.subtype === 'ongoing') return 14;
    if (cardDef.subtype === 'special') return 11;
    return 9;
};

const buildResponseWindowActions = (state: SmashUpState, playerId: PlayerId): AiLegalAction[] | null => {
    const responseWindow = state.sys.responseWindow?.current;
    if (!responseWindow) return null;

    const currentResponderId = responseWindow.responderQueue?.[responseWindow.currentResponderIndex];
    if (currentResponderId !== playerId) return null;

    const actions: AiLegalAction[] = [{
        actionId: createAiLegalActionId('response-pass', responseWindow.windowType, playerId),
        kind: 'response-pass',
        label: '跳过响应',
        commands: [{
            type: 'RESPONSE_PASS',
            payload: {},
        }],
        metadata: {
            windowType: responseWindow.windowType,
        },
    }];

    actions.push(...buildPlayableCardActions(state, playerId, { inResponseWindow: true }));
    return actions;
};

export function buildSmashUpAiLegalActions(args: {
    playerId: PlayerId;
    state: MatchState<unknown>;
}): AiLegalAction[] {
    const state = args.state as SmashUpState;
    const playerId = args.playerId;

    if (state.core.gameResult) return [];

    const interactionActions = buildInteractionActions(state, playerId);
    if (interactionActions && interactionActions.length > 0) {
        return interactionActions;
    }

    const responseActions = buildResponseWindowActions(state, playerId);
    if (responseActions && responseActions.length > 0) {
        return responseActions;
    }

    const currentPlayerId = getCurrentPlayerId(state.core);
    if (currentPlayerId !== playerId) {
        return [];
    }

    const phase = state.sys.phase as string;
    const actions: AiLegalAction[] = [];

    if (phase === 'factionSelect') {
        return buildFactionSelectActions(state, playerId);
    }

    if (phase === 'playCards') {
        actions.push(...buildSpecialActions(state, playerId));
        actions.push(...buildTalentActions(state, playerId));
        actions.push(...buildPlayableCardActions(state, playerId));
        actions.push(buildAdvancePhaseAction(state, playerId));
        return actions;
    }

    if (phase === 'scoreBases') {
        actions.push(...buildSpecialActions(state, playerId));
        actions.push(buildAdvancePhaseAction(state, playerId));
        return actions;
    }

    if (phase === 'draw') {
        const discardActions = buildDiscardActions(state, playerId);
        if (discardActions.length > 0) return discardActions;
        return [buildAdvancePhaseAction(state, playerId)];
    }

    return [buildAdvancePhaseAction(state, playerId)];
}

const actionKindScorer = createActionKindScorer('action-kind', {
    'interaction-choice': 200,
    'response-play-action': 90,
    'response-play-minion': 85,
    'response-pass': -30,
    'activate-special': 70,
    'use-talent': 60,
    'play-minion': 55,
    'play-action': 30,
    'discard-to-limit': 25,
    'select-faction': 20,
    'advance-phase': -40,
});

const factionScorer: LocalAiActionScorer = {
    id: 'faction-priority',
    score(_context, action) {
        if (action.kind !== 'select-faction') return null;
        const priority = typeof action.metadata?.priority === 'number'
            ? action.metadata.priority
            : FACTION_PRIORITY.length + 10;
        return {
            score: 40 - priority,
            reason: `优先选择 ${String(action.metadata?.factionId ?? '稳定派系')}`,
        };
    },
};

const minionTempoScorer: LocalAiActionScorer = {
    id: 'minion-tempo',
    score(context, action) {
        if (action.kind !== 'play-minion' && action.kind !== 'response-play-minion') return null;
        const state = context.visibleState as SmashUpState;
        const player = state.core.players[context.playerId];
        if (!player) return null;

        const projectedMargin = typeof action.metadata?.projectedMargin === 'number'
            ? action.metadata.projectedMargin
            : -99;
        const power = typeof action.metadata?.power === 'number' ? action.metadata.power : 0;
        const fromDiscard = action.metadata?.fromDiscard === true;
        const actionKindBonus = action.kind === 'response-play-minion' ? 8 : 0;

        let score = power * 2 + actionKindBonus;
        if (player.minionsPlayed < player.minionLimit) score += 22;
        if (projectedMargin >= 0) score += 18 + Math.min(10, projectedMargin);
        else score += Math.max(0, 10 + projectedMargin);
        if (fromDiscard) score += 6;

        return {
            score,
            reason: `优先用随从抢节奏，预计力量差 ${projectedMargin}`,
        };
    },
};

const actionTempoScorer: LocalAiActionScorer = {
    id: 'action-tempo',
    score(context, action) {
        if (action.kind !== 'play-action' && action.kind !== 'response-play-action') return null;
        const state = context.visibleState as SmashUpState;
        const player = state.core.players[context.playerId];
        if (!player) return null;

        const otherPlayableMinions = context.legalActions.some((candidate) => candidate.kind === 'play-minion');
        const targetBaseIndex = typeof action.metadata?.targetBaseIndex === 'number'
            ? action.metadata.targetBaseIndex
            : undefined;
        const pressureBonus = targetBaseIndex !== undefined
            ? Math.max(
                0,
                6 - (
                    getEffectiveBreakpoint(state.core, targetBaseIndex)
                    - getTotalEffectivePowerOnBase(state.core, state.core.bases[targetBaseIndex], targetBaseIndex)
                ),
            )
            : 0;

        let score = 10 + pressureBonus;
        if (player.minionsPlayed >= player.minionLimit || !otherPlayableMinions) {
            score += 14;
        } else {
            score -= 6;
        }

        if (action.kind === 'response-play-action') score += 10;

        return {
            score,
            reason: targetBaseIndex !== undefined
                ? `行动目标基地压力更高（${targetBaseIndex}）`
                : '补足本回合行动节奏',
        };
    },
};

const responsePassScorer: LocalAiActionScorer = {
    id: 'response-pass-control',
    score(context, action) {
        if (action.kind !== 'response-pass') return null;
        const hasOtherResponse = context.legalActions.some((candidate) => candidate.kind !== 'response-pass');
        return {
            score: hasOtherResponse ? -80 : 20,
            reason: hasOtherResponse ? '还有响应牌可用，先不轻易让过' : '没有更好的响应，直接让过',
        };
    },
};

const discardScorer: LocalAiActionScorer = {
    id: 'discard-priority',
    score(_context, action) {
        if (action.kind !== 'discard-to-limit') return null;
        const discardPriority = typeof action.metadata?.discardPriority === 'number'
            ? action.metadata.discardPriority
            : -50;
        return {
            score: discardPriority,
            reason: '优先弃掉保留价值较低的牌',
        };
    },
};

const advancePhaseScorer: LocalAiActionScorer = {
    id: 'advance-when-done',
    score(context, action) {
        if (action.kind !== 'advance-phase') return null;
        const hasPlayableTempoAction = context.legalActions.some((candidate) => {
            return candidate.actionId !== action.actionId
                && candidate.kind !== 'response-pass'
                && candidate.kind !== 'discard-to-limit';
        });

        return {
            score: hasPlayableTempoAction ? -60 : 35,
            reason: hasPlayableTempoAction ? '还有可执行动作，不急着过阶段' : '本阶段可做的事基本做完了',
        };
    },
};

const baselineLocalPolicy = createScoredLocalAiPolicy({
    id: 'baseline',
    scorers: [
        actionKindScorer,
        factionScorer,
        minionTempoScorer,
        actionTempoScorer,
        responsePassScorer,
        discardScorer,
        advancePhaseScorer,
    ],
    maxReasonCount: 3,
});

export const smashUpAiRuntime: GameAiRuntime = {
    gameId: 'smashup',
    buildLegalActions: buildSmashUpAiLegalActions,
    localPolicies: {
        baseline: baselineLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
