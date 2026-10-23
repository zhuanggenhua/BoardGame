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
