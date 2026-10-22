import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
export type GameSubmissionDocument = HydratedDocument<GameSubmission>;

/** An external game's review record, never a runnable engine package. */
@Schema({ timestamps: true })
export class GameSubmission {
    @Prop({ type: String, required: true, unique: true }) submissionId!: string;
    @Prop({ type: String, required: true, index: true }) ownerId!: string;
    @Prop({ type: String, required: true }) name!: string;
    @Prop({ type: String, required: true }) url!: string;
    @Prop({ type: String, required: true }) category!: string;
    @Prop({ type: Number, required: true }) minPlayers!: number;
    @Prop({ type: Number, required: true }) maxPlayers!: number;
    @Prop({ type: Number }) durationMinutes?: number;
    @Prop({ type: String, default: '' }) author!: string;
    @Prop({ type: String, default: '' }) description!: string;
    @Prop({ type: String, default: '' }) rules!: string;
    @Prop({ type: String, default: '' }) coverUrl!: string;
    @Prop({ type: String, enum: ['draft', 'pending', 'approved', 'rejected'], default: 'draft' }) status!: 'draft' | 'pending' | 'approved' | 'rejected';
    @Prop({ type: String, default: '' }) reviewComment!: string;
    createdAt!: Date;
    updatedAt!: Date;
}
export const GameSubmissionSchema = SchemaFactory.createForClass(GameSubmission);
GameSubmissionSchema.index({ ownerId: 1, updatedAt: -1 });
