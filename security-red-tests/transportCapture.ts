import type { Server as IOServer } from 'socket.io';
import type { MatchState } from '../src/engine/types';
import type { GameEngineConfig } from '../src/engine/transport/engineConfig';
import {
    broadcastProjectedMatchState,
    type TransportStateProjectionMatch,
} from '../src/engine/transport/stateProjection';
import { createMatchSetupState } from '../src/engine/transport/matchSetupStateFactory';
import { TransportStateSynchronizer } from '../src/engine/transport/transportStateSynchronizer';
import { engineConfig, type BetrayalCore } from '../src/games/betrayal/game';

export const SYNTHETIC_PLAYER_IDS = ['0', '1', '2'];
export const NON_ACTING_PLAYER_ID = '1';
export const SYNTHETIC_CREDENTIAL = 'security-test-only-seat-credential';

export type CapturedState = {
    event: string;
    state: MatchState<BetrayalCore>;
    players: unknown;
    randomMeta?: { seed?: string; cursor?: number };
};

// Only the external socket boundary is replaced. All production projection,
// serialization, broadcast, sync, and game code executes from this copy.
export function createSyntheticMatch(): TransportStateProjectionMatch {
    const seed = 'security-test-only-fixed-random-source';
    const setup = createMatchSetupState({
        matchID: 'security-test-only-match',
        engineConfig: engineConfig as unknown as GameEngineConfig,
        playerIds: SYNTHETIC_PLAYER_IDS,
        seed,
    });
    return {
        matchID: 'security-test-only-match',
        engineConfig: engineConfig as unknown as GameEngineConfig,
        state: setup.state,
        metadata: {
            gameName: 'betrayal',
            players: Object.fromEntries(SYNTHETIC_PLAYER_IDS.map((id) => [id, {
                name: `Synthetic player ${id}`,
                credentials: SYNTHETIC_CREDENTIAL,
                isConnected: true,
            }])),
            createdAt: 0,
            updatedAt: 0,
        },
        stateID: 1,
        randomSeed: seed,
        getRandomCursor: () => setup.randomCursor,
        connections: new Map([[NON_ACTING_PLAYER_ID, new Set(['synthetic-socket'])]]),
        spectatorSockets: new Set(),
        lastBroadcastedViews: new Map(),
        lastCommandPlayerId: null,
    };
}

export function captureFreshBroadcast(match: TransportStateProjectionMatch): CapturedState {
    const calls: CapturedState[] = [];
    const io = {
        of: () => ({
            to: () => ({
                emit: (event: string, _id: string, state: MatchState<BetrayalCore>, players: unknown) => {
                    calls.push({ event, state, players });
                },
            }),
        }),
    } as unknown as IOServer;
    match.lastBroadcastedViews.clear();
    broadcastProjectedMatchState({ io, match });
    if (calls.length !== 1 || calls[0]?.event !== 'state:update') {
        throw new Error('Expected one complete ordinary-player state:update at the real socket boundary.');
    }
    return calls[0];
}

export function captureFreshSync(match: TransportStateProjectionMatch): CapturedState {
    const calls: CapturedState[] = [];
    new TransportStateSynchronizer({} as IOServer).syncSocket({
        match,
        playerID: NON_ACTING_PLAYER_ID,
        socket: {
            emit: (event, ...args) => {
                calls.push({
                    event,
                    state: args[1] as MatchState<BetrayalCore>,
                    players: args[2],
                    randomMeta: args[3] as CapturedState['randomMeta'],
                });
            },
        },
    });
    if (calls.length !== 1 || calls[0]?.event !== 'state:sync') {
        throw new Error('Expected one ordinary-player state:sync at the real socket boundary.');
    }
    return calls[0];
}
