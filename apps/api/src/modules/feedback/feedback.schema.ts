import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FeedbackDocument = Feedback & Document;

export enum FeedbackType {
    BUG = 'bug',
    SUGGESTION = 'suggestion',
    OTHER = 'other'
}

export enum FeedbackSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum FeedbackStatus {
    OPEN = 'open',
    IN_PROGRESS = 'in_progress',
    RESOLVED = 'resolved',
    CLOSED = 'closed'
}

export enum FeedbackReporterType {
    USER = 'user',
    SYSTEM = 'system',
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
    schemaVersion: number;
    captureId: string;
    chainId?: string;
    capturedAt: string;
    source: 'user' | 'client-auto' | 'server';
    collectionStatus: FeedbackCollectionStatus;
    replayability: FeedbackReplayability;
    missingFields: string[];
    correlation?: {
        matchId?: string;
        roomId?: string;
        requestId?: string;
        stateId?: number;
        stateRevision?: number;
        decisionEpoch?: number;
    };
    build?: Record<string, unknown>;
    phase?: string;
    turnNumber?: number;
    currentPlayerId?: string;
    interaction?: unknown;
    responseWindow?: unknown;
    legalActions?: unknown;
    aiDecisionPreview?: unknown;
    snapshots?: {
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

export interface FeedbackConfigProposalSourceContext {
    route?: string;
    tableId?: string;
    rowId?: string;
    cellKey?: string;
    language?: string;
    objectContext?: Record<string, unknown>;
}

export interface FeedbackConfigProposalContext {
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

@Schema({ timestamps: true })
export class Feedback {
    @Prop({ type: Types.ObjectId, ref: 'User', required: false })
    userId?: Types.ObjectId;

    @Prop({ type: String, required: true })
    content!: string;

    @Prop({ type: String, enum: FeedbackType, default: FeedbackType.OTHER })
    type!: FeedbackType;

    @Prop({ type: String, enum: FeedbackSeverity, default: FeedbackSeverity.LOW })
    severity!: FeedbackSeverity;

    @Prop({ type: String, enum: FeedbackStatus, default: FeedbackStatus.OPEN })
    status!: FeedbackStatus;

    @Prop({ type: String, default: null, trim: true })
    closedReason?: string | null;

    @Prop({ type: String, default: null, trim: true })
    resolvedMethod?: string | null;

    @Prop({ type: String, enum: FeedbackReporterType, default: FeedbackReporterType.USER })
    reporterType!: FeedbackReporterType;

    @Prop({ type: String, trim: true, lowercase: true, default: 'feedback-modal' })
    source!: string;

    @Prop({ type: String })
    autoReportKind?: string;

    @Prop({ type: String })
    incidentKey?: string;

    @Prop({ type: String })
    aggregationKey?: string;

    @Prop({ type: String })
    aggregationActiveKey?: string;

    @Prop({ type: Number, default: 1 })
    occurrenceCount!: number;

    @Prop({ type: Date })
    firstOccurredAt?: Date;

    @Prop({ type: Date })
    lastOccurredAt?: Date;

    @Prop({ type: String })
    latestIncidentKey?: string;

    @Prop({ type: String })
    gameName?: string;

    @Prop({ type: String, lowercase: true, trim: true })
    gameId?: string;

    @Prop({ type: String })
    contactInfo?: string;

    @Prop({ type: String })
    actionLog?: string;

    @Prop({ type: String })
    stateSnapshot?: string;

    @Prop({ type: Number, default: 0, min: 0 })
    rewardPoints!: number;

    @Prop({ type: Object })
    clientContext?: FeedbackClientContext;

    @Prop({ type: Object })
    errorContext?: FeedbackErrorContext;

    @Prop({ type: Object })
    diagnosticPacket?: FeedbackDiagnosticPacket;

    @Prop({ type: Object })
    configProposal?: FeedbackConfigProposalContext;

    @Prop({ type: [Object] })
    configProposals?: FeedbackConfigProposalContext[];
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);

FeedbackSchema.index({ reporterType: 1, source: 1, createdAt: -1 });
FeedbackSchema.index({ gameId: 1, createdAt: -1 });
FeedbackSchema.index({ status: 1, createdAt: -1 });
FeedbackSchema.index({ 'diagnosticPacket.replayability': 1, createdAt: -1 });
FeedbackSchema.index({ incidentKey: 1 }, { sparse: true });
FeedbackSchema.index({ aggregationKey: 1 }, { sparse: true });
FeedbackSchema.index(
    { source: 1, status: 1, lastOccurredAt: 1 },
    {
        partialFilterExpression: {
            source: 'online-ai-watchdog',
            status: 'closed',
            aggregationKey: { $exists: true },
        },
    },
);
FeedbackSchema.index(
    { aggregationActiveKey: 1 },
    {
        unique: true,
        partialFilterExpression: {
            aggregationActiveKey: { $exists: true },
            status: { $in: ['open', 'in_progress', 'resolved'] },
        },
    },
);

