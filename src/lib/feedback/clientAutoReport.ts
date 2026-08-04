import { FEEDBACK_API_URL, IS_DEV_API_DISABLED } from '../../config/server';
import { isStaleChunkError } from '../staleChunkReloadGuard';
import { buildFeedbackClientContext, getCurrentRouteContext } from './clientFeedbackContext';
import { buildGameFeedbackActionLog, buildGameFeedbackStateSnapshot } from './gameFeedbackDiagnostics';
import { getCurrentGameFeedbackContext } from './gameFeedbackContext';
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
    jsStack?: string;
    componentStack?: string;
};

function getStorageKey(signature: string): string {
    return `${DEDUPE_STORAGE_PREFIX}${signature}`;
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

function isKnownClientAudioDeviceNoise(payload: ClientAutoReportPayload): boolean {
    const normalizedMessage = payload.errorMessage.trim().toLowerCase();
    const normalizedName = payload.errorName.trim().toLowerCase();
    if (!normalizedMessage) {
        return false;
    }
    return normalizedMessage.includes('failed to start the audio device')
        && normalizedName === 'invalidstateerror';
}

function isKnownClientAudioCodecNoise(payload: ClientAutoReportPayload): boolean {
    const normalizedMessage = payload.errorMessage.trim().toLowerCase();
    if (!normalizedMessage) {
        return false;
    }
    return normalizedMessage.includes('no codec support for selected audio sources')
        || normalizedMessage.includes('decoding audio data failed')
        || /^failed loading audio file with status: \d+\.?$/.test(normalizedMessage);
}

function isKnownClientAudioHowlerCodeNoise(payload: ClientAutoReportPayload): boolean {
    const normalizedMessage = payload.errorMessage.trim().toLowerCase();
    const normalizedStack = `${payload.stack ?? ''}\n${payload.jsStack ?? ''}`.toLowerCase();
    if (normalizedMessage !== '4') {
        return false;
    }
    return normalizedStack.includes('vendor-howler')
        || normalizedStack.includes('howler');
}

function isGenericScriptErrorNoise(payload: ClientAutoReportPayload): boolean {
    const normalizedMessage = payload.errorMessage.trim().toLowerCase();
    return /^script error\.?$/.test(normalizedMessage);
}

function isCapacitorPluginNotImplementedNoise(payload: ClientAutoReportPayload): boolean {
    const normalizedMessage = payload.errorMessage.trim().toLowerCase();
    return /^"?(app|capacitorupdater)"? plugin is not implemented on android$/.test(normalizedMessage);
}

function isAbortErrorNoise(payload: ClientAutoReportPayload): boolean {
    const normalizedMessage = payload.errorMessage.trim().toLowerCase();
    const normalizedName = payload.errorName.trim().toLowerCase();
    return normalizedName === 'aborterror'
        && /^the operation was aborted\.?$/.test(normalizedMessage);
}

function isEmptyGenericUnhandledRejectionNoise(payload: ClientAutoReportPayload): boolean {
    const normalizedMessage = payload.errorMessage.trim().toLowerCase();
    const normalizedName = payload.errorName.trim().toLowerCase();
    const normalizedStack = `${payload.stack ?? ''}${payload.jsStack ?? ''}${payload.componentStack ?? ''}`.trim();
    return (payload.source || DEFAULT_CLIENT_AUTO_REPORT_SOURCE) === 'client-unhandled-rejection'
        && normalizedName === 'unhandledrejection'
        && normalizedMessage === 'unhandled rejection'
        && normalizedStack.length === 0;
}

function isWebKitBareLoadFailedNoise(payload: ClientAutoReportPayload): boolean {
    const normalizedMessage = payload.errorMessage.trim().toLowerCase();
    const normalizedName = payload.errorName.trim().toLowerCase();
    const normalizedStack = `${payload.stack ?? ''}${payload.jsStack ?? ''}${payload.componentStack ?? ''}`.trim();
    return (payload.source || DEFAULT_CLIENT_AUTO_REPORT_SOURCE) === 'client-unhandled-rejection'
        && normalizedName === 'typeerror'
        && normalizedMessage === 'load failed'
        && payload.errorSource === 'window.unhandledrejection'
        && normalizedStack.length === 0;
}

function isBrowserExtensionInjectionNoise(payload: ClientAutoReportPayload): boolean {
    const normalizedMessage = payload.errorMessage.trim().toLowerCase();
    const normalizedStack = `${payload.stack ?? ''}\n${payload.jsStack ?? ''}\n${payload.errorSource ?? ''}`.toLowerCase();
    const isExtensionFrame = normalizedStack.includes('chrome-extension://')
        || normalizedStack.includes('moz-extension://')
        || normalizedStack.includes('safari-web-extension://')
        || normalizedStack.includes('ms-browser-extension://');
    if (!isExtensionFrame || hasAppStackFrame(payload.stack) || hasAppStackFrame(payload.jsStack)) {
        return false;
    }

    if (normalizedMessage.includes('cannot redefine property: ethereum')
        || normalizedMessage.includes('func sseerror not found')) {
        return true;
    }

    return normalizedStack.includes('chrome-extension://')
        || normalizedStack.includes('moz-extension://')
        || normalizedStack.includes('safari-web-extension://')
        || normalizedStack.includes('ms-browser-extension://');
}

function isCloudflareBeaconNoise(payload: ClientAutoReportPayload): boolean {
    const normalizedMessage = payload.errorMessage.trim().toLowerCase();
    const normalizedStack = `${payload.stack ?? ''}\n${payload.jsStack ?? ''}\n${payload.errorSource ?? ''}`.toLowerCase();
    if (!normalizedStack.includes('static.cloudflareinsights.com/beacon.min.js')) {
        return false;
    }
    if (hasAppStackFrame(payload.stack) || hasAppStackFrame(payload.jsStack) || hasAppStackFrame(payload.componentStack)) {
        return false;
    }

    return normalizedMessage === "cannot read properties of undefined (reading 'readystate')"
        || normalizedMessage === 'cannot read properties of undefined (reading "readystate")'
        || normalizedMessage.endsWith('.at is not a function');
}

function isAnonymousTopLevelDocumentSource(errorSource: string): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    const trimmedSource = errorSource.trim();
    const match = /^(.*):(\d+):(\d+)$/.exec(trimmedSource);
    if (!match) {
        return false;
    }

    const [, rawUrl, rawLine, rawColumn] = match;
    const line = Number(rawLine);
    const column = Number(rawColumn);
    if (!Number.isFinite(line) || !Number.isFinite(column) || line !== 1 || column > 80) {
        return false;
    }

    try {
        const sourceUrl = new URL(rawUrl, window.location.href);
        const currentUrl = new URL(window.location.href);
        return sourceUrl.pathname === currentUrl.pathname
            && sourceUrl.search === currentUrl.search;
    } catch {
        return false;
    }
}

