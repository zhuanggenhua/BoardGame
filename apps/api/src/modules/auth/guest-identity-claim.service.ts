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
        const claimResult = await this.matchRecordModel.updateMany(
            {
                $or: [
                    { 'players.ownerKey': guestKey },
                    { 'players.id': guestKey },
                    { winnerID: guestKey },
                    { winnerIDs: guestKey },
                ],
            },
            [{
                $set: {
                    players: {
                        $map: {
                            input: '$players', as: 'player',
                            in: { $cond: [
                                { $or: [{ $eq: ['$$player.ownerKey', guestKey] }, { $eq: ['$$player.id', guestKey] }] },
                                { $mergeObjects: ['$$player', { id: userKey, ownerKey: userKey, name: { $literal: username } }] },
                                '$$player',
                            ] },
                        },
                    },
                    winnerID: { $cond: [{ $eq: ['$winnerID', guestKey] }, userKey, { $ifNull: ['$winnerID', '$$REMOVE'] }] },
                    winnerIDs: { $cond: [
                        { $isArray: '$winnerIDs' },
                        { $setUnion: [{ $map: {
                            input: '$winnerIDs', as: 'winner',
                            in: { $cond: [{ $eq: ['$$winner', guestKey] }, userKey, '$$winner'] },
                        } }, []] },
                        '$$REMOVE',
                    ] },
                },
            }],
        );

        const summary: GuestIdentityClaimResult = {
            guestKey,
            userKey,
            matchedRecords: claimResult.matchedCount ?? 0,
            modifiedRecords: claimResult.modifiedCount ?? 0,
        };
        if (summary.modifiedRecords > 0) {
            this.logger.log(`归并游客排行榜身份 ${guestKey} -> ${userKey}: ${summary.modifiedRecords} 条`);
        }
        return summary;
    }
}
