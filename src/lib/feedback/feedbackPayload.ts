export interface FeedbackElementSummary {
    tagName?: string;
    testId?: string;
    role?: string;
    id?: string;
    name?: string;
    type?: string;
    ariaLabel?: string;
    text?: string;
}

export interface FeedbackUserActionSummary {
    type: string;
    at: string;
    key?: string;
    target?: FeedbackElementSummary;
}

export interface FeedbackRouteChangeSummary {
    from?: string;
    to: string;
    trigger: 'init' | 'pushState' | 'replaceState' | 'popstate' | 'hashchange';
    at: string;
}

export interface FeedbackPageFlags {
    isGamePage?: boolean;
    hasModalOpen?: boolean;
    gameId?: string;
    homeStyle?: string;
    mobileLayoutPreset?: string;
    mobileProfile?: string;
}

export interface FeedbackClientContext {
    route?: string;
    mode?: string;
    matchId?: string;
    playerId?: string;
    gameId?: string;
    appVersion?: string;
    userAgent?: string;
    viewport?: {
        width: number;
        height: number;
    };
    language?: string;
    timezone?: string;
    activeElement?: FeedbackElementSummary;
    lastUserAction?: FeedbackUserActionSummary;
    lastRouteChange?: FeedbackRouteChangeSummary;
    pageFlags?: FeedbackPageFlags;
}

export interface FeedbackErrorContext {
    message?: string;
    name?: string;
    stack?: string;
    source?: string;
    jsStack?: string;
    componentStack?: string;
}
