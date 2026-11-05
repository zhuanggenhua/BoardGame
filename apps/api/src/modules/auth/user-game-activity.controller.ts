import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { MatchRecord, type MatchRecordDocument } from '../admin/schemas/match-record.schema';

@Controller('auth/profile')
@UseGuards(JwtAuthGuard)
export class UserGameActivityController {
    constructor(@InjectModel(MatchRecord.name) private readonly records: Model<MatchRecordDocument>) {}
    @Get('matches')
    async matches(@CurrentUser() user: { userId: string }) {
        const ownerKey = `user:${user.userId}`;
        const records = await this.records.find({ 'players.ownerKey': ownerKey, endedAt: { $ne: null } })
            .select('matchID gameName endedAt players').sort({ endedAt: -1 }).limit(50).lean();
        return records.map(record => {
            const own = record.players.find(player => player.ownerKey === ownerKey)!;
            const result = own.result === 'win' || own.result === 'loss' || own.result === 'draw'
                ? own.result : 'completed';
            // 只返回展示需要的个人结果；不暴露ownerKey、其它玩家标识或完整操作日志。
            return { id: record.matchID, gameId: record.gameName, endedAt: record.endedAt, result,
                opponents: record.players.filter(player => player.id !== own.id).map(player => player.name).filter(Boolean) };
        });
    }
    @Get('activity')
    async activity(@CurrentUser() user: { userId: string }) {
        // Name matching can mix unrelated accounts; only the recorded owner identifies a player.
        const games = await this.records.aggregate<{ _id: string; plays: number; lastPlayed: Date }>([
            { $match: { 'players.ownerKey': `user:${user.userId}`, endedAt: { $ne: null } } },
            { $group: { _id: '$gameName', plays: { $sum: 1 }, lastPlayed: { $max: '$endedAt' } } },
            { $sort: { lastPlayed: -1 } },
        ]);
        return { totalPlays: games.reduce((sum, game) => sum + game.plays, 0), games: games.map(game => ({ gameId: game._id, plays: game.plays, lastPlayed: game.lastPlayed })) };
    }
}
