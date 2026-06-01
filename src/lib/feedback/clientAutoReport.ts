import { FEEDBACK_API_URL, IS_DEV_API_DISABLED } from '../../config/server';
import { isStaleChunkError } from '../staleChunkReloadGuard';
import { setLastErrorContext } from './errorContext';

const DEFAULT_CLIENT_AUTO_REPORT_SOURCE = 'client-auto-report';
const DEDUPE_STORAGE_PREFIX = 'bg:auto-feedback:v1:';
const DEDUPE_TTL_MS = 6 * 60 * 60 * 1000;
const inMemoryReportedKeys = new Set<string>();

type ClientAutoReportWindow = Window & {
    __BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__?: boolean;
};

export const CLIENT_AUTO_REPORT_ALLOWED_SOURCES = [
    'client-auto-report',
    'client-runtime-guard',
    'client-window-error',
    'client-unhandled-rejection',
    'react-error-boundary',
    'board-render-error',
    'home-modal-error-boundary',
] as const;

export type ClientAutoReportSource = typeof CLIENT_AUTO_REPORT_ALLOWED_SOURCES[number];

type ClientAutoReportPayload = {
    content: string;
    autoReportKind: string;
    gameId: string;
    gameName: string;
    source?: ClientAutoReportSource;
    playerId?: string | null;
    errorName: string;
    errorMessage: string;
    errorSource: string;
    stack?: string;
};

function getStorageKey(signature: string): string {
    return `${DEDUPE_STORAGE_PREFIX}${signature}`;
}

function buildRouteContext() {
    if (typeof window === 'undefined') return {};

    const route = `${window.location.pathname}${window.location.search}${window.location.hash}` || undefined;
    const match = /^\/play\/([^/]+)\/match\/([^/?#]+)/.exec(window.location.pathname);
    const gameIdFromRoute = match?.[1];
    const matchId = match?.[2];
    const mode = (window as Window & { __BG_GAME_MODE__?: string }).__BG_GAME_MODE__;

    return {
        route,
        matchId,
        mode,
        gameIdFromRoute,
    };
}

function normalizeGameIdCandidate(value?: string | null): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    return normalized || undefined;
}

function resolveClientAutoReportGameId(
    payloadGameId: string,
    payloadGameName: string,
    routeGameId?: string,
): string {
    const normalizedPayloadGameId = normalizeGameIdCandidate(payloadGameId);
    const normalizedPayloadGameName = normalizeGameIdCandidate(payloadGameName);
    const normalizedRouteGameId = normalizeGameIdCandidate(routeGameId);
    const normalizedFallbackGameId = normalizedPayloadGameId && normalizedPayloadGameId !== 'unknown'
        ? normalizedPayloadGameId
        : normalizedPayloadGameName && normalizedPayloadGameName !== 'client'
            ? normalizedPayloadGameName
            : undefined;
    const shouldPreferRouteGameId = normalizedPayloadGameId === 'unknown'
        || (normalizedPayloadGameId === 'client' && normalizedPayloadGameName === 'client');

    if (shouldPreferRouteGameId) {
        return normalizedRouteGameId ?? normalizedFallbackGameId ?? normalizedPayloadGameName ?? 'client';
    }

    return normalizedPayloadGameId ?? normalizedRouteGameId ?? normalizedPayloadGameName ?? 'client';
}

function hasRecentReport(signature: string): boolean {
    if (inMemoryReportedKeys.has(signature)) return true;
    if (typeof window === 'undefined') return false;

    try {
        const raw = window.localStorage.getItem(getStorageKey(signature));
        if (!raw) return false;
        const timestamp = Number(raw);
        if (!Number.isFinite(timestamp)) return false;
        if (Date.now() - timestamp > DEDUPE_TTL_MS) {
            window.localStorage.removeItem(getStorageKey(signature));
            return false;
        }
        inMemoryReportedKeys.add(signature);
        return true;
    } catch {
        return false;
    }
}

function markRecentReport(signature: string) {
    inMemoryReportedKeys.add(signature);
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(getStorageKey(signature), String(Date.now()));
    } catch {
        // ignore storage failures
    }
}

function shouldSkipClientAutoReport(payload: ClientAutoReportPayload): boolean {
    const normalizedMessage = payload.errorMessage.trim();
    const normalizedName = payload.errorName.trim();
    if (!normalizedMessage && !normalizedName) {
        return true;
    }
    if (normalizedMessage === 'Script error') {
        return true;
    }
    if (isStaleChunkError(new Error(normalizedMessage || normalizedName))) {
        return true;
    }
    return false;
}

export async function reportClientAutoFeedbackOnce(signature: string, payload: ClientAutoReportPayload) {
    setLastErrorContext({
        name: payload.errorName,
        message: payload.errorMessage,
        stack: payload.stack,
        source: payload.errorSource,
    });

    if (typeof window === 'undefined') return;
    const allowInTest = (window as ClientAutoReportWindow).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ === true;
    if ((import.meta as { env?: Record<string, unknown> }).env?.MODE === 'test' && !allowInTest) return;
    if (IS_DEV_API_DISABLED) return;
    if (shouldSkipClientAutoReport(payload)) return;
    if (hasRecentReport(signature)) return;

    const { route, matchId, mode, gameIdFromRoute } = buildRouteContext();
    const gameId = resolveClientAutoReportGameId(payload.gameId, payload.gameName, gameIdFromRoute);
    const source = payload.source || DEFAULT_CLIENT_AUTO_REPORT_SOURCE;

    markRecentReport(signature);

    try {
        await fetch(FEEDBACK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: payload.content,
                type: 'bug',
                severity: 'high',
                source,
                autoReportKind: payload.autoReportKind,
                gameName: payload.gameName,
                contactInfo: `auto:${source}`,
                clientContext: {
                    route,
                    mode,
                    matchId,
                    playerId: payload.playerId ?? undefined,
                    gameId,
                    appVersion: (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_APP_VERSION
                        || (import.meta as { env?: Record<string, string | undefined> }).env?.MODE
                        || undefined,
                    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
                    viewport: typeof window !== 'undefined'
                        ? { width: window.innerWidth, height: window.innerHeight }
                        : undefined,
                    language: typeof navigator !== 'undefined' ? navigator.language : undefined,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
                },
                errorContext: {
                    name: payload.errorName,
                    message: payload.errorMessage,
                    stack: payload.stack,
                    source: payload.errorSource,
                },
            }),
        });
    } catch (error) {
        console.warn('[client-auto-report] feedback submit failed', error);
    }
}
