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
    userAgent?: string;
    viewport?: {
        width: number;
        height: number;
    };
    language?: string;
    timezone?: string;
}

export interface FeedbackErrorContext {
    message?: string;
    name?: string;
    stack?: string;
    source?: string;
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

    @Prop({ type: Object })
    clientContext?: FeedbackClientContext;

    @Prop({ type: Object })
    errorContext?: FeedbackErrorContext;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);

FeedbackSchema.index({ reporterType: 1, source: 1, createdAt: -1 });
FeedbackSchema.index({ gameId: 1, createdAt: -1 });
FeedbackSchema.index({ status: 1, createdAt: -1 });
FeedbackSchema.index({ incidentKey: 1 }, { sparse: true });
FeedbackSchema.index({ aggregationKey: 1 }, { sparse: true });

