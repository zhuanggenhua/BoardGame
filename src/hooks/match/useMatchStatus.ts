import { useState, useEffect, useCallback, useRef } from 'react';
import * as matchApi from '../../services/matchApi';
import { GAME_SERVER_URL } from '../../config/server';
import {
    getLocalStorage,
    readLocalStorageItem,
    readSessionStorageItem,
    removeLocalStorageItem,
    writeLocalStorageItem,
    writeSessionStorageItem,
} from '../../lib/browserStorage';

export interface PlayerStatus {
    id: number;
    name?: string;
    isConnected?: boolean;
}

export type MatchCleanupReason = 'destroyed';

export type MatchCleanupNotice = {
    matchID: string;
    reason: MatchCleanupReason;
    timestamp: number;
    nonce: string;
};

const createMatchCleanupNonce = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const parseMatchCleanupNotice = (raw: string | null): MatchCleanupNotice | null => {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as MatchCleanupNotice;
        if (!parsed?.matchID || !parsed?.nonce || !parsed?.reason) return null;
        if (parsed.reason !== 'destroyed') return null;
        return parsed;
    } catch {
        return null;
    }
};

export function readMatchCleanupNotice(): MatchCleanupNotice | null {
    return parseMatchCleanupNotice(readLocalStorageItem(MATCH_CLEANUP_NOTICE_KEY));
}

export function publishMatchCleanupNotice(matchID: string, reason: MatchCleanupReason = 'destroyed'): MatchCleanupNotice | null {
    if (!matchID) return null;
    const notice: MatchCleanupNotice = {
        matchID,
        reason,
        timestamp: Date.now(),
        nonce: createMatchCleanupNonce(),
    };
    writeLocalStorageItem(MATCH_CLEANUP_NOTICE_KEY, JSON.stringify(notice));
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('match-cleanup-notice'));
    }
    return notice;
}

export function hasSeenMatchCleanupNotice(notice: MatchCleanupNotice): boolean {
    if (typeof window === 'undefined') return false;
    return readSessionStorageItem(MATCH_CLEANUP_NOTICE_SEEN_KEY) === notice.nonce;
}

export function markMatchCleanupNoticeSeen(notice: MatchCleanupNotice): void {
    if (typeof window === 'undefined') return;
    writeSessionStorageItem(MATCH_CLEANUP_NOTICE_SEEN_KEY, notice.nonce);
}

export function isMatchNotFoundError(err: unknown): boolean {
    const status = typeof err === 'object' && err !== null && 'status' in err
        ? (err as { status?: unknown }).status
        : undefined;
    if (status === 404) {
        return true;
    }
    const errorMessage = err instanceof Error ? err.message : String(err);
    return errorMessage.includes('404') || errorMessage.toLowerCase().includes('not found');
}

const OWNER_ACTIVE_MATCH_KEY = 'owner_active_match';
const MATCH_CREDENTIALS_PREFIX = 'match_creds_';
const MATCH_AI_CREDENTIALS_PREFIX = 'match_ai_creds_';
const OWNER_ACTIVE_MATCH_SUPPRESS_KEY = 'owner_active_match_suppressed';
const MATCH_CLEANUP_NOTICE_KEY = 'match_cleanup_notice';
const MATCH_CLEANUP_NOTICE_SEEN_KEY = 'match_cleanup_notice_seen';

const parseOwnerActiveMatchSuppression = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item)).filter(Boolean);
        }
    } catch {
        return [];
    }
    return [];
};

const saveOwnerActiveMatchSuppression = (matchIDs: string[]): void => {
    if (matchIDs.length === 0) {
        removeLocalStorageItem(OWNER_ACTIVE_MATCH_SUPPRESS_KEY);
    } else {
        writeLocalStorageItem(OWNER_ACTIVE_MATCH_SUPPRESS_KEY, JSON.stringify(matchIDs));
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('owner-active-match-changed'));
    }
};

export function getSuppressedOwnerActiveMatches(): string[] {
    return parseOwnerActiveMatchSuppression(readLocalStorageItem(OWNER_ACTIVE_MATCH_SUPPRESS_KEY));
}

export function isOwnerActiveMatchSuppressed(matchID: string): boolean {
    if (!matchID) return false;
    return getSuppressedOwnerActiveMatches().includes(matchID);
}

export function suppressOwnerActiveMatch(matchID: string): void {
    if (!matchID) return;
    const current = getSuppressedOwnerActiveMatches();
    if (current.includes(matchID)) return;
    saveOwnerActiveMatchSuppression([...current, matchID]);
}

