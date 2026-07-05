import type { MatchState, RandomFn } from '../../../engine/types';
import { createHeistRecord } from './showdown';
import { createInitialHeistCore } from './setup';
import {
    THE_GANG_COMMANDS,
    THE_GANG_EVENTS,
    type TheGangCommand,
    type TheGangCore,
    type TheGangEvent,
    type TheGangRound,
} from './types';

const timestampOf = (command: TheGangCommand) =>
    typeof command.timestamp === 'number' ? command.timestamp : 0;

const drawCommunityCardsForNextRound = (core: TheGangCore) => {
    const drawCount = core.round === 1 ? 3 : 1;
    return core.deck.slice(0, drawCount);
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
            return [{
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
        }
        case THE_GANG_COMMANDS.START_NEXT_HEIST:
            return [{
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
            };
        default:
            return core;
    }
}
