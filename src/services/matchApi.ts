/**
 * 房间管理 REST API 封装
 *
 * 直接调用服务端 REST 路由。
 * 路由结构：/games/:name/:matchID/...
 */

import type { RematchRecoveryRequest, RecoveredRematch } from '../shared/rematchRecovery';
import { getGameServerUrl } from '../config/server';

// ============================================================================
// 类型定义
// ============================================================================

export interface MatchPlayer {
    id: number;
    name?: string;
    isConnected?: boolean;
}

export interface MatchInfo {
    matchID: string;
    gameName: string;
    players: MatchPlayer[];
    setupData?: unknown;
    createdAt?: number;
    updatedAt?: number;
    gameover?: unknown;
}

export interface CreateMatchOptions {
    numPlayers: number;
    setupData?: Record<string, unknown>;
    playerName?: string;
    previousOwnerCredentials?: string;
    forceReplaceOwnerRoom?: boolean;
}

export interface CreateMatchResult {
    matchID: string;
    ownerPlayerID?: string;
    ownerCredentials?: string;
    ownerType?: 'user' | 'guest';
    ownerKey?: string;
}

export interface JoinMatchOptions {
    playerID?: string;
    playerName?: string;
    data?: Record<string, unknown>;
}

export interface JoinMatchResult {
    playerCredentials: string;
    playerID?: string;
}

export interface LeaveMatchOptions {
    playerID: string;
    credentials: string;
}

// ============================================================================
// 内部工具
// ============================================================================

const baseUrl = (): string => getGameServerUrl() || '';

type ApiRequestOptions = {
    expectedStatuses?: number[];
    signal?: AbortSignal;
};

export interface MatchApiError extends Error {
    status?: number;
    details?: string;
    code?: string;
}

const tryParseErrorCode = (text: string): string | undefined => {
    const normalized = text.trim();
    if (!normalized) return undefined;

    const jsonMatch = normalized.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[0]) as { error?: unknown; code?: unknown };
            if (typeof parsed.error === 'string' && parsed.error.trim()) return parsed.error.trim();
            if (typeof parsed.code === 'string' && parsed.code.trim()) return parsed.code.trim();
        } catch {
            // 忽略解析失败，降级到文本匹配
        }
    }

    const textCodeMatch = normalized.match(/\b([A-Z][A-Z0-9_]{2,})\b/);
    return textCodeMatch?.[1];
};

const buildApiError = (status: number, text: string, fallbackStatusText: string): MatchApiError => {
    const normalizedText = text.trim();
    const error = new Error(`${status}: ${normalizedText || fallbackStatusText}`) as MatchApiError;
    error.status = status;
    error.details = normalizedText || fallbackStatusText;
    error.code = tryParseErrorCode(normalizedText)
        ?? (status === 401 ? 'INVALID_TOKEN' : undefined)
        ?? `HTTP_${status}`;
    return error;
};

async function apiPost<T = unknown>(url: string, body: unknown, extraHeaders?: Record<string, string>, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            signal,
            headers: { 'Content-Type': 'application/json', ...extraHeaders },
            body: JSON.stringify(body),
        });
    } catch (error) {
        console.error('[matchApi] POST fetch failed', {
            url,
            method: 'POST',
            baseUrl: baseUrl(),
            errorName: error instanceof Error ? error.name : typeof error,
            bodyKeys: body && typeof body === 'object' && !Array.isArray(body)
                ? Object.keys(body as Record<string, unknown>)
                : [],
        });
        throw error;
    }
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('[matchApi] POST response not ok', {
            url,
            method: 'POST',
            status: response.status,
            statusText: response.statusText,
        });
        // 401 仅上抛给调用方处理，避免业务接口误判时提前清空登录态
        if (response.status === 401) {
            console.warn('[matchApi] 401 Unauthorized');
        }
        throw buildApiError(response.status, text, response.statusText);
    }
    return response.json() as Promise<T>;
}

async function apiGet<T = unknown>(url: string, options: ApiRequestOptions = {}): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, {
            cache: 'no-store',
            signal: options.signal,
        });
    } catch (error) {
        console.error('[matchApi] GET fetch failed', {
            url,
            method: 'GET',
            baseUrl: baseUrl(),
            errorName: error instanceof Error ? error.name : typeof error,
        });
        throw error;
    }
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        const isExpectedStatus = options.expectedStatuses?.includes(response.status) ?? false;
        if (!isExpectedStatus) {
            console.error('[matchApi] GET response not ok', {
                url,
                method: 'GET',
                status: response.status,
                statusText: response.statusText,
            });
        }
        // 401 仅上抛给调用方处理，避免业务接口误判时提前清空登录态
        if (response.status === 401) {
            console.warn('[matchApi] 401 Unauthorized');
        }
        throw buildApiError(response.status, text, response.statusText);
    }
    return response.json() as Promise<T>;
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 创建对局
 */
