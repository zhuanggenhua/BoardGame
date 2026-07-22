import type { MatchState, RandomFn } from '../../../engine/types';
import {
    allRequiredFinalTokensAreTaken,
    getCurrentRoundExitChipOwners,
    getUnoccupiedChipValues,
    removeConflictingChipOwners,
    resolveChipOwnerKey,
} from './chips';
import { createHeistRecord } from './showdown';
import {
    createInitialHeistCore,
    discardHighestCard,
    discardLowestCard,
    getChipValues,
    retuneInitialHeistCoreForRulesConfig,
} from './setup';
import {
    buildDealPlan,
    createSpecialistDeck,
    createToolDeck,
    getBlackedRankForHeist,
    isChallengeActive,
    normalizeRulesConfig,
    rulesConfigRequiresRedeal,
} from './expansions';
import {
    THE_GANG_COMMANDS,
    THE_GANG_EVENTS,
    type TheGangCommand,
    type TheGangCore,
    type TheGangEvent,
    type TheGangProgressKind,
    type TheGangRound,
    type TheGangSpecialistId,
    type TheGangToolId,
} from './types';

const timestampOf = (command: TheGangCommand) =>
    typeof command.timestamp === 'number' ? command.timestamp : 0;

type CardList = TheGangCore['deck'];

const shuffleItems = <T,>(items: readonly T[], random: RandomFn): T[] => {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
};

interface RoundAdvanceDraw {
    revealedCards: CardList;
    playerRevealedCards?: Record<string, CardList>;
    playerDrawnCards?: Record<string, CardList>;
    playerDrawnSecondaryCards?: Record<string, CardList>;
    cardsConsumed: number;
}

const applyCommunityDiscardRule = (core: TheGangCore, cards: CardList) => {
    if (core.round === 2 && isChallengeActive(core.rules.config, 'motion-detector')) {
        return discardLowestCard(cards);
    }
    if (core.round === 2 && isChallengeActive(core.rules.config, 'laser-tripwires')) {
        return discardHighestCard(cards);
    }
    if (core.round === 3 && isChallengeActive(core.rules.config, 'ventilation-shaft')) {
        const dealPlan = buildDealPlan(core.rules.config);
        const baseDrawCount = dealPlan.roundDraws[core.round as 1 | 2 | 3] ?? 0;
        return cards.slice(-baseDrawCount);
    }
    return cards;
};

const buildRoundAdvanceDraw = (core: TheGangCore): RoundAdvanceDraw => {
    const drawRound = core.round as 1 | 2 | 3;
    const dealPlan = buildDealPlan(core.rules.config);
    const baseDrawCount = dealPlan.roundDraws[drawRound] ?? 0;
    const extraCommunityDrawCount = (
        (core.round === 2 && (isChallengeActive(core.rules.config, 'motion-detector') || isChallengeActive(core.rules.config, 'laser-tripwires')))
        || (core.round === 3 && isChallengeActive(core.rules.config, 'ventilation-shaft'))
    ) ? 1 : 0;
    let cursor = 0;
    const take = (count: number) => {
        const cards = core.deck.slice(cursor, cursor + count);
        cursor += count;
        return cards;
    };

    const playerDrawnCards: Record<string, CardList> = {};
    const playerDrawnSecondaryCards: Record<string, CardList> = {};
    if (core.round === 1 && isChallengeActive(core.rules.config, 'balance')) {
        for (const playerId of core.playerIds) {
            playerDrawnCards[playerId] = take(1);
            if (core.rules.config.twoHand) {
                playerDrawnSecondaryCards[playerId] = take(1);
            }
        }
    }

    if (dealPlan.perPlayerCommunity) {
        const playerRevealedCards: Record<string, CardList> = {};
        for (const playerId of core.playerIds) {
            playerRevealedCards[playerId] = applyCommunityDiscardRule(
                core,
                take(baseDrawCount + extraCommunityDrawCount),
            );
        }
        return {
            revealedCards: [],
            playerRevealedCards,
            playerDrawnCards: Object.keys(playerDrawnCards).length > 0 ? playerDrawnCards : undefined,
            playerDrawnSecondaryCards: Object.keys(playerDrawnSecondaryCards).length > 0 ? playerDrawnSecondaryCards : undefined,
            cardsConsumed: cursor,
        };
    }

    return {
        revealedCards: applyCommunityDiscardRule(core, take(baseDrawCount + extraCommunityDrawCount)),
        playerDrawnCards: Object.keys(playerDrawnCards).length > 0 ? playerDrawnCards : undefined,
        playerDrawnSecondaryCards: Object.keys(playerDrawnSecondaryCards).length > 0 ? playerDrawnSecondaryCards : undefined,
        cardsConsumed: cursor,
    };
};

