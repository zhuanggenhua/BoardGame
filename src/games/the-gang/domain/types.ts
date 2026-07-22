import type { Command, GameEvent, GameOverResult, PlayerId } from '../../../engine/types';

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type TheGangGameMode = 'texas-holdem' | 'seven-card-stud' | 'banana-split';
export type TheGangExitChipMode = 'default' | 'mastermind' | 'mega-mastermind' | 'ultra-mastermind';
export type TheGangChallengeId =
    | 'quick-access'
    | 'noise-sensor'
    | 'motion-detector'
    | 'retina-scan'
    | 'hasty-getaway'
    | 'ventilation-shaft'
    | 'laser-tripwires'
    | 'blackout'
    | 'fingerprint-scan'
    | 'security-camera'
    | 'the-joker'
    | 'uninvited-guest'
    | 'reverse-run'
    | 'master-key'
    | 'balance'
    | 'quick-execution'
    | 'lengthy-finish'
    | 'rough-kickoff'
    | 'quantum-chaos'
    | 'no-color'
    | 'all-out-attack'
    | 'sleeping-guard'
    | 'intricate-lock'
    | 'cluttered-toolbox'
    | 'foot-door'
    | 'extra-hours'
    | 'grinding-gears';
export type TheGangToolId =
    | 'airpods'
    | 'backdoor-key'
    | 'burner-phone'
    | 'crowbar'
    | 'flashlight'
    | 'jamming-device'
    | 'lock-pick'
    | 'lubricant'
    | 'night-vision-goggles'
    | 'smoke-grenade';
export type TheGangSpecialistId =
    | 'con-artist'
    | 'coordinator'
    | 'getaway-driver'
    | 'hacker'
    | 'information'
    | 'investor'
    | 'jack'
    | 'mastermind'
    | 'math-wiz'
    | 'muscle';
export type TheGangHandRankCode =
    | 'RF'
    | '5s'
    | 'SF'
    | 'FS'
    | '4s'
    | 'FH'
    | 'FL'
    | 'ST'
    | '3s'
    | 'FA'
    | '2p'
    | '1p'
    | 'HC';
export type Rank =
    | '2'
    | '3'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8'
    | '9'
    | '10'
    | 'J'
    | 'Q'
    | 'K'
    | 'A'
    | 'B'
    | 'C'
    | 'D'
    | 'Joker'
    | 'Wild'
    | 'Blank';

export interface PlayingCard {
    suit: Suit | 'gear' | 'special';
    rank: Rank;
    kind?: 'standard' | 'joker' | 'wild' | 'blank';
}

export type TheGangRound = 1 | 2 | 3 | 4;
export type TheGangPhase = 'chip-selection' | 'hand-swap' | 'showdown' | 'game-over';
export type HeistOutcome = 'success' | 'failure';
export type TheGangHandSlot = 'top' | 'bottom';

export interface RoundChipState {
    round: TheGangRound;
    chipsByPlayer: Record<string, number>;
    exitChipOwners?: string[];
}

export interface HandStrength {
    category: number;
    ranks: number[];
    label: string;
    code?: TheGangHandRankCode;
}

export interface ShowdownPlayerResult {
    playerId: PlayerId;
    handSlot?: TheGangHandSlot;
    chip: number;
    exited?: boolean;
    strength: HandStrength;
    pocketCards: PlayingCard[];
    secondaryPocketCards?: PlayingCard[];
    bestCards: PlayingCard[];
    winningHandSlot?: TheGangHandSlot;
}

export interface HeistRecord {
    heistNumber: number;
    outcome: HeistOutcome;
    results: ShowdownPlayerResult[];
}

export type TheGangProgressKind = 'end-round' | 'reveal-showdown' | 'hand-swap' | 'start-next-heist';
export type TheGangTutorialChipMode = 'lowest-unoccupied';

export interface TheGangProgressConfirmation {
    kind: TheGangProgressKind;
    approvals: PlayerId[];
}

