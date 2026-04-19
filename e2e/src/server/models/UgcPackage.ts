/**
 * UGC 包模型（游戏服务器侧）
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface UgcPackageRecord extends Document {
    packageId: string;
    ownerId: string;
    name: string;
    description?: string;
    tags?: string[];
    version?: string;
    gameId?: string;
    coverAssetId?: string;
    status: 'draft' | 'published';
    manifest?: Record<string, unknown> | null;
    publishedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const UgcPackageSchema = new Schema<UgcPackageRecord>(
    {
        packageId: { type: String, required: true, unique: true, index: true },
        ownerId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        description: { type: String, default: '' },
        tags: { type: [String], default: [] },
        version: { type: String, default: '' },
        gameId: { type: String, default: '' },
        coverAssetId: { type: String, default: '' },
        status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
        manifest: { type: Schema.Types.Mixed, default: null },
        publishedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

UgcPackageSchema.index({ status: 1, publishedAt: -1 });
UgcPackageSchema.index({ ownerId: 1, updatedAt: -1 });

let UgcPackageModel: Model<UgcPackageRecord> | null = null;

export const getUgcPackageModel = (): Model<UgcPackageRecord> => {
    if (!UgcPackageModel) {
        UgcPackageModel = mongoose.models.UgcPackage as Model<UgcPackageRecord>
            || mongoose.model<UgcPackageRecord>('UgcPackage', UgcPackageSchema);
    }
    return UgcPackageModel;
};
