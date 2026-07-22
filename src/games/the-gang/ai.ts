import type { MatchState, PlayerId } from '../../engine/types';
import { createAiLegalActionId } from '../../engine/ai';
import type { AiDecisionContext, AiLegalAction, GameAiRuntime, LocalAiPolicy } from '../../engine/ai';
import {
    allRequiredChipOwnersHaveChips,
    allRequiredExitChipsAreTaken,
    evaluateBestTheGangHand,
    getCurrentRoundExitChipOwners,
    getMissingHandSlotsForPlayer,
    getRequiredExitChipCount,
    getUnoccupiedChipValues,
    resolveChipOwnerKey,
} from './domain';
import { getChipValues } from './domain/setup';
import { THE_GANG_COMMANDS, type TheGangCore, type TheGangHandSlot, type TheGangProgressKind } from './domain/types';

type TheGangState = MatchState<TheGangCore>;

const ACTION_KIND_TAKE_CHIP = 'take-chip';
const ACTION_KIND_TAKE_EXIT_CHIP = 'take-exit-chip';
const ACTION_KIND_END_ROUND = 'end-round';
const ACTION_KIND_REVEAL_SHOWDOWN = 'reveal-showdown';
const ACTION_KIND_CONFIRM_HAND_SWAP = 'confirm-hand-swap';
const ACTION_KIND_START_NEXT_HEIST = 'start-next-heist';

const createTakeChipAction = (chip: number, handSlot?: TheGangHandSlot): AiLegalAction => ({
    actionId: createAiLegalActionId(ACTION_KIND_TAKE_CHIP, handSlot, chip),
    kind: ACTION_KIND_TAKE_CHIP,
    label: `${handSlot === 'bottom' ? '下手' : handSlot === 'top' ? '上手' : ''}选择 ${chip} 星筹码`.trim(),
    commands: [{
        type: THE_GANG_COMMANDS.TAKE_CHIP,
        payload: { chip, ...(handSlot ? { handSlot } : {}) },
    }],
    metadata: { chip, handSlot },
});

const createTakeExitChipAction = (handSlot?: TheGangHandSlot): AiLegalAction => ({
    actionId: createAiLegalActionId(ACTION_KIND_TAKE_EXIT_CHIP, handSlot ?? 'single'),
    kind: ACTION_KIND_TAKE_EXIT_CHIP,
    label: `${handSlot === 'bottom' ? '下手' : handSlot === 'top' ? '上手' : ''}选择撤离筹码`.trim(),
    commands: [{
        type: THE_GANG_COMMANDS.TAKE_EXIT_CHIP,
        payload: { ...(handSlot ? { handSlot } : {}) },
    }],
    metadata: { handSlot },
});

const createProgressAction = (
    kind:
        | typeof ACTION_KIND_END_ROUND
        | typeof ACTION_KIND_REVEAL_SHOWDOWN
        | typeof ACTION_KIND_CONFIRM_HAND_SWAP
        | typeof ACTION_KIND_START_NEXT_HEIST,
    label: string,
    commandType: string,
): AiLegalAction => ({
    actionId: createAiLegalActionId(kind),
    kind,
    label,
    commands: [{
        type: commandType,
        payload: {},
    }],
});

const isProgressAlreadyApprovedByPlayer = (
    core: TheGangCore,
    playerId: PlayerId,
    kind: TheGangProgressKind,
): boolean => (
    core.pendingProgress?.kind === kind
    && core.pendingProgress.approvals.includes(playerId)
);

const allPlayersHaveChips = (core: TheGangCore): boolean => allRequiredChipOwnersHaveChips(core);

const getMissingExitChipHandSlotsForPlayer = (
    core: TheGangCore,
    playerId: PlayerId,
): TheGangHandSlot[] => {
    if (core.round !== 4 || getRequiredExitChipCount(core) <= 0 || allRequiredExitChipsAreTaken(core)) return [];
    return (core.rules.config.twoHand ? (['top', 'bottom'] as const) : (['top'] as const))
        .filter((handSlot) => {
            const ownerKey = resolveChipOwnerKey(core, playerId, handSlot);
            return core.currentRoundChips[ownerKey] !== undefined
                && !getCurrentRoundExitChipOwners(core).includes(ownerKey);
        });
};

