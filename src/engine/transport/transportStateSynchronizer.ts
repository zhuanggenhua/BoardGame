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
    constructor(private readonly io: IOServer) {}

    applyPlayerView(match: Pick<TransportStateProjectionMatch, 'engineConfig' | 'state'>, playerID: string | null): unknown {
        return applyMatchPlayerView(match, playerID);
    }

    stripForTransport(viewState: unknown, options?: TransportStateProjectionOptions): unknown {
        return stripStateForTransport(viewState, options);
    }

    stripForTraining(viewState: unknown): unknown {
        return stripStateForTraining(viewState);
    }

    buildAuthoritativeState(match: Pick<TransportStateProjectionMatch, 'state'>): unknown {
        return this.stripForTransport(match.state, { stripEventStream: true });
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
        args.socket.emit('state:sync', args.match.matchID, viewState, matchPlayers, {
            seed: args.match.randomSeed,
            cursor: args.match.getRandomCursor(),
        }, {
            stateID: args.match.stateID,
        });

        args.match.lastBroadcastedViews.set(args.playerID ?? 'spectator', JSON.parse(JSON.stringify(viewState)));
    }

    broadcast(match: TransportStateProjectionMatch): void {
        broadcastProjectedMatchState({ io: this.io, match });
    }
}
