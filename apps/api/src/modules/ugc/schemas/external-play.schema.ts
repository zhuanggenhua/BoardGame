import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
export type ExternalPlayDocument = HydratedDocument<ExternalPlayRecord>;
@Schema({ timestamps: true })
export class ExternalPlayRecord {
    @Prop({ type: String, required: true, unique: true }) sessionId!: string;
    @Prop({ type: String, required: true, index: true }) userId!: string;
    @Prop({ type: String, required: true }) gameId!: string;
    @Prop({ type: Number, default: 0 }) sequence!: number;
    @Prop({ type: Boolean, default: true }) active!: boolean;
    @Prop({ type: Boolean, default: false }) ended!: boolean;
    @Prop({ required: true, type: Date }) lastSeenAt!: Date;
    @Prop({ type: [{ start: Number, end: Number, _id: false }], default: [] }) ranges!: Array<{ start: number; end: number }>;
    createdAt!: Date;
    updatedAt!: Date;
}
export const ExternalPlaySchema = SchemaFactory.createForClass(ExternalPlayRecord);
