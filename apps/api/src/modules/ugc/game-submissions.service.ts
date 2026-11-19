import { BadRequestException, ConflictException, Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createUGCStorageService } from '../../../../../src/server/storage/UGCStorageService';
import { GameSubmission, type GameSubmissionDocument } from './schemas/game-submission.schema';
import type { GameSubmissionDetailsDto, GameSubmissionDto } from './dtos/game-submission.dto';
import type { ReviewSubmissionDto } from './dtos/external-game.dto';
import { ExternalGamesService } from './external-games.service';
import { editableGameFields, gameFieldsUpdate, validateExternalFields } from './external-game-fields';
import { validateGameRulesFile, type GameRulesUpload } from './game-rules-file';
import { storeWebGameZip } from './external-web-game-host';

@Injectable()
export class GameSubmissionsService {
    private readonly storage = createUGCStorageService();
    constructor(@InjectModel(GameSubmission.name) private readonly records: Model<GameSubmissionDocument>,
        @Inject(ExternalGamesService) private readonly games: ExternalGamesService) {}

    list(ownerId: string) { return this.records.find({ ownerId }).sort({ updatedAt: -1 }).limit(100); }
    private async owned(ownerId: string, submissionId: string) {
        const record = await this.records.findOne({ ownerId, submissionId });
        if (!record) throw new NotFoundException('没有找到这份投稿');
        return record;
    }
    private validate(data: GameSubmissionDto) {
        validateExternalFields(data);
    }
    create(ownerId: string, data: GameSubmissionDto) {
        this.validate(data);
        return this.records.create({ ...editableGameFields(data), ownerId, submissionId: randomUUID(), status: 'draft' });
    }
    async update(ownerId: string, id: string, data: GameSubmissionDto) {
        const record = await this.editable(ownerId, id);
        return this.updateDraft(record, data, record.url === data.url.trim() ? record.webZipName : undefined);
    }
    async saveWebZip(ownerId: string, details: GameSubmissionDetailsDto, file: { name: string; buffer: Buffer }, id?: string) {
        const record = id ? await this.editable(ownerId, id) : null;
        const submissionId = record?.submissionId ?? randomUUID();
        this.validate({ ...details, url: '' });
        const url = await storeWebGameZip(submissionId, file.buffer);
        const data = { ...details, url };
        if (record) return this.updateDraft(record, data, file.name);
        return this.records.create({ ...editableGameFields(data), ownerId, submissionId, webZipName: file.name, status: 'draft' });
    }
    private async editable(ownerId: string, id: string) {
        const record = await this.owned(ownerId, id);
        await this.games.assertSubmissionEditable(ownerId, record.gameId);
        if (record.status === 'pending') throw new ConflictException('投稿正在审核，请先撤回再编辑');
        if (record.status === 'approved' && !record.gameId) throw new ConflictException('投稿正在收录，请稍后再编辑');
        return record;
    }
    private async updateDraft(record: GameSubmissionDocument, data: GameSubmissionDto, webZipName?: string) {
        const fields = gameFieldsUpdate(data);
        const updated = await this.records.findOneAndUpdate({ _id: record._id, status: { $ne: 'pending' }, updatedAt: record.updatedAt },
            {
                $set: { ...fields.$set, ...(webZipName ? { webZipName } : {}), status: 'draft', reviewComment: '' },
                $unset: { ...fields.$unset, ...(!webZipName ? { webZipName: 1 } : {}), reviewRevision: 1, reviewerId: 1 },
            }, { new: true });
        if (!updated) throw new ConflictException('投稿正在审核或已发生变化，请刷新后操作');
        return updated;
    }
    async uploadCover(ownerId: string, id: string, buffer: Buffer) {
        const record = await this.owned(ownerId, id);
        await this.games.assertSubmissionEditable(ownerId, record.gameId);
        if (record.status === 'pending') throw new ConflictException('投稿正在审核，请先撤回再修改封面');
        if (record.status === 'approved' && !record.gameId) throw new ConflictException('投稿正在收录，请稍后再修改封面');
        let converted: Buffer;
        try { converted = await sharp(buffer, { limitInputPixels: 40_000_000 }).rotate().resize(1200, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(); }
        catch { throw new BadRequestException('封面不是可读取的图片'); }
        const digest = createHash('sha256').update(converted).digest('hex').slice(0, 16);
        const coverUrl = await this.storage.upload({ userId: ownerId, packageId: `submission-${id}`, fileName: `cover-${digest}.webp`, fileBuffer: converted, contentType: 'image/webp' });
        const updated = await this.records.findOneAndUpdate({ ownerId, submissionId: id, status: { $ne: 'pending' }, updatedAt: record.updatedAt },
            { $set: { coverUrl, status: 'draft' }, $unset: { reviewRevision: 1, reviewerId: 1 } }, { new: true });
        if (!updated) throw new ConflictException('投稿已发生变化，请刷新后重试上传');
        return { coverUrl };
    }
    async uploadRules(ownerId: string, id: string, file: GameRulesUpload) {
        const record = await this.rulesEditable(ownerId, id);
        const validated = validateGameRulesFile(file);
        const url = await this.storage.upload({ userId: ownerId, packageId: `submission-${id}`, fileName: validated.fileName, fileBuffer: file.buffer, contentType: validated.contentType });
        const rulesDocument = { url, name: validated.name, size: validated.size };
        const updated = await this.records.findOneAndUpdate({ ownerId, submissionId: id, status: { $ne: 'pending' }, updatedAt: record.updatedAt },
            { $set: { rulesDocument, status: 'draft' }, $unset: { reviewRevision: 1, reviewerId: 1 } }, { new: true });
        if (!updated) throw new ConflictException('投稿已发生变化，请刷新后重试上传');
        return { rulesDocument };
    }
    private async rulesEditable(ownerId: string, id: string) {
        const record = await this.owned(ownerId, id);
        await this.games.assertSubmissionEditable(ownerId, record.gameId);
        if (record.status === 'pending') throw new ConflictException('投稿正在审核，请先撤回再修改规则文件');
        if (record.status === 'approved' && !record.gameId) throw new ConflictException('投稿正在收录，请稍后再修改规则文件');
        return record;
    }
    async removeRules(ownerId: string, id: string) {
        const record = await this.rulesEditable(ownerId, id);
        const updated = await this.records.findOneAndUpdate({ ownerId, submissionId: id, status: { $ne: 'pending' }, updatedAt: record.updatedAt },
            { $set: { status: 'draft' }, $unset: { rulesDocument: 1, reviewRevision: 1, reviewerId: 1 } }, { new: true });
        if (!updated) throw new ConflictException('投稿已发生变化，请刷新后重试');
        return { removed: true };
    }
    async submit(ownerId: string, id: string) {
        const record = await this.editable(ownerId, id);
        this.validate(record);
        if (!record.coverUrl) throw new BadRequestException('请先上传封面');
        const updated = await this.records.findOneAndUpdate({ ownerId, submissionId: id, status: { $ne: 'pending' }, updatedAt: record.updatedAt },
            { $set: { status: 'pending', reviewComment: '' }, $unset: { reviewRevision: 1, reviewerId: 1 } }, { new: true });
        if (!updated) throw new ConflictException('投稿已送审或已发生变化，请刷新');
        return updated;
    }
    async withdraw(ownerId: string, id: string) {
        const record = await this.owned(ownerId, id);
        await this.games.assertSubmissionEditable(ownerId, record.gameId);
        const updated = await this.records.findOneAndUpdate({ ownerId, submissionId: id, status: 'pending' },
            { $set: { status: 'draft', reviewComment: '' }, $unset: { reviewRevision: 1, reviewerId: 1 } }, { new: true });
        if (!updated) throw new ConflictException('投稿已处理或未送审');
        return updated;
    }
    pending() { return this.records.find({ $or: [{ status: 'pending' }, { status: 'approved', gameId: { $exists: false } }] }).sort({ updatedAt: 1 }); }
    async review(reviewerId: string, id: string, data: ReviewSubmissionDto) {
        if (!data.comment.trim()) throw new BadRequestException('请填写审核意见');
        let record = await this.records.findOne({ submissionId: id, status: 'pending', updatedAt: new Date(data.revision) });
        const retry = !record && data.decision === 'approved'
            ? await this.records.findOne({ submissionId: id, status: 'approved', gameId: { $exists: false }, reviewRevision: data.revision }) : null;
        if (!record && !retry) throw new ConflictException('投稿已处理或版本已变化，请刷新');
        if (retry) record = retry;
        if (!record) throw new ConflictException('投稿不存在');
        if (record.gameId) await this.games.assertSubmissionEditable(record.ownerId, record.gameId);
        if (data.decision === 'approved') {
            this.validate(record);
            if (!record.coverUrl) throw new BadRequestException('请先上传封面');
        }
        const reviewed = retry ?? await this.records.findOneAndUpdate({ submissionId: id, status: 'pending', updatedAt: record.updatedAt },
            {
                $set: { status: data.decision, reviewComment: data.comment, reviewRevision: data.revision, reviewerId },
                // 新收录和版本更新都能沿用待发布审核记录重试。公开游戏记录保留原入口，直到发布成功。
                ...(data.decision === 'approved' ? { $unset: { gameId: 1 } } : {}),
            }, { new: true });
        if (!reviewed) throw new ConflictException('投稿审核时发生变化，请刷新');
        if (data.decision === 'approved') {
            const gameId = await this.games.publishSubmission(reviewed.submissionId, reviewed.ownerId, reviewed, reviewed.coverUrl, reviewed.rulesDocument, reviewed.webZipName);
            await this.records.updateOne({ submissionId: id, status: 'approved', updatedAt: reviewed.updatedAt }, { $set: { gameId } });
            reviewed.gameId = gameId;
        }
        return reviewed;
    }
}
