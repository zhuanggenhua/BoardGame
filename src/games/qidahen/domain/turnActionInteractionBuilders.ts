import type { MatchState } from '../../../engine/types';
import {
    createSimpleChoice,
} from '../../../engine/systems/InteractionSystem';
import { QIDAHEN_COMMANDS } from './commands';
import {
    getQidahenCurrentWheelDispatchSelectionForCore,
} from './dispatchSelectionBuilders';
import type {
    QidahenDiplomacyInteraction,
    QidahenDriveTigerConsentInteraction,
    QidahenFortificationMaintenanceInteraction,
    QidahenHandLimitDiscardInteraction,
    QidahenInternalDispatchInteraction,
    QidahenKhanEdictInteraction,
    QidahenMaShiTradeInteraction,
    QidahenRecruitInteraction,
    QidahenWheelDispatchInteraction,
} from './interactionContracts';
import type { QidahenRuntimeInteractionBuilderSpec } from './runtimeInteractionBuilderContracts';
import {
    getQidahenDriveTigerConsentSelectionForCore,
    getQidahenDiplomacySelectionForCore,
    getQidahenHandLimitDiscardSelectionForCore,
    getQidahenFortificationMaintenanceSelectionForCore,
    getQidahenInternalDispatchSelectionForCore,
    getQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenRecruitSelectionForCore,
    getQidahenWheelDispatchSelectionForCore,
} from './interactionSelectionAccessors';
import {
    QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID,
    QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID,
    QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID,
    QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID,
    QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID,
    QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID,
    QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID,
    QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID,
    QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID,
} from './interactionSources';
import type { QidahenCore } from './types';

function buildQidahenHandLimitDiscardInteraction(
    state: MatchState<QidahenCore>,
): QidahenHandLimitDiscardInteraction | null {
    const selection = getQidahenHandLimitDiscardSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return null;
    }
    const playerId = state.core.factions[selection.factionId]?.playerId;
    if (!playerId) {
        return null;
    }

    const optionIds = new Set(selection.candidateCardIds);
    const options = state.core.handCards
        .filter((card) => optionIds.has(card.id))
        .map((card) => ({
            id: card.id,
            label: card.id,
            value: { cardId: card.id },
            displayMode: 'card' as const,
        }));

    const interaction = createSimpleChoice(
        `qidahen-hand-limit-discard-${selection.factionId}`,
        playerId,
        `${selection.factionName}：按手牌上限弃牌`,
        options,
        {
            sourceId: QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID,
            targetType: 'hand',
            autoResolveIfSingle: false,
            multi: {
                min: selection.requiredDiscardCount,
                max: selection.requiredDiscardCount,
            },
            subtitle: `手牌 ${selection.handCount}/${selection.handLimit} · 需弃 ${selection.requiredDiscardCount} 张`,
        },
    ) as QidahenHandLimitDiscardInteraction;

    interaction.data.qidahenHandLimitDiscardSelection = {
        ...selection,
        selectedCardIds: [...selection.selectedCardIds],
    };

    return interaction;
}

function buildQidahenRecruitInteraction(
    state: MatchState<QidahenCore>,
): QidahenRecruitInteraction | null {
    const selection = getQidahenRecruitSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return null;
    }

    const options = selection.choices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        value: { choiceId: choice.id },
        displayMode: 'button' as const,
    }));

    const interaction = createSimpleChoice(
        `qidahen-recruit-${selection.targetRegionId ?? state.core.currentPlayer}`,
        state.core.currentPlayer,
        '征召军队：选择建军方式',
        options,
        {
            titleKey: 'board.actions.recruit.title',
            sourceId: QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID,
            targetType: 'button',
            autoResolveIfSingle: false,
            subtitle: `当前目标 ${selection.targetRegionName ?? '未锁定'} · 可切换到其他己方控制区后再决定建军方式`,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
        },
    ) as QidahenRecruitInteraction;

    interaction.data.qidahenRecruitSelection = {
        ...selection,
        choices: selection.choices.map((choice) => ({ ...choice })),
    };

    return interaction;
}

