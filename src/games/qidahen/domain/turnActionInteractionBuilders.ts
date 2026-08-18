import type { MatchState } from '../../../engine/types';
import { createQidahenChoiceRequestInteraction } from './choiceRequestInteractionBuilder';
import { QIDAHEN_COMMANDS } from './commands';
import {
    getQidahenCurrentWheelDispatchSelectionForCore,
} from './dispatchSelectionBuilders';
import type {
    QidahenDiplomacyInteraction,
    QidahenDriveTigerConsentInteraction,
    QidahenEventCharacterTargetInteraction,
    QidahenEventOpponentHandChoiceInteraction,
    QidahenFortificationMaintenanceInteraction,
    QidahenGrantPardonInteraction,
    QidahenHandLimitDiscardInteraction,
    QidahenInternalDispatchInteraction,
    QidahenKhanEdictInteraction,
    QidahenMaShiTradeInteraction,
    QidahenOpenGateSurrenderInteraction,
    QidahenRecruitInteraction,
    QidahenWheelDispatchInteraction,
} from './interactionContracts';
import type { QidahenRuntimeInteractionBuilderSpec } from './runtimeInteractionBuilderContracts';
import {
    getQidahenDriveTigerConsentSelectionForCore,
    getQidahenEventCharacterTargetSelectionForCore,
    getQidahenEventOpponentHandChoiceSelectionForCore,
    getQidahenDiplomacySelectionForCore,
    getQidahenHandLimitDiscardSelectionForCore,
    getQidahenFortificationMaintenanceSelectionForCore,
    getQidahenGrantPardonSelectionForCore,
    getQidahenInternalDispatchSelectionForCore,
    getQidahenKhanEdictSelectionForCore,
    getQidahenMaShiTradeSelectionForCore,
    getQidahenOpenGateSurrenderSelectionForCore,
    getQidahenRecruitSelectionForCore,
    getQidahenWheelDispatchSelectionForCore,
} from './interactionSelectionAccessors';
import {
    QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID,
    QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID,
    QIDAHEN_EVENT_CHARACTER_TARGET_INTERACTION_SOURCE_ID,
    QIDAHEN_EVENT_OPPONENT_HAND_CHOICE_INTERACTION_SOURCE_ID,
    QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID,
    QIDAHEN_GRANT_PARDON_INTERACTION_SOURCE_ID,
    QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID,
    QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID,
    QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID,
    QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID,
    QIDAHEN_OPEN_GATE_SURRENDER_INTERACTION_SOURCE_ID,
    QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID,
    QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID,
} from './interactionSources';
import { buildQidahenOpenGateSurrenderTroopChoices } from './openGateSurrenderSelection';
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

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-hand-limit-discard-${selection.factionId}`,
        playerId,
        title: `${selection.factionName}：按手牌上限弃牌`,
        sourceId: QIDAHEN_HAND_LIMIT_DISCARD_INTERACTION_SOURCE_ID,
        candidates: options,
        targetType: 'hand',
        multi: {
            min: selection.requiredDiscardCount,
            max: selection.requiredDiscardCount,
        },
        subtitle: `手牌 ${selection.handCount}/${selection.handLimit} · 需弃 ${selection.requiredDiscardCount} 张`,
    }) as QidahenHandLimitDiscardInteraction;

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

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-recruit-${selection.targetRegionId ?? state.core.currentPlayer}`,
        playerId: state.core.currentPlayer,
        title: '征召军队：选择建军方式',
        titleKey: 'board.actions.recruit.title',
        sourceId: QIDAHEN_RECRUIT_INTERACTION_SOURCE_ID,
        candidates: options,
        subtitle: '选择建军方式',
        allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION, QIDAHEN_COMMANDS.RESOLVE_RECRUIT_CHOICE],
    }) as QidahenRecruitInteraction;

    interaction.data.qidahenRecruitSelection = {
        ...selection,
        choices: selection.choices.map((choice) => ({ ...choice })),
    };

    return interaction;
}