function hasAppStackFrame(stack?: string): boolean {
    if (!stack) {
        return false;
    }
    const normalizedStack = stack.toLowerCase();
    return normalizedStack.includes('/assets/')
        || normalizedStack.includes('/src/')
        || normalizedStack.includes('webpack-internal:')
        || normalizedStack.includes('vite/dist/');
}

function isAnonymousInjectedWindowErrorNoise(payload: ClientAutoReportPayload): boolean {
    if ((payload.source || DEFAULT_CLIENT_AUTO_REPORT_SOURCE) !== 'client-window-error') {
        return false;
    }
    if (!isAnonymousTopLevelDocumentSource(payload.errorSource) || hasAppStackFrame(payload.stack)) {
        return false;
    }

    const normalizedName = payload.errorName.trim().toLowerCase();
    const isUndefinedGlobal = normalizedName === 'referenceerror'
        && /^[a-z_$][a-z0-9_$]* is not defined$/i.test(payload.errorMessage.trim());
    const isAnonymousPropertyRead = normalizedName === 'typeerror'
        && /^cannot read properties of undefined \(reading ['"][a-z0-9_$-]+['"]\)$/i.test(payload.errorMessage.trim());

    return isUndefinedGlobal || isAnonymousPropertyRead;
}

function isKnownDiceBoxThirdPartyRenderNoise(payload: ClientAutoReportPayload): boolean {
    if ((payload.source || DEFAULT_CLIENT_AUTO_REPORT_SOURCE) !== 'client-window-error') {
        return false;
    }

    const normalizedName = payload.errorName.trim().toLowerCase();
    const normalizedMessage = payload.errorMessage.trim().toLowerCase();
    const normalizedStack = `${payload.stack ?? ''}\n${payload.jsStack ?? ''}\n${payload.errorSource ?? ''}`.toLowerCase();
    return normalizedName === 'typeerror'
        && normalizedMessage === "cannot read properties of null (reading 'trim')"
        && normalizedStack.includes('dice-box-threejs');
}

function shouldSkipClientAutoReport(payload: ClientAutoReportPayload): boolean {
    const normalizedMessage = payload.errorMessage.trim();
    const normalizedName = payload.errorName.trim();
    if (!normalizedMessage && !normalizedName) {
        return true;
    }
    if (isGenericScriptErrorNoise(payload)) {
        return true;
    }
    if (isStaleChunkError(new Error(normalizedMessage || normalizedName))) {
        return true;
    }
    if (isCapacitorPluginNotImplementedNoise(payload)) {
        return true;
    }
    if (isKnownClientAudioDeviceNoise(payload)) {
        return true;
    }
    if (isKnownClientAudioCodecNoise(payload)) {
        return true;
    }
    if (isKnownClientAudioHowlerCodeNoise(payload)) {
        return true;
    }
    if (isAbortErrorNoise(payload)) {
        return true;
    }
    if (isEmptyGenericUnhandledRejectionNoise(payload)) {
        return true;
    }
    if (isWebKitBareLoadFailedNoise(payload)) {
        return true;
    }
    if (isBrowserExtensionInjectionNoise(payload)) {
        return true;
    }
    if (isCloudflareBeaconNoise(payload)) {
        return true;
    }
    if (isKnownDiceBoxThirdPartyRenderNoise(payload)) {
        return true;
    }
    if (isAnonymousInjectedWindowErrorNoise(payload)) {
        return true;
    }
    return false;
}

export async function reportClientAutoFeedbackOnce(signature: string, payload: ClientAutoReportPayload) {
    const combinedStack = payload.stack
        ?? [payload.jsStack ?? '', payload.componentStack ?? ''].filter(Boolean).join('\n');

    setLastErrorContext({
        name: payload.errorName,
        message: payload.errorMessage,
        stack: combinedStack,
        source: payload.errorSource,
        jsStack: payload.jsStack ?? payload.stack,
        componentStack: payload.componentStack,
    });

    if (typeof window === 'undefined') return;
    const allowInTest = (window as ClientAutoReportWindow).__BG_ALLOW_CLIENT_AUTO_REPORT_IN_TEST__ === true;
    if ((import.meta as { env?: Record<string, unknown> }).env?.MODE === 'test' && !allowInTest) return;
    if (IS_DEV_API_DISABLED) return;
    if (shouldSkipClientAutoReport(payload)) return;
    if (hasRecentReport(signature)) return;

    const { matchId, mode, gameIdFromRoute } = getCurrentRouteContext();
    const gameId = resolveClientAutoReportGameId(payload.gameId, payload.gameName, gameIdFromRoute);
    const source = payload.source || DEFAULT_CLIENT_AUTO_REPORT_SOURCE;
    const gameFeedbackContext = getCurrentGameFeedbackContext();
    const actionLog = gameFeedbackContext?.state
        ? buildGameFeedbackActionLog(gameFeedbackContext.state)
        : undefined;
    const stateSnapshot = gameFeedbackContext?.state
        ? buildGameFeedbackStateSnapshot(gameFeedbackContext.state)
        : undefined;

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
                actionLog,
                stateSnapshot,
                clientContext: buildFeedbackClientContext({
                    mode,
                    matchId,
                    playerId: payload.playerId ?? undefined,
                    gameId,
                }),
                errorContext: {
                    name: payload.errorName,
                    message: payload.errorMessage,
                    stack: combinedStack,
                    source: payload.errorSource,
                    jsStack: payload.jsStack ?? payload.stack,
                    componentStack: payload.componentStack,
                },
            }),
        });
    } catch (error) {
        console.warn('[client-auto-report] feedback submit failed', error);
    }
}