export interface TheGangPlayerState {
    id: PlayerId;
    pocketCards: PlayingCard[];
    secondaryPocketCards?: PlayingCard[];
    communityCards?: PlayingCard[];
    toolCards: TheGangToolId[];
    specialistCards: TheGangSpecialistId[];
    activeTools: TheGangToolId[];
    flashlightCards: PlayingCard[];
    nightVisionCards: PlayingCard[];
}

export interface TheGangRulesConfig {
    gameMode: TheGangGameMode;
    exitChipMode: TheGangExitChipMode;
    omaha: boolean;
    twoHand: boolean;
    /** Compatibility mirror of twoHand. TTS has no separate hand-swap setup toggle. */
    handSwap: boolean;
    automode: boolean;
    antiTroll: boolean;
    challenges: Partial<Record<TheGangChallengeId, number>>;
    lockedHandRanks?: TheGangHandRankCode[];
}

export interface TheGangRulesRuntime {
    config: TheGangRulesConfig;
    blankedRank?: Rank;
}

export interface TheGangCore {
    playerIds: PlayerId[];
    players: Record<PlayerId, TheGangPlayerState>;
    rules: TheGangRulesRuntime;
    deck: PlayingCard[];
    discardPile: PlayingCard[];
    toolDeck: TheGangToolId[];
    toolDiscardPile: TheGangToolId[];
    specialistDeck: TheGangSpecialistId[];
    specialistDiscardPile: TheGangSpecialistId[];
    communityCards: PlayingCard[];
    round: TheGangRound;
    phase: TheGangPhase;
    heistStarted: boolean;
    heistNumber: number;
    successes: number;
    failures: number;
    currentRoundChips: Record<string, number>;
    currentRoundExitChipOwners: string[];
    pendingProgress?: TheGangProgressConfirmation;
    roundHistory: RoundChipState[];
    heistHistory: HeistRecord[];
    lastShowdown?: HeistRecord;
    gameResult?: GameOverResult;
}

export const THE_GANG_COMMANDS = {
    START_HEIST: 'START_HEIST',
    REDEAL_HEIST: 'REDEAL_HEIST',
    TAKE_CHIP: 'TAKE_CHIP',
    TAKE_EXIT_CHIP: 'TAKE_EXIT_CHIP',
    SET_RULES_CONFIG: 'SET_RULES_CONFIG',
    DEAL_TOOLS: 'DEAL_TOOLS',
    RESET_TOOLS: 'RESET_TOOLS',
    RESET_SPECIALISTS: 'RESET_SPECIALISTS',
    USE_TOOL: 'USE_TOOL',
    END_ROUND: 'END_ROUND',
    REVEAL_SHOWDOWN: 'REVEAL_SHOWDOWN',
    CONFIRM_HAND_SWAP: 'CONFIRM_HAND_SWAP',
    START_NEXT_HEIST: 'START_NEXT_HEIST',
} as const;

export interface StartHeistCommand extends Command<typeof THE_GANG_COMMANDS.START_HEIST> {
    payload: Record<string, never>;
}

export interface RedealHeistCommand extends Command<typeof THE_GANG_COMMANDS.REDEAL_HEIST> {
    payload: Record<string, never>;
}

export interface TakeChipCommand extends Command<typeof THE_GANG_COMMANDS.TAKE_CHIP> {
    payload: {
        chip: number;
        handSlot?: TheGangHandSlot;
        tutorialChipMode?: TheGangTutorialChipMode;
        tutorialOnlyIfMissing?: boolean;
    };
}

export interface TakeExitChipCommand extends Command<typeof THE_GANG_COMMANDS.TAKE_EXIT_CHIP> {
    payload: {
        handSlot?: TheGangHandSlot;
    };
}

export interface SetRulesConfigCommand extends Command<typeof THE_GANG_COMMANDS.SET_RULES_CONFIG> {
    payload: { config: Partial<TheGangRulesConfig> };
}

export interface DealToolsCommand extends Command<typeof THE_GANG_COMMANDS.DEAL_TOOLS> {
    payload: Record<string, never>;
}

export interface ResetToolsCommand extends Command<typeof THE_GANG_COMMANDS.RESET_TOOLS> {
    payload: Record<string, never>;
}

