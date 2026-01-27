import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export type ReviewDocument = HydratedDocument<Review>;

@Schema({ timestamps: true })
export class Review {
    @Prop({ type: 'ObjectId', ref: 'User', required: true, index: true })
    user!: Types.ObjectId;

    @Prop({ type: String, required: true, index: true, trim: true })
    gameId!: string;

    @Prop({ type: Boolean, required: true })
    isPositive!: boolean;

    @Prop({ type: String, maxlength: 500, trim: true })
    content?: string;

    @Prop({ type: Number, min: 1, max: 10 })
    rating?: number;

    @Prop({ type: [String] })
    tags?: string[];

    @Prop({ type: Number, default: 0 })
    helpfulCount?: number;

    @Prop({ type: Number })
    playTime?: number;

    createdAt!: Date;
    updatedAt!: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.index({ user: 1, gameId: 1 }, { unique: true });
ReviewSchema.index({ gameId: 1, createdAt: -1 });
ReviewSchema.index({ gameId: 1, isPositive: 1 });
