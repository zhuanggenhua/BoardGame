export const EXTERNAL_ROOM_CONNECT = 'boardgame:room-connect';
export const EXTERNAL_ROOM_VERSION = 1;
export const MAX_EXTERNAL_SIGNAL_LENGTH = 65_536;

export interface ExternalRoomPlayer {
    seatId: string;
    displayName: string;
    ready: boolean;
}

export interface ExternalRoomSnapshot {
    roomId: string;
    seatId: string;
    hostSeatId: string;
    players: ExternalRoomPlayer[];
}

export interface ExternalRoomSignal {
    id: string;
    fromSeatId: string;
    toSeatId: string;
    kind: 'offer' | 'answer';
    value: string;
}

export interface ExternalRoomView {
    room: ExternalRoomSnapshot;
    gameId: string;
    title: string;
    entry: string;
    capacity: number;
    started: boolean;
    signals: ExternalRoomSignal[];
}

export function externalRoomRosterKey(players: Pick<ExternalRoomPlayer, 'seatId'>[]) {
    return players.map(player => player.seatId).join(':');
}

export function externalRoomPlayerLimits(min?: number, max?: number) {
    const minimum = Math.max(2, Math.min(32, min ?? 2));
    return { min: minimum, max: Math.max(minimum, Math.min(32, max ?? minimum)) };
}
