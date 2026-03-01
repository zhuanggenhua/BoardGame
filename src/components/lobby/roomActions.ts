/**
 * 房间操作相关的纯工具函数和共享类型
 * 从 GameDetailsModal 中提取，供子模块复用
 */

import type { StoredMatchCredentials, OwnerActiveMatch } from '../../hooks/match/useMatchStatus';

// ============================================================================
// 类型
// ============================================================================

export interface RoomPlayer {
    id: number;
    name?: string;
    isConnected?: boolean;
}

export interface Room {
    matchID: string;
    players: RoomPlayer[];
    totalSeats?: number;
    gameName?: string;
    roomName?: string;
    ownerKey?: string;
    ownerType?: 'user' | 'guest';
    isLocked?: boolean;
}

/** 带有计算属性的房间项（房间列表渲染用） */
export interface RoomItem extends Room {
    isFull: boolean;
    isEmptyRoom: boolean;
    playerCount: number;
    totalSeats: number;
    isMyRoom: boolean;
    isOwnerRoom: boolean;
    canReconnect: boolean;
    myPlayerID: string | null;
    myCredentials: string | null;
    isHost: boolean;
    gameKey: string;
}

/** 活跃对局信息 */
export interface ActiveMatchInfo {
    matchID: string;
    gameName: string;
    canReconnect: boolean;
    myPlayerID: string | null;
    myCredentials: string | null;
    isHost: boolean;
}

// ============================================================================
// 工具函数
// ============================================================================

export const normalizeGameName = (name?: string) => (name || '').toLowerCase();

export const shouldPromptExitActiveMatch = (activeMatchID: string | null, targetMatchID: string) => (
    !!activeMatchID && activeMatchID !== targetMatchID
);

export const resolveActiveMatchExitPayload = (
    activeMatchID: string | null,
    storedActive: StoredMatchCredentials | null,
    ownerActive: OwnerActiveMatch | null,
    fallbackGameName: string
): { gameName: string; playerID: string; credentials: string } | null => {
    if (!activeMatchID) return null;
    const playerID = storedActive?.playerID;
    const credentials = storedActive?.credentials;
    if (!playerID || !credentials) return null;

    const activeGameName = normalizeGameName(storedActive?.gameName || ownerActive?.gameName)
        || fallbackGameName
        || 'tictactoe';

    return { gameName: activeGameName, playerID, credentials };
};

export const buildCreateRoomErrorTip = (error: unknown): { messageKey: string } | null => {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const details = (error as { details?: unknown } | null)?.details;
    const detailText = typeof details === 'string'
        ? details
        : details
            ? JSON.stringify(details)
            : '';
    const combined = `${rawMessage} ${detailText}`.toLowerCase();

    if (combined.includes('failed to fetch') || combined.includes('networkerror')) {
        return { messageKey: 'error.createRoomNetwork' };
    }
    if (combined.includes('access-control-allow-origin') || combined.includes('cors')) {
        return { messageKey: 'error.createRoomCors' };
    }
    if (combined.includes('http status 401') || combined.includes('invalid token')) {
        return { messageKey: 'error.createRoomInvalidToken' };
    }
    if (combined.includes('guestid is required')) {
        return { messageKey: 'error.createRoomGuestId' };
    }
    if (combined.includes('http status 403')) {
        return { messageKey: 'error.createRoomForbidden' };
    }
    if (combined.includes('http status 404')) {
        return { messageKey: 'error.createRoomNotFound' };
    }
    if (combined.includes('request size did not match content length')) {
        return { messageKey: 'error.createRoomRequestSize' };
    }
    return null;
};
