import type {
    FeedbackClientContext,
    FeedbackElementSummary,
    FeedbackPageFlags,
    FeedbackRouteChangeSummary,
    FeedbackUserActionSummary,
} from './feedbackPayload';
import { resolveRuntimeBuildInfo } from './runtimeBuildInfo';

type FeedbackWindow = Window & {
    __BG_CLIENT_DIAGNOSTIC_CAPTURE_INSTALLED__?: boolean;
    __BG_LAST_USER_ACTION__?: FeedbackUserActionSummary;
    __BG_LAST_ROUTE_CHANGE__?: FeedbackRouteChangeSummary;
    __BG_HISTORY_PUSH_STATE_ORIGINAL__?: History['pushState'];
    __BG_HISTORY_REPLACE_STATE_ORIGINAL__?: History['replaceState'];
};

type RouteContext = {
    route?: string;
    matchId?: string;
    mode?: string;
    gameIdFromRoute?: string;
};

const MAX_INLINE_TEXT_LENGTH = 80;

const getHost = (): FeedbackWindow | null => (
    typeof window !== 'undefined' ? (window as FeedbackWindow) : null
);

const truncate = (value: string | null | undefined, maxLength = MAX_INLINE_TEXT_LENGTH): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return undefined;
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
};

const getCurrentRoute = (): string | undefined => {
    if (typeof window === 'undefined') return undefined;
    const route = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    return route || undefined;
};

export function getCurrentRouteContext(): RouteContext {
    if (typeof window === 'undefined') return {};

    const route = getCurrentRoute();
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

function describeElement(element: Element | null): FeedbackElementSummary | undefined {
    if (!(element instanceof HTMLElement)) {
        return undefined;
    }

    const tagName = element.tagName.toLowerCase();
    const role = truncate(element.getAttribute('role'), 32);
    const type = truncate(element.getAttribute('type'), 32);
    const isTextEntry = tagName === 'input'
        || tagName === 'textarea'
        || role === 'textbox'
        || element.getAttribute('contenteditable') === 'true';
    const text = isTextEntry ? undefined : truncate(element.innerText || element.textContent, 80);

    return {
        tagName,
        testId: truncate(element.getAttribute('data-testid'), 64),
        role,
        id: truncate(element.id, 64),
        name: truncate(element.getAttribute('name'), 64),
        type,
        ariaLabel: truncate(element.getAttribute('aria-label'), 80),
        text,
    };
}

function buildPageFlags(): FeedbackPageFlags | undefined {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return undefined;
    }

    const root = document.documentElement;
    const modalRoot = document.getElementById('modal-root');
    const routeContext = getCurrentRouteContext();
    const searchParams = new URLSearchParams(window.location.search);
    const gameId = root.dataset.gameId || routeContext.gameIdFromRoute;
    const flags: FeedbackPageFlags = {
        isGamePage: root.dataset.gamePage === 'true' || window.location.pathname.startsWith('/play/'),
        hasModalOpen: Boolean(modalRoot?.childElementCount) || Boolean(document.querySelector('[aria-modal="true"]')),
        gameId: gameId || undefined,
        homeStyle: searchParams.get('homeStyle') || undefined,
        mobileLayoutPreset: root.dataset.mobileLayoutPreset || undefined,
        mobileProfile: root.dataset.mobileProfile || undefined,
    };

    return Object.values(flags).some((value) => value !== undefined && value !== false) ? flags : undefined;
}

function rememberRouteChange(trigger: FeedbackRouteChangeSummary['trigger'], from?: string) {
    const host = getHost();
    const to = getCurrentRoute();
    if (!host || !to) return;
    host.__BG_LAST_ROUTE_CHANGE__ = {
        from,
        to,
        trigger,
        at: new Date().toISOString(),
    };
}

function rememberLastUserAction(type: string, eventTarget: EventTarget | null, key?: string) {
    const host = getHost();
    if (!host) return;

    const normalizedKey = key && key.length > 1 ? key : undefined;
    host.__BG_LAST_USER_ACTION__ = {
        type,
        at: new Date().toISOString(),
        key: normalizedKey,
        target: describeElement(eventTarget instanceof Element ? eventTarget : null),
    };
}

function installHistoryRouteCapture(host: FeedbackWindow) {
    if (host.__BG_HISTORY_PUSH_STATE_ORIGINAL__ || host.__BG_HISTORY_REPLACE_STATE_ORIGINAL__) {
        return;
    }

    host.__BG_HISTORY_PUSH_STATE_ORIGINAL__ = window.history.pushState.bind(window.history);
    host.__BG_HISTORY_REPLACE_STATE_ORIGINAL__ = window.history.replaceState.bind(window.history);

    window.history.pushState = function patchedPushState(...args) {
        const from = getCurrentRoute();
        const result = host.__BG_HISTORY_PUSH_STATE_ORIGINAL__?.(...args);
        rememberRouteChange('pushState', from);
        return result as void;
    };

    window.history.replaceState = function patchedReplaceState(...args) {
        const from = getCurrentRoute();
        const result = host.__BG_HISTORY_REPLACE_STATE_ORIGINAL__?.(...args);
        rememberRouteChange('replaceState', from);
        return result as void;
    };

    host.addEventListener('popstate', () => rememberRouteChange('popstate', undefined));
    host.addEventListener('hashchange', () => rememberRouteChange('hashchange', undefined));
}

export function installClientDiagnosticCapture() {
    const host = getHost();
    if (!host || host.__BG_CLIENT_DIAGNOSTIC_CAPTURE_INSTALLED__) return;
    host.__BG_CLIENT_DIAGNOSTIC_CAPTURE_INSTALLED__ = true;

    installHistoryRouteCapture(host);
    rememberRouteChange('init', undefined);

    host.addEventListener('pointerdown', (event) => {
        rememberLastUserAction('pointerdown', event.target);
    }, true);

    host.addEventListener('click', (event) => {
        rememberLastUserAction('click', event.target);
    }, true);

    host.addEventListener('submit', (event) => {
        rememberLastUserAction('submit', event.target);
    }, true);

    host.addEventListener('keydown', (event) => {
        rememberLastUserAction('keydown', event.target, event.key);
    }, true);
}

export function getClientDiagnosticContext(): Pick<
    FeedbackClientContext,
    'activeElement' | 'lastUserAction' | 'lastRouteChange' | 'pageFlags'
> {
    const host = getHost();
    if (!host || typeof document === 'undefined') {
        return {};
    }

    return {
        activeElement: describeElement(document.activeElement),
        lastUserAction: host.__BG_LAST_USER_ACTION__,
        lastRouteChange: host.__BG_LAST_ROUTE_CHANGE__,
        pageFlags: buildPageFlags(),
    };
}

export function buildFeedbackClientContext(
    overrides: Partial<Pick<FeedbackClientContext, 'mode' | 'matchId' | 'playerId' | 'gameId'>> = {},
): FeedbackClientContext {
    installClientDiagnosticCapture();

    const routeContext = getCurrentRouteContext();
    const buildInfo = resolveRuntimeBuildInfo();
    return {
        route: routeContext.route,
        mode: overrides.mode ?? routeContext.mode,
        matchId: overrides.matchId ?? routeContext.matchId,
        playerId: overrides.playerId,
        gameId: overrides.gameId ?? routeContext.gameIdFromRoute,
        ...buildInfo,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        viewport: typeof window !== 'undefined'
            ? { width: window.innerWidth, height: window.innerHeight }
            : undefined,
        language: typeof navigator !== 'undefined' ? navigator.language : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
        ...getClientDiagnosticContext(),
    };
}