const nextPlayableRound = (core: TheGangCore) => {
    const dealPlan = buildDealPlan(core.rules.config);
    let nextRound = core.round + 1;
    while (dealPlan.skippedRounds.includes(nextRound) && nextRound < 4) {
        nextRound += 1;
    }
    return nextRound as TheGangRound;
};

const isHandSwapEnabled = (core: TheGangCore) =>
    core.rules.config.twoHand;

const createHandSwapStartedEvent = (
    core: TheGangCore,
    command: TheGangCommand,
    timestamp: number,
): TheGangEvent => ({
    type: THE_GANG_EVENTS.HAND_SWAP_STARTED,
    payload: { round: core.round },
    sourceCommandType: command.type,
    timestamp,
});

const applyHandSwapConfirmationToCore = (
    core: TheGangCore,
    payload: {
        playerId: string;
        topIndex?: number;
        bottomIndex?: number;
    },
): TheGangCore => {
    if (typeof payload.topIndex !== 'number' || typeof payload.bottomIndex !== 'number') {
        return core;
    }

    const player = core.players[payload.playerId];
    const secondaryCards = player.secondaryPocketCards ?? [];
    const topCard = player.pocketCards[payload.topIndex];
    const bottomCard = secondaryCards[payload.bottomIndex];
    if (!topCard || !bottomCard) return core;

    const nextPocketCards = [...player.pocketCards];
    const nextSecondaryPocketCards = [...secondaryCards];
    nextPocketCards[payload.topIndex] = bottomCard;
    nextSecondaryPocketCards[payload.bottomIndex] = topCard;

    return {
        ...core,
        players: {
            ...core.players,
            [payload.playerId]: {
                ...player,
                pocketCards: nextPocketCards,
                secondaryPocketCards: nextSecondaryPocketCards,
            },
        },
    };
};

const buildCoreWithRulesConfig = (core: TheGangCore, random: RandomFn, config: Partial<TheGangCore['rules']['config']>) => {
    const normalizedConfig = normalizeRulesConfig(config);
    void random;
    if (!rulesConfigRequiresRedeal(core.rules.config, normalizedConfig)) {
        return {
            ...core,
            rules: {
                config: normalizedConfig,
                blankedRank: getBlackedRankForHeist(normalizedConfig, core.heistNumber),
            },
        };
    }
    return retuneInitialHeistCoreForRulesConfig(core, normalizedConfig);
};

const buildAutoProgressEventsAfterChip = (
    core: TheGangCore,
    command: Extract<TheGangCommand, { type: typeof THE_GANG_COMMANDS.TAKE_CHIP | typeof THE_GANG_COMMANDS.TAKE_EXIT_CHIP }>,
    nextRoundChips: Record<string, number>,
    nextExitChipOwners: string[],
    timestamp: number,
): TheGangEvent[] => {
    if (!core.rules.config.automode) return [];
    if (!allRequiredFinalTokensAreTaken({
        ...core,
        currentRoundChips: nextRoundChips,
        currentRoundExitChipOwners: nextExitChipOwners,
    })) return [];

    if (isHandSwapEnabled(core)) {
        if (core.round < 4 || core.communityCards.length >= 5) {
            return [createHandSwapStartedEvent(core, command, timestamp)];
        }
        return [];
    }

    if (core.round < 4) {
        return [{
            type: THE_GANG_EVENTS.ROUND_ENDED,
            payload: {
                round: core.round,
                nextRound: nextPlayableRound(core),
                ...buildRoundAdvanceDraw(core),
            },
            sourceCommandType: command.type,
            timestamp,
        }];
    }

    if (core.communityCards.length < 5) return [];

    const coreWithFinalChip = {
        ...core,
        currentRoundChips: nextRoundChips,
        currentRoundExitChipOwners: nextExitChipOwners,
    };
    const record = createHeistRecord(coreWithFinalChip);
    const successes = core.successes + (record.outcome === 'success' ? 1 : 0);
    const failures = core.failures + (record.outcome === 'failure' ? 1 : 0);
    const events: TheGangEvent[] = [{
        type: THE_GANG_EVENTS.SHOWDOWN_REVEALED,
        payload: { record, successes, failures },
        sourceCommandType: command.type,
        timestamp,
    }];

    if (successes >= 3 || failures >= 3) {
        events.push({
            type: THE_GANG_EVENTS.GAME_FINISHED,
            payload: successes >= 3 ? { winners: core.playerIds } : { draw: false },
            sourceCommandType: command.type,
            timestamp,
        });
    }

    return events;
};

