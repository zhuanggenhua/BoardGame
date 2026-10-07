import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { MatchRecord, type MatchRecordDocument } from '../admin/schemas/match-record.schema';

export type GuestIdentityClaimResult = {
    guestKey: string;
    userKey: string;
    matchedRecords: number;
    modifiedRecords: number;
};

@Injectable()
export class GuestIdentityClaimService {
    private readonly logger = new Logger(GuestIdentityClaimService.name);

    constructor(
        @InjectModel(MatchRecord.name)
        private readonly matchRecordModel: Model<MatchRecordDocument>,
    ) {}

    async claimGuestHistory({
        guestId,
        userId,
        username,
    }: {
        guestId?: string;
        userId: string;
        username: string;
    }): Promise<GuestIdentityClaimResult | null> {
        const normalizedGuestId = guestId?.trim();
        if (!normalizedGuestId) {
            return null;
        }

        const guestKey = `guest:${normalizedGuestId}`;
        const userKey = `user:${userId}`;
        const playerResult = await this.matchRecordModel.updateMany(
            {
                $or: [
                    { 'players.ownerKey': guestKey },
                    { 'players.id': guestKey },
                ],
            },
            {
                $set: {
                    'players.$[player].id': userKey,
                    'players.$[player].ownerKey': userKey,
                    'players.$[player].name': username,
                },
            },
            {
                arrayFilters: [{
                    $or: [
                        { 'player.ownerKey': guestKey },
                        { 'player.id': guestKey },
                    ],
                }],
            },
        );
        const winnerResult = await this.matchRecordModel.updateMany(
            { winnerID: guestKey },
            { $set: { winnerID: userKey } },
        );

        const summary: GuestIdentityClaimResult = {
            guestKey,
            userKey,
            matchedRecords: (playerResult.matchedCount ?? 0) + (winnerResult.matchedCount ?? 0),
            modifiedRecords: (playerResult.modifiedCount ?? 0) + (winnerResult.modifiedCount ?? 0),
        };
        if (summary.modifiedRecords > 0) {
            this.logger.log(`归并游客排行榜身份 ${guestKey} -> ${userKey}: ${summary.modifiedRecords} 条`);
        }
        return summary;
    }
}
