export const EXTERNAL_ROOM_CONNECT = 'boardgame:room-connect';
export const EXTERNAL_ROOM_VERSION = 1;
export const MAX_EXTERNAL_SIGNAL_LENGTH = 65_536;
export const EXTERNAL_NATIVE_ROOM_CONNECT = 'boardgame:game-room-connect';
export const EXTERNAL_ROOM_PASSWORD_REQUIRED = 'EXTERNAL_ROOM_PASSWORD_REQUIRED';

export interface ExternalRoomSetup {
    playerCounts: number[];
    fields: {
        id: string;
        label: string;
        defaultValue: string;
        options: { value: string; label: string }[];
    }[];
}

export type ExternalRoomSettings = Record<string, string>;

export interface ExternalRoomListing {
    roomId: string;
    hostName: string;
    roomName?: string;
    playerNames?: string[];
    occupied: number;
    capacity: number;
    isLocked?: boolean;
    native?: boolean;
}

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
    settings?: ExternalRoomSettings;
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
    native?: boolean;
    signals: ExternalRoomSignal[];
}

export function externalRoomRosterKey(players: Pick<ExternalRoomPlayer, 'seatId'>[]) {
    return players.map(player => player.seatId).join(':');
}

export function externalRoomPlayerLimits(min?: number, max?: number) {
    const minimum = Math.max(2, Math.min(32, min ?? 2));
    return { min: minimum, max: Math.max(minimum, Math.min(32, max ?? minimum)) };
}
