import type { Command, GameEvent, GameOverResult, PlayerId } from '../../../engine/types';

export type GemColor = 'white' | 'blue' | 'green' | 'red' | 'black';
export type TokenColor = GemColor | 'gold';
export type CardTier = 1 | 2 | 3;

export interface SplendorCardDef {
    id: string;
    name: string;
    tier: CardTier;
    points: number;
    bonus: GemColor;
    cost: Record<GemColor, number>;
}

export interface SplendorNobleDef {
    id: string;
    name: string;
    points: 3;
    requirement: Record<GemColor, number>;
}

export interface SplendorPlayerState {
    id: PlayerId;
    tokens: Record<TokenColor, number>;
    reservedCardIds: string[];
    purchasedCardIds: string[];
    nobleIds: string[];
    points: number;
}

export type SplendorPendingResolution =
    | { type: 'discardToLimit'; excess: number }
    | { type: 'chooseNoble'; nobleIds: string[] };

export interface SplendorEndgameState {
    triggered: boolean;
    triggerRound?: number;
    triggeredByPlayerId?: PlayerId;
}

export interface SplendorCore {
    playerOrder: PlayerId[];
    hostPlayerId: PlayerId;
    hostStarted: boolean;
    startingPlayerId: PlayerId;
    currentPlayer: PlayerId;
    round: number;
    players: Record<PlayerId, SplendorPlayerState>;
    bank: Record<TokenColor, number>;
    market: Record<CardTier, string[]>;
    decks: Record<CardTier, string[]>;
    nobleIds: string[];
    pendingResolution?: SplendorPendingResolution;
    endgame: SplendorEndgameState;
    gameResult?: GameOverResult;
    setupPlayerCount: number;
}

export const SPLENDOR_COMMANDS = {
    HOST_START_GAME: 'HOST_START_GAME',
    TAKE_THREE_DIFFERENT_GEMS: 'TAKE_THREE_DIFFERENT_GEMS',
    TAKE_TWO_SAME_GEMS: 'TAKE_TWO_SAME_GEMS',
    RESERVE_OPEN_CARD: 'RESERVE_OPEN_CARD',
    RESERVE_DECK_TOP_CARD: 'RESERVE_DECK_TOP_CARD',
    BUY_OPEN_CARD: 'BUY_OPEN_CARD',
    BUY_RESERVED_CARD: 'BUY_RESERVED_CARD',
    DISCARD_GEMS_TO_LIMIT: 'DISCARD_GEMS_TO_LIMIT',
    CHOOSE_NOBLE: 'CHOOSE_NOBLE',
    PASS_TURN: 'PASS_TURN',
} as const;

export type HostStartGameCommand = Command<typeof SPLENDOR_COMMANDS.HOST_START_GAME, Record<string, never>>;

export type TakeThreeDifferentGemsCommand = Command<typeof SPLENDOR_COMMANDS.TAKE_THREE_DIFFERENT_GEMS, {
    colors: GemColor[];
}>;

export type TakeTwoSameGemsCommand = Command<typeof SPLENDOR_COMMANDS.TAKE_TWO_SAME_GEMS, {
    color: GemColor;
}>;

export type ReserveOpenCardCommand = Command<typeof SPLENDOR_COMMANDS.RESERVE_OPEN_CARD, {
    tier: CardTier;
    cardId: string;
}>;

export type ReserveDeckTopCardCommand = Command<typeof SPLENDOR_COMMANDS.RESERVE_DECK_TOP_CARD, {
    tier: CardTier;
}>;

export type BuyOpenCardCommand = Command<typeof SPLENDOR_COMMANDS.BUY_OPEN_CARD, {
    tier: CardTier;
    cardId: string;
}>;

export type BuyReservedCardCommand = Command<typeof SPLENDOR_COMMANDS.BUY_RESERVED_CARD, {
    cardId: string;
}>;

export type DiscardGemsToLimitCommand = Command<typeof SPLENDOR_COMMANDS.DISCARD_GEMS_TO_LIMIT, {
    color: TokenColor;
}>;

export type ChooseNobleCommand = Command<typeof SPLENDOR_COMMANDS.CHOOSE_NOBLE, {
    nobleId: string;
}>;

export type PassTurnCommand = Command<typeof SPLENDOR_COMMANDS.PASS_TURN, Record<string, never>>;