const uniqueChipValues = (chips: readonly number[]): number[] => [...new Set(chips)];

const getAvailableChipsForPlayer = (
    core: TheGangCore,
    playerId: PlayerId,
    handSlot: TheGangHandSlot,
): number[] => {
    const ownChip = core.currentRoundChips[resolveChipOwnerKey(core, playerId, handSlot)];

    return uniqueChipValues(
        getChipValues(core.playerIds.length, core.rules.config, core.round)
            .filter((chip) => chip !== ownChip),
    );
};

const getUnoccupiedCurrentRoundChips = (core: TheGangCore): number[] => {
    return getUnoccupiedChipValues(
        getChipValues(core.playerIds.length, core.rules.config, core.round),
        core.currentRoundChips,
    );
};

const scoreFromEvaluation = (evaluation: ReturnType<typeof evaluateBestTheGangHand>) => (
    evaluation.strength.category * 100
    + evaluation.strength.ranks.reduce((total, rank, index) => (
        total + rank / (10 ** (index + 1))
    ), 0)
);

const getVisibleStrengthScore = (
    core: TheGangCore,
    playerId: PlayerId,
    handSlot: TheGangHandSlot = 'top',
): number => {
    const player = core.players[playerId];
    if (!player) return 0;

    const boardCards = [
        ...(player.communityCards ?? core.communityCards),
        ...player.flashlightCards,
    ];
    const primaryHandCards = handSlot === 'top'
        ? [...player.pocketCards, ...player.nightVisionCards]
        : [...(player.secondaryPocketCards ?? [])];

    if (primaryHandCards.length + boardCards.length >= 5) {
        const primaryEvaluation = evaluateBestTheGangHand(primaryHandCards, boardCards, {
            rulesConfig: core.rules.config,
            blankedRank: core.rules.blankedRank,
        });
        return scoreFromEvaluation(primaryEvaluation);
    }

    return primaryHandCards
        .map((card) => card.rank)
        .map((rank) => {
            const order = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
            return order.indexOf(rank) + 2;
        })
        .reduce((total, value) => total + value, 0);
};

const getPreferredChip = (
    core: TheGangCore,
    playerId: PlayerId,
    handSlot: TheGangHandSlot,
    availableChips: number[],
): number | null => {
    if (availableChips.length === 0) return null;

    const visibleRankings = core.playerIds
        .map((id) => ({
            playerId: id,
            score: getVisibleStrengthScore(core, id, handSlot),
        }))
        .sort((left, right) => left.score - right.score || left.playerId.localeCompare(right.playerId));

    const preferredRank = visibleRankings.findIndex((entry) => entry.playerId === playerId) + 1;
    if (preferredRank <= 0) return availableChips[0] ?? null;

    return [...availableChips].sort((left, right) => (
        Math.abs(left - preferredRank) - Math.abs(right - preferredRank) || left - right
    ))[0] ?? null;
};

