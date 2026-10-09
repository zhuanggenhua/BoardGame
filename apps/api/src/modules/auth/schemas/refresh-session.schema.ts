import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type RefreshSessionDocument = HydratedDocument<RefreshSession>;
export const REFRESH_SESSION_MAX_IDLE_SECONDS = 60 * 60 * 24 * 400;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class RefreshSession {
    @Prop({ type: String, required: true, unique: true, index: true })
    sessionId!: string;

    @Prop({ type: String, required: true, index: true })
    userId!: string;

    @Prop({ type: String, required: true, unique: true, select: false })
    tokenHash!: string;

    @Prop({ type: String, select: false })
    previousTokenHash!: string | null;

    @Prop({ type: String, select: false })
    legacyTokenHash!: string | null;

    @Prop({ type: Number, required: true, default: 0 })
    rotationVersion!: number;

    @Prop({ type: Date, required: true, default: Date.now })
    lastUsedAt!: Date;

    @Prop({ type: Date, default: null })
    revokedAt!: Date | null;

    @Prop({ type: Date, default: null })
    previousTokenGraceUntil!: Date | null;

    @Prop({ type: Date, default: null })
    migrationGraceUntil!: Date | null;

    @Prop({ type: Date, default: null })
    cleanupAt!: Date | null;

    createdAt!: Date;
}

export const RefreshSessionSchema = SchemaFactory.createForClass(RefreshSession);
RefreshSessionSchema.index({ userId: 1, revokedAt: 1 });
RefreshSessionSchema.index({ legacyTokenHash: 1 }, { unique: true, sparse: true });
RefreshSessionSchema.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 });
RefreshSessionSchema.index({ lastUsedAt: 1 }, { expireAfterSeconds: REFRESH_SESSION_MAX_IDLE_SECONDS });