function buildQidahenDiplomacyInteraction(
    state: MatchState<QidahenCore>,
): QidahenDiplomacyInteraction | null {
    const selection = getQidahenDiplomacySelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return null;
    }

    const options = selection.choices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        value: { choiceId: choice.id },
        displayMode: 'button' as const,
    }));

    const interaction = createSimpleChoice(
        `qidahen-diplomacy-${selection.source}-${selection.sourceRegionId ?? state.core.currentPlayer}`,
        state.core.currentPlayer,
        selection.title,
        options,
        {
            sourceId: QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID,
            targetType: 'button',
            autoResolveIfSingle: false,
            subtitle: `源区 ${selection.sourceRegionName ?? '未锁定'} · 当前目标 ${selection.targetRegionName ?? '未锁定'} · 还可继续 ${selection.remainingTargetCount} 次`,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
        },
    ) as QidahenDiplomacyInteraction;

    interaction.data.qidahenDiplomacySelection = {
        ...selection,
        choices: selection.choices.map((choice) => ({ ...choice })),
        candidateTargetRegionIds: [...selection.candidateTargetRegionIds],
        resolvedSteps: selection.resolvedSteps.map((step) => ({ ...step })),
    };

    return interaction;
}

function buildQidahenWheelDispatchInteraction(
    state: MatchState<QidahenCore>,
): QidahenWheelDispatchInteraction | null {
    const selection = state.core.turnPhase === 'dispatch-targeting'
        ? (
            getQidahenWheelDispatchSelectionForCore(state.core, state.sys.interaction?.current)
            ?? getQidahenCurrentWheelDispatchSelectionForCore(state.core)
        )
        : null;
    if (!selection) {
        return null;
    }

    const options = selection.candidates.map((candidate) => ({
        id: candidate.targetRuntimeRegionId,
        label: `${candidate.targetRegionName} · 防守 ${candidate.defenderLabel}`,
        value: { choiceId: candidate.targetRuntimeRegionId },
        displayMode: 'button' as const,
        description: `${candidate.resolutionHint} · 源兵 ${candidate.sourceAvailableTroops} · 投入 ${candidate.committedTroops} · 压力 ${candidate.attackPressure} · 耗 ${candidate.totalTravelCost}`,
    }));

    const interaction = createSimpleChoice(
        `qidahen-dispatch-targeting-${selection.attackerFactionId}-${selection.sourceRegionId}`,
        state.core.currentPlayer,
        selection.restriction,
        options,
        {
            sourceId: QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID,
            targetType: 'button',
            autoResolveIfSingle: false,
            subtitle: `源区 ${selection.sourceRegionName} · 可选目标 ${selection.candidates.length} · 也可继续点击地图高亮区锁定目标`,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
        },
    ) as QidahenWheelDispatchInteraction;

    interaction.data.qidahenWheelDispatchSelection = {
        ...selection,
        candidates: selection.candidates.map((candidate) => ({ ...candidate })),
    };

    return interaction;
}

function buildQidahenInternalDispatchInteraction(
    state: MatchState<QidahenCore>,
): QidahenInternalDispatchInteraction | null {
    const selection = getQidahenInternalDispatchSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return null;
    }

    const options = selection.candidates.map((candidate) => ({
        id: candidate.id,
        label: candidate.targetRegionName,
        value: { choiceId: candidate.id },
        displayMode: 'button' as const,
        description: `${candidate.resolutionHint} · 耗 ${candidate.totalTravelCost}`,
    }));

    const interaction = createSimpleChoice(
        `qidahen-internal-dispatch-${selection.sourceRegionId}`,
        state.core.currentPlayer,
        selection.title,
        options,
        {
            sourceId: QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID,
            targetType: 'button',
            autoResolveIfSingle: false,
            subtitle: `源区 ${selection.sourceRegionName} · 最多调度 ${selection.maxTroops} 部队`,
        },
    ) as QidahenInternalDispatchInteraction;

    interaction.data.qidahenInternalDispatchSelection = {
        ...selection,
        candidates: selection.candidates.map((candidate) => ({ ...candidate })),
    };

    return interaction;
}

