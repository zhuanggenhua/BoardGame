/**
 * 房间操作相关的纯工具函数和共享类型
 * 从 GameDetailsModal 中提取，供子模块复用
 */

import type { StoredMatchCredentials, OwnerActiveMatch, ExitMatchResult } from '../../hooks/match/useMatchStatus';
import type {
    GameManifestEntry,
    GameManifestTranslationLabel,
    GameSetupSelectOption,
} from '../../shared/gameManifest.types';

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
    publicSetupSummary?: {
        enabledExpansions?: string[];
        scenarioId?: string;
    };
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

export type RoomLabelTranslator = (key: string, options?: Record<string, unknown>) => string;
type RoomSetupSummaryManifest = Pick<GameManifestEntry, 'id' | 'setupOptions' | 'publicRoomSetupSummary'>;

// ============================================================================
// 工具函数
// ============================================================================

export const normalizeGameName = (name?: string) => (name || '').toLowerCase();

const normalizeGameScopedLabelKey = (gameId: string, labelKey: string) => {
    const gamePrefix = `games.${gameId}.`;
    return labelKey.startsWith(gamePrefix)
        ? labelKey.slice(gamePrefix.length)
        : labelKey;
};

const resolveManifestLabel = (
    t: RoomLabelTranslator,
    gameManifest: RoomSetupSummaryManifest,
    label: GameManifestTranslationLabel,
    fallbackValue: string,
) => t(
    label.namespace ? label.labelKey : normalizeGameScopedLabelKey(gameManifest.id, label.labelKey),
    {
        ns: label.namespace ?? `game-${gameManifest.id}`,
        defaultValue: label.defaultValue ?? fallbackValue,
    },
);

const getSetupFieldOptions = (field: NonNullable<GameManifestEntry['setupOptions']>[string]): GameSetupSelectOption[] => {
    if (field.type === 'multi-select') {
        return field.options;
    }

    return [
        ...(field.options ?? []),
        ...Object.values(field.optionsByPlayerCount ?? {}).flatMap((options) => options ?? []),
    ];
};

const findSetupOptionLabel = (
    gameManifest: RoomSetupSummaryManifest | undefined,
    optionValue: string,
): GameManifestTranslationLabel | null => {
    for (const field of Object.values(gameManifest?.setupOptions ?? {})) {
        const option = getSetupFieldOptions(field).find((candidate) => candidate.value === optionValue);
        if (option) {
            return { labelKey: option.labelKey };
        }
    }
    return null;
};

export const resolveRoomExpansionLabel = (
    t: RoomLabelTranslator,
    _gameName: string | undefined,
    expansionId: string,
    gameManifest?: RoomSetupSummaryManifest,
): string => {
    const label = gameManifest?.publicRoomSetupSummary?.enabledExpansions?.[expansionId]
        ?? findSetupOptionLabel(gameManifest, expansionId);
    return label ? resolveManifestLabel(t, gameManifest!, label, expansionId) : expansionId;
};

export const resolveRoomScenarioLabel = (
    t: RoomLabelTranslator,
    _gameName: string | undefined,
    scenarioId: string,
    gameManifest?: RoomSetupSummaryManifest,
): string => {
    const label = gameManifest?.publicRoomSetupSummary?.scenario?.options?.[scenarioId]
        ?? findSetupOptionLabel(gameManifest, scenarioId);
    return label ? resolveManifestLabel(t, gameManifest!, label, scenarioId) : scenarioId;
};

export const resolveRoomScenarioPendingLabel = (
    t: RoomLabelTranslator,
    gameManifest?: RoomSetupSummaryManifest,
): string => {
    const label = gameManifest?.publicRoomSetupSummary?.scenario?.pendingLabel;
    return label && gameManifest
        ? resolveManifestLabel(t, gameManifest, label, label.defaultValue ?? '')
        : '';
};

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

export const resolveExitMatchErrorMessageKey = (
    error: ExitMatchResult['error'],
    isHost: boolean
): string => {
    if (error === 'forbidden') {
        return isHost ? 'error.destroyForbidden' : 'error.leaveForbidden';
    }
    if (error === 'network' || error === 'server_error') {
        return isHost ? 'error.destroyNetwork' : 'error.leaveNetwork';
    }
    return 'error.actionFailed';
};

type ExitMatchToastError = (payload: { kind: 'i18n'; key: string; ns: 'lobby' }) => void;

export const notifyExitMatchErrorToast = (
    toastError: ExitMatchToastError,
    error: ExitMatchResult['error'],
    isHost: boolean
): void => {
    if (error === 'forbidden') {
        if (isHost) {
            toastError({ kind: 'i18n', key: 'error.destroyForbidden', ns: 'lobby' });
        } else {
            toastError({ kind: 'i18n', key: 'error.leaveForbidden', ns: 'lobby' });
        }
        return;
    }
    if (error === 'network' || error === 'server_error') {
        if (isHost) {
            toastError({ kind: 'i18n', key: 'error.destroyNetwork', ns: 'lobby' });
        } else {
            toastError({ kind: 'i18n', key: 'error.leaveNetwork', ns: 'lobby' });
        }
        return;
    }
    toastError({ kind: 'i18n', key: 'error.actionFailed', ns: 'lobby' });
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
