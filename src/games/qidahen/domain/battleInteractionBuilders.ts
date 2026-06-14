import type { MatchState } from '../../../engine/types';
import {
    createSimpleChoice,
} from '../../../engine/systems/InteractionSystem';
import { QIDAHEN_COMMANDS } from './commands';
import type {
    QidahenPendingTargetInteraction,
    QidahenPostBattleInteraction,
} from './interactionContracts';
import type { QidahenRuntimeInteractionBuilderSpec } from './runtimeInteractionBuilderContracts';
import {
    getQidahenPendingTargetActionForCore,
    getQidahenPostBattleSelectionForCore,
} from './interactionSelectionAccessors';
import {
    QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID,
    QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,
} from './interactionSources';
import {
    buildPendingTargetChoiceOptions,
} from './pendingTargetChoiceOptions';
import type { QidahenCore } from './types';

function buildQidahenPendingTargetInteraction(
    state: MatchState<QidahenCore>,
): QidahenPendingTargetInteraction | null {
    const pendingTargetAction = getQidahenPendingTargetActionForCore(state.core, state.sys.interaction?.current);
    if (!pendingTargetAction) {
        return null;
    }

    const description = `${pendingTargetAction.resolutionHint}${pendingTargetAction.defenderPayCost != null ? ` · 守方需付 ${pendingTargetAction.defenderPayCost}` : ''}`;
    const options = buildPendingTargetChoiceOptions(state.core, pendingTargetAction).map((option) => ({
        ...option,
        description,
        displayMode: 'button' as const,
    }));

    const interaction = createSimpleChoice(
        `qidahen-pending-target-${pendingTargetAction.actionId}-${pendingTargetAction.targetRuntimeRegionId}`,
        state.core.currentPlayer,
        `${pendingTargetAction.title} · ${pendingTargetAction.targetRegionName}`,
        options,
        {
            sourceId: QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID,
            targetType: 'button',
            autoResolveIfSingle: false,
            subtitle: `防守 ${pendingTargetAction.defenderLabel} · 源兵 ${pendingTargetAction.sourceAvailableTroops} · 投入 ${pendingTargetAction.committedTroops} · 压力 ${pendingTargetAction.attackPressure}`,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],
        },
    ) as QidahenPendingTargetInteraction;

    interaction.data.qidahenPendingTargetAction = {
        ...pendingTargetAction,
    };

    return interaction;
}

function buildQidahenPostBattleInteraction(
    state: MatchState<QidahenCore>,
): QidahenPostBattleInteraction | null {
    const selection = getQidahenPostBattleSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return null;
    }

    const options = selection.choices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        value: { choiceId: choice.id },
        displayMode: 'button' as const,
        description: choice.detail,
    }));

    const interaction = createSimpleChoice(
        `qidahen-post-battle-${selection.actionId}-${selection.targetRuntimeRegionId}`,
        state.core.currentPlayer,
        `${selection.title} · ${selection.targetRegionName}`,
        options,
        {
            sourceId: QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,
            targetType: 'button',
            autoResolveIfSingle: false,
            subtitle: `${selection.summary} · 投入 ${selection.committedTroops}`,
        },
    ) as QidahenPostBattleInteraction;

    interaction.data.qidahenPostBattleSelection = {
        ...selection,
        choices: selection.choices.map((choice) => ({ ...choice })),
    };

    return interaction;
}

export const QIDAHEN_BATTLE_RUNTIME_INTERACTION_BUILDERS: readonly QidahenRuntimeInteractionBuilderSpec[] = [
    {
        sourceId: QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenPendingTargetInteraction,
    },
    {
        sourceId: QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenPostBattleInteraction,
    },
];
