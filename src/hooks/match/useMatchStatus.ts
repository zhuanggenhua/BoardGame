import { useState, useEffect, useCallback, useRef } from 'react';
import { LobbyClient } from 'boardgame.io/client';
import { GAME_SERVER_URL } from '../../config/server';

const lobbyClient = new LobbyClient({ server: GAME_SERVER_URL });

export interface PlayerStatus {
    id: number;
    name?: string;
    isConnected?: boolean;
}

const OWNER_ACTIVE_MATCH_KEY = 'owner_active_match';
const MATCH_CREDENTIALS_PREFIX = 'match_creds_';

export interface StoredMatchCredentials {
    matchID: string;
    playerID?: string;
    credentials?: string;
    gameName?: string;
    playerName?: string;
    updatedAt?: number;
}

export interface OwnerActiveMatch {
    matchID: string;
    gameName: string;
    ownerKey?: string;
    ownerType?: 'user' | 'guest';
    updatedAt?: number;
}

export interface ExitMatchResult {
    success: boolean;
    cleanedLocal?: boolean;
    error?: 'not_found' | 'forbidden' | 'server_error' | 'network' | 'unknown';
}

export function clearMatchCredentials(matchID: string): void {
    if (!matchID) return;
    localStorage.removeItem(`${MATCH_CREDENTIALS_PREFIX}${matchID}`);

    // 让同一标签页监听器（Home 活跃对局横幅、lobby 弹窗）立即刷新。
    // 原生 `storage` 事件不会在同一 document 触发。
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('match-credentials-changed'));
    }
}

export type ClaimSeatOptions = {
    token?: string;
    guestId?: string;
    playerName?: string;
};

/**
 * 通过 JWT 或 guestId 回归占位（无本地凭据时使用）
 */
export async function claimSeat(
    gameName: string,
    matchID: string,
    playerID: string,
    options: ClaimSeatOptions
): Promise<{ success: boolean; credentials?: string }> {
    try {
        const normalizedGameName = (gameName || 'tictactoe').toLowerCase();
        const baseUrl = GAME_SERVER_URL || '';
        const url = `${baseUrl}/games/${normalizedGameName}/${matchID}/claim-seat`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (options.token) {
            headers.Authorization = `Bearer ${options.token}`;
        }
        const payload: { playerID: string; guestId?: string; playerName?: string } = { playerID };
        if (!options.token && options.guestId) {
            payload.guestId = options.guestId;
        }
        if (options.playerName) {
            payload.playerName = options.playerName;
        }
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const message = await response.text().catch(() => '');
            console.warn('[claimSeat] 请求失败', {
                url,
                status: response.status,
                message,
                matchID,
                playerID,
            });
            return { success: false };
        }

        const data = await response.json().catch(() => null) as { playerCredentials?: string } | null;
        const credentials = data?.playerCredentials;
        if (!credentials) {
            return { success: false };
        }

        persistMatchCredentials(matchID, {
            playerID,
            credentials,
            matchID,
            gameName: normalizedGameName,
            playerName: options.playerName,
        });

        return { success: true, credentials };
    } catch (err) {
        console.error('[claimSeat] 请求异常:', err);
        return { success: false };
    }
}

export function getOwnerActiveMatch(): OwnerActiveMatch | null {
    try {
        const raw = localStorage.getItem(OWNER_ACTIVE_MATCH_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as OwnerActiveMatch;
        if (!parsed?.matchID) return null;
        return parsed;
    } catch {
        return null;
    }
}

export function setOwnerActiveMatch(payload: OwnerActiveMatch): void {
    if (!payload?.matchID) return;
    localStorage.setItem(OWNER_ACTIVE_MATCH_KEY, JSON.stringify({
        ...payload,
        updatedAt: Date.now(),
    }));
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('owner-active-match-changed'));
    }
}

export function clearOwnerActiveMatch(matchID?: string): void {
    const existing = getOwnerActiveMatch();
    if (!existing) return;
    if (matchID && existing.matchID !== matchID) return;
    localStorage.removeItem(OWNER_ACTIVE_MATCH_KEY);
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('owner-active-match-changed'));
    }
}

const parseStoredCredentials = (raw: string | null): StoredMatchCredentials | null => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as StoredMatchCredentials;
        if (!parsed?.matchID) return null;
        return parsed;
    } catch {
        return null;
    }
};

export function readStoredMatchCredentials(matchID: string): StoredMatchCredentials | null {
    if (!matchID) return null;
    return parseStoredCredentials(localStorage.getItem(`${MATCH_CREDENTIALS_PREFIX}${matchID}`));
}

export function listStoredMatchCredentials(): StoredMatchCredentials[] {
    const results: StoredMatchCredentials[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(MATCH_CREDENTIALS_PREFIX)) continue;
        const raw = localStorage.getItem(key);
        const parsed = parseStoredCredentials(raw);
        if (parsed) {
            results.push(parsed);
        }
    }
    return results;
}

