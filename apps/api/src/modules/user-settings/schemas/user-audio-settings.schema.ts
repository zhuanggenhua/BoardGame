import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export type UserAudioSettingsDocument = HydratedDocument<UserAudioSettings>;

@Schema({ timestamps: true })
export class UserAudioSettings {
    @Prop({ type: 'ObjectId', ref: 'User', required: true })
    userId!: Types.ObjectId;

    @Prop({ type: Boolean, required: true, default: false })
    muted!: boolean;

    @Prop({ type: Number, required: true, default: 1 })
    masterVolume!: number;

    @Prop({ type: Number, required: true, default: 1 })
    sfxVolume!: number;

    @Prop({ type: Number, required: true, default: 0.6 })
    bgmVolume!: number;

    createdAt!: Date;
    updatedAt!: Date;
}

export const UserAudioSettingsSchema = SchemaFactory.createForClass(UserAudioSettings);

UserAudioSettingsSchema.index({ userId: 1 }, { unique: true });
