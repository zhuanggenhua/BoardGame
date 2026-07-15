import type { ActionLogEntry, ActionLogSegment, Command, GameEvent, MatchState } from '../../engine/types';
import {
    THE_GANG_COMMANDS,
    THE_GANG_EVENTS,
    type HeistStartedEvent,
    type RoundEndedEvent,
    type ShowdownRevealedEvent,
    type NextHeistStartedEvent,
    type TheGangCore,
    type TheGangEvent,
} from './domain/types';

export const THE_GANG_ACTION_ALLOWLIST = [
    THE_GANG_COMMANDS.START_HEIST,
    THE_GANG_COMMANDS.TAKE_CHIP,
    THE_GANG_COMMANDS.END_ROUND,
    THE_GANG_COMMANDS.REVEAL_SHOWDOWN,
    THE_GANG_COMMANDS.START_NEXT_HEIST,
] as const;

export const THE_GANG_UNDO_ALLOWLIST = [
    THE_GANG_COMMANDS.START_HEIST,
    THE_GANG_COMMANDS.TAKE_CHIP,
    THE_GANG_COMMANDS.END_ROUND,
    THE_GANG_COMMANDS.REVEAL_SHOWDOWN,
    THE_GANG_COMMANDS.START_NEXT_HEIST,
] as const;

const NS = 'game-the-gang';

const i18nSeg = (
    key: string,
    params?: Record<string, string | number>,
): ActionLogSegment => ({
    type: 'i18n',
    ns: NS,
    key,
    ...(params ? { params } : {}),
});

const timestampOf = (command: Command) =>
    typeof command.timestamp === 'number' ? command.timestamp : 0;

const playerNumberOf = (core: TheGangCore, playerId: string) => {
    const index = core.playerIds.indexOf(playerId);
    return index >= 0 ? index + 1 : playerId;
};

const entry = (
    command: Command,
    segments: ActionLogSegment[],
): ActionLogEntry => {
    const timestamp = timestampOf(command);
    return {
        id: `the-gang-${command.type}-${command.playerId}-${timestamp}`,
        timestamp,
        actorId: command.playerId,
        kind: command.type,
        segments,
    };
};

const findShowdownEvent = (events: GameEvent[]): ShowdownRevealedEvent | undefined =>
    events.find((event): event is ShowdownRevealedEvent =>
        event.type === THE_GANG_EVENTS.SHOWDOWN_REVEALED,
    );

const findRoundEndedEvent = (events: GameEvent[]): RoundEndedEvent | undefined =>
    events.find((event): event is RoundEndedEvent =>
        event.type === THE_GANG_EVENTS.ROUND_ENDED,
    );

const findHeistStartedEvent = (events: GameEvent[]): HeistStartedEvent | undefined =>
    events.find((event): event is HeistStartedEvent =>
        event.type === THE_GANG_EVENTS.HEIST_STARTED,
    );

const findNextHeistEvent = (events: GameEvent[]): NextHeistStartedEvent | undefined =>
    events.find((event): event is NextHeistStartedEvent =>
        event.type === THE_GANG_EVENTS.NEXT_HEIST_STARTED,
    );

const hasEvent = (events: GameEvent[], type: string) =>
    events.some((event) => event.type === type);

export function formatTheGangActionEntry({
    command,
    state,
    events,
}: {
    command: Command;
    state: MatchState<unknown>;
    events: GameEvent[];
}): ActionLogEntry | null {
    const core = state.core as TheGangCore;
    const actor = playerNumberOf(core, command.playerId);

    switch (command.type) {
        case THE_GANG_COMMANDS.START_HEIST: {
            const heistStarted = findHeistStartedEvent(events);
            if (!heistStarted) return null;
            return entry(command, [i18nSeg('actionLog.startHeist', {
                player: actor,
                heist: heistStarted.payload.heistNumber,
            })]);
        }
        case THE_GANG_COMMANDS.TAKE_CHIP: {
            if (!hasEvent(events, THE_GANG_EVENTS.CHIP_TAKEN)) return null;
            const payload = command.payload as { chip: number };
            return entry(command, [i18nSeg('actionLog.takeChip', {
                player: actor,
                round: core.round,
                chip: payload.chip,
            })]);
        }
        case THE_GANG_COMMANDS.END_ROUND: {
            const roundEnded = findRoundEndedEvent(events);
            if (!roundEnded) return null;
            return entry(command, [i18nSeg('actionLog.endRound', {
                player: actor,
                round: roundEnded.payload.round,
                nextRound: roundEnded.payload.nextRound,
            })]);
        }
        case THE_GANG_COMMANDS.REVEAL_SHOWDOWN: {
            const showdown = findShowdownEvent(events as TheGangEvent[]);
            if (!showdown) return null;
            return entry(command, [i18nSeg('actionLog.revealShowdown', {
                player: actor,
                heist: showdown.payload.record.heistNumber,
                outcome: showdown.payload.record.outcome === 'success'
                    ? '成功'
                    : '失败',
                successes: showdown.payload.successes,
                failures: showdown.payload.failures,
            })]);
        }
        case THE_GANG_COMMANDS.START_NEXT_HEIST: {
            const nextHeist = findNextHeistEvent(events);
            if (!nextHeist) return null;
            return entry(command, [i18nSeg('actionLog.startNextHeist', {
                player: actor,
                heist: nextHeist.payload.nextCore.heistNumber,
            })]);
        }
        default:
            return null;
    }
}
