import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ExternalPlayRecord, type ExternalPlayDocument } from './schemas/external-play.schema';
import { ExternalGameRecord, type ExternalGameDocument } from './schemas/external-game.schema';
import { mergeTimeRanges } from '../../../../../src/shared/externalGames';
import type { PlayHeartbeatDto } from './dtos/external-game.dto';

@Injectable()
export class ExternalPlayService {
    constructor(
        @InjectModel(ExternalPlayRecord.name) private readonly sessions: Model<ExternalPlayDocument>,
        @InjectModel(ExternalGameRecord.name) private readonly games: Model<ExternalGameDocument>,
    ) {}
    async start(userId: string, gameId: string) {
        if (!await this.games.exists({ gameId, published: true, embedStatus: { $ne: 'blocked' } })) throw new ConflictException('游戏不存在、未公开或嵌入受限，不开始计时');
        const sessionId = randomUUID();
        await this.sessions.create({ sessionId, userId, gameId, lastSeenAt: new Date(), active: true, ended: false, sequence: 0, ranges: [] });
        return { sessionId };
    }
    async heartbeat(userId: string, sessionId: string, data: PlayHeartbeatDto) {
        const record = await this.sessions.findOne({ userId, sessionId });
        if (!record) throw new NotFoundException('游玩会话不存在');
        if (data.sequence <= record.sequence) return { accepted: true, duplicate: true };
        if (record.ended) return { accepted: false };
        if (!await this.games.exists({ gameId: record.gameId, published: true, embedStatus: { $ne: 'blocked' } })) {
            await this.sessions.updateOne({ userId, sessionId, sequence: record.sequence, ended: false }, { $set: { active: false, ended: true } });
            return { accepted: false };
        }
        const now = Date.now();
        // offset 使用客户端单调时钟，延迟重传仍归属会话内原发生时间，不能搬到联网时。
        const end = Math.max(record.lastSeenAt.getTime(), Math.min(now, record.createdAt.getTime() + data.offsetMs));
        const start = Math.max(record.lastSeenAt.getTime(), end - Math.min(data.elapsedMs, 20_000));
        const ranges = record.ranges.map(range => ({ start: range.start, end: range.end }));
        if (record.active && end > start) {
            const last = ranges[ranges.length - 1];
            if (last && last.end === start) last.end = end;
            else ranges.push({ start, end });
        }
        const result = await this.sessions.updateOne({ userId, sessionId, sequence: record.sequence, ended: false }, { $set: {
            sequence: data.sequence, lastSeenAt: new Date(end), active: data.active && !data.ended, ended: data.ended === true, ranges,
        } });
        return { accepted: result.modifiedCount === 1 };
    }
    async history(userId: string) {
        const sessions = (await this.sessions.find({ userId }).select('gameId ranges').lean()).filter(session => session.ranges.length > 0);
        const ids = [...new Set(sessions.map(session => session.gameId))];
        const games = await this.games.find({ gameId: { $in: ids } }).select('gameId name').lean();
        const allRanges = sessions.flatMap(session => session.ranges);
        return {
            totalSeconds: Math.floor(mergeTimeRanges(allRanges) / 1000),
            items: games.map(game => {
                const plays = sessions.filter(session => session.gameId === game.gameId);
                return { gameId: game.gameId, name: game.name, seconds: Math.floor(mergeTimeRanges(plays.flatMap(play => play.ranges)) / 1000),
                    lastPlayedAt: new Date(Math.max(...plays.flatMap(play => play.ranges.map(range => range.end)))).toISOString() };
            }).sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt)),
        };
    }
}