const progressKindForCommand = (command: TheGangCommand): TheGangProgressKind | null => {
    switch (command.type) {
        case THE_GANG_COMMANDS.END_ROUND:
            return 'end-round';
        case THE_GANG_COMMANDS.REVEAL_SHOWDOWN:
            return 'reveal-showdown';
        case THE_GANG_COMMANDS.CONFIRM_HAND_SWAP:
            return 'hand-swap';
        case THE_GANG_COMMANDS.START_NEXT_HEIST:
            return 'start-next-heist';
        default:
            return null;
    }
};

const buildProgressApprovalEvent = (
    core: TheGangCore,
    command: TheGangCommand,
    timestamp: number,
): TheGangEvent[] => {
    const kind = progressKindForCommand(command);
    if (!kind) return [];

    const existingApprovals = core.pendingProgress?.kind === kind
        ? core.pendingProgress.approvals
        : [];
    const approvals = existingApprovals.includes(command.playerId)
        ? existingApprovals
        : [...existingApprovals, command.playerId];

    return [{
        type: THE_GANG_EVENTS.PROGRESS_APPROVED,
        payload: { kind, approvals },
        sourceCommandType: command.type,
        timestamp,
    }];
};

const hasAllProgressApprovals = (core: TheGangCore, events: TheGangEvent[]) => {
    const approval = events.find((event) => event.type === THE_GANG_EVENTS.PROGRESS_APPROVED);
    if (!approval || approval.type !== THE_GANG_EVENTS.PROGRESS_APPROVED) return false;
    return core.playerIds.every((playerId) => approval.payload.approvals.includes(playerId));
};

const buildEventsAfterHandSwap = (
    core: TheGangCore,
    command: TheGangCommand,
    timestamp: number,
): TheGangEvent[] => {
    if (core.round < 4) {
        return [{
            type: THE_GANG_EVENTS.ROUND_ENDED,
            payload: {
                round: core.round,
                nextRound: nextPlayableRound(core),
                ...buildRoundAdvanceDraw(core),
            },
            sourceCommandType: command.type,
            timestamp,
        }];
    }

    if (core.communityCards.length < 5) return [];
    const record = createHeistRecord(core);
    const successes = core.successes + (record.outcome === 'success' ? 1 : 0);
    const failures = core.failures + (record.outcome === 'failure' ? 1 : 0);
    const events: TheGangEvent[] = [{
        type: THE_GANG_EVENTS.SHOWDOWN_REVEALED,
        payload: { record, successes, failures },
        sourceCommandType: command.type,
        timestamp,
    }];

    if (successes >= 3 || failures >= 3) {
        events.push({
            type: THE_GANG_EVENTS.GAME_FINISHED,
            payload: successes >= 3 ? { winners: core.playerIds } : { draw: false },
            sourceCommandType: command.type,
            timestamp,
        });
    }

    return events;
};

const buildHandSwapConfirmedEvents = (
    core: TheGangCore,
    command: Extract<TheGangCommand, { type: typeof THE_GANG_COMMANDS.CONFIRM_HAND_SWAP }>,
    timestamp: number,
): TheGangEvent[] => {
    const existingApprovals = core.pendingProgress?.kind === 'hand-swap'
        ? core.pendingProgress.approvals
        : [];
    if (existingApprovals.includes(command.playerId)) return [];

    const approvals = [...existingApprovals, command.playerId];
    const hasSwap = typeof command.payload.topIndex === 'number' && typeof command.payload.bottomIndex === 'number';
    const confirmationPayload = {
        playerId: command.playerId,
        approvals,
        ...(hasSwap ? {
            topIndex: command.payload.topIndex,
            bottomIndex: command.payload.bottomIndex,
        } : {}),
    };
    const confirmationEvent: TheGangEvent = {
        type: THE_GANG_EVENTS.HAND_SWAP_CONFIRMED,
        payload: confirmationPayload,
        sourceCommandType: command.type,
        timestamp,
    };
    const coreAfterSwap = applyHandSwapConfirmationToCore(core, confirmationPayload);
    if (!core.playerIds.every((playerId) => approvals.includes(playerId))) {
        return [confirmationEvent];
    }

    return [
        confirmationEvent,
        ...buildEventsAfterHandSwap(coreAfterSwap, command, timestamp),
    ];
};

