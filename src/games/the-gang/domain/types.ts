import type { Command, GameEvent, GameOverResult, PlayerId } from '../../../engine/types';

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface PlayingCard {
    suit: Suit;
    rank: Rank;
}

export type TheGangRound = 1 | 2 | 3 | 4;
export type TheGangPhase = 'chip-selection' | 'showdown' | 'game-over';
export type HeistOutcome = 'success' | 'failure';

export interface RoundChipState {
    round: TheGangRound;
    chipsByPlayer: Record<PlayerId, number>;
}

export interface HandStrength {
    category: number;
    ranks: number[];
    label: string;
}

export interface ShowdownPlayerResult {
    playerId: PlayerId;
    chip: number;
    strength: HandStrength;
    bestCards: PlayingCard[];
}

export interface HeistRecord {
    heistNumber: number;
    outcome: HeistOutcome;
    results: ShowdownPlayerResult[];
}

export interface TheGangPlayerState {
    id: PlayerId;
    pocketCards: PlayingCard[];
}

export interface TheGangCore {
    playerIds: PlayerId[];
    players: Record<PlayerId, TheGangPlayerState>;
    deck: PlayingCard[];
    discardPile: PlayingCard[];
    communityCards: PlayingCard[];
    round: TheGangRound;
    phase: TheGangPhase;
    heistNumber: number;
    successes: number;
    failures: number;
    currentRoundChips: Record<PlayerId, number>;
    roundHistory: RoundChipState[];
    heistHistory: HeistRecord[];
    lastShowdown?: HeistRecord;
    gameResult?: GameOverResult;
}

export const THE_GANG_COMMANDS = {
    TAKE_CHIP: 'TAKE_CHIP',
    END_ROUND: 'END_ROUND',
    REVEAL_SHOWDOWN: 'REVEAL_SHOWDOWN',
    START_NEXT_HEIST: 'START_NEXT_HEIST',
} as const;

export interface TakeChipCommand extends Command<typeof THE_GANG_COMMANDS.TAKE_CHIP> {
    payload: { chip: number };
}

export interface EndRoundCommand extends Command<typeof THE_GANG_COMMANDS.END_ROUND> {
    payload: Record<string, never>;
}

export interface RevealShowdownCommand extends Command<typeof THE_GANG_COMMANDS.REVEAL_SHOWDOWN> {
    payload: Record<string, never>;
}

export interface StartNextHeistCommand extends Command<typeof THE_GANG_COMMANDS.START_NEXT_HEIST> {
    payload: Record<string, never>;
}

export type TheGangCommand =
    | TakeChipCommand
    | EndRoundCommand
    | RevealShowdownCommand
    | StartNextHeistCommand;

export type TheGangCommandMap = {
    [THE_GANG_COMMANDS.TAKE_CHIP]: { chip: number };
    [THE_GANG_COMMANDS.END_ROUND]: Record<string, never>;
    [THE_GANG_COMMANDS.REVEAL_SHOWDOWN]: Record<string, never>;
    [THE_GANG_COMMANDS.START_NEXT_HEIST]: Record<string, never>;
};

export const THE_GANG_EVENTS = {
    CHIP_TAKEN: 'CHIP_TAKEN',
    ROUND_ENDED: 'ROUND_ENDED',
    SHOWDOWN_REVEALED: 'SHOWDOWN_REVEALED',
    NEXT_HEIST_STARTED: 'NEXT_HEIST_STARTED',
    GAME_FINISHED: 'GAME_FINISHED',
} as const;

export interface ChipTakenEvent extends GameEvent<typeof THE_GANG_EVENTS.CHIP_TAKEN> {
    payload: {
        playerId: PlayerId;
        round: TheGangRound;
        chip: number;
    };
}

export interface RoundEndedEvent extends GameEvent<typeof THE_GANG_EVENTS.ROUND_ENDED> {
    payload: {
        round: TheGangRound;
        nextRound: TheGangRound;
        revealedCards: PlayingCard[];
    };
}

export interface ShowdownRevealedEvent extends GameEvent<typeof THE_GANG_EVENTS.SHOWDOWN_REVEALED> {
    payload: {
        record: HeistRecord;
        successes: number;
        failures: number;
    };
}

export interface NextHeistStartedEvent extends GameEvent<typeof THE_GANG_EVENTS.NEXT_HEIST_STARTED> {
    payload: {
        nextCore: TheGangCore;
    };
}

export interface GameFinishedEvent extends GameEvent<typeof THE_GANG_EVENTS.GAME_FINISHED> {
    payload: GameOverResult;
}

export type TheGangEvent =
    | ChipTakenEvent
    | RoundEndedEvent
    | ShowdownRevealedEvent
    | NextHeistStartedEvent
    | GameFinishedEvent;