export function buildTheGangAiLegalActions(args: {
    playerId: PlayerId;
    state: MatchState<unknown>;
}): AiLegalAction[] {
    const state = args.state as TheGangState;
    const core = state.core;

    if (state.sys?.gameover || core.gameResult || core.phase === 'game-over') return [];

    if (core.phase === 'chip-selection') {
        if (!core.heistStarted) return [];

        const missingHandSlots = getMissingHandSlotsForPlayer(core, args.playerId);
        const actions = missingHandSlots.flatMap((handSlot) => (
            getAvailableChipsForPlayer(core, args.playerId, handSlot)
                .map((chip) => createTakeChipAction(chip, core.rules.config.twoHand ? handSlot : undefined))
        ));

        if (!allPlayersHaveChips(core)) return actions;

        const exitChipActions = getMissingExitChipHandSlotsForPlayer(core, args.playerId)
            .map((handSlot) => createTakeExitChipAction(core.rules.config.twoHand ? handSlot : undefined));
        if (exitChipActions.length > 0) return exitChipActions;

        if (core.round < 4 && !isProgressAlreadyApprovedByPlayer(core, args.playerId, 'end-round')) {
            actions.push(createProgressAction(
                ACTION_KIND_END_ROUND,
                '推进到下一轮',
                THE_GANG_COMMANDS.END_ROUND,
            ));
        } else if (
            core.communityCards.length === 5
            && !isProgressAlreadyApprovedByPlayer(core, args.playerId, 'reveal-showdown')
        ) {
            actions.push(createProgressAction(
                ACTION_KIND_REVEAL_SHOWDOWN,
                '揭示摊牌结果',
                THE_GANG_COMMANDS.REVEAL_SHOWDOWN,
            ));
        }

        return actions;
    }

    if (
        core.phase === 'hand-swap'
        && !isProgressAlreadyApprovedByPlayer(core, args.playerId, 'hand-swap')
    ) {
        return [createProgressAction(
            ACTION_KIND_CONFIRM_HAND_SWAP,
            '确认不调换手牌',
            THE_GANG_COMMANDS.CONFIRM_HAND_SWAP,
        )];
    }

    if (
        core.phase === 'showdown'
        && core.lastShowdown
        && !core.gameResult
        && !isProgressAlreadyApprovedByPlayer(core, args.playerId, 'start-next-heist')
    ) {
        return [createProgressAction(
            ACTION_KIND_START_NEXT_HEIST,
            '开始下一次抢劫',
            THE_GANG_COMMANDS.START_NEXT_HEIST,
        )];
    }

    return [];
}

const baselineLocalPolicy: LocalAiPolicy = {
    id: 'baseline',
    decide(context: AiDecisionContext) {
        const state = context.visibleState as TheGangState;
        const chipActions = context.legalActions.filter((action) => action.kind === ACTION_KIND_TAKE_CHIP);
        if (chipActions.length > 0) {
            const targetHandSlot: TheGangHandSlot = chipActions[0].metadata?.handSlot === 'bottom' ? 'bottom' : 'top';
            const targetChipActions = chipActions.filter((action) => (
                (action.metadata?.handSlot ?? 'top') === targetHandSlot
            ));
            const allAvailableChips = targetChipActions
                .map((action) => action.metadata?.chip)
                .filter((chip): chip is number => typeof chip === 'number');
            const unoccupiedChips = getUnoccupiedCurrentRoundChips(state.core);
            const candidateChips = allPlayersHaveChips(state.core)
                ? allAvailableChips
                : allAvailableChips.filter((chip) => unoccupiedChips.includes(chip));
            const preferredChip = getPreferredChip(
                state.core,
                context.playerId,
                targetHandSlot,
                candidateChips.length > 0 ? candidateChips : allAvailableChips,
            );
            const preferredAction = targetChipActions.find((action) => action.metadata?.chip === preferredChip);
            return preferredAction ? { actionId: preferredAction.actionId } : { actionId: chipActions[0].actionId };
        }

        const exitChipAction = context.legalActions.find((action) => action.kind === ACTION_KIND_TAKE_EXIT_CHIP);
        if (exitChipAction) return { actionId: exitChipAction.actionId };

        const firstProgressAction = context.legalActions.find((action) => (
            action.kind === ACTION_KIND_END_ROUND
            || action.kind === ACTION_KIND_REVEAL_SHOWDOWN
            || action.kind === ACTION_KIND_CONFIRM_HAND_SWAP
            || action.kind === ACTION_KIND_START_NEXT_HEIST
        ));
        return firstProgressAction ? { actionId: firstProgressAction.actionId } : null;
    },
};

export const theGangAiRuntime: GameAiRuntime = {
    gameId: 'the-gang',
    buildLegalActions: buildTheGangAiLegalActions,
    defaultMinimumActionDelayMs: 900,
    localPolicies: {
        baseline: baselineLocalPolicy,
    },
    defaultLocalPolicyId: 'baseline',
};