const drawFirstNonJoker = (core: TheGangCore) => {
    const drawnCards = core.deck.slice();
    const index = drawnCards.findIndex((card) => card.kind !== 'joker');
    const cardIndex = index >= 0 ? index : 0;
    const drawnCard = drawnCards[cardIndex];
    return {
        drawnCard,
        remainingDeck: drawnCards.slice(cardIndex + 1),
        discardPile: [
            ...core.discardPile,
            ...drawnCards.slice(0, cardIndex).filter((card) => card.kind === 'joker'),
        ],
    };
};

const buildToolUsedPayload = (core: TheGangCore, playerId: string, tool: TheGangToolId, cardIndex?: number) => {
    if (tool === 'burner-phone') {
        return {
            playerId,
            tool,
            remainingSpecialistDeck: core.specialistDeck.slice(2),
            specialistCards: core.specialistDeck.slice(0, 2),
        };
    }
    if (tool === 'flashlight') {
        return {
            playerId,
            tool,
            ...drawFirstNonJoker(core),
        };
    }
    return {
        playerId,
        tool,
        movedCardIndex: cardIndex,
    };
};

const resolveTakeChipValue = (core: TheGangCore, command: Extract<TheGangCommand, { type: typeof THE_GANG_COMMANDS.TAKE_CHIP }>): number | null => {
    const ownerKey = resolveChipOwnerKey(core, command.playerId, command.payload.handSlot);
    if (command.payload.tutorialOnlyIfMissing && core.currentRoundChips[ownerKey] !== undefined) {
        return null;
    }
    if (command.payload.tutorialChipMode === 'lowest-unoccupied') {
        return getUnoccupiedChipValues(
            getChipValues(core.playerIds.length, core.rules.config, core.round),
            core.currentRoundChips,
        )
            .at(0)
            ?? null;
    }
    return command.payload.chip;
};

