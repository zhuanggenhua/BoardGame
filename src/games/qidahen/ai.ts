import type { MatchState } from '../../engine/types';
import type {
    AiDecisionContext,
    AiLegalAction,
    GameAiRuntime,
    LocalAiPolicy,
} from '../../engine/ai';
import { createAiLegalActionId } from '../../engine/ai';
import {
    buildAiLegalActionsFromInteractionDecision,
    type AiDecisionDescriptor,
} from '../../engine/ai/decisionSemantics';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import { QIDAHEN_COMMANDS, validate as validateQidahenCommand } from './domain/commands';
import {
    getQidahenDriveTigerConsentSelectionForCore,
    getQidahenPendingTargetActionForCore,
    getQidahenPostBattleSelectionForCore,
    getQidahenWheelDispatchSelectionForCore,
} from './domain';
import {
    getQidahenDiplomacySelectionForCore,
    getQidahenFortificationMaintenanceSelectionForCore,
    getQidahenHandLimitDiscardSelectionForCore,
    getQidahenInternalDispatchSelectionForCore,
    getQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenRecruitSelectionForCore,
} from './domain/interactionSelectionAccessors';
import { hasRemainingFactionAction } from './domain/factionActionWindow';
import { getFactionIdByPlayerId } from './domain/factionTurnAccessors';
import { buildPendingTargetChoiceOptions } from './domain/pendingTargetChoiceOptions';
import type { QidahenCore, QidahenFactionId } from './domain/types';

type QidahenState = MatchState<QidahenCore>;

const asQidahenState = (state: MatchState<unknown>): QidahenState => state as QidahenState;

const createSingleCommandAction = (
    _playerId: string,
    args: {
        actionId: string;
        kind: string;
        label: string;
        commandType: string;
        payload: Record<string, unknown>;
        metadata?: Record<string, unknown>;
    },
): AiLegalAction => ({
    actionId: args.actionId,
    kind: args.kind,
    label: args.label,
    commands: [{
        type: args.commandType,
        payload: args.payload,
    }],
    metadata: args.metadata,
});

const appendIfValid = (
    actions: AiLegalAction[],
    state: QidahenState,
    playerId: string,
    action: AiLegalAction,
): void => {
    const isValid = action.commands.every((command) => validateQidahenCommand(
        state,
        {
            type: command.type as never,
            playerId,
            payload: command.payload as never,
            timestamp: 0,
        },
    ).valid);
    if (isValid) {
        actions.push(action);
    }
};

const combinations = <TValue>(items: readonly TValue[], count: number): TValue[][] => {
    if (count <= 0) {
        return [[]];
    }
    if (items.length < count) {
        return [];
    }
    if (count === 1) {
        return items.map((item) => [item]);
    }
    const result: TValue[][] = [];
    for (let index = 0; index <= items.length - count; index += 1) {
        const current = items[index];
        for (const tail of combinations(items.slice(index + 1), count - 1)) {
            result.push([current, ...tail]);
        }
    }
    return result;
};

const getFactionIdForPlayer = (
    core: QidahenCore,
    playerId: string,
): QidahenFactionId => getFactionIdByPlayerId(core, playerId);

const buildScenarioChoiceActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const core = state.core;
    const factionId = getFactionIdForPlayer(core, playerId);
    const characterGroups = core.pendingScenarioCharacterChoices.filter((group) => group.factionId === factionId);
    const armamentGroups = core.pendingScenarioArmamentChoices.filter((group) => group.factionId === factionId);

    for (const group of characterGroups) {
        for (const selectedCharacterIds of combinations(group.characterIds, group.count)) {
            appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
                actionId: createAiLegalActionId('scenario-character', group.id, ...selectedCharacterIds),
                kind: 'scenario-character',
                label: `确认剧本人物：${selectedCharacterIds.join(' / ')}`,
                commandType: QIDAHEN_COMMANDS.RESOLVE_SCENARIO_CHARACTER_CHOICE,
                payload: {
                    groupId: group.id,
                    characterIds: selectedCharacterIds,
                },
                metadata: {
                    groupId: group.id,
                    factionId: group.factionId,
                    selectedCharacterIds,
                },
            }));
        }
    }

    for (const group of armamentGroups) {
        for (const selectedArmamentIds of combinations(group.armamentIds, group.count)) {
            appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
                actionId: createAiLegalActionId('scenario-armament', group.id, ...selectedArmamentIds),
                kind: 'scenario-armament',
                label: `确认剧本军备：${selectedArmamentIds.join(' / ')}`,
                commandType: QIDAHEN_COMMANDS.RESOLVE_SCENARIO_ARMAMENT_CHOICE,
                payload: {
                    groupId: group.id,
                    armamentIds: selectedArmamentIds,
                },
                metadata: {
                    groupId: group.id,
                    factionId: group.factionId,
                    selectedArmamentIds,
                },
            }));
        }
    }

    return actions;
};

const buildScenarioVoteActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const scenarioVote = state.core.scenarioVote;
    if (!scenarioVote || playerId !== scenarioVote.hostPlayerId) {
        return [];
    }
    if (scenarioVote.votes[playerId] != null) {
        return [];
    }

    const actions: AiLegalAction[] = [];
    for (const option of scenarioVote.options) {
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('scenario-host-pick', option.scenarioId),
            kind: 'scenario-host-pick',
            label: `房主选择剧本：${option.label}`,
            commandType: QIDAHEN_COMMANDS.CAST_SCENARIO_VOTE,
            payload: {
                scenarioId: option.scenarioId,
            },
            metadata: {
                scenarioId: option.scenarioId,
            },
        }));
    }
    return actions;
};

const buildCurrentInteractionActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const currentInteraction = state.sys.interaction?.current as {
        id?: unknown;
        kind?: unknown;
        playerId?: unknown;
        data?: {
            sourceId?: unknown;
            ai?: {
                decisions?: unknown;
            };
            options?: Array<{
                id?: unknown;
                label?: unknown;
                disabled?: unknown;
                value?: unknown;
            }>;
            multi?: {
                min?: unknown;
                max?: unknown;
            };
        };
    } | undefined;
    if (!currentInteraction || currentInteraction.kind !== 'simple-choice' || currentInteraction.playerId !== playerId) {
        return [];
    }

    const interactionId = typeof currentInteraction.id === 'string' ? currentInteraction.id : '';
    if (interactionId.length <= 0) {
        return [];
    }

    const semanticDecisions = Array.isArray(currentInteraction.data?.ai?.decisions)
        ? currentInteraction.data.ai.decisions
        : [];
    if (semanticDecisions.length > 0) {
        const actions: AiLegalAction[] = [];
        for (const decision of semanticDecisions) {
            for (const action of buildAiLegalActionsFromInteractionDecision(decision as AiDecisionDescriptor)) {
                appendIfValid(actions, state, playerId, action);
            }
        }
        if (actions.length > 0) {
            return actions;
        }
    }

    const options = Array.isArray(currentInteraction.data?.options)
        ? currentInteraction.data.options.filter((option): option is {
            id: string;
            label?: string;
            disabled?: boolean;
            value?: unknown;
        } => typeof option?.id === 'string' && option.disabled !== true)
        : [];
    if (options.length <= 0) {
        return [];
    }

    const minSelections = typeof currentInteraction.data?.multi?.min === 'number'
        ? Math.max(1, currentInteraction.data.multi.min)
        : 1;
    const maxSelections = typeof currentInteraction.data?.multi?.max === 'number'
        ? Math.max(minSelections, currentInteraction.data.multi.max)
        : minSelections;
    const actions: AiLegalAction[] = [];

    if (maxSelections > 1 || minSelections > 1) {
        const combinationSize = Math.min(options.length, minSelections);
        for (const selectedOptions of combinations(options, combinationSize)) {
            const optionIds = selectedOptions.map((option) => option.id);
            appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
                actionId: createAiLegalActionId('interaction', interactionId, ...optionIds),
                kind: 'interaction-respond',
                label: selectedOptions.map((option) => option.label ?? option.id).join(' / '),
                commandType: INTERACTION_COMMANDS.RESPOND,
                payload: {
                    interactionId,
                    optionIds,
                },
                metadata: {
                    interactionId,
                    optionIds,
                    sourceId: currentInteraction.data?.sourceId,
                },
            }));
        }
        return actions;
    }

    for (const option of options) {
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('interaction', interactionId, option.id),
            kind: 'interaction-respond',
            label: option.label ?? option.id,
            commandType: INTERACTION_COMMANDS.RESPOND,
            payload: {
                interactionId,
                optionId: option.id,
            },
            metadata: {
                interactionId,
                optionId: option.id,
                sourceId: currentInteraction.data?.sourceId,
            },
        }));
    }

    return actions;
};

const buildHandLimitDiscardActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selection = getQidahenHandLimitDiscardSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return actions;
    }

    const selectedIds = new Set(selection.selectedCardIds);
    if (selection.selectedCardIds.length < selection.requiredDiscardCount) {
        for (const cardId of selection.candidateCardIds) {
            if (selectedIds.has(cardId)) {
                continue;
            }
            appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
                actionId: createAiLegalActionId('hand-limit-discard-select', cardId),
                kind: 'hand-limit-discard-select',
                label: `手牌上限弃牌：选择 ${cardId}`,
                commandType: QIDAHEN_COMMANDS.SELECT_HAND_LIMIT_DISCARD_CARD,
                payload: { cardId },
                metadata: { cardId },
            }));
        }
    }

    appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
        actionId: createAiLegalActionId('hand-limit-discard-resolve', ...selection.selectedCardIds),
        kind: 'hand-limit-discard-resolve',
        label: '确认手牌上限弃牌',
        commandType: QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD,
        payload: {},
        metadata: {
            selectedCardIds: [...selection.selectedCardIds],
            requiredDiscardCount: selection.requiredDiscardCount,
        },
    }));

    return actions;
};

const buildSunYuanhuaTechActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selection = state.core.sunYuanhuaTechSelection;
    if (!selection) {
        return actions;
    }

    const selectedIds = new Set(selection.selectedCardIds);
    if (selection.selectedCardIds.length < selection.requiredCardCount) {
        for (const cardId of selection.candidateCardIds) {
            if (selectedIds.has(cardId)) {
                continue;
            }
            appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
                actionId: createAiLegalActionId('sun-yuanhua-tech-select', cardId),
                kind: 'sun-yuanhua-tech-select',
                label: `孙元化军备：选择 ${cardId}`,
                commandType: QIDAHEN_COMMANDS.SELECT_SUN_YUANHUA_TECH_CARD,
                payload: { cardId },
                metadata: { cardId },
            }));
        }
    }

    appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
        actionId: createAiLegalActionId('sun-yuanhua-tech-confirm', ...selection.selectedCardIds),
        kind: 'sun-yuanhua-tech-confirm',
        label: '确认孙元化军备',
        commandType: QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH,
        payload: { choiceId: 'confirm' },
        metadata: {
            selectedCardIds: [...selection.selectedCardIds],
            requiredCardCount: selection.requiredCardCount,
        },
    }));

    appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
        actionId: createAiLegalActionId('sun-yuanhua-tech-skip'),
        kind: 'sun-yuanhua-tech-skip',
        label: '跳过孙元化军备',
        commandType: QIDAHEN_COMMANDS.RESOLVE_SUN_YUANHUA_TECH,
        payload: { choiceId: 'skip' },
    }));

    return actions;
};

const buildGaoDiDispatchActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selection = state.core.gaoDiDispatchSelection;
    if (!selection) {
        return actions;
    }

    if (selection.selectedCardId == null) {
        for (const cardId of selection.candidateCardIds) {
            appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
                actionId: createAiLegalActionId('gao-di-dispatch-select-card', cardId),
                kind: 'gao-di-dispatch-select-card',
                label: `高第弃牌调度：选择 ${cardId}`,
                commandType: QIDAHEN_COMMANDS.SELECT_GAO_DI_DISPATCH_CARD,
                payload: { cardId },
                metadata: { cardId },
            }));
        }
        return actions;
    }

    for (const candidate of selection.candidates) {
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('gao-di-dispatch', candidate.id),
            kind: 'gao-di-dispatch',
            label: candidate.resolutionHint,
            commandType: QIDAHEN_COMMANDS.RESOLVE_GAO_DI_DISPATCH,
            payload: { choiceId: candidate.id },
            metadata: {
                choiceId: candidate.id,
                targetRegionId: candidate.targetRegionId,
                committedTroops: candidate.committedTroops,
                committedPopulation: candidate.committedPopulation,
            },
        }));
    }

    return actions;
};

const buildInternalDispatchActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selection = getQidahenInternalDispatchSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return actions;
    }

    for (const candidate of selection.candidates) {
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('internal-dispatch', candidate.id),
            kind: 'internal-dispatch',
            label: candidate.resolutionHint,
            commandType: QIDAHEN_COMMANDS.RESOLVE_INTERNAL_DISPATCH,
            payload: { choiceId: candidate.id },
            metadata: {
                choiceId: candidate.id,
                targetRegionId: candidate.targetRegionId,
                committedTroops: candidate.committedTroops,
            },
        }));
    }

    return actions;
};

const buildDriveTigerConsentActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selection = getQidahenDriveTigerConsentSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return actions;
    }

    const orderedChoices = [...selection.choices].sort((left, right) => {
        const leftScore = left.id === 'accept' ? 0 : 1;
        const rightScore = right.id === 'accept' ? 0 : 1;
        return leftScore - rightScore;
    });

    for (const choice of orderedChoices) {
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('drive-tiger-consent', choice.id),
            kind: 'drive-tiger-consent',
            label: choice.label,
            commandType: QIDAHEN_COMMANDS.RESOLVE_DRIVE_TIGER_CONSENT,
            payload: { choiceId: choice.id },
            metadata: { choiceId: choice.id },
        }));
    }

    return actions;
};

const buildRecruitActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selection = getQidahenRecruitSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return actions;
    }

    const orderedChoices = [...selection.choices].sort((left, right) => right.troopDelta - left.troopDelta);
    for (const choice of orderedChoices) {
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('recruit-choice', choice.id),
            kind: 'recruit-choice',
            label: choice.label,
            commandType: QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE,
            payload: { choiceId: choice.id },
            metadata: {
                choiceId: choice.id,
                troopDelta: choice.troopDelta,
                targetRegionId: selection.targetRegionId,
            },
        }));
    }

    return actions;
};

const buildMaShiTradeActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selection = getQidahenMaShiTradeSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return actions;
    }

    const orderedChoices = [...selection.choices].sort((left, right) => right.troopCount - left.troopCount);
    for (const choice of orderedChoices) {
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('ma-shi-trade', choice.troopCount),
            kind: 'ma-shi-trade',
            label: choice.label,
            commandType: QIDAHEN_COMMANDS.RESOLVE_MA_SHI_TRADE_CHOICE,
            payload: { troopCount: choice.troopCount },
            metadata: {
                troopCount: choice.troopCount,
                targetRegionId: selection.targetRegionId,
            },
        }));
    }

    return actions;
};

const buildKhanEdictActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selection = getQidahenKhanEdictSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return actions;
    }

    const orderedChoices = [...selection.choices].sort((left, right) => {
        const leftScore = left.id === 'hire-dispatch' ? 0 : 1;
        const rightScore = right.id === 'hire-dispatch' ? 0 : 1;
        return leftScore - rightScore;
    });
    for (const choice of orderedChoices) {
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('khan-edict', choice.id),
            kind: 'khan-edict',
            label: choice.label,
            commandType: QIDAHEN_COMMANDS.RESOLVE_KHAN_EDICT_CHOICE,
            payload: { choiceId: choice.id },
            metadata: { choiceId: choice.id },
        }));
    }

    return actions;
};

const buildDiplomacyActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selection = getQidahenDiplomacySelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return actions;
    }

    if (selection.targetRegionId == null) {
        for (const regionId of selection.candidateTargetRegionIds) {
            appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
                actionId: createAiLegalActionId('diplomacy-select-region', regionId),
                kind: 'diplomacy-select-region',
                label: `外交目标：${regionId}`,
                commandType: QIDAHEN_COMMANDS.SELECT_REGION,
                payload: { regionId },
                metadata: { regionId },
            }));
        }
    }

    const orderedChoices = [...selection.choices].sort((left, right) => {
        const score = (choiceId: string) => {
            if (choiceId === 'place-friendly') return 0;
            if (choiceId === 'flip-vassal') return 1;
            if (choiceId === 'remove-marker') return 2;
            if (choiceId === 'hire-only') return 3;
            return 4;
        };
        return score(left.id) - score(right.id);
    });
    for (const choice of orderedChoices) {
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('diplomacy-choice', choice.id, selection.targetRegionId ?? 'none'),
            kind: 'diplomacy-choice',
            label: choice.label,
            commandType: QIDAHEN_COMMANDS.RESOLVE_DIPLOMACY_CHOICE,
            payload: { choiceId: choice.id },
            metadata: {
                choiceId: choice.id,
                sourceRegionId: selection.sourceRegionId,
                targetRegionId: selection.targetRegionId,
            },
        }));
    }

    return actions;
};

const buildWheelDispatchActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selection = getQidahenWheelDispatchSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return actions;
    }

    const seenRegionIds = new Set<string>();
    for (const candidate of selection.candidates) {
        if (seenRegionIds.has(candidate.targetRuntimeRegionId)) {
            continue;
        }
        seenRegionIds.add(candidate.targetRuntimeRegionId);
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('wheel-dispatch-select-region', candidate.targetRuntimeRegionId),
            kind: 'wheel-dispatch-select-region',
            label: candidate.resolutionHint,
            commandType: QIDAHEN_COMMANDS.SELECT_REGION,
            payload: { regionId: candidate.targetRuntimeRegionId },
            metadata: {
                regionId: candidate.targetRuntimeRegionId,
                targetRegionId: candidate.targetRegionId,
                committedTroops: candidate.committedTroops,
                battleMode: candidate.battleMode ?? null,
            },
        }));
    }

    return actions;
};

const buildPendingActionResolutionActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const pending = getQidahenPendingTargetActionForCore(state.core, state.sys.interaction?.current);
    if (!pending) {
        return actions;
    }

    for (const option of buildPendingTargetChoiceOptions(state.core, pending)) {
        const { choiceId, ...payload } = option.value;
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('resolve-pending-action', option.id),
            kind: 'resolve-pending-action',
            label: option.label,
            commandType: QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
            payload,
            metadata: {
                choiceId,
                targetRegionId: pending.targetRegionId,
                actionId: pending.actionId,
            },
        }));
    }

    return actions;
};

const buildPostBattleActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selection = getQidahenPostBattleSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return actions;
    }

    const orderedChoices = [...selection.choices].sort((left, right) => {
        const score = (mode: string) => {
            if (mode === 'occupy') return 0;
            if (mode === 'besiege') return 1;
            return 2;
        };
        return score(left.mode) - score(right.mode);
    });
    for (const choice of orderedChoices) {
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('post-battle', choice.id),
            kind: 'post-battle',
            label: choice.label,
            commandType: QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION,
            payload: { choiceId: choice.id },
            metadata: {
                choiceId: choice.id,
                mode: choice.mode,
                targetRegionId: choice.regionId,
            },
        }));
    }

    return actions;
};

const buildFortificationMaintenanceActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const selection = getQidahenFortificationMaintenanceSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return actions;
    }

    const orderedChoices = [...selection.choices].sort((left, right) => {
        const leftScore = left.id === 'auto-pay' ? 0 : 1;
        const rightScore = right.id === 'auto-pay' ? 0 : 1;
        return leftScore - rightScore;
    });
    for (const choice of orderedChoices) {
        appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
            actionId: createAiLegalActionId('fortification-maintenance', choice.id),
            kind: 'fortification-maintenance',
            label: choice.label,
            commandType: QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE,
            payload: { choiceId: choice.id },
            metadata: { choiceId: choice.id },
        }));
    }

    return actions;
};