export type SplendorCommand =
    | HostStartGameCommand
    | TakeThreeDifferentGemsCommand
    | TakeTwoSameGemsCommand
    | ReserveOpenCardCommand
    | ReserveDeckTopCardCommand
    | BuyOpenCardCommand
    | BuyReservedCardCommand
    | DiscardGemsToLimitCommand
    | ChooseNobleCommand
    | PassTurnCommand;

export const SPLENDOR_EVENTS = {
    HOST_STARTED: 'HOST_STARTED',
    TOKENS_GAINED: 'TOKENS_GAINED',
    TOKENS_SPENT: 'TOKENS_SPENT',
    TOKENS_DISCARDED: 'TOKENS_DISCARDED',
    CARD_RESERVED: 'CARD_RESERVED',
    CARD_PURCHASED: 'CARD_PURCHASED',
    MARKET_CARD_REMOVED: 'MARKET_CARD_REMOVED',
    MARKET_CARD_REFILLED: 'MARKET_CARD_REFILLED',
    RESERVED_CARD_REMOVED: 'RESERVED_CARD_REMOVED',
    NOBLE_GAINED: 'NOBLE_GAINED',
    PENDING_RESOLUTION_SET: 'PENDING_RESOLUTION_SET',
    PENDING_RESOLUTION_CLEARED: 'PENDING_RESOLUTION_CLEARED',
    TURN_ADVANCED: 'TURN_ADVANCED',
    ENDGAME_TRIGGERED: 'ENDGAME_TRIGGERED',
    GAME_ENDED: 'GAME_ENDED',
} as const;

export type SplendorEvent =
    | GameEvent<typeof SPLENDOR_EVENTS.HOST_STARTED, { playerId: PlayerId }>
    | GameEvent<typeof SPLENDOR_EVENTS.TOKENS_GAINED, { playerId: PlayerId; tokens: Partial<Record<TokenColor, number>> }>
    | GameEvent<typeof SPLENDOR_EVENTS.TOKENS_SPENT, { playerId: PlayerId; tokens: Partial<Record<TokenColor, number>> }>
    | GameEvent<typeof SPLENDOR_EVENTS.TOKENS_DISCARDED, { playerId: PlayerId; color: TokenColor; count: number }>
    | GameEvent<typeof SPLENDOR_EVENTS.CARD_RESERVED, { playerId: PlayerId; tier: CardTier; cardId: string; source: 'open' | 'deck' }>
    | GameEvent<typeof SPLENDOR_EVENTS.CARD_PURCHASED, { playerId: PlayerId; cardId: string; source: 'open' | 'reserved' }>
    | GameEvent<typeof SPLENDOR_EVENTS.MARKET_CARD_REMOVED, { tier: CardTier; cardId: string }>
    | GameEvent<typeof SPLENDOR_EVENTS.MARKET_CARD_REFILLED, { tier: CardTier }>
    | GameEvent<typeof SPLENDOR_EVENTS.RESERVED_CARD_REMOVED, { playerId: PlayerId; cardId: string }>
    | GameEvent<typeof SPLENDOR_EVENTS.NOBLE_GAINED, { playerId: PlayerId; nobleId: string }>
    | GameEvent<typeof SPLENDOR_EVENTS.PENDING_RESOLUTION_SET, { pending: SplendorPendingResolution }>
    | GameEvent<typeof SPLENDOR_EVENTS.PENDING_RESOLUTION_CLEARED, Record<string, never>>
    | GameEvent<typeof SPLENDOR_EVENTS.TURN_ADVANCED, { nextPlayerId: PlayerId; round: number }>
    | GameEvent<typeof SPLENDOR_EVENTS.ENDGAME_TRIGGERED, { triggeredByPlayerId: PlayerId; triggerRound: number }>
    | GameEvent<typeof SPLENDOR_EVENTS.GAME_ENDED, GameOverResult>;

export type SplendorCommandMap = Record<string, unknown> & {
    HOST_START_GAME: Record<string, never>;
    TAKE_THREE_DIFFERENT_GEMS: { colors: GemColor[] };
    TAKE_TWO_SAME_GEMS: { color: GemColor };
    RESERVE_OPEN_CARD: { tier: CardTier; cardId: string };
    RESERVE_DECK_TOP_CARD: { tier: CardTier };
    BUY_OPEN_CARD: { tier: CardTier; cardId: string };
    BUY_RESERVED_CARD: { cardId: string };
    DISCARD_GEMS_TO_LIMIT: { color: TokenColor };
    CHOOSE_NOBLE: { nobleId: string };
    PASS_TURN: Record<string, never>;
};