function buildQidahenGrantPardonInteraction(
    state: MatchState<QidahenCore>,
): QidahenGrantPardonInteraction | null {
    const selection = getQidahenGrantPardonSelectionForCore(state.core, state.sys.interaction?.current);
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

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-grant-pardon-${selection.sourceRegionId ?? state.core.currentPlayer}`,
        playerId: state.core.currentPlayer,
        title: selection.title,
        sourceId: QIDAHEN_GRANT_PARDON_INTERACTION_SOURCE_ID,
        candidates: options,
        subtitle: selection.summary,
        allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_GRANT_PARDON_CHOICE],
    }) as QidahenGrantPardonInteraction;

    interaction.data.qidahenGrantPardonSelection = {
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

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-diplomacy-${selection.source}-${selection.sourceRegionId ?? state.core.currentPlayer}`,
        playerId: state.core.currentPlayer,
        title: selection.title,
        sourceId: QIDAHEN_DIPLOMACY_INTERACTION_SOURCE_ID,
        candidates: options,
        subtitle: `处理外交步骤 · 还可再做 ${selection.remainingTargetCount} 次`,
        allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
    }) as QidahenDiplomacyInteraction;

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
        label: `进攻 ${candidate.targetRegionName} · 守方 ${candidate.defenderLabel}`,
        value: { choiceId: candidate.targetRuntimeRegionId },
        displayMode: 'button' as const,
        description: `${candidate.resolutionHint} · 出兵 ${candidate.committedTroops} · 路耗 ${candidate.totalTravelCost}`,
    }));

    const interactionPlayerId = selection.sourceActionId === 'drive-tiger'
        ? state.core.factions.ming.playerId
        : state.core.factions[selection.attackerFactionId]?.playerId ?? state.core.currentPlayer;

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-dispatch-targeting-${selection.attackerFactionId}-${selection.sourceRegionId}`,
        playerId: interactionPlayerId,
        title: selection.restriction,
        sourceId: QIDAHEN_WHEEL_DISPATCH_INTERACTION_SOURCE_ID,
        candidates: options,
        subtitle: '进攻目标',
        allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
    }) as QidahenWheelDispatchInteraction;

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

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-internal-dispatch-${selection.sourceRegionId}`,
        playerId: state.core.currentPlayer,
        title: selection.title,
        sourceId: QIDAHEN_INTERNAL_DISPATCH_INTERACTION_SOURCE_ID,
        candidates: options,
        subtitle: `选择调度目标 · 最多调 ${selection.maxTroops} 个部队`,
        allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
    }) as QidahenInternalDispatchInteraction;

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

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-ma-shi-trade-${selection.targetRegionId ?? state.core.currentPlayer}`,
        playerId: state.core.currentPlayer,
        title: '马市贸易：选择建兵数量',
        titleKey: 'board.actions.maShiTrade.title',
        sourceId: QIDAHEN_MA_SHI_TRADE_INTERACTION_SOURCE_ID,
        candidates: options,
        subtitle: '选择建军数量',
        allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
    }) as QidahenMaShiTradeInteraction;

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

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-khan-edict-${selection.sourceRegionId ?? state.core.currentPlayer}`,
        playerId: state.core.currentPlayer,
        title: '大汗令箭：选择执行效果',
        titleKey: 'board.actions.khanEdict.title',
        sourceId: QIDAHEN_KHAN_EDICT_INTERACTION_SOURCE_ID,
        candidates: options,
        subtitle: '选择执行效果',
        allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
    }) as QidahenKhanEdictInteraction;

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

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-drive-tiger-consent-${selection.targetFactionId}`,
        playerId,
        title: '驱虎吞狼：是否接受大明指挥',
        titleKey: 'board.actions.driveTiger.title',
        sourceId: QIDAHEN_DRIVE_TIGER_CONSENT_INTERACTION_SOURCE_ID,
        candidates: options,
        subtitle: `先问 ${selection.targetFactionName} 愿不愿听大明指挥；同意后抽 6 张牌，再由大明指挥其出兵进攻`,
    }) as QidahenDriveTigerConsentInteraction;

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

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-fortification-maintenance-${state.core.currentYearIndex}`,
        playerId: state.core.factions.ming.playerId ?? state.core.currentPlayer,
        title: selection.title,
        sourceId: QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID,
        candidates: options,
        subtitle: selection.summary,
        allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE],
    }) as QidahenFortificationMaintenanceInteraction;

    interaction.data.qidahenFortificationMaintenanceSelection = {
        ...selection,
        choices: selection.choices.map((choice) => ({ ...choice })),
    };

    return interaction;
}

