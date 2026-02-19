/**
 * 房间管理 REST API 封装
 *
 * 直接调用服务端 REST 路由。
 * 路由结构：/games/:name/:matchID/...
 */

import { GAME_SERVER_URL } from '../config/server';

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
}

export interface JoinMatchOptions {
    playerID: string;
    playerName?: string;
    data?: Record<string, unknown>;
}

export interface JoinMatchResult {
    playerCredentials: string;
}

export interface LeaveMatchOptions {
    playerID: string;
    credentials: string;
}

// ============================================================================
// 内部工具
// ============================================================================

const baseUrl = (): string => GAME_SERVER_URL || '';

async function apiPost<T = unknown>(url: string, body: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`${response.status}: ${text || response.statusText}`);
    }
    return response.json() as Promise<T>;
}

async function apiGet<T = unknown>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`${response.status}: ${text || response.statusText}`);
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
): Promise<{ matchID: string }> {
    const url = `${baseUrl()}/games/${gameName}/create`;
    return apiPost<{ matchID: string }>(url, {
        numPlayers: options.numPlayers,
        setupData: options.setupData,
    }, init?.headers);
}

/**
 * 获取对局信息
 */
export async function getMatch(
    gameName: string,
    matchID: string,
): Promise<MatchInfo> {
    const url = `${baseUrl()}/games/${gameName}/${matchID}`;
    return apiGet<MatchInfo>(url);
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
    return apiPost<JoinMatchResult>(url, {
        playerID: options.playerID,
        playerName: options.playerName,
        data: options.data,
    });
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
        throw new Error(`${response.status}: ${text || response.statusText}`);
    }
    return response.json() as Promise<{ playerCredentials: string }>;
}


/**
 * 重赛（创建新对局，保持相同游戏和人数）
 */
export async function playAgain(
    gameName: string,
    matchID: string,
    options: { playerID: string; credentials: string; guestId?: string },
): Promise<{ nextMatchID: string }> {
    // 先获取当前对局信息以复用 numPlayers 和 setupData
    const matchInfo = await getMatch(gameName, matchID);
    const numPlayers = matchInfo.players.length || 2;

    // 提取 setupData 中需要保留的字段（ownerKey/ownerType）
    const prevSetupData = (matchInfo.setupData ?? {}) as Record<string, unknown>;
    const setupData: Record<string, unknown> = {};
    if (prevSetupData.ownerKey) setupData.ownerKey = prevSetupData.ownerKey;
    if (prevSetupData.ownerType) setupData.ownerType = prevSetupData.ownerType;
    // 匿名用户需要传递 guestId 以通过服务端 owner 验证
    if (options.guestId) setupData.guestId = options.guestId;

    const { matchID: nextMatchID } = await createMatch(gameName, { numPlayers, setupData });
    return { nextMatchID };
}