const buildActionWindowActions = (
    state: QidahenState,
    playerId: string,
): AiLegalAction[] => {
    const actions: AiLegalAction[] = [];
    const core = state.core;

    if (!core.wheelActionUsed) {
        for (const choice of core.wheelMoveChoices) {
            appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
                actionId: createAiLegalActionId('wheel-move', choice.id),
                kind: 'wheel-move',
                label: choice.label,
                commandType: QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE,
                payload: { moveId: choice.id },
                metadata: {
                    moveId: choice.id,
                    steps: choice.steps,
                },
            }));
        }
    }

    if (hasRemainingFactionAction(core)) {
        for (const actionChoice of core.actionChoices) {
            appendIfValid(actions, state, playerId, createSingleCommandAction(playerId, {
                actionId: createAiLegalActionId('execute-action', actionChoice.id),
                kind: 'execute-action',
                label: actionChoice.label,
                commandType: QIDAHEN_COMMANDS.EXECUTE_ACTION,
                payload: { actionId: actionChoice.id },
                metadata: {
                    actionId: actionChoice.id,
                    cost: actionChoice.cost,
                    selectedRegionId: core.selectedRegionId,
                },
            }));
        }
    }

    return actions;
};

export function buildQidahenAiLegalActions(args: {
    playerId: string;
    state: MatchState<unknown>;
}): AiLegalAction[] {
    const state = asQidahenState(args.state);
    const core = state.core;

    if (core.victoryStatus) {
        return [];
    }

    const scenarioVoteActions = buildScenarioVoteActions(state, args.playerId);
    if (scenarioVoteActions.length > 0) {
        return scenarioVoteActions;
    }
    if (core.scenarioVote) {
        return [];
    }

    const scenarioActions = buildScenarioChoiceActions(state, args.playerId);
    if (scenarioActions.length > 0) {
        return scenarioActions;
    }

    if (
        core.pendingScenarioCharacterChoices.length > 0
        || core.pendingScenarioArmamentChoices.length > 0
    ) {
        return [];
    }

    const interactionActions = buildCurrentInteractionActions(state, args.playerId);
    if (interactionActions.length > 0) {
        return interactionActions;
    }

    if (core.currentPlayer !== args.playerId) {
        return [];
    }

    const phaseActions = [
        ...buildHandLimitDiscardActions(state, args.playerId),
        ...buildSunYuanhuaTechActions(state, args.playerId),
        ...buildGaoDiDispatchActions(state, args.playerId),
        ...buildInternalDispatchActions(state, args.playerId),
        ...buildDriveTigerConsentActions(state, args.playerId),
        ...buildRecruitActions(state, args.playerId),
        ...buildMaShiTradeActions(state, args.playerId),
        ...buildKhanEdictActions(state, args.playerId),
        ...buildDiplomacyActions(state, args.playerId),
        ...buildPendingActionResolutionActions(state, args.playerId),
        ...buildPostBattleActions(state, args.playerId),
        ...buildWheelDispatchActions(state, args.playerId),
        ...buildFortificationMaintenanceActions(state, args.playerId),
    ];

    if (phaseActions.length > 0) {
        return phaseActions;
    }

    return buildActionWindowActions(state, args.playerId);
}

const baselineLocalPolicy: LocalAiPolicy = {
    id: 'baseline',
    decide(context: AiDecisionContext) {
        return context.legalActions[0]
            ? { actionId: context.legalActions[0].actionId }
            : null;
    },
};

export const qidahenAiRuntime: GameAiRuntime = {
    gameId: 'qidahen',
    buildLegalActions: buildQidahenAiLegalActions,
    defaultMinimumActionDelayMs: 800,
    localPolicies: {
        baseline: baselineLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
