import { BadRequestException, ForbiddenException, Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { ExternalGameRecord, type ExternalGameDocument } from './schemas/external-game.schema';
import { CreatorClaimRecord, type CreatorClaimDocument } from './schemas/creator-claim.schema';
import { EXTERNAL_GAME_SEEDS } from './external-game-seeds';
import type { ExternalGame, ExternalGameFields } from '../../../../../src/shared/externalGames';
import type { CheckEmbedDto, ExternalGameEditDto } from './dtos/external-game.dto';
import { editableGameFields, gameFieldsUpdate } from './external-game-fields';
import { encodeGameImage } from './game-image';
import { createUGCStorageService } from '../../../../../src/server/storage/UGCStorageService';

@Injectable()
export class ExternalGamesService implements OnModuleInit {
    private readonly storage = createUGCStorageService();
    constructor(
        @InjectModel(ExternalGameRecord.name) private readonly games: Model<ExternalGameDocument>,
        @InjectModel(CreatorClaimRecord.name) private readonly claims: Model<CreatorClaimDocument>,
    ) {}

    async onModuleInit() {
        await this.claims.init();
        for (const seed of EXTERNAL_GAME_SEEDS) {
            await this.games.updateOne({ gameId: seed.gameId }, { $setOnInsert: seed }, { upsert: true });
        }
    }

    private async project(records: ExternalGameDocument[]): Promise<ExternalGame[]> {
        const claims = await this.claims.find({ gameId: { $in: records.map(record => record.gameId) }, status: 'approved' }).select('gameId applicantId').lean();
        const owners = new Map(claims.map(claim => [claim.gameId, claim.applicantId]));
        return records.map(record => ({
            gameId: record.gameId, name: record.name, url: record.url, category: record.category,
            minPlayers: record.minPlayers, maxPlayers: record.maxPlayers, durationMinutes: record.durationMinutes,
            author: record.author, authorProfileUrl: record.authorProfileUrl, description: record.description,
            rules: record.rules, coverUrl: record.coverUrl, published: record.published,
            embedStatus: record.embedStatus, embedReason: record.embedReason,
            embedCheckedUrl: record.embedCheckedUrl, embedCheckedAt: record.embedCheckedAt?.toISOString(),
            ownerUserId: owners.get(record.gameId) ?? null, updatedAt: record.updatedAt.toISOString(),
        }));
    }
    async list() { return this.project(await this.games.find({ published: true }).sort({ createdAt: -1 })); }
    async listForReview() { return this.project(await this.games.find({}).sort({ updatedAt: -1 })); }
    async get(gameId: string) {
        const record = await this.games.findOne({ gameId, published: true });
        if (!record) throw new NotFoundException('游戏不存在或尚未公开');
        return (await this.project([record]))[0];
    }
    async mine(userId: string) {
        const owned = await this.claims.find({ applicantId: userId, status: 'approved' }).select('gameId').lean();
        return this.project(await this.games.find({ gameId: { $in: owned.map(claim => claim.gameId) } }).sort({ updatedAt: -1 }));
    }
    async getOwned(userId: string, gameId: string) {
        await this.assertOwner(userId, gameId);
        const record = await this.games.findOne({ gameId });
        if (!record) throw new NotFoundException('游戏不存在');
        return (await this.project([record]))[0];
    }
    async assertOwner(userId: string, gameId: string) {
        if (!await this.claims.exists({ applicantId: userId, gameId, status: 'approved' })) throw new ForbiddenException('你尚未获得这款游戏的管理权');
    }
    async assertSubmissionEditable(userId: string, gameId?: string) {
        if (!gameId) return;
        const owner = await this.claims.findOne({ gameId, status: 'approved' });
        if (owner && owner.applicantId !== userId) throw new ForbiddenException('游戏已由认证作者管理，你仍可查看原投稿');
    }
    async edit(userId: string, gameId: string, data: ExternalGameEditDto) {
        await this.assertOwner(userId, gameId);
        const record = await this.games.findOne({ gameId });
        if (!record) throw new NotFoundException('游戏不存在');
        const fields = editableGameFields(data);
        const changedUrl = record.url !== fields.url;
        Object.assign(record, fields, { published: data.published });
        if (changedUrl) Object.assign(record, { embedStatus: 'unknown', embedReason: '', embedCheckedUrl: undefined, embedCheckedAt: undefined });
        await record.save();
        return (await this.project([record]))[0];
    }
    async uploadCover(userId: string, gameId: string, buffer: Buffer) {
        await this.assertOwner(userId, gameId);
        const converted = await encodeGameImage(buffer);
        const url = await this.storage.upload({ userId, packageId: `external-${gameId}`, fileName: 'cover.webp', fileBuffer: converted, contentType: 'image/webp' });
        const coverUrl = `${url}?v=${createHash('sha256').update(converted).digest('hex').slice(0, 16)}`;
        await this.games.updateOne({ gameId }, { $set: { coverUrl } });
        return { coverUrl };
    }
    async publishSubmission(submissionId: string, submitterId: string, fields: ExternalGameFields, coverUrl: string) {
        const existing = await this.games.findOne({ submissionId });
        await this.assertSubmissionEditable(submitterId, existing?.gameId);
        const values = editableGameFields(fields);
        const fieldUpdate = gameFieldsUpdate(fields);
        const update = {
            ...fieldUpdate.$set, coverUrl, published: true,
            ...(existing && existing.url !== values.url ? { embedStatus: 'unknown', embedReason: '', embedCheckedUrl: null, embedCheckedAt: null } : {}),
        };
        const record = await this.games.findOneAndUpdate({ submissionId }, {
            $set: update, $unset: fieldUpdate.$unset, $setOnInsert: { gameId: `external-${randomUUID()}` },
        }, { upsert: true, new: true });
        return record!.gameId;
    }
    async setEmbedCheck(gameId: string, data: CheckEmbedDto) {
        const record = await this.games.findOne({ gameId });
        if (!record) throw new NotFoundException('游戏不存在');
        if (data.url !== record.url) throw new BadRequestException('游戏网址已变化，请重新核对当前网址');
        if (data.status !== 'unknown' && !data.reason.trim()) throw new BadRequestException('请说明实际检查结果');
        Object.assign(record, { embedStatus: data.status, embedReason: data.reason, embedCheckedUrl: record.url, embedCheckedAt: new Date() });
        await record.save();
        return (await this.project([record]))[0];
    }
}