export function getLatestStoredMatchCredentials(): StoredMatchCredentials | null {
    const all = listStoredMatchCredentials();
    if (all.length === 0) return null;
    const sorted = [...all].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    return sorted[0] || null;
}

export function pruneStoredMatchCredentials(keepMatchID?: string): string | null {
    const all = listStoredMatchCredentials();
    if (all.length === 0) return null;

    let keepId = keepMatchID;
    if (!keepId) {
        const latest = getLatestStoredMatchCredentials();
        keepId = latest?.matchID;
    }
    if (!keepId) return null;

    const toRemove = all.filter(item => item.matchID !== keepId);
    if (toRemove.length > 0) {
        toRemove.forEach(item => {
            localStorage.removeItem(`${MATCH_CREDENTIALS_PREFIX}${item.matchID}`);
        });
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('match-credentials-changed'));
        }
    }

    const ownerActive = getOwnerActiveMatch();
    if (ownerActive?.matchID && ownerActive.matchID !== keepId) {
        clearOwnerActiveMatch(ownerActive.matchID);
    }

    return keepId;
}

export function persistMatchCredentials(
    matchID: string,
    data: StoredMatchCredentials,
    options?: { enforceSingle?: boolean }
): void {
    if (!matchID) return;
    if (options?.enforceSingle !== false) {
        pruneStoredMatchCredentials(matchID);
    }
    const existing = parseStoredCredentials(localStorage.getItem(`${MATCH_CREDENTIALS_PREFIX}${matchID}`));
    const payload: StoredMatchCredentials = {
        ...(existing && typeof existing === 'object' ? existing : {}),
        ...data,
        matchID,
        updatedAt: Date.now(),
    };
    localStorage.setItem(`${MATCH_CREDENTIALS_PREFIX}${matchID}`, JSON.stringify(payload));
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('match-credentials-changed'));
    }
}

/**
 * 强制销毁房间（仅房主可用）
 *
 * 证据：后端 `server.ts` 仅实现了 `POST /games/:game/:matchID/destroy`，并要求 body 中包含 playerID/credentials。
 * 用户截图显示前端请求打到了 `POST /games/:game/:matchID/destroy` 但返回 404。
 *
 * 结论：404 更可能来自「gameName 与服务端注册的游戏 id 不一致」或「请求发到了错误的服务器(baseUrl/proxy)」。
 * 这里补充更可审计的日志与 gameName 归一化，避免大小写导致的 404。
 */
export async function destroyMatch(
    gameName: string,
    matchID: string,
    playerID: string,
    credentials: string
): Promise<ExitMatchResult> {
    try {
        const normalizedGameName = (gameName || 'tictactoe').toLowerCase();

        const baseUrl = GAME_SERVER_URL || '';
        const url = `${baseUrl}/games/${normalizedGameName}/${matchID}/destroy`;

        // 不做“兜底直连”以掩盖问题：销毁必须明确走 proxy 或生产反代。
        // 诊断：
        // - 5173 404：Vite proxy 未生效（或请求没到 Vite dev server）。
        // - 18000 404：后端没有命中 destroy 中间件（中间件顺序或 boardgame.io 路由吞掉）。

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ playerID, credentials }),
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.warn('[destroyMatch] 404 Not Found，销毁失败', {
                    url,
                    normalizedGameName,
                    matchID,
                    playerID,
                });
                clearMatchCredentials(matchID);
                clearOwnerActiveMatch(matchID);
                return { success: true, cleanedLocal: true, error: 'not_found' };
            }

            if (response.status === 403) {
                return { success: false, error: 'forbidden' };
            }

            if (response.status >= 500) {
                clearMatchCredentials(matchID);
                clearOwnerActiveMatch(matchID);
                return { success: true, cleanedLocal: true, error: 'server_error' };
            }

            const message = await response.text().catch(() => '');
            console.error('[destroyMatch] 请求失败', {
                url,
                status: response.status,
                statusText: response.statusText,
                message,
                matchID,
                playerID,
                normalizedGameName,
            });
            throw new Error(message || response.statusText);
        }

        clearMatchCredentials(matchID);
        clearOwnerActiveMatch(matchID);
        return { success: true };
    } catch (err) {
        console.error('[destroyMatch] 销毁房间失败:', err);
        return { success: false, error: 'network' };
    }
}

export interface MatchStatus {
    matchID: string;
    players: PlayerStatus[];
    isLoading: boolean;
    error: string | null;
    myPlayerID: string | null;
    opponentName: string | null;
    opponentConnected: boolean;
    isHost: boolean; // 是否是房主（playerID === '0'）
}

/**
 * 房间状态 Hook
 * 用于实时获取房间信息和对手状态
 */
