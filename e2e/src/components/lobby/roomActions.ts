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

type CreateRoomErrorLike = {
    message?: unknown;
    details?: unknown;
    status?: unknown;
    code?: unknown;
};

const normalizeCreateRoomErrorText = (error: unknown) => {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const details = (error as CreateRoomErrorLike | null)?.details;
    const detailText = typeof details === 'string'
        ? details
        : details
            ? JSON.stringify(details)
            : '';
    return {
        rawMessage,
        detailText,
        combined: `${rawMessage} ${detailText}`.toLowerCase(),
    };
};

export const resolveCreateRoomErrorCode = (error: unknown): string => {
    const code = (error as CreateRoomErrorLike | null)?.code;
    if (typeof code === 'string' && code.trim()) return code.trim();

    const { rawMessage, detailText, combined } = normalizeCreateRoomErrorText(error);
    const source = `${rawMessage} ${detailText}`;
    const jsonMatch = source.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]) as { error?: unknown; code?: unknown };
            if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error.trim();
            if (typeof parsed.code === 'string' && parsed.code.trim()) return parsed.code.trim();
        } catch {
            // ignore
        }
    }

    const statusMatch = combined.match(/(?:^|\s)(\d{3})(?:\s*:|\s|$)/);
    if (combined.includes('invalid token')) return 'INVALID_TOKEN';
    if (combined.includes('guestid is required')) return 'GUEST_ID_REQUIRED';
    if (combined.includes('failed to setup match')) return 'FAILED_TO_SETUP_MATCH';
    if (combined.includes('failed to fetch') || combined.includes('networkerror')) return 'NETWORK_ERROR';
    if (combined.includes('cors') || combined.includes('access-control-allow-origin')) return 'CORS_BLOCKED';
    if (combined.includes('request size did not match content length')) return 'REQUEST_SIZE_MISMATCH';
    if (statusMatch?.[1]) return `HTTP_${statusMatch[1]}`;
    return 'UNKNOWN_CREATE_ROOM_ERROR';
};

export const resolveCreateRoomErrorStatus = (error: unknown): number | null => {
    const status = (error as CreateRoomErrorLike | null)?.status;
    if (typeof status === 'number' && Number.isFinite(status)) return status;

    const { combined } = normalizeCreateRoomErrorText(error);
    const statusMatch = combined.match(/(?:^|\s)(\d{3})(?:\s*:|\s|$)/);
    return statusMatch ? Number(statusMatch[1]) : null;
};

export const buildCreateRoomErrorTip = (error: unknown): { messageKey: string } | null => {
    const { combined } = normalizeCreateRoomErrorText(error);

    if (combined.includes('failed to fetch') || combined.includes('networkerror')) {
        return { messageKey: 'error.createRoomNetwork' };
    }
    if (combined.includes('access-control-allow-origin') || combined.includes('cors')) {
        return { messageKey: 'error.createRoomCors' };
    }
    if (combined.includes('http status 401') || combined.includes('invalid token') || combined.includes('401:')) {
        return { messageKey: 'error.createRoomInvalidToken' };
    }
    if (combined.includes('guestid is required')) {
        return { messageKey: 'error.createRoomGuestId' };
    }
    if (combined.includes('http status 403') || combined.includes('403:')) {
        return { messageKey: 'error.createRoomForbidden' };
    }
    if (combined.includes('http status 404') || combined.includes('404:')) {
        return { messageKey: 'error.createRoomNotFound' };
    }
    if (combined.includes('request size did not match content length')) {
        return { messageKey: 'error.createRoomRequestSize' };
    }
    return null;
};
