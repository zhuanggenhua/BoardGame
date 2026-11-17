import type { Server as IOServer } from 'socket.io';
import {
    applyMatchPlayerView,
    broadcastProjectedMatchState,
    buildTransportMatchPlayers,
    stripStateForTraining,
    stripStateForTransport,
    type TransportStateProjectionMatch,
    type TransportStateProjectionOptions,
} from './stateProjection';

export type StateSyncSocket = {
    emit: (event: string, ...args: unknown[]) => void;
};

export class TransportStateSynchronizer {
    private readonly io: IOServer;

    constructor(io: IOServer) {
        this.io = io;
    }

    applyPlayerView(match: Pick<TransportStateProjectionMatch, 'engineConfig' | 'state'>, playerID: string | null): unknown {
        return applyMatchPlayerView(match, playerID);
    }

    stripForTransport(viewState: unknown, options?: TransportStateProjectionOptions): unknown {
        return stripStateForTransport(viewState, options);
    }

    stripForTraining(viewState: unknown): unknown {
        return stripStateForTraining(viewState);
    }

    buildPlayerState(match: Pick<TransportStateProjectionMatch, 'engineConfig' | 'state'>, playerID: string): unknown {
        return this.stripForTransport(this.applyPlayerView(match,playerID), { stripEventStream: true });
    }

    clearAllBaselines(match: Pick<TransportStateProjectionMatch, 'lastBroadcastedViews'>): void {
        match.lastBroadcastedViews.clear();
    }

    clearBaseline(match: Pick<TransportStateProjectionMatch, 'lastBroadcastedViews'>, playerID: string | null): void {
        match.lastBroadcastedViews.delete(playerID ?? 'spectator');
    }

    syncSocket(args: {
        socket: StateSyncSocket;
        match: TransportStateProjectionMatch;
        playerID: string | null;
    }): void {
        const viewState = this.stripForTransport(this.applyPlayerView(args.match, args.playerID));
        const matchPlayers = buildTransportMatchPlayers(args.match);
        const randomMeta = args.match.engineConfig.randomSeedVisibility === 'server-only' ? null : {
            seed: args.match.randomSeed,
            cursor: args.match.getRandomCursor(),
        };
        args.socket.emit('state:sync', args.match.matchID, viewState, matchPlayers, randomMeta, {
            stateID: args.match.stateID,
        });

        // stripForTransport already returns an independent snapshot for the patch baseline.
        args.match.lastBroadcastedViews.set(args.playerID ?? 'spectator', viewState);
    }

    broadcast(match: TransportStateProjectionMatch): void {
        broadcastProjectedMatchState({ io: this.io, match });
    }
}
