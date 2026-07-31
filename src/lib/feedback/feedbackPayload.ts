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
    appCommitSha?: string;
    appBuildTime?: string;
    appReleaseChannel?: string;
    userAgent?: string;
    viewport?: {
        width: number;
        height: number;
    };
    language?: string;
    timezone?: string;
    activeElement?: FeedbackElementSummary;
    lastUserAction?: FeedbackUserActionSummary;
    recentUserActions?: FeedbackUserActionSummary[];
    lastRouteChange?: FeedbackRouteChangeSummary;
    recentRouteChanges?: FeedbackRouteChangeSummary[];
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

export interface FeedbackConfigProposalSourceContext {
    route?: string;
    tableId?: string;
    rowId?: string;
    cellKey?: string;
    language?: string;
    objectContext?: unknown;
}

export interface FeedbackConfigProposal {
    gameId: string;
    configVersion: string;
    objectId: string;
    objectType?: string;
    fieldPath: string;
    currentValue?: unknown;
    suggestedValue?: unknown;
    reason: string;
    evidence?: string;
    sourceContext?: FeedbackConfigProposalSourceContext;
    status?: string;
}
