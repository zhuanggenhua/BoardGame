import type { DomainCore, PlayerId, RandomFn } from '../../../engine/types';
import { validate } from './commands';
import { execute, reduce } from './reducer';
import { SPLENDOR_NOBLE_DEFS } from './data';
import { createPlayerState, drawOpenCards, getBankForPlayerCount, getNobleCountForPlayerCount, maskCoreForPlayer, shuffleArray, splitDecks } from './rules';
import type { SplendorCommand, SplendorCore, SplendorEvent } from './types';

type GameModeHost = { __BG_GAME_MODE__?: string };
type SplendorSetupData = { startingPlayerId?: string };

function getGameMode(): string | undefined {
    return typeof globalThis !== 'undefined'
        ? (globalThis as GameModeHost).__BG_GAME_MODE__
        : undefined;
}

export const SplendorDomain: DomainCore<SplendorCore, SplendorCommand, SplendorEvent> = {
    gameId: 'splendor',

    setup: (playerIds: PlayerId[], random: RandomFn, setupData?: unknown): SplendorCore => {
        const mode = getGameMode();
        const autoStarted = mode === 'local' || mode === 'tutorial';
        const configuredStartingPlayer = (setupData as SplendorSetupData | undefined)?.startingPlayerId;
        const startingPlayerId = (typeof configuredStartingPlayer === 'string' && playerIds.includes(configuredStartingPlayer as PlayerId))
            ? configuredStartingPlayer as PlayerId
            : playerIds[0];
        const decks = splitDecks(random);
        const tier1 = drawOpenCards(decks[1]);
        const tier2 = drawOpenCards(decks[2]);
        const tier3 = drawOpenCards(decks[3]);
        const nobleIds = shuffleArray(
            SPLENDOR_NOBLE_DEFS.map((noble) => noble.id),
            random,
        ).slice(0, getNobleCountForPlayerCount(playerIds.length));

        return {
            playerOrder: playerIds,
            hostPlayerId: playerIds[0],
            hostStarted: autoStarted,
            startingPlayerId,
            currentPlayer: startingPlayerId,
            round: 1,
            players: Object.fromEntries(playerIds.map((playerId) => [playerId, createPlayerState(playerId)])),
            bank: getBankForPlayerCount(playerIds.length),
            market: {
                1: tier1.open,
                2: tier2.open,
                3: tier3.open,
            },
            decks: {
                1: tier1.deck,
                2: tier2.deck,
                3: tier3.deck,
            },
            nobleIds,
            pendingResolution: undefined,
            endgame: {
                triggered: false,
            },
            gameResult: undefined,
            setupPlayerCount: playerIds.length,
        };
    },

    validate: (state, command) => validate(state.core, command),
    execute,
    reduce,
    playerView: (state, playerId) => maskCoreForPlayer(state, playerId),
    isGameOver: (state) => state.gameResult,
};

export type {
    CardTier,
    GemColor,
    TokenColor,
    SplendorCommand,
    SplendorCommandMap,
    SplendorCore,
    SplendorEvent,
    SplendorPendingResolution,
} from './types';