export async function createMatch(
    gameName: string,
    options: CreateMatchOptions,
    init?: { headers?: Record<string, string> },
): Promise<CreateMatchResult> {
    const url = `${baseUrl()}/games/${gameName}/create`;
    return apiPost<CreateMatchResult>(url, {
        numPlayers: options.numPlayers,
        setupData: options.setupData,
        playerName: options.playerName,
        previousOwnerCredentials: options.previousOwnerCredentials,
        forceReplaceOwnerRoom: options.forceReplaceOwnerRoom,
    }, init?.headers);
}

/**
 * 获取对局信息
 */
export async function getMatch(
    gameName: string,
    matchID: string,
    options?: ApiRequestOptions,
): Promise<MatchInfo> {
    const url = `${baseUrl()}/games/${gameName}/${matchID}`;
    return apiGet<MatchInfo>(url, options);
}

/**
 * 加入对局
 */
export async function joinMatch(
    gameName: string,
    matchID: string,
    options: JoinMatchOptions,
): Promise<JoinMatchResult> {
    const url = `${baseUrl()}/games/${gameName}/${matchID}/join`;
    const payload: Record<string, unknown> = {
        playerName: options.playerName,
        data: options.data,
    };
    if (options.playerID) {
        payload.playerID = options.playerID;
    }
    return apiPost<JoinMatchResult>(url, payload);
}

/**
 * 离开对局（释放座位）
 */
export async function leaveMatch(
    gameName: string,
    matchID: string,
    options: LeaveMatchOptions,
): Promise<void> {
    const url = `${baseUrl()}/games/${gameName}/${matchID}/leave`;
    await apiPost(url, {
        playerID: options.playerID,
        credentials: options.credentials,
    });
}

/**
 * 销毁对局（仅房主）
 */
export async function destroyMatch(
    gameName: string,
    matchID: string,
    playerID: string,
    credentials: string,
): Promise<void> {
    const url = `${baseUrl()}/games/${gameName}/${matchID}/destroy`;
    await apiPost(url, { playerID, credentials });
}

/**
 * 占座（JWT/guestId 认证）
 */
export async function claimSeat(
    gameName: string,
    matchID: string,
    playerID: string,
    options: { token?: string; guestId?: string; ownerCredentials?: string; playerName?: string },
): Promise<{ playerCredentials: string }> {
    const url = `${baseUrl()}/games/${gameName}/${matchID}/claim-seat`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.token) {
        headers.Authorization = `Bearer ${options.token}`;
    }
    const body: Record<string, unknown> = { playerID };
    if (!options.token && options.guestId) {
        body.guestId = options.guestId;
    }
    if (!options.token && options.ownerCredentials) body.ownerCredentials = options.ownerCredentials;
    if (options.playerName) {
        body.playerName = options.playerName;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw buildApiError(response.status, text, response.statusText);
    }
    return response.json() as Promise<{ playerCredentials: string }>;
}


/**
 * 重赛（创建新对局，保持相同游戏和人数）
 */
export async function playAgain(
    gameName: string,
    matchID: string,
    options: { playerID: string; credentials: string; token?: string; playerName?: string; recovery?: RematchRecoveryRequest },
): Promise<{ nextMatchID: string; ownerCredentials?: string; ownerType?: 'user' | 'guest'; ownerKey?: string }> {
    const { matchID: nextMatchID, ownerCredentials, ownerType, ownerKey } = await apiPost<CreateMatchResult>(
        `${baseUrl()}/games/${gameName}/create`,
        {
            rematch: { matchID, playerID: options.playerID, credentials: options.credentials, ...(options.recovery ? { recovery: options.recovery } : {}) },
            playerName: options.playerName,
        },
        options.token ? { Authorization: `Bearer ${options.token}` } : undefined,
    );
    return { nextMatchID, ownerCredentials, ownerType, ...(ownerKey ? { ownerKey } : {}) };
}

/** Read-only recovery. Never retries creation or rotates the seat. */
export function recoverRematch(gameName: string, sourceMatchID: string, recovery: RematchRecoveryRequest, token?: string, signal?: AbortSignal): Promise<RecoveredRematch> {
    return apiPost(`${baseUrl()}/games/${gameName}/${recovery.nextMatchID}/rematch-recovery`,
        { sourceMatchID, token: recovery.token }, token ? { Authorization: `Bearer ${token}` } : undefined, signal);
}
