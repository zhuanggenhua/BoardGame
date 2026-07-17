import type { MatchState, PlayerId } from '../../engine/types';
import { createAiLegalActionId } from '../../engine/ai';
import type { AiDecisionContext, AiLegalAction, GameAiRuntime, LocalAiPolicy } from '../../engine/ai';
import { compareHandStrength, evaluateBestTheGangHand } from './domain';
import { getChipValues } from './domain/setup';
import { THE_GANG_COMMANDS, type TheGangCore, type TheGangProgressKind } from './domain/types';

type TheGangState = MatchState<TheGangCore>;

const ACTION_KIND_TAKE_CHIP = 'take-chip';
const ACTION_KIND_END_ROUND = 'end-round';
const ACTION_KIND_REVEAL_SHOWDOWN = 'reveal-showdown';
const ACTION_KIND_CONFIRM_HAND_SWAP = 'confirm-hand-swap';
const ACTION_KIND_START_NEXT_HEIST = 'start-next-heist';

const createTakeChipAction = (chip: number): AiLegalAction => ({
    actionId: createAiLegalActionId(ACTION_KIND_TAKE_CHIP, chip),
    kind: ACTION_KIND_TAKE_CHIP,
    label: `选择 ${chip} 星筹码`,
    commands: [{
        type: THE_GANG_COMMANDS.TAKE_CHIP,
        payload: { chip },
    }],
    metadata: { chip },
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

const allPlayersHaveChips = (core: TheGangCore): boolean =>
    core.playerIds.every((playerId) => core.currentRoundChips[playerId] !== undefined);

const getAvailableChipsForPlayer = (core: TheGangCore, playerId: PlayerId): number[] => {
    const ownChip = core.currentRoundChips[playerId];

    return getChipValues(core.playerIds.length, core.rules.config, core.round)
        .filter((chip) => chip !== ownChip);
};

const getUnoccupiedCurrentRoundChips = (core: TheGangCore): number[] => {
    const occupied = new Set(Object.values(core.currentRoundChips));
    return getChipValues(core.playerIds.length, core.rules.config, core.round)
        .filter((chip) => !occupied.has(chip));
};

const scoreFromEvaluation = (evaluation: ReturnType<typeof evaluateBestTheGangHand>) => (
    evaluation.strength.category * 100
    + evaluation.strength.ranks.reduce((total, rank, index) => (
        total + rank / (10 ** (index + 1))
    ), 0)
);

const getVisibleStrengthScore = (core: TheGangCore, playerId: PlayerId): number => {
    const player = core.players[playerId];
    if (!player) return 0;

    const boardCards = [
        ...(player.communityCards ?? core.communityCards),
        ...player.flashlightCards,
    ];
    const primaryHandCards = [...player.pocketCards, ...player.nightVisionCards];
    const secondaryHandCards = player.secondaryPocketCards ?? [];

    if (primaryHandCards.length + boardCards.length >= 5) {
        const primaryEvaluation = evaluateBestTheGangHand(primaryHandCards, boardCards, {
            rulesConfig: core.rules.config,
            blankedRank: core.rules.blankedRank,
        });
        if (secondaryHandCards.length + boardCards.length < 5) {
            return scoreFromEvaluation(primaryEvaluation);
        }

        const secondaryEvaluation = evaluateBestTheGangHand(secondaryHandCards, boardCards, {
            rulesConfig: core.rules.config,
            blankedRank: core.rules.blankedRank,
        });
        return scoreFromEvaluation(
            compareHandStrength(secondaryEvaluation.strength, primaryEvaluation.strength) > 0
                ? secondaryEvaluation
                : primaryEvaluation,
        );
    }

    return [...primaryHandCards, ...secondaryHandCards]
        .map((card) => card.rank)
        .map((rank) => {
            const order = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
            return order.indexOf(rank) + 2;
        })
        .reduce((total, value) => total + value, 0);
};

const getPreferredChip = (core: TheGangCore, playerId: PlayerId, availableChips: number[]): number | null => {
    if (availableChips.length === 0) return null;

    const visibleRankings = core.playerIds
        .map((id) => ({
            playerId: id,
            score: getVisibleStrengthScore(core, id),
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

        const playerHasChip = core.currentRoundChips[args.playerId] !== undefined;
        const actions = playerHasChip
            ? []
            : getAvailableChipsForPlayer(core, args.playerId).map(createTakeChipAction);

        if (!allPlayersHaveChips(core)) return actions;

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
            const allAvailableChips = chipActions
                .map((action) => action.metadata?.chip)
                .filter((chip): chip is number => typeof chip === 'number');
            const unoccupiedChips = getUnoccupiedCurrentRoundChips(state.core);
            const candidateChips = allPlayersHaveChips(state.core)
                ? allAvailableChips
                : allAvailableChips.filter((chip) => unoccupiedChips.includes(chip));
            const preferredChip = getPreferredChip(
                state.core,
                context.playerId,
                candidateChips.length > 0 ? candidateChips : allAvailableChips,
            );
            const preferredAction = chipActions.find((action) => action.metadata?.chip === preferredChip);
            return preferredAction ? { actionId: preferredAction.actionId } : { actionId: chipActions[0].actionId };
        }

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