export interface ResetSpecialistsCommand extends Command<typeof THE_GANG_COMMANDS.RESET_SPECIALISTS> {
    payload: Record<string, never>;
}

export interface UseToolCommand extends Command<typeof THE_GANG_COMMANDS.USE_TOOL> {
    payload: {
        tool: TheGangToolId;
        cardIndex?: number;
    };
}

export interface EndRoundCommand extends Command<typeof THE_GANG_COMMANDS.END_ROUND> {
    payload: Record<string, never>;
}

export interface RevealShowdownCommand extends Command<typeof THE_GANG_COMMANDS.REVEAL_SHOWDOWN> {
    payload: Record<string, never>;
}

export interface ConfirmHandSwapCommand extends Command<typeof THE_GANG_COMMANDS.CONFIRM_HAND_SWAP> {
    payload: {
        topIndex?: number;
        bottomIndex?: number;
    };
}

export interface StartNextHeistCommand extends Command<typeof THE_GANG_COMMANDS.START_NEXT_HEIST> {
    payload: Record<string, never>;
}

export type TheGangCommand =
    | StartHeistCommand
    | RedealHeistCommand
    | TakeChipCommand
    | TakeExitChipCommand
    | SetRulesConfigCommand
    | DealToolsCommand
    | ResetToolsCommand
    | ResetSpecialistsCommand
    | UseToolCommand
    | EndRoundCommand
    | RevealShowdownCommand
    | ConfirmHandSwapCommand
    | StartNextHeistCommand;

export type TheGangCommandMap = {
    [THE_GANG_COMMANDS.START_HEIST]: Record<string, never>;
    [THE_GANG_COMMANDS.REDEAL_HEIST]: Record<string, never>;
    [THE_GANG_COMMANDS.TAKE_CHIP]: {
        chip: number;
        handSlot?: TheGangHandSlot;
        tutorialChipMode?: TheGangTutorialChipMode;
        tutorialOnlyIfMissing?: boolean;
    };
    [THE_GANG_COMMANDS.TAKE_EXIT_CHIP]: { handSlot?: TheGangHandSlot };
    [THE_GANG_COMMANDS.SET_RULES_CONFIG]: { config: Partial<TheGangRulesConfig> };
    [THE_GANG_COMMANDS.DEAL_TOOLS]: Record<string, never>;
    [THE_GANG_COMMANDS.RESET_TOOLS]: Record<string, never>;
    [THE_GANG_COMMANDS.RESET_SPECIALISTS]: Record<string, never>;
    [THE_GANG_COMMANDS.USE_TOOL]: { tool: TheGangToolId; cardIndex?: number };
    [THE_GANG_COMMANDS.END_ROUND]: Record<string, never>;
    [THE_GANG_COMMANDS.REVEAL_SHOWDOWN]: Record<string, never>;
    [THE_GANG_COMMANDS.CONFIRM_HAND_SWAP]: { topIndex?: number; bottomIndex?: number };
    [THE_GANG_COMMANDS.START_NEXT_HEIST]: Record<string, never>;
};

export const THE_GANG_EVENTS = {
    HEIST_STARTED: 'HEIST_STARTED',
    HEIST_REDEALT: 'HEIST_REDEALT',
    CHIP_TAKEN: 'CHIP_TAKEN',
    EXIT_CHIP_TAKEN: 'EXIT_CHIP_TAKEN',
    RULES_CONFIG_SET: 'RULES_CONFIG_SET',
    TOOLS_DEALT: 'TOOLS_DEALT',
    TOOLS_RESET: 'TOOLS_RESET',
    SPECIALISTS_RESET: 'SPECIALISTS_RESET',
    TOOL_USED: 'TOOL_USED',
    PROGRESS_APPROVED: 'PROGRESS_APPROVED',
    HAND_SWAP_STARTED: 'HAND_SWAP_STARTED',
    HAND_SWAP_CONFIRMED: 'HAND_SWAP_CONFIRMED',
    ROUND_ENDED: 'ROUND_ENDED',
    SHOWDOWN_REVEALED: 'SHOWDOWN_REVEALED',
    NEXT_HEIST_STARTED: 'NEXT_HEIST_STARTED',
    GAME_FINISHED: 'GAME_FINISHED',
} as const;

