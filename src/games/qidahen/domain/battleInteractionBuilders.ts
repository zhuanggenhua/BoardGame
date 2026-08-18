import type { MatchState } from '../../../engine/types';
import type { ChoiceRequestCandidate } from '../../../engine/ChoiceRequest';
import { QIDAHEN_COMMANDS } from './commands';
import { createQidahenChoiceRequestInteraction } from './choiceRequestInteractionBuilder';
import type {
    QidahenFeignedRetreatInteraction,
    QidahenPendingTargetChoiceValue,
    QidahenPendingTargetInteraction,
    QidahenPostBattleInteraction,
    QidahenRaidAndAmbushInteraction,
} from './interactionContracts';
import type { QidahenRuntimeInteractionBuilderSpec } from './runtimeInteractionBuilderContracts';
import {
    getQidahenPendingTargetActionForCore,
    getQidahenPostBattleSelectionForCore,
} from './interactionSelectionAccessors';
import {
    QIDAHEN_FEIGNED_RETREAT_INTERACTION_SOURCE_ID,
    QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID,
    QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,
    QIDAHEN_RAID_AND_AMBUSH_INTERACTION_SOURCE_ID,
} from './interactionSources';
import {
    buildPendingTargetChoiceOptions,
} from './pendingTargetChoiceOptions';
import type { QidahenCore } from './types';
import { getQidahenTroopKindLabel } from './troopStacks';

function buildQidahenFeignedRetreatInteraction(
    state: MatchState<QidahenCore>,
): QidahenFeignedRetreatInteraction | null {
    const selection = state.core.feignedRetreatSelection;
    if (!selection) {
        return null;
    }
    const requestId = `qidahen-feigned-retreat-${selection.targetRuntimeRegionId}`;
    const playerId = state.core.factions[selection.factionId]?.playerId ?? state.core.currentPlayer;
    const candidates: ChoiceRequestCandidate<{ choiceId: string }>[] = [{
        id: 'skip',
        label: '不使用',
        labelKey: 'board.actions.common.skip',
        value: { choiceId: 'skip' },
        displayMode: 'button',
    }];
    const interaction = createQidahenChoiceRequestInteraction({
        requestId,
        playerId,
        title: `诈败诱敌 · ${selection.targetRegionName}`,
        sourceId: QIDAHEN_FEIGNED_RETREAT_INTERACTION_SOURCE_ID,
        candidates,
        subtitle: '对手刚宣告骑兵劫掠：直接点击真实手牌「诈败诱敌」，或选择不使用',
        allowedCommands: [QIDAHEN_COMMANDS.PLAY_TACTIC_CARD],
    }) as QidahenFeignedRetreatInteraction;
    interaction.data.qidahenFeignedRetreatSelection = {
        ...selection,
        pendingTargetAction: {
            ...selection.pendingTargetAction,
        },
        cavalryPlunderPayload: {
            ...selection.cavalryPlunderPayload,
            pendingTargetAction: selection.cavalryPlunderPayload.pendingTargetAction
                ? { ...selection.cavalryPlunderPayload.pendingTargetAction }
                : selection.cavalryPlunderPayload.pendingTargetAction,
        },
    };
    return interaction;
}