function buildQidahenEventCharacterTargetInteraction(
    state: MatchState<QidahenCore>,
): QidahenEventCharacterTargetInteraction | null {
    const selection = getQidahenEventCharacterTargetSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return null;
    }
    const playerId = state.core.factions[selection.ownerFactionId]?.playerId;
    if (!playerId) {
        return null;
    }

    const options = selection.choices.map((choice) => ({
        id: choice.id,
        label: `${choice.characterName}（${choice.factionName}）`,
        value: { choiceId: choice.id },
        displayMode: 'button' as const,
        description: choice.detail,
    }));

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-event-character-target-${selection.eventCardId}`,
        playerId,
        title: selection.title,
        sourceId: QIDAHEN_EVENT_CHARACTER_TARGET_INTERACTION_SOURCE_ID,
        candidates: options,
        subtitle: selection.summary,
        allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_EVENT_CHARACTER_TARGET],
    }) as QidahenEventCharacterTargetInteraction;

    interaction.data.qidahenEventCharacterTargetSelection = {
        ...selection,
        paymentCardIds: [...selection.paymentCardIds],
        choices: selection.choices.map((choice) => ({ ...choice })),
    };

    return interaction;
}

function buildQidahenEventOpponentHandChoiceInteraction(
    state: MatchState<QidahenCore>,
): QidahenEventOpponentHandChoiceInteraction | null {
    const selection = getQidahenEventOpponentHandChoiceSelectionForCore(state.core, state.sys.interaction?.current);
    if (!selection) {
        return null;
    }
    const factionId = selection.source === 'ginseng-and-sable-card'
        || selection.source === 'tribute-edict-action'
        ? selection.targetFactionId
        : selection.ownerFactionId;
    const playerId = factionId ? state.core.factions[factionId]?.playerId : null;
    if (!playerId) {
        return null;
    }

    const options = selection.choices.map((choice) => ({
        id: choice.id,
        label: choice.cardLabel,
        value: { choiceId: choice.id },
        displayMode: 'button' as const,
        description: choice.detail,
    }));

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-event-opponent-hand-choice-${selection.eventCardId}-${selection.source}`,
        playerId,
        title: selection.title,
        sourceId: QIDAHEN_EVENT_OPPONENT_HAND_CHOICE_INTERACTION_SOURCE_ID,
        candidates: options,
        subtitle: selection.summary,
        allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_EVENT_OPPONENT_HAND_CHOICE],
    }) as QidahenEventOpponentHandChoiceInteraction;

    interaction.data.qidahenEventOpponentHandChoiceSelection = {
        ...selection,
        paymentCardIds: [...selection.paymentCardIds],
        choices: selection.choices.map((choice) => ({ ...choice })),
    };

    return interaction;
}

