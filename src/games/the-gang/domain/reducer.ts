import type { MatchState, RandomFn } from '../../../engine/types';
import { createHeistRecord } from './showdown';
import { createInitialHeistCore } from './setup';
import {
    THE_GANG_COMMANDS,
    THE_GANG_EVENTS,
    type TheGangCommand,
    type TheGangCore,
    type TheGangEvent,
    type TheGangProgressKind,
    type TheGangRound,
} from './types';

const timestampOf = (command: TheGangCommand) =>
    typeof command.timestamp === 'number' ? command.timestamp : 0;

const drawCommunityCardsForNextRound = (core: TheGangCore) => {
    const drawCount = core.round === 1 ? 3 : 1;
    return core.deck.slice(0, drawCount);
};

const progressKindForCommand = (command: TheGangCommand): TheGangProgressKind | null => {
    switch (command.type) {
        case THE_GANG_COMMANDS.END_ROUND:
            return 'end-round';
        case THE_GANG_COMMANDS.REVEAL_SHOWDOWN:
            return 'reveal-showdown';
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

export function execute(
    state: MatchState<TheGangCore>,
    command: TheGangCommand,
    random: RandomFn,
): TheGangEvent[] {
    const core = state.core;
    const timestamp = timestampOf(command);

    switch (command.type) {
        case THE_GANG_COMMANDS.TAKE_CHIP:
            return [{
                type: THE_GANG_EVENTS.CHIP_TAKEN,
                payload: {
                    playerId: command.playerId,
                    round: core.round,
                    chip: command.payload.chip,
                },
                sourceCommandType: command.type,
                timestamp,
            }];
        case THE_GANG_COMMANDS.END_ROUND: {
            const nextRound = (core.round + 1) as TheGangRound;
            const events = buildProgressApprovalEvent(core, command, timestamp);
            if (!hasAllProgressApprovals(core, events)) return events;
            return [...events, {
                type: THE_GANG_EVENTS.ROUND_ENDED,
                payload: {
                    round: core.round,
                    nextRound,
                    revealedCards: drawCommunityCardsForNextRound(core),
                },
                sourceCommandType: command.type,
                timestamp,
            }];
        }
        case THE_GANG_COMMANDS.REVEAL_SHOWDOWN: {
            const events = buildProgressApprovalEvent(core, command, timestamp);
            if (!hasAllProgressApprovals(core, events)) return events;
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
        case THE_GANG_EVENTS.CHIP_TAKEN:
            return {
                ...core,
                currentRoundChips: {
                    ...core.currentRoundChips,
                    [event.payload.playerId]: event.payload.chip,
                },
                pendingProgress: undefined,
            };
        case THE_GANG_EVENTS.PROGRESS_APPROVED:
            return {
                ...core,
                pendingProgress: event.payload,
            };
        case THE_GANG_EVENTS.ROUND_ENDED: {
            const historyEntry = {
                round: event.payload.round,
                chipsByPlayer: { ...core.currentRoundChips },
            };
            return {
                ...core,
                round: event.payload.nextRound,
                deck: core.deck.slice(event.payload.revealedCards.length),
                communityCards: [...core.communityCards, ...event.payload.revealedCards],
                currentRoundChips: {},
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
                    { round: core.round, chipsByPlayer: { ...core.currentRoundChips } },
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
