import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { CreatorClaimRecord, type CreatorClaimDocument } from './schemas/creator-claim.schema';
import { ExternalGameRecord, type ExternalGameDocument } from './schemas/external-game.schema';
import type { CreateCreatorClaimDto, ReviewCreatorClaimDto } from './dtos/external-game.dto';
import { parseExternalUrl } from '../../../../../src/shared/externalGames';
import { encodeGameImage } from './game-image';
import { User, type UserDocument } from '../auth/schemas/user.schema';

@Injectable()
export class CreatorClaimsService {
    constructor(
        @InjectModel(CreatorClaimRecord.name) private readonly claims: Model<CreatorClaimDocument>,
        @InjectModel(ExternalGameRecord.name) private readonly games: Model<ExternalGameDocument>,
        @InjectModel(User.name) private readonly users: Model<UserDocument>,
    ) {}
    list(userId: string) { return this.claims.find({ applicantId: userId }).sort({ createdAt: -1 }); }
    async pending() {
        const records = await this.claims.find({ status: 'pending' }).sort({ updatedAt: 1 });
        const users = await this.users.find({ _id: { $in: records.map(record => record.applicantId) } }).select('username').lean();
        const names = new Map(users.map(user => [String(user._id), user.username]));
        return records.map(record => ({ record, applicantName: names.get(record.applicantId) ?? '账号资料不可用' }));
    }
    async create(userId: string, data: CreateCreatorClaimDto) {
        if (!await this.games.exists({ gameId: data.gameId, published: true })) throw new NotFoundException('请选择已收录的游戏');
        let url: URL;
        try { url = parseExternalUrl(data.profileUrl); } catch { throw new BadRequestException('作者主页网址无效'); }
        if (url.protocol !== 'https:') throw new BadRequestException('作者主页需要 HTTPS 网址');
        if (data.explanation.trim().length < 10) throw new BadRequestException('请填写至少十个字的作品关系说明');
        if (await this.claims.exists({ gameId: data.gameId, applicantId: userId, status: { $in: ['draft', 'pending'] } })) throw new ConflictException('已有未完成的申请，请先完成或撤回');
        return this.claims.create({
            claimId: randomUUID(), applicantId: userId, gameId: data.gameId, profileUrl: url.href,
            explanation: data.explanation.trim(), verificationCode: `BG-${randomBytes(5).toString('hex').toUpperCase()}`,
            verificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), status: 'draft',
        });
    }
    async upload(userId: string, claimId: string, buffer: Buffer) {
        const converted = await encodeGameImage(buffer);
        const record = await this.claims.findOneAndUpdate({ claimId, applicantId: userId, status: 'draft' }, {
            $set: { evidenceImage: converted, hasEvidence: true, evidenceDigest: createHash('sha256').update(converted).digest('hex') },
        }, { new: true });
        if (!record) throw new ForbiddenException('只能为自己的未送审申请上传材料');
        return record;
    }
    async submit(userId: string, claimId: string) {
        const record = await this.claims.findOneAndUpdate({ claimId, applicantId: userId, status: 'draft', hasEvidence: true,
            verificationExpiresAt: { $gt: new Date() } }, { $set: { status: 'pending' } }, { new: true });
        if (!record) throw new BadRequestException('请先上传材料，并在验证期限内送审；过期可撤回后重新申请');
        return record;
    }
    async withdraw(userId: string, claimId: string) {
        const record = await this.claims.findOneAndUpdate({ claimId, applicantId: userId, status: { $in: ['draft', 'pending'] } },
            { $set: { status: 'rejected', reviewComment: '申请人已撤回' } }, { new: true });
        if (!record) throw new BadRequestException('申请已完成，不能撤回');
        return record;
    }
    async image(userId: string, claimId: string, admin = false) {
        const record = await this.claims.findOne({ claimId, ...(admin ? {} : { applicantId: userId }) }).select('+evidenceImage');
        if (!record?.evidenceImage) throw new NotFoundException('没有可访问的认证材料');
        return record.evidenceImage;
    }
    async review(reviewerId: string, claimId: string, data: ReviewCreatorClaimDto) {
        const claim = await this.claims.findOne({ claimId });
        if (!claim) throw new NotFoundException('申请不存在');
        if (claim.applicantId === reviewerId) throw new ForbiddenException('不能审核自己的作者认领申请');
        if (claim.status !== 'pending') throw new ConflictException('申请状态已变化，请刷新');
        if (data.comment.trim().length < 5) throw new BadRequestException('请填写至少五个字的审核意见');
        if (data.evidenceDigest !== claim.evidenceDigest) throw new ConflictException('认证材料已变化，请重新打开核对');
        if (data.decision === 'approved' && (!claim.hasEvidence || !data.profileControlVerified || !data.gameRelationshipVerified)) throw new BadRequestException('必须核对作者主页控制权和目标游戏关系');
        try {
            const updated = await this.claims.findOneAndUpdate({ claimId, status: 'pending' }, { $set: {
                status: data.decision, reviewComment: data.comment.trim(), reviewerId, reviewedAt: new Date(),
            } }, { new: true });
            if (!updated) throw new ConflictException('申请已被处理，请刷新');
            return updated;
        } catch (error) {
            if ((error as { code?: number }).code === 11000) throw new ConflictException('游戏已有认证管理者，请按争议流程处理，不能直接覆盖');
            throw error;
        }
    }
}
