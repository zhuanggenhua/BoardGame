import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type UgcBuilderProjectDocument = HydratedDocument<UgcBuilderProject>;

@Schema({ timestamps: true })
export class UgcBuilderProject {
    @Prop({ type: String, required: true, unique: true, index: true, trim: true })
    projectId!: string;

    @Prop({ type: String, required: true, index: true, trim: true })
    ownerId!: string;

    @Prop({ type: String, required: true, trim: true })
    name!: string;

    @Prop({ type: String, default: '', trim: true })
    description?: string;

    @Prop({ type: Object, default: null })
    data?: Record<string, unknown> | null;

    createdAt!: Date;
    updatedAt!: Date;
}

export const UgcBuilderProjectSchema = SchemaFactory.createForClass(UgcBuilderProject);

UgcBuilderProjectSchema.index({ ownerId: 1, updatedAt: -1 });
