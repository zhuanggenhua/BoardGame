import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

export const ROOM_MATCH_MODEL_NAME = 'Match';

export type RoomMatchDocument = HydratedDocument<RoomMatch>;

@Schema({ timestamps: true })
export class RoomMatch {
    @Prop({ type: String, required: true, unique: true, index: true })
    matchID!: string;

    @Prop({ type: String, required: true, index: true })
    gameName!: string;

    @Prop({ type: MongooseSchema.Types.Mixed, default: null })
    state?: unknown;

    @Prop({ type: MongooseSchema.Types.Mixed, default: null })
    initialState?: unknown;

    @Prop({ type: MongooseSchema.Types.Mixed, default: null })
    metadata?: unknown;

    @Prop({ type: [MongooseSchema.Types.Mixed], default: [] })
    log?: unknown[];

    @Prop({ type: Number, default: 0 })
    ttlSeconds?: number;

    @Prop({ type: Date, default: null })
    expiresAt?: Date | null;

    createdAt!: Date;
    updatedAt!: Date;
}

export const RoomMatchSchema = SchemaFactory.createForClass(RoomMatch);
