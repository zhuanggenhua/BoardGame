import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import type { EmbedStatus } from '../../../../../../src/shared/externalGames';

export type ExternalGameDocument = HydratedDocument<ExternalGameRecord>;
@Schema({ timestamps: true })
export class ExternalGameRecord {
    @Prop({ type: String, required: true, unique: true }) gameId!: string;
    @Prop({ type: String }) submissionId?: string;
    @Prop({ type: String, required: true }) name!: string;
    @Prop({ type: String, required: true }) url!: string;
    @Prop({ type: String, default: 'uncategorized' }) category!: string;
    @Prop({ type: Number }) minPlayers?: number;
    @Prop({ type: Number }) maxPlayers?: number;
    @Prop({ type: Number }) durationMinutes?: number;
    @Prop({ type: String, default: '' }) author!: string;
    @Prop({ type: String, default: '' }) authorProfileUrl!: string;
    @Prop({ type: String, default: '' }) description!: string;
    @Prop({ type: String, default: '' }) rules!: string;
    @Prop({ type: String, default: '' }) coverUrl!: string;
    @Prop({ type: Boolean, default: true, index: true }) published!: boolean;
    @Prop({ type: String, enum: ['unknown', 'allowed', 'blocked'], default: 'unknown' }) embedStatus!: EmbedStatus;
    @Prop({ type: String, default: '' }) embedReason!: string;
    @Prop({ type: String }) embedCheckedUrl?: string;
    @Prop({ type: Date }) embedCheckedAt?: Date;
    createdAt!: Date;
    updatedAt!: Date;
}
export const ExternalGameSchema = SchemaFactory.createForClass(ExternalGameRecord);
ExternalGameSchema.index({ submissionId: 1 }, { unique: true, partialFilterExpression: { submissionId: { $type: 'string' } } });