export function useMatchStatus(gameName: string | undefined, matchID: string | undefined, myPlayerID: string | null): MatchStatus {
    const [players, setPlayers] = useState<PlayerStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const failureCountRef = useRef(0);
    const lastFailureAtRef = useRef<number | null>(null);

    // 获取房间状态
    const fetchMatchStatus = useCallback(async () => {
        if (!matchID) return;

        try {
            const effectiveGameName = gameName || 'tictactoe';
            const match = await lobbyClient.getMatch(effectiveGameName, matchID);
            setPlayers(match.players.map(p => ({
                id: p.id,
                name: p.name,
                isConnected: p.isConnected,
            })));
            failureCountRef.current = 0;
            lastFailureAtRef.current = null;
            setError(null);
        } catch (err: any) {
            console.error('获取房间状态失败:', err);
            failureCountRef.current += 1;
            if (!lastFailureAtRef.current) {
                lastFailureAtRef.current = Date.now();
            }
            const shouldExposeError = failureCountRef.current >= 3;
            if (shouldExposeError) {
                // 404 说明房间已不存在，清理本地凭据（避免创建后短暂抖动误判）
                if (err?.message?.includes('404') || err?.message?.includes('not found')) {
                    clearMatchCredentials(matchID);
                }
                setError(prev => prev ?? '房间不存在或已被删除');
            } else {
                setError(null);
            }
        } finally {
            setIsLoading(false);
        }
    }, [gameName, matchID]);

    // 定期轮询房间状态
    useEffect(() => {
        if (!matchID || error) return;

        fetchMatchStatus();

        // 每 3 秒轮询一次（可以后续改为 WebSocket）
        const interval = setInterval(fetchMatchStatus, 3000);

        return () => clearInterval(interval);
    }, [matchID, fetchMatchStatus, error]);

    // 报错后低频重试，避免错误态卡死
    useEffect(() => {
        if (!matchID || !error) return;

        fetchMatchStatus();
        const interval = setInterval(fetchMatchStatus, 10000);

        return () => clearInterval(interval);
    }, [matchID, error, fetchMatchStatus]);

    // 计算对手信息
    const myIndex = myPlayerID ? parseInt(myPlayerID) : -1;
    const opponentIndex = myIndex === 0 ? 1 : 0;
    const opponent = players[opponentIndex];

    return {
        matchID: matchID || '',
        players,
        isLoading,
        error,
        myPlayerID,
        opponentName: opponent?.name || null,
        opponentConnected: opponent?.isConnected || false,
        isHost: myPlayerID === '0',
    };
}

/**
 * 离开房间（只取消占位，不删除房间）
 */
export async function leaveMatch(
    gameName: string,
    matchID: string,
    playerID: string,
    credentials: string
): Promise<ExitMatchResult> {
    try {
        await lobbyClient.leaveMatch(gameName, matchID, {
            playerID,
            credentials,
        });
        // 清理本地凭证
        clearMatchCredentials(matchID);
        return { success: true };
    } catch (err: any) {
        console.error('离开房间失败:', err);
        // 404 说明房间已不存在，视为成功并清理凭据
        if (err?.message?.includes('404') || err?.message?.includes('not found')) {
            clearMatchCredentials(matchID);
            return { success: true, cleanedLocal: true, error: 'not_found' };
        }
        return { success: false, error: 'unknown' };
    }
}

/**
 * 离开/销毁房间（统一入口）
 */
export async function exitMatch(
    gameName: string,
    matchID: string,
    playerID: string,
    credentials: string,
    isHost?: boolean
): Promise<ExitMatchResult> {
    if (isHost) {
        return destroyMatch(gameName, matchID, playerID, credentials);
    }
    return leaveMatch(gameName, matchID, playerID, credentials);
}

/**
 * 重新加入房间（如果之前离开过）
 */
export async function rejoinMatch(
    gameName: string,
    matchID: string,
    playerID: string,
    playerName: string,
    options?: { guestId?: string }
): Promise<{ success: boolean; credentials?: string }> {
    try {
        const { playerCredentials } = await lobbyClient.joinMatch(gameName, matchID, {
            playerID,
            playerName,
            data: options?.guestId ? { guestId: options.guestId } : undefined,
        });

        // 保存新凭证
        const storageKey = `match_creds_${matchID}`;
        let existing: any = null;
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) existing = JSON.parse(raw);
        } catch {
            existing = null;
        }

        persistMatchCredentials(matchID, {
            ...(existing && typeof existing === 'object' ? existing : {}),
            playerID,
            credentials: playerCredentials,
            matchID,
            gameName,
        });

        return { success: true, credentials: playerCredentials };
    } catch (err) {
        console.error('重新加入房间失败:', err);
        clearMatchCredentials(matchID);
        return { success: false };
    }
}