export function clearOwnerActiveMatchSuppression(matchID?: string): void {
    const current = getSuppressedOwnerActiveMatches();
    if (current.length === 0) return;
    if (!matchID) {
        saveOwnerActiveMatchSuppression([]);
        return;
    }
    const next = current.filter((id) => id !== matchID);
    if (next.length === current.length) return;
    saveOwnerActiveMatchSuppression(next);
}

export interface StoredMatchCredentials {
    matchID: string;
    playerID?: string;
    credentials?: string;
    gameName?: string;
    playerName?: string;
    updatedAt?: number;
}

export type StoredAiSeatCredentials = Record<string, string>;

export type MatchSeatValidationReason = 'missing_seat' | 'seat_empty' | 'name_mismatch';

export type MatchSeatValidationResult = {
    shouldClear: boolean;
    reason?: MatchSeatValidationReason;
};

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

const resolveExitMatchError = (err: unknown): { error: Exclude<ExitMatchResult['error'], 'unknown'>; status?: number } => {
    if (isMatchNotFoundError(err)) {
        return { error: 'not_found', status: 404 };
    }

    const status = typeof err === 'object' && err !== null && 'status' in err
        ? (err as { status?: number }).status
        : undefined;
    const code = typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code ?? '')
        : '';

    if (status === 401 || status === 403 || code === 'INVALID_TOKEN' || code === 'HTTP_401' || code === 'HTTP_403') {
        return { error: 'forbidden', status: status ?? (code === 'INVALID_TOKEN' ? 401 : undefined) };
    }

    if (typeof status === 'number' && status >= 500) {
        return { error: 'server_error', status };
    }

    return {
        error: 'network',
        status: typeof status === 'number' ? status : undefined,
    };
};

export type RejoinMatchError =
    | 'not_found'
    | 'room_full'
    | 'forbidden'
    | 'unauthorized'
    | 'network'
    | 'invalid_response';

export interface RejoinMatchResult {
    success: boolean;
    playerID?: string;
    credentials?: string;
    error?: RejoinMatchError;
    status?: number;
}

const resolveRejoinMatchError = (err: unknown): { error: Exclude<RejoinMatchError, 'invalid_response'>; status?: number } => {
    if (isMatchNotFoundError(err)) {
        return { error: 'not_found', status: 404 };
    }
    const status = typeof err === 'object' && err !== null && 'status' in err
        ? (err as { status?: number }).status
        : undefined;
    const code = typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code ?? '')
        : '';
    if (status === 401 || code === 'INVALID_TOKEN') {
        return { error: 'unauthorized', status: status ?? 401 };
    }
    if (status === 403) {
        return { error: 'forbidden', status };
    }
    if (status === 409 || code === 'ROOM_FULL') {
        return { error: 'room_full', status: status ?? 409 };
    }
    return {
        error: 'network',
        status: typeof status === 'number' ? status : undefined,
    };
};

export function clearMatchCredentials(matchID: string): void {
    if (!matchID) return;
    removeLocalStorageItem(`${MATCH_CREDENTIALS_PREFIX}${matchID}`);
    removeLocalStorageItem(`${MATCH_AI_CREDENTIALS_PREFIX}${matchID}`);

    // 让同一标签页监听器（Home 活跃对局横幅、lobby 弹窗）立即刷新。
    // 原生 `storage` 事件不会在同一 document 触发。
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('match-credentials-changed'));
    }
}

export function readStoredAiSeatCredentials(matchID: string): StoredAiSeatCredentials {
    if (!matchID) return {};
    try {
        const raw = readLocalStorageItem(`${MATCH_AI_CREDENTIALS_PREFIX}${matchID}`);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return Object.fromEntries(
            Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        );
    } catch {
        return {};
    }
}

export function persistAiSeatCredentials(matchID: string, seatCredentials: StoredAiSeatCredentials): void {
    if (!matchID) return;
    const normalized = Object.fromEntries(
        Object.entries(seatCredentials).filter((entry): entry is [string, string] => Boolean(entry[0]) && Boolean(entry[1])),
    );
    if (Object.keys(normalized).length === 0) {
        removeLocalStorageItem(`${MATCH_AI_CREDENTIALS_PREFIX}${matchID}`);
    } else {
        writeLocalStorageItem(`${MATCH_AI_CREDENTIALS_PREFIX}${matchID}`, JSON.stringify(normalized));
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('match-credentials-changed'));
    }
}

export type ClaimSeatOptions = {
    token?: string;
    guestId?: string;
    playerName?: string;
};