function buildQidahenMaShiTradeInteraction(
    state: MatchState<QidahenCore>,
): QidahenMaShiTradeInteraction | null {
    const selection = getQidahenMaShiTradeSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return null;
    }

    const options = selection.choices.map((choice) => ({
        id: String(choice.troopCount),
        label: choice.label,
        value: { troopCount: choice.troopCount },
        displayMode: 'button' as const,
        description: choice.detail,
    }));

    const interaction = createSimpleChoice(
        `qidahen-ma-shi-trade-${selection.targetRegionId ?? state.core.currentPlayer}`,
        state.core.currentPlayer,
        '马市贸易：选择建兵数量',
        options,
        {
            titleKey: 'board.actions.maShiTrade.title',
            sourceId: QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID,
            targetType: 'button',
            autoResolveIfSingle: false,
            subtitle: `当前目标 ${selection.targetRegionName ?? '未锁定'} · 可切换到其他大明控制区后再决定建立数量`,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
        },
    ) as QidahenMaShiTradeInteraction;

    interaction.data.qidahenMaShiTradeSelection = {
        ...selection,
        choices: selection.choices.map((choice) => ({ ...choice })),
    };

    return interaction;
}

function buildQidahenKhanEdictInteraction(
    state: MatchState<QidahenCore>,
): QidahenKhanEdictInteraction | null {
    const selection = getQidahenKhanEdictSelectionForCore(state.core, state.sys.interaction?.current);
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
        `qidahen-khan-edict-${selection.sourceRegionId ?? state.core.currentPlayer}`,
        state.core.currentPlayer,
        '大汗令箭：选择执行效果',
        options,
        {
            titleKey: 'board.actions.khanEdict.title',
            sourceId: QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID,
            targetType: 'button',
            autoResolveIfSingle: false,
            subtitle: `当前区域 ${selection.sourceRegionName ?? '未锁定'} · 可切换地图选中区后再决定`,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
        },
    ) as QidahenKhanEdictInteraction;

    interaction.data.qidahenKhanEdictSelection = {
        ...selection,
        choices: selection.choices.map((choice) => ({ ...choice })),
    };

    return interaction;
}

function buildQidahenDriveTigerConsentInteraction(
    state: MatchState<QidahenCore>,
): QidahenDriveTigerConsentInteraction | null {
    const selection = getQidahenDriveTigerConsentSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return null;
    }
    const playerId = state.core.factions[selection.targetFactionId]?.playerId;
    if (!playerId) {
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
        `qidahen-drive-tiger-consent-${selection.targetFactionId}`,
        playerId,
        '驱虎吞狼：是否接受大明指挥',
        options,
        {
            titleKey: 'board.actions.driveTiger.title',
            sourceId: QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID,
            targetType: 'button',
            autoResolveIfSingle: false,
            subtitle: `${selection.targetFactionName} 是否同意接受大明指挥；同意后才会抽 6 张牌并进入调度进攻`,
        },
    ) as QidahenDriveTigerConsentInteraction;

    interaction.data.qidahenDriveTigerConsentSelection = {
        ...selection,
        dispatchSelection: {
            ...selection.dispatchSelection,
            candidates: selection.dispatchSelection.candidates.map((candidate) => ({ ...candidate })),
        },
        choices: selection.choices.map((choice) => ({ ...choice })),
    };

    return interaction;
}

function buildQidahenFortificationMaintenanceInteraction(
    state: MatchState<QidahenCore>,
): QidahenFortificationMaintenanceInteraction | null {
    const selection = getQidahenFortificationMaintenanceSelectionForCore(state.core, state.sys.interaction?.current);
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
        `qidahen-fortification-maintenance-${state.core.currentYearIndex}`,
        state.core.currentPlayer,
        selection.title,
        options,
        {
            sourceId: QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID,
            targetType: 'button',
            autoResolveIfSingle: false,
            subtitle: selection.summary,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE],
        },
    ) as QidahenFortificationMaintenanceInteraction;

    interaction.data.qidahenFortificationMaintenanceSelection = {
        ...selection,
        choices: selection.choices.map((choice) => ({ ...choice })),
    };

    return interaction;
}

export const QIDAHEN_TURN_ACTION_RUNTIME_INTERACTION_BUILDERS: readonly QidahenRuntimeInteractionBuilderSpec[] = [
    {
        sourceId: QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenHandLimitDiscardInteraction,
    },
    {
        sourceId: QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenRecruitInteraction,
    },
    {
        sourceId: QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenDiplomacyInteraction,
    },
    {
        sourceId: QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenWheelDispatchInteraction,
    },
    {
        sourceId: QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenInternalDispatchInteraction,
    },
    {
        sourceId: QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenMaShiTradeInteraction,
    },
    {
        sourceId: QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenKhanEdictInteraction,
    },
    {
        sourceId: QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenDriveTigerConsentInteraction,
    },
    {
        sourceId: QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenFortificationMaintenanceInteraction,
    },
];