export function execute(
    state: MatchState<TheGangCore>,
    command: TheGangCommand,
    random: RandomFn,
): TheGangEvent[] {
    const core = state.core;
    const timestamp = timestampOf(command);

    switch (command.type) {
        case THE_GANG_COMMANDS.START_HEIST:
            return [{
                type: THE_GANG_EVENTS.HEIST_STARTED,
                payload: {
                    playerId: command.playerId,
                    heistNumber: core.heistNumber,
                },
                sourceCommandType: command.type,
                timestamp,
            }];
        case THE_GANG_COMMANDS.REDEAL_HEIST:
            return [{
                type: THE_GANG_EVENTS.HEIST_REDEALT,
                payload: {
                    nextCore: createInitialHeistCore(core.playerIds, random, {
                        heistNumber: core.heistNumber,
                        successes: core.successes,
                        failures: core.failures,
                        heistHistory: core.heistHistory,
                        rulesConfig: core.rules.config,
                    }),
                },
                sourceCommandType: command.type,
                timestamp,
            }];
        case THE_GANG_COMMANDS.TAKE_CHIP: {
            const chip = resolveTakeChipValue(core, command);
            if (chip === null) return [];
            const ownerKey = resolveChipOwnerKey(core, command.playerId, command.payload.handSlot);
            const nextRoundChips = removeConflictingChipOwners(
                core.currentRoundChips,
                ownerKey,
                chip,
                getChipValues(core.playerIds.length, core.rules.config, core.round),
            );
            nextRoundChips[ownerKey] = chip;
            const chipTakenEvent: TheGangEvent = {
                type: THE_GANG_EVENTS.CHIP_TAKEN,
                payload: {
                    playerId: command.playerId,
                    ownerKey,
                    handSlot: command.payload.handSlot,
                    round: core.round,
                    chip,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            return [
                chipTakenEvent,
                ...buildAutoProgressEventsAfterChip(
                    core,
                    command,
                    nextRoundChips,
                    getCurrentRoundExitChipOwners(core),
                    timestamp,
                ),
            ];
        }
        case THE_GANG_COMMANDS.TAKE_EXIT_CHIP: {
            const ownerKey = resolveChipOwnerKey(core, command.playerId, command.payload.handSlot);
            const nextExitChipOwners = [
                ...getCurrentRoundExitChipOwners(core).filter((currentOwnerKey) => currentOwnerKey !== ownerKey),
                ownerKey,
            ];
            const exitChipTakenEvent: TheGangEvent = {
                type: THE_GANG_EVENTS.EXIT_CHIP_TAKEN,
                payload: {
                    playerId: command.playerId,
                    ownerKey,
                    handSlot: command.payload.handSlot,
                    round: core.round,
                },
                sourceCommandType: command.type,
                timestamp,
            };
            return [
                exitChipTakenEvent,
                ...buildAutoProgressEventsAfterChip(core, command, core.currentRoundChips, nextExitChipOwners, timestamp),
            ];
        }
        case THE_GANG_COMMANDS.SET_RULES_CONFIG:
            return [{
                type: THE_GANG_EVENTS.RULES_CONFIG_SET,
                payload: {
                    nextCore: buildCoreWithRulesConfig(core, random, command.payload.config),
                },
                sourceCommandType: command.type,
                timestamp,
            }];
        case THE_GANG_COMMANDS.DEAL_TOOLS: {
            const dealtTools = Object.fromEntries(
                core.playerIds.map((playerId, index) => [playerId, core.toolDeck[index]]),
            );
            return [{
                type: THE_GANG_EVENTS.TOOLS_DEALT,
                payload: {
                    dealtTools,
                    remainingToolDeck: core.toolDeck.slice(core.playerIds.length),
                },
                sourceCommandType: command.type,
                timestamp,
            }];
        }
        case THE_GANG_COMMANDS.RESET_TOOLS:
            return [{
                type: THE_GANG_EVENTS.TOOLS_RESET,
                payload: {
                    toolDeck: shuffleItems<TheGangToolId>(createToolDeck(), random),
                },
                sourceCommandType: command.type,
                timestamp,
            }];
        case THE_GANG_COMMANDS.RESET_SPECIALISTS:
            return [{
                type: THE_GANG_EVENTS.SPECIALISTS_RESET,
                payload: {
                    specialistDeck: shuffleItems<TheGangSpecialistId>(createSpecialistDeck(), random),
                },
                sourceCommandType: command.type,
                timestamp,
            }];
        case THE_GANG_COMMANDS.USE_TOOL:
            return [{
                type: THE_GANG_EVENTS.TOOL_USED,
                payload: buildToolUsedPayload(core, command.playerId, command.payload.tool, command.payload.cardIndex),
                sourceCommandType: command.type,
                timestamp,
            }];
        case THE_GANG_COMMANDS.END_ROUND: {
            const nextRound = nextPlayableRound(core);
            const events = buildProgressApprovalEvent(core, command, timestamp);
            if (!hasAllProgressApprovals(core, events)) return events;
            if (isHandSwapEnabled(core)) {
                return [...events, createHandSwapStartedEvent(core, command, timestamp)];
            }
            return [...events, {
                type: THE_GANG_EVENTS.ROUND_ENDED,
                payload: {
                    round: core.round,
                    nextRound,
                    ...buildRoundAdvanceDraw(core),
                },
                sourceCommandType: command.type,
                timestamp,
            }];
        }
        case THE_GANG_COMMANDS.REVEAL_SHOWDOWN: {
            const events = buildProgressApprovalEvent(core, command, timestamp);
            if (!hasAllProgressApprovals(core, events)) return events;
            if (isHandSwapEnabled(core)) {
                return [...events, createHandSwapStartedEvent(core, command, timestamp)];
            }
            const record = createHeistRecord(core);
            const successes = core.successes + (record.outcome === 'success' ? 1 : 0);
            const failures = core.failures + (record.outcome === 'failure' ? 1 : 0);
            events.push({
                type: THE_GANG_EVENTS.SHOWDOWN_REVEALED,
                payload: { record, successes, failures },
                sourceCommandType: command.type,
                timestamp,
            });
            if (successes >= 3 || failures >= 3) {
                events.push({
                    type: THE_GANG_EVENTS.GAME_FINISHED,
                    payload: successes >= 3 ? { winners: core.playerIds } : { draw: false },
                    sourceCommandType: command.type,
                    timestamp,
                });
            }
            return events;
        }
        case THE_GANG_COMMANDS.CONFIRM_HAND_SWAP:
            return buildHandSwapConfirmedEvents(core, command, timestamp);
        case THE_GANG_COMMANDS.START_NEXT_HEIST: {
            const events = buildProgressApprovalEvent(core, command, timestamp);
            if (!hasAllProgressApprovals(core, events)) return events;
            return [...events, {
                type: THE_GANG_EVENTS.NEXT_HEIST_STARTED,
                payload: {
                    nextCore: createInitialHeistCore(core.playerIds, random, {
                        heistNumber: core.heistNumber + 1,
                        successes: core.successes,
                        failures: core.failures,
                        heistHistory: core.heistHistory,
                        rulesConfig: core.rules.config,
                    }),
                },
                sourceCommandType: command.type,
                timestamp,
            }];
        }
        default:
            return [];
    }
}

export function reduce(core: TheGangCore, event: TheGangEvent): TheGangCore {
    switch (event.type) {
        case THE_GANG_EVENTS.HEIST_STARTED:
            return {
                ...core,
                heistStarted: true,
                pendingProgress: undefined,
            };
        case THE_GANG_EVENTS.HEIST_REDEALT:
            return event.payload.nextCore;
        case THE_GANG_EVENTS.CHIP_TAKEN: {
            const nextRoundChips = removeConflictingChipOwners(
                core.currentRoundChips,
                event.payload.ownerKey,
                event.payload.chip,
                getChipValues(core.playerIds.length, core.rules.config, core.round),
            );
            return {
                ...core,
                currentRoundChips: {
                    ...nextRoundChips,
                    [event.payload.ownerKey]: event.payload.chip,
                },
                pendingProgress: undefined,
            };
        }
        case THE_GANG_EVENTS.EXIT_CHIP_TAKEN:
            return {
                ...core,
                currentRoundExitChipOwners: [
                    ...getCurrentRoundExitChipOwners(core).filter((ownerKey) => ownerKey !== event.payload.ownerKey),
                    event.payload.ownerKey,
                ],
                pendingProgress: undefined,
            };
        case THE_GANG_EVENTS.RULES_CONFIG_SET:
            return event.payload.nextCore;
        case THE_GANG_EVENTS.TOOLS_DEALT: {
            const players = Object.fromEntries(core.playerIds.map((playerId) => {
                const tool = event.payload.dealtTools[playerId];
                const player = core.players[playerId];
                return [playerId, {
                    ...player,
                    toolCards: tool ? [...player.toolCards, tool] : player.toolCards,
                }];
            }));
            return {
                ...core,
                players,
                toolDeck: event.payload.remainingToolDeck,
            };
        }
        case THE_GANG_EVENTS.TOOLS_RESET: {
            const players = Object.fromEntries(core.playerIds.map((playerId) => {
                const player = core.players[playerId];
                return [playerId, {
                    ...player,
                    toolCards: [],
                    activeTools: [],
                    flashlightCards: [],
                    nightVisionCards: [],
                }];
            }));
            return {
                ...core,
                players,
                toolDeck: event.payload.toolDeck,
                toolDiscardPile: [],
            };
        }
        case THE_GANG_EVENTS.SPECIALISTS_RESET: {
            const players = Object.fromEntries(core.playerIds.map((playerId) => {
                const player = core.players[playerId];
                return [playerId, {
                    ...player,
                    specialistCards: [],
                }];
            }));
            return {
                ...core,
                players,
                specialistDeck: event.payload.specialistDeck,
                specialistDiscardPile: [],
            };
        }
        case THE_GANG_EVENTS.TOOL_USED: {
            const player = core.players[event.payload.playerId];
            const removeTool = (tools: TheGangToolId[]) => {
                const index = tools.indexOf(event.payload.tool);
                return index < 0 ? tools : tools.filter((_, toolIndex) => toolIndex !== index);
            };
            const nextPlayer = {
                ...player,
                toolCards: removeTool(player.toolCards),
                activeTools: [...player.activeTools, event.payload.tool],
                pocketCards: event.payload.tool === 'night-vision-goggles' && event.payload.movedCardIndex !== undefined
                    ? player.pocketCards.filter((_, cardIndex) => cardIndex !== event.payload.movedCardIndex)
                    : player.pocketCards,
                specialistCards: event.payload.specialistCards
                    ? [...player.specialistCards, ...event.payload.specialistCards]
                    : player.specialistCards,
                flashlightCards: event.payload.drawnCard
                    ? [...player.flashlightCards, event.payload.drawnCard]
                    : player.flashlightCards,
                nightVisionCards: event.payload.tool === 'night-vision-goggles' && event.payload.movedCardIndex !== undefined
                    ? [...player.nightVisionCards, player.pocketCards[event.payload.movedCardIndex]]
                    : player.nightVisionCards,
            };
            return {
                ...core,
                players: {
                    ...core.players,
                    [event.payload.playerId]: nextPlayer,
                },
                deck: event.payload.remainingDeck ?? core.deck,
                discardPile: event.payload.discardPile ?? core.discardPile,
                specialistDeck: event.payload.remainingSpecialistDeck ?? core.specialistDeck,
                toolDiscardPile: [...core.toolDiscardPile, event.payload.tool],
            };
        }
        case THE_GANG_EVENTS.PROGRESS_APPROVED:
            return {
                ...core,
                pendingProgress: event.payload,
            };
        case THE_GANG_EVENTS.HAND_SWAP_STARTED:
            return {
                ...core,
                phase: 'hand-swap',
                pendingProgress: undefined,
            };
        case THE_GANG_EVENTS.HAND_SWAP_CONFIRMED: {
            const swappedCore = applyHandSwapConfirmationToCore(core, event.payload);
            return {
                ...swappedCore,
                pendingProgress: {
                    kind: 'hand-swap',
                    approvals: event.payload.approvals,
                },
            };
        }
        case THE_GANG_EVENTS.ROUND_ENDED: {
            const historyEntry = {
                round: event.payload.round,
                chipsByPlayer: { ...core.currentRoundChips },
                exitChipOwners: [...getCurrentRoundExitChipOwners(core)],
            };
            const players = Object.fromEntries(core.playerIds.map((playerId) => {
                const player = core.players[playerId];
                const drawnCards = event.payload.playerDrawnCards?.[playerId] ?? [];
                const drawnSecondaryCards = event.payload.playerDrawnSecondaryCards?.[playerId] ?? [];
                const revealedCards = event.payload.playerRevealedCards?.[playerId];
                return [playerId, {
                    ...player,
                    pocketCards: [...player.pocketCards, ...drawnCards],
                    ...(player.secondaryPocketCards || drawnSecondaryCards.length > 0
                        ? { secondaryPocketCards: [...(player.secondaryPocketCards ?? []), ...drawnSecondaryCards] }
                        : {}),
                    ...(revealedCards
                        ? { communityCards: [...(player.communityCards ?? []), ...revealedCards] }
                        : {}),
                }];
            }));
            return {
                ...core,
                players,
                phase: 'chip-selection',
                round: event.payload.nextRound,
                deck: core.deck.slice(event.payload.cardsConsumed ?? event.payload.revealedCards.length),
                communityCards: [...core.communityCards, ...event.payload.revealedCards],
                currentRoundChips: {},
                currentRoundExitChipOwners: [],
                pendingProgress: undefined,
                roundHistory: [...core.roundHistory, historyEntry],
            };
        }
        case THE_GANG_EVENTS.SHOWDOWN_REVEALED:
            return {
                ...core,
                phase: 'showdown',
                successes: event.payload.successes,
                failures: event.payload.failures,
                lastShowdown: event.payload.record,
                heistHistory: [...core.heistHistory, event.payload.record],
                pendingProgress: undefined,
                roundHistory: [
                    ...core.roundHistory,
                    {
                        round: core.round,
                        chipsByPlayer: { ...core.currentRoundChips },
                        exitChipOwners: [...getCurrentRoundExitChipOwners(core)],
                    },
                ],
            };
        case THE_GANG_EVENTS.NEXT_HEIST_STARTED:
            return event.payload.nextCore;
        case THE_GANG_EVENTS.GAME_FINISHED:
            return {
                ...core,
                phase: 'game-over',
                gameResult: event.payload,
                pendingProgress: undefined,
            };
        default:
            return core;
    }
}