export type ClaimSeatError =
    | 'unauthorized'
    | 'forbidden'
    | 'not_found'
    | 'server_error'
    | 'invalid_response'
    | 'network';

export type ClaimSeatResult = {
    success: boolean;
    credentials?: string;
    status?: number;
    error?: ClaimSeatError;
};

/**
 * 通过 JWT 或 guestId 回归占位（无本地凭据时使用）
 */
export async function claimSeat(
    gameName: string,
    matchID: string,
    playerID: string,
    options: ClaimSeatOptions
): Promise<ClaimSeatResult> {
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
            const status = response.status;
            let error: ClaimSeatError = 'network';
            if (status === 401) error = 'unauthorized';
            else if (status === 403) error = 'forbidden';
            else if (status === 404) error = 'not_found';
            else if (status >= 500) error = 'server_error';

            console.warn('[claimSeat] 请求失败', {
                url,
                status,
                message,
                matchID,
                playerID,
                error,
            });
            return { success: false, status, error };
        }

        const data = await response.json().catch(() => null) as { playerCredentials?: string } | null;
        const credentials = data?.playerCredentials;
        if (!credentials) {
            return { success: false, error: 'invalid_response' };
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
        return { success: false, error: 'network' };
    }
}

export function getOwnerActiveMatch(): OwnerActiveMatch | null {
    try {
        const raw = readLocalStorageItem(OWNER_ACTIVE_MATCH_KEY);
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
    clearOwnerActiveMatchSuppression(payload.matchID);
    writeLocalStorageItem(OWNER_ACTIVE_MATCH_KEY, JSON.stringify({
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
    removeLocalStorageItem(OWNER_ACTIVE_MATCH_KEY);
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
    return parseStoredCredentials(readLocalStorageItem(`${MATCH_CREDENTIALS_PREFIX}${matchID}`));
}

export function listStoredMatchCredentials(): StoredMatchCredentials[] {
    const storage = getLocalStorage();
    if (!storage) return [];

    const results: StoredMatchCredentials[] = [];
    for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (!key || !key.startsWith(MATCH_CREDENTIALS_PREFIX)) continue;
        const raw = storage.getItem(key);
        const parsed = parseStoredCredentials(raw);
        if (parsed) {
            results.push(parsed);
        }
    }
    return results;
}

const RECENT_MATCH_CREDENTIALS_GRACE_MS = 10_000;

export function validateStoredMatchSeat(
    stored: StoredMatchCredentials | null,
    matchPlayers: Array<{ id: number; name?: string | null }>,
    expectedPlayerID?: string | null
): MatchSeatValidationResult {
    if (!stored?.playerID) {
        return { shouldClear: false };
    }

    const resolvedPlayerID = expectedPlayerID ?? stored.playerID;
    if (!resolvedPlayerID || String(resolvedPlayerID) !== String(stored.playerID)) {
        return { shouldClear: false };
    }

    const isRecentlyPersisted = typeof stored.updatedAt === 'number'
        && Number.isFinite(stored.updatedAt)
        && Date.now() - stored.updatedAt < RECENT_MATCH_CREDENTIALS_GRACE_MS;

    const seat = matchPlayers.find(player => String(player.id) === String(resolvedPlayerID));
    if (!seat) {
        return isRecentlyPersisted ? { shouldClear: false } : { shouldClear: true, reason: 'missing_seat' };
    }
    if (!seat.name) {
        return isRecentlyPersisted ? { shouldClear: false } : { shouldClear: true, reason: 'seat_empty' };
    }
    if (stored.playerName && seat.name !== stored.playerName) {
        // 用户名变更后 localStorage 中的 playerName 可能与 match metadata 中的 seat.name 不一致，
        // 这是正常情况，不应清除凭据。凭据（随机 nanoid）才是真正的认证手段。
        return { shouldClear: false };
    }

    return { shouldClear: false };
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
            removeLocalStorageItem(`${MATCH_CREDENTIALS_PREFIX}${item.matchID}`);
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
    const existing = parseStoredCredentials(readLocalStorageItem(`${MATCH_CREDENTIALS_PREFIX}${matchID}`));
    const payload: StoredMatchCredentials = {
        ...(existing && typeof existing === 'object' ? existing : {}),
        ...data,
        matchID,
        updatedAt: Date.now(),
    };
    writeLocalStorageItem(`${MATCH_CREDENTIALS_PREFIX}${matchID}`, JSON.stringify(payload));
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
        // - 4173 404：Vite proxy 未生效（或请求没到 Vite dev server）。
        // - 18000 404：后端没有命中 destroy 中间件（中间件顺序或路由吞掉）。

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
                return { success: false, error: 'server_error' };
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
    errorKind: 'not_found' | 'transient_unreachable' | null;
    myPlayerID: string | null;
    opponentName: string | null;
    opponentConnected: boolean;
    isHost: boolean; // 是否是房主（playerID === '0'）
}

const MATCH_STATUS_POLL_INTERVAL_MS = 3000;
const MATCH_STATUS_ERROR_RETRY_INTERVAL_MS = 10000;
const MATCH_STATUS_RETRY_BACKOFF_BASE_MS = 5000;
const MATCH_STATUS_RETRY_BACKOFF_MAX_MS = 30000;
const MATCH_STATUS_RETRY_JITTER_RATIO = 0.2;

const computeTransientRetryDelayMs = (failureCount: number): number => {
    const backoffDelayMs = Math.min(
        MATCH_STATUS_RETRY_BACKOFF_MAX_MS,
        MATCH_STATUS_RETRY_BACKOFF_BASE_MS * (2 ** Math.max(0, failureCount - 1)),
    );
    const jitterFactor = 1 + ((Math.random() * 2 - 1) * MATCH_STATUS_RETRY_JITTER_RATIO);
    return Math.max(MATCH_STATUS_RETRY_BACKOFF_BASE_MS, Math.round(backoffDelayMs * jitterFactor));
};

/**
 * 房间状态 Hook
 * 用于实时获取房间信息和对手状态
 */
export function useMatchStatus(gameName: string | undefined, matchID: string | undefined, myPlayerID: string | null): MatchStatus {
    const [players, setPlayers] = useState<PlayerStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [errorKind, setErrorKind] = useState<'not_found' | 'transient_unreachable' | null>(null);
    const [isPageVisible, setIsPageVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden));
    const failureCountRef = useRef(0);
    const lastFailureAtRef = useRef<number | null>(null);
    const inFlightRef = useRef(false);
    const nextAllowedFetchAtRef = useRef<number | null>(null);
    // 用 ref 持有最新的 gameName/matchID，避免 fetchMatchStatus 依赖变化导致 useEffect 反复重建 interval
    const gameNameRef = useRef(gameName);
    const matchIDRef = useRef(matchID);
    gameNameRef.current = gameName;
    matchIDRef.current = matchID;

    // 获取房间状态（无外部依赖，引用稳定）
    const fetchMatchStatus = useCallback(async (options?: { force?: boolean }) => {
        const requestMatchID = matchIDRef.current;
        if (!requestMatchID) return;
        if (inFlightRef.current) return;
        if (!options?.force && nextAllowedFetchAtRef.current && Date.now() < nextAllowedFetchAtRef.current) {
            return;
        }

        inFlightRef.current = true;
        try {
            const effectiveGameName = gameNameRef.current || 'tictactoe';
            const match = await matchApi.getMatch(effectiveGameName, requestMatchID);
            // 切换到新房间后，忽略旧请求的迟到结果，避免旧房间状态污染
            if (requestMatchID !== matchIDRef.current) return;
            setPlayers(match.players.map(p => ({
                id: p.id,
                name: p.name,
                isConnected: p.isConnected,
            })));
            failureCountRef.current = 0;
            lastFailureAtRef.current = null;
            nextAllowedFetchAtRef.current = null;
            setError(null);
            setErrorKind(null);
        } catch (err: unknown) {
            // 切房间后旧请求报错也直接忽略
            if (requestMatchID !== matchIDRef.current) return;
            // 404 错误（房间不存在）立即触发错误状态，无需等待 3 次失败
            const is404 = isMatchNotFoundError(err);
            if (is404) {
                nextAllowedFetchAtRef.current = null;
                setErrorKind('not_found');
                setError('房间不存在或已被删除');
                return;
            }

            console.error('获取房间状态失败:', err);
            // 其他错误（网络问题等）需要连续 3 次失败才触发
            failureCountRef.current += 1;
            nextAllowedFetchAtRef.current = Date.now() + computeTransientRetryDelayMs(failureCountRef.current);
            if (!lastFailureAtRef.current) {
                lastFailureAtRef.current = Date.now();
            }
            const shouldExposeError = failureCountRef.current >= 3;
            if (shouldExposeError) {
                setErrorKind('transient_unreachable');
                setError('房间暂时不可达，请稍后重试');
            } else {
                setErrorKind(null);
                setError(null);
            }
        } finally {
            inFlightRef.current = false;
            if (requestMatchID === matchIDRef.current) {
                setIsLoading(false);
            }
        }
    }, []); // 依赖为空，引用永远稳定

    // 切换房间时重置状态，避免旧房间错误态阻塞新房间轮询
    useEffect(() => {
        failureCountRef.current = 0;
        lastFailureAtRef.current = null;
        inFlightRef.current = false;
        nextAllowedFetchAtRef.current = null;
        setError(null);
        setErrorKind(null);
        setPlayers([]);
        setIsLoading(Boolean(matchID));
    }, [matchID, gameName]);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const handleVisibilityChange = () => {
            setIsPageVisible(!document.hidden);
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    // 回到前台或网络恢复后立即重拉一次，降低“恢复焦点后仍显示旧状态”的窗口期
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!matchID || errorKind === 'not_found') return;
        const handleWakeUp = () => {
            if (typeof document !== 'undefined' && document.hidden) return;
            void fetchMatchStatus({ force: true });
        };
        window.addEventListener('focus', handleWakeUp);
        window.addEventListener('online', handleWakeUp);
        return () => {
            window.removeEventListener('focus', handleWakeUp);
            window.removeEventListener('online', handleWakeUp);
        };
    }, [matchID, errorKind, fetchMatchStatus]);

    // 定期轮询房间状态
    useEffect(() => {
        if (!matchID || error || !isPageVisible) return;

        fetchMatchStatus();

        // 每 3 秒轮询一次（可以后续改为 WebSocket）
        const interval = setInterval(fetchMatchStatus, MATCH_STATUS_POLL_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [matchID, error, fetchMatchStatus, isPageVisible]);

    // 报错后低频重试，避免错误态卡死
    useEffect(() => {
        if (!matchID || !error || errorKind === 'not_found' || !isPageVisible) return;

        fetchMatchStatus();
        const interval = setInterval(fetchMatchStatus, MATCH_STATUS_ERROR_RETRY_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [matchID, error, errorKind, fetchMatchStatus, isPageVisible]);

    // 计算对手信息
    const myIndex = myPlayerID ? parseInt(myPlayerID) : -1;
    const opponentIndex = myIndex === 0 ? 1 : 0;
    const opponent = players[opponentIndex];

    return {
        matchID: matchID || '',
        players,
        isLoading,
        error,
        errorKind,
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
        await matchApi.leaveMatch(gameName, matchID, {
            playerID,
            credentials,
        });
        // 清理本地凭证
        clearMatchCredentials(matchID);
        return { success: true };
    } catch (err: unknown) {
        console.error('离开房间失败:', err);
        const resolvedError = resolveExitMatchError(err);
        // 404 说明房间已不存在，视为成功并清理凭据
        if (resolvedError.error === 'not_found') {
            clearMatchCredentials(matchID);
            return { success: true, cleanedLocal: true, error: resolvedError.error };
        }
        return { success: false, error: resolvedError.error };
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
    playerID: string | undefined,
    playerName: string,
    options?: { guestId?: string }
): Promise<RejoinMatchResult> {
    try {
        const { playerCredentials, playerID: assignedPlayerID } = await matchApi.joinMatch(gameName, matchID, {
            playerID,
            playerName,
            data: options?.guestId ? { guestId: options.guestId } : undefined,
        });
        const resolvedPlayerID = assignedPlayerID ?? playerID;
        if (!playerCredentials || !resolvedPlayerID) {
            return {
                success: false,
                error: 'invalid_response',
            };
        }

        // 保存新凭证
        const storageKey = `match_creds_${matchID}`;
        let existing: Record<string, unknown> | null = null;
        try {
            const raw = readLocalStorageItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw);
                existing = typeof parsed === 'object' && parsed !== null ? parsed : null;
            }
        } catch {
            existing = null;
        }

        persistMatchCredentials(matchID, {
            ...(existing || {}),
            playerID: resolvedPlayerID,
            credentials: playerCredentials,
            matchID,
            gameName,
            playerName,
        });

        return { success: true, playerID: resolvedPlayerID, credentials: playerCredentials };
    } catch (err: unknown) {
        console.error('重新加入房间失败:', err);
        const resolvedError = resolveRejoinMatchError(err);
        const shouldClearLocal = resolvedError.error === 'not_found'
            || resolvedError.error === 'unauthorized'
            || resolvedError.error === 'forbidden';
        if (shouldClearLocal) {
            clearMatchCredentials(matchID);
        }
        return { success: false, ...resolvedError };
    }
}
