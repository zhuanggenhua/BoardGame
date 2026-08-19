/**
 * 房间管理 REST API 封装
 *
 * 直接调用服务端 REST 路由。
 * 路由结构：/games/:name/:matchID/...
 */

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
    forceReplaceOwnerRoom?: boolean;
}

export interface CreateMatchResult {
    matchID: string;
    ownerPlayerID?: string;
    ownerCredentials?: string;
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

async function apiPost<T = unknown>(url: string, body: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...extraHeaders },
            body: JSON.stringify(body),
        });
    } catch (error) {
        console.error('[matchApi] POST fetch failed', {
            url,
            method: 'POST',
            baseUrl: baseUrl(),
            errorName: error instanceof Error ? error.name : typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
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
            details: text,
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
        });
    } catch (error) {
        console.error('[matchApi] GET fetch failed', {
            url,
            method: 'GET',
            baseUrl: baseUrl(),
            errorName: error instanceof Error ? error.name : typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
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
                details: text,
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
    options: { token?: string; guestId?: string; playerName?: string },
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
    options: { playerID: string; credentials: string; guestId?: string; token?: string },
): Promise<{ nextMatchID: string }> {
    // 先获取当前对局信息以复用 numPlayers 和 setupData
    const matchInfo = await getMatch(gameName, matchID);
    const numPlayers = matchInfo.players.length || 2;

    const prevSetupData = (matchInfo.setupData ?? {}) as Record<string, unknown>;
    const setupData = Object.fromEntries(
        Object.entries(prevSetupData).filter(([key]) => ![
            'ownerKey',
            'ownerType',
            'guestId',
            'password',
            'firstPlayerId',
            'turnOrder',
        ].includes(key)),
    );
    setupData.prevMatchID = matchID;
    // 匿名用户需要传递 guestId 以通过服务端 owner 验证
    if (options.guestId) setupData.guestId = options.guestId;

    const { matchID: nextMatchID } = await createMatch(
        gameName,
        { numPlayers, setupData, forceReplaceOwnerRoom: true },
        options.token ? { headers: { Authorization: `Bearer ${options.token}` } } : undefined,
    );
    return { nextMatchID };
}
