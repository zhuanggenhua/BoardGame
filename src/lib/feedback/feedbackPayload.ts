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

export interface FeedbackPerformanceContext {
    capturedAt: string;
    windowMs: number;
    frame?: {
        averageFps?: number;
        minFps?: number;
        averageFrameTimeMs?: number;
        maxFrameTimeMs?: number;
        bucketCount?: number;
    };
    longTasks?: {
        count: number;
        totalDurationMs: number;
        maxDurationMs?: number;
    };
    network?: {
        connectionRttMs?: number;
        effectiveType?: string;
        downlinkMbps?: number;
        requestCount: number;
        averageDurationMs?: number;
        maxDurationMs?: number;
        averageTtfbMs?: number;
        recentRequests?: Array<{
            path: string;
            initiatorType?: string;
            durationMs: number;
            ttfbMs?: number;
            connectMs?: number;
        }>;
    };
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
    performance?: FeedbackPerformanceContext;
}

export interface FeedbackErrorContext {
    message?: string;
    name?: string;
    stack?: string;
    source?: string;
    jsStack?: string;
    componentStack?: string;
}

export type FeedbackReplayability = 'full' | 'partial' | 'unreplayable';
export type FeedbackCollectionStatus = 'complete' | 'partial' | 'failed';

export interface FeedbackDiagnosticPacket {
    schemaVersion: 1;
    captureId: string;
    chainId?: string;
    capturedAt: string;
    source: 'user' | 'client-auto' | 'server';
    collectionStatus: FeedbackCollectionStatus;
    replayability: FeedbackReplayability;
    missingFields: string[];
    correlation: {
        matchId?: string;
        roomId?: string;
        requestId?: string;
        stateId?: number;
        stateRevision?: number;
        decisionEpoch?: number;
    };
    build?: {
        appVersion?: string;
        appCommitSha?: string;
        appBuildTime?: string;
        appReleaseChannel?: string;
    };
    phase?: string;
    turnNumber?: number;
    currentPlayerId?: string;
    interaction?: unknown;
    responseWindow?: unknown;
    legalActions?: unknown;
    aiDecisionPreview?: unknown;
    snapshots: {
        before?: unknown;
        at?: unknown;
        after?: unknown;
    };
    actionLogTail?: unknown[];
    eventStreamTail?: unknown[];
    undo?: unknown;
    randomCursor?: number;
    collectionErrors?: string[];
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
    objectDisplayName?: string;
    objectType?: string;
    fieldPath: string;
    fieldDisplayName?: string;
    currentValue?: unknown;
    suggestedValue?: unknown;
    currentDisplayValue?: string;
    updatedDisplayValue?: string;
    reason: string;
    evidence?: string;
    sourceContext?: FeedbackConfigProposalSourceContext;
    status?: string;
}

export type FeedbackConfigProposalDraft = Omit<FeedbackConfigProposal, 'reason'> & {
    reason?: string;
};
