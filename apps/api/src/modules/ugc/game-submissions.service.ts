import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createUGCStorageService } from '../../../../../src/server/storage/UGCStorageService';
import { GameSubmission, type GameSubmissionDocument } from './schemas/game-submission.schema';
import type { GameSubmissionDto } from './dtos/game-submission.dto';

@Injectable()
export class GameSubmissionsService {
    private readonly storage = createUGCStorageService();
    constructor(@InjectModel(GameSubmission.name) private readonly records: Model<GameSubmissionDocument>) {}

    list(ownerId: string) { return this.records.find({ ownerId }).sort({ updatedAt: -1 }).limit(100); }
    private async owned(ownerId: string, submissionId: string) {
        const record = await this.records.findOne({ ownerId, submissionId });
        if (!record) throw new NotFoundException('没有找到这份投稿');
        return record;
    }
    private validate(data: GameSubmissionDto) {
        if (!data.name.trim() || !data.description.trim()) throw new BadRequestException('请填写名称和介绍');
        if (data.minPlayers > data.maxPlayers) throw new BadRequestException('最少人数不能大于最多人数');
    }
    create(ownerId: string, data: GameSubmissionDto) {
        this.validate(data);
        return this.records.create({ ...data, name: data.name.trim(), ownerId, submissionId: randomUUID(), status: 'draft' });
    }
    async update(ownerId: string, id: string, data: GameSubmissionDto) {
        this.validate(data);
        const record = await this.owned(ownerId, id);
        Object.assign(record, data, { status: 'draft', reviewComment: '' });
        return record.save();
    }
    async uploadCover(ownerId: string, id: string, buffer: Buffer) {
        const record = await this.owned(ownerId, id);
        let converted: Buffer;
        try { converted = await sharp(buffer, { limitInputPixels: 40_000_000 }).rotate().resize(1200, 1600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer(); }
        catch { throw new BadRequestException('封面不是可读取的图片'); }
        const coverUrl = await this.storage.upload({ userId: ownerId, packageId: `submission-${id}`, fileName: 'cover.webp', fileBuffer: converted, contentType: 'image/webp' });
        record.coverUrl = `${coverUrl}?v=${createHash('sha256').update(converted).digest('hex').slice(0, 16)}`;
        record.status = 'draft';
        await record.save();
        return { coverUrl: record.coverUrl };
    }
    async submit(ownerId: string, id: string) {
        const record = await this.owned(ownerId, id);
        this.validate(record);
        if (!record.coverUrl) throw new BadRequestException('请先上传封面');
        record.status = 'pending';
        record.reviewComment = '';
        return record.save();
    }
}