export interface HeistStartedEvent extends GameEvent<typeof THE_GANG_EVENTS.HEIST_STARTED> {
    payload: {
        playerId: PlayerId;
        heistNumber: number;
    };
}

export interface HeistRedealtEvent extends GameEvent<typeof THE_GANG_EVENTS.HEIST_REDEALT> {
    payload: {
        nextCore: TheGangCore;
    };
}

export interface ChipTakenEvent extends GameEvent<typeof THE_GANG_EVENTS.CHIP_TAKEN> {
    payload: {
        playerId: PlayerId;
        ownerKey: string;
        handSlot?: TheGangHandSlot;
        round: TheGangRound;
        chip: number;
    };
}

export interface ExitChipTakenEvent extends GameEvent<typeof THE_GANG_EVENTS.EXIT_CHIP_TAKEN> {
    payload: {
        playerId: PlayerId;
        ownerKey: string;
        handSlot?: TheGangHandSlot;
        round: TheGangRound;
    };
}

export interface RulesConfigSetEvent extends GameEvent<typeof THE_GANG_EVENTS.RULES_CONFIG_SET> {
    payload: {
        nextCore: TheGangCore;
    };
}

export interface ToolsDealtEvent extends GameEvent<typeof THE_GANG_EVENTS.TOOLS_DEALT> {
    payload: {
        dealtTools: Record<PlayerId, TheGangToolId>;
        remainingToolDeck: TheGangToolId[];
    };
}

export interface ToolsResetEvent extends GameEvent<typeof THE_GANG_EVENTS.TOOLS_RESET> {
    payload: {
        toolDeck: TheGangToolId[];
    };
}

export interface SpecialistsResetEvent extends GameEvent<typeof THE_GANG_EVENTS.SPECIALISTS_RESET> {
    payload: {
        specialistDeck: TheGangSpecialistId[];
    };
}

export interface ToolUsedEvent extends GameEvent<typeof THE_GANG_EVENTS.TOOL_USED> {
    payload: {
        playerId: PlayerId;
        tool: TheGangToolId;
        remainingDeck?: PlayingCard[];
        discardPile?: PlayingCard[];
        drawnCard?: PlayingCard;
        remainingSpecialistDeck?: TheGangSpecialistId[];
        specialistCards?: TheGangSpecialistId[];
        movedCardIndex?: number;
    };
}

export interface ProgressApprovedEvent extends GameEvent<typeof THE_GANG_EVENTS.PROGRESS_APPROVED> {
    payload: TheGangProgressConfirmation;
}

export interface HandSwapStartedEvent extends GameEvent<typeof THE_GANG_EVENTS.HAND_SWAP_STARTED> {
    payload: {
        round: TheGangRound;
    };
}

export interface HandSwapConfirmedEvent extends GameEvent<typeof THE_GANG_EVENTS.HAND_SWAP_CONFIRMED> {
    payload: {
        playerId: PlayerId;
        approvals: PlayerId[];
        topIndex?: number;
        bottomIndex?: number;
    };
}

export interface RoundEndedEvent extends GameEvent<typeof THE_GANG_EVENTS.ROUND_ENDED> {
    payload: {
        round: TheGangRound;
        nextRound: TheGangRound;
        revealedCards: PlayingCard[];
        playerRevealedCards?: Record<PlayerId, PlayingCard[]>;
        playerDrawnCards?: Record<PlayerId, PlayingCard[]>;
        playerDrawnSecondaryCards?: Record<PlayerId, PlayingCard[]>;
        cardsConsumed?: number;
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
    | HeistStartedEvent
    | HeistRedealtEvent
    | ChipTakenEvent
    | ExitChipTakenEvent
    | RulesConfigSetEvent
    | ToolsDealtEvent
    | ToolsResetEvent
    | SpecialistsResetEvent
    | ToolUsedEvent
    | ProgressApprovedEvent
    | HandSwapStartedEvent
    | HandSwapConfirmedEvent
    | RoundEndedEvent
    | ShowdownRevealedEvent
    | NextHeistStartedEvent
    | GameFinishedEvent;