function buildQidahenRaidAndAmbushInteraction(
    state: MatchState<QidahenCore>,
): QidahenRaidAndAmbushInteraction | null {
    const selection = state.core.raidAndAmbushSelection;
    if (!selection) {
        return null;
    }
    const candidates: ChoiceRequestCandidate<{ choiceId: string }>[] = selection.phase === 'select-troop-kind'
        ? selection.eligibleTroopKinds.map((troopKind) => ({
            id: `troop-kind:${troopKind}`,
            label: getQidahenTroopKindLabel(troopKind),
            value: { choiceId: `troop-kind:${troopKind}` },
            displayMode: 'button',
        }))
        : [{
            id: selection.phase === 'offer' ? 'skip' : 'skip-follow-up',
            label: selection.phase === 'offer' ? '不使用' : '不追加战术',
            labelKey: selection.phase === 'offer'
                ? 'board.actions.common.skip'
                : 'board.actions.raidAndAmbush.skipFollowUp',
            value: { choiceId: selection.phase === 'offer' ? 'skip' : 'skip-follow-up' },
            displayMode: 'button',
        }];
    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-raid-and-ambush-${selection.targetRuntimeRegionId}-${selection.phase}`,
        playerId: state.core.factions[selection.factionId]?.playerId ?? state.core.currentPlayer,
        title: `偷袭与伏击 · ${selection.targetRegionName}`,
        sourceId: QIDAHEN_RAID_AND_AMBUSH_INTERACTION_SOURCE_ID,
        candidates,
        subtitle: selection.phase === 'offer'
            ? '敌方刚完成增援：直接点击真实手牌「偷袭与伏击」，或选择不使用'
            : selection.phase === 'select-troop-kind'
                ? '选择敌方当前实际参战的一种兵种'
                : '可以再直接点击一张合法战术牌，或选择不追加战术',
        allowedCommands: [QIDAHEN_COMMANDS.PLAY_TACTIC_CARD],
    }) as QidahenRaidAndAmbushInteraction;
    interaction.data.qidahenRaidAndAmbushSelection = {
        ...selection,
        eligibleTroopKinds: [...selection.eligibleTroopKinds],
    };
    return interaction;
}

function buildQidahenPendingTargetInteraction(
    state: MatchState<QidahenCore>,
): QidahenPendingTargetInteraction | null {
    if (state.core.raidAndAmbushSelection || state.core.feignedRetreatSelection) {
        return null;
    }
    const pendingTargetAction = getQidahenPendingTargetActionForCore(state.core, state.sys.interaction?.current);
    if (!pendingTargetAction) {
        return null;
    }

    const candidates: ChoiceRequestCandidate<QidahenPendingTargetChoiceValue>[] = buildPendingTargetChoiceOptions(state.core, pendingTargetAction).map((option) => ({
        ...option,
        displayMode: 'button',
    }));

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-pending-target-${pendingTargetAction.actionId}-${pendingTargetAction.targetRuntimeRegionId}`,
        playerId: state.core.factions[pendingTargetAction.attackerFactionId]?.playerId ?? state.core.currentPlayer,
        title: `${pendingTargetAction.title} · ${pendingTargetAction.targetRegionName}`,
        sourceId: QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID,
        candidates,
        subtitle: `守方 ${pendingTargetAction.defenderLabel} · 本次出兵 ${pendingTargetAction.committedTroops}`,
        allowedCommands: [
            QIDAHEN_COMMANDS.SELECT_REGION,
            QIDAHEN_COMMANDS.PLAY_TACTIC_CARD,
            QIDAHEN_COMMANDS.PLAY_BATTLE_RESPONSE_EVENT_CARD,
            QIDAHEN_COMMANDS.TOGGLE_PINCER_ADVANCE_TROOP,
            QIDAHEN_COMMANDS.RESOLVE_PINCER_ADVANCE,
            QIDAHEN_COMMANDS.CANCEL_PINCER_ADVANCE,
            QIDAHEN_COMMANDS.RESOLVE_INFANTRY_CAVALRY_COMBINED,
            QIDAHEN_COMMANDS.RESOLVE_INSTIGATE_DEFECTION,
            QIDAHEN_COMMANDS.CANCEL_INSTIGATE_DEFECTION,
            QIDAHEN_COMMANDS.SET_WUZHEN_CHAOHA_ARTILLERY_TECH_COUNT,
            QIDAHEN_COMMANDS.RESOLVE_WUZHEN_CHAOHA,
            QIDAHEN_COMMANDS.CANCEL_WUZHEN_CHAOHA,
            QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION,
        ],
    }) as QidahenPendingTargetInteraction;

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

    const candidates: ChoiceRequestCandidate<{ choiceId: string }>[] = selection.choices.map((choice) => ({
        id: choice.id,
        label: choice.label,
        value: { choiceId: choice.id },
        displayMode: 'button',
    }));

    const interaction = createQidahenChoiceRequestInteraction({
        requestId: `qidahen-post-battle-${selection.actionId}-${selection.targetRuntimeRegionId}`,
        playerId: state.core.factions[selection.attackerFactionId]?.playerId ?? state.core.currentPlayer,
        title: `${selection.title} · ${selection.targetRegionName}`,
        sourceId: QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,
        candidates,
        subtitle: `${selection.summary} · 幸存 ${selection.survivingTroops}`,
    }) as QidahenPostBattleInteraction;

    interaction.data.qidahenPostBattleSelection = {
        ...selection,
        choices: selection.choices.map((choice) => ({ ...choice })),
    };

    return interaction;
}

export const QIDAHEN_BATTLE_RUNTIME_INTERACTION_BUILDERS: readonly QidahenRuntimeInteractionBuilderSpec[] = [
    {
        sourceId: QIDAHEN_FEIGNED_RETREAT_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenFeignedRetreatInteraction,
    },
    {
        sourceId: QIDAHEN_RAID_AND_AMBUSH_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenRaidAndAmbushInteraction,
    },
    {
        sourceId: QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenPendingTargetInteraction,
    },
    {
        sourceId: QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,
        buildInteraction: buildQidahenPostBattleInteraction,
    },
];
