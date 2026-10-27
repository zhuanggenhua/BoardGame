import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import type { ClaimStatus } from '../../../../../../src/shared/externalGames';

export type CreatorClaimDocument = HydratedDocument<CreatorClaimRecord>;
@Schema({ timestamps: true })
export class CreatorClaimRecord {
    @Prop({ type: String, required: true, unique: true }) claimId!: string;
    @Prop({ type: String, required: true, index: true }) gameId!: string;
    @Prop({ type: String, required: true, index: true }) applicantId!: string;
    @Prop({ type: String, required: true }) profileUrl!: string;
    @Prop({ type: String, default: '' }) explanation!: string;
    @Prop({ type: String, required: true }) verificationCode!: string;
    @Prop({ required: true, type: Date }) verificationExpiresAt!: Date;
    @Prop({ type: Boolean, default: false }) hasEvidence!: boolean;
    @Prop({ type: String, default: '' }) evidenceDigest!: string;
    @Prop({ type: Buffer, select: false }) evidenceImage?: Buffer;
    @Prop({ type: String, enum: ['draft', 'pending', 'approved', 'rejected'], default: 'draft' }) status!: ClaimStatus;
    @Prop({ type: String, default: '' }) reviewComment!: string;
    @Prop({ type: String }) reviewerId?: string;
    @Prop({ type: Date }) reviewedAt?: Date;
    createdAt!: Date;
    updatedAt!: Date;
}
export const CreatorClaimSchema = SchemaFactory.createForClass(CreatorClaimRecord);
// 审核通过的认领是管理权唯一来源，数据库阻止并发审核产生两个管理者。
CreatorClaimSchema.index({ gameId: 1 }, { name: 'unique_approved_creator_claim_per_game', unique: true, partialFilterExpression: { status: 'approved' } });
