/** Persisted match results shared by the game server, API and admin UI. */
export type MatchPlayerResult = 'win' | 'loss' | 'draw';

export interface MatchRecordPlayer {
    id: string;
    seatId?: string;
    name?: string;
    ownerKey?: string;
    isAi?: boolean;
    result?: MatchPlayerResult;
}

export interface MatchRecordOutcome {
    /** Complete winner identities; absent on historical single-winner records. */
    winnerIDs?: string[];
    /** Historical single-winner field. New writers set it only for one winner. */
    winnerID?: string;
    draw?: boolean;
}

export interface PersistedMatchRecord extends MatchRecordOutcome {
    matchID: string;
    gameName: string;
    players: MatchRecordPlayer[];
    actionLog?: unknown[];
    scores?: Record<string, number>;
    createdAt: Date;
    endedAt: Date;
    updatedAt?: Date;
}

export function getMatchWinnerIDs(outcome: MatchRecordOutcome): string[] {
    return outcome.winnerIDs ?? (outcome.winnerID !== undefined ? [outcome.winnerID] : []);
}

export function getMatchPlayerResult(outcome: MatchRecordOutcome, player: MatchRecordPlayer): MatchPlayerResult {
    if (player.result === 'win' || player.result === 'loss' || player.result === 'draw') return player.result;
    const winners = getMatchWinnerIDs(outcome);
    if (outcome.draw === true) return 'draw';
    if (winners.includes(player.id)) return 'win';
    return winners.length > 0 || outcome.draw === false ? 'loss' : 'draw';
}

/** Normalize the engine's terminal result without discarding team victories. */
export function readTerminalOutcome(value: unknown): { winnerSeats: string[]; draw: boolean; scores?: Record<string, number> } {
    const result = value && typeof value === 'object'
        ? value as { winner?: unknown; winners?: unknown; draw?: unknown; scores?: unknown }
        : {};
    const rawWinners = Array.isArray(result.winners)
        ? result.winners
        : result.winner !== undefined ? [result.winner] : [];
    const winnerSeats = result.draw === true ? [] : Array.from(new Set(rawWinners
        .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number')
        .map(String)));
    const scores = result.scores && typeof result.scores === 'object' && !Array.isArray(result.scores)
        ? Object.fromEntries(Object.entries(result.scores)
            .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])))
        : undefined;
    return { winnerSeats, draw: result.draw === true || (winnerSeats.length === 0 && result.draw !== false), scores };
}