function buildQidahenOpenGateSurrenderInteraction(
    state: MatchState<QidahenCore>,
): QidahenOpenGateSurrenderInteraction | null {
    const selection = getQidahenOpenGateSurrenderSelectionForCore(
        state.core,
        state.sys.interaction?.current,
    );
    if (!selection) {
        return null;
    }

    const playerId = selection.phase === 'choose-effects'
        ? state.core.factions[selection.ownerFactionId]?.playerId
        : selection.phase === 'ming-faction'
            ? state.core.factions.ming.playerId
            : state.core.factions.jin.playerId;
    if (!playerId) {
        return null;
    }

    const effectOptions = [
        {
            id: 'jin-effect',
            label: '只执行第一项',
            labelKey: 'board.actions.openGateSurrender.options.jinEffect',
            value: { choiceId: 'jin-effect' },
            displayMode: 'button' as const,
            description: '后金可弃掉任意数量在场人物，再按剩余人物数每张弃掉 2 个部队。',
        },
        {
            id: 'ming-effect',
            label: '只执行第二项',
            labelKey: 'board.actions.openGateSurrender.options.mingEffect',
            value: { choiceId: 'ming-effect' },
            displayMode: 'button' as const,
            description: '由大明选择一个派系，弃掉该派系全部在场人物。',
        },
        {
            id: 'both',
            label: '两项都执行',
            labelKey: 'board.actions.openGateSurrender.options.both',
            value: { choiceId: 'both' },
            displayMode: 'button' as const,
            description: '先执行第一项，再执行第二项。',
        },
    ];
    const characterOptions = state.core.factions.jin.characters
        .filter((character) => character.inPlay && !character.removedFromGame)
        .map((character) => ({
            id: character.id,
            label: character.name,
            value: { choiceId: character.id },
            displayMode: 'button' as const,
            description: `后金弃掉在场人物「${character.name}」。`,
        }));
    const troopOptions = buildQidahenOpenGateSurrenderTroopChoices(state.core).map((choice) => ({
        id: choice.id,
        label: choice.label,
        value: { choiceId: choice.id, tokenId: choice.id },
        displayMode: 'button' as const,
        description: `弃掉${choice.label}。`,
    }));
    const factionOptions = (['ming', 'mongol', 'jin'] as const).map((factionId) => ({
        id: factionId,
        label: state.core.factions[factionId].name,
        value: { choiceId: factionId },
        displayMode: 'button' as const,
        description: `弃掉${state.core.factions[factionId].name}全部在场人物。`,
    }));

    const options = selection.phase === 'choose-effects'
        ? effectOptions
        : selection.phase === 'jin-characters'
            ? characterOptions
            : selection.phase === 'jin-troops'
                ? troopOptions
                : factionOptions;
    const subtitle = selection.phase === 'choose-effects'
        ? '第一项、第二项可以择一执行，也可以依次都执行'
        : selection.phase === 'jin-characters'
            ? '后金可选择弃掉任意数量的在场人物，也可以一张都不弃'
            : selection.phase === 'jin-troops'
                ? `后金必须选择并弃掉 ${selection.requiredJinTroopLoss} 个具体部队`
                : '由大明选择一个派系，弃掉其全部在场人物';
    const multi = selection.phase === 'jin-characters'
        ? { min: 0, max: characterOptions.length }
        : selection.phase === 'jin-troops'
            ? { min: selection.requiredJinTroopLoss, max: selection.requiredJinTroopLoss }
            : undefined;

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-open-gate-surrender-${selection.eventCardId}-${selection.phase}`,
        playerId,
        title: '开门迎降',
        titleKey: 'board.actions.openGateSurrender.title',
        sourceId: QIDAHEN_OPEN_GATE_SURRENDER_INTERACTION_SOURCE_ID,
        candidates: options,
        subtitle,
        ...(multi ? { multi } : {}),
    }) as QidahenOpenGateSurrenderInteraction;
    interaction.data.qidahenOpenGateSurrenderSelection = {
        ...selection,
        paymentCardIds: [...selection.paymentCardIds],
        discardedJinCharacterIds: [...selection.discardedJinCharacterIds],
        summaryLines: [...selection.summaryLines],
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
        sourceId: QIDAHEN_GRANT_PARDON_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenGrantPardonInteraction,
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
    {
        sourceId: QIDAHEN_EVENT_CHARACTER_TARGET_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenEventCharacterTargetInteraction,
    },
    {
        sourceId: QIDAHEN_EVENT_OPPONENT_HAND_CHOICE_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenEventOpponentHandChoiceInteraction,
    },
    {
        sourceId: QIDAHEN_OPEN_GATE_SURRENDER_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenOpenGateSurrenderInteraction,
    },
];
