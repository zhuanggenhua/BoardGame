import { getAiSeatIds } from '../ai';
import { createInitialSystemState } from '../pipeline';
import type { EngineSystem } from '../systems/types';
import { setUndoAiSeatIds } from '../systems/UndoSystem';
import type { MatchState, PlayerId } from '../types';
import type { GameEngineConfig } from './engineConfig';
import { createTrackedRandom } from './trackedRandom';
import { extractTrustedSetupSeatControllers } from './onlineAiSeatControllers';
import { resolveSetupPlayerIds } from './setupPlayerOrder';

export type MatchSetupStateArgs = {
    matchID: string;
    engineConfig: GameEngineConfig;
    playerIds: PlayerId[];
    seed: string;
    setupData?: unknown;
};

export type MatchSetupStateResult = {
    state: MatchState<unknown>;
    randomCursor: number;
};

/**
 * Builds the initial authoritative match state from a game config and setup data.
 *
 * The transport server owns when setup is requested; this module owns how setup
 * player order, seeded randomness, systems state, and AI undo seats are composed.
 */
export function createMatchSetupState(args: MatchSetupStateArgs): MatchSetupStateResult {
    const setupSeatControllers = extractTrustedSetupSeatControllers(args.setupData);
    const setupPlayerIds = resolveSetupPlayerIds({
        playerIds: args.playerIds,
        setupData: args.setupData,
        seatControllers: setupSeatControllers,
    });
    const trackedRandom = createTrackedRandom(args.seed, 0);
    const core = args.engineConfig.domain.setup(
        setupPlayerIds,
        trackedRandom.random,
        args.setupData,
    );
    const sys = createInitialSystemState(
        setupPlayerIds,
        args.engineConfig.systems as EngineSystem[],
        args.matchID,
    );
    const state = setUndoAiSeatIds(
        { sys, core },
        getAiSeatIds(setupSeatControllers),
    );
    return {
        state,
        randomCursor: trackedRandom.getCursor(),
    };
}
