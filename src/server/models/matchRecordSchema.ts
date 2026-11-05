import { Schema } from 'mongoose';
import type { PersistedMatchRecord } from '../../shared/matchRecord';

/** Both processes write/read the same collection and must use the same schema. */
export function createMatchRecordSchema() {
    const schema = new Schema<PersistedMatchRecord>({
        matchID: { type: String, required: true, unique: true },
        gameName: { type: String, required: true, index: true },
        players: [{
            id: { type: String, required: true },
            seatId: String,
            name: String,
            ownerKey: String,
            isAi: Boolean,
            result: { type: String, enum: ['win', 'loss', 'draw'] },
        }],
        winnerID: String,
        winnerIDs: { type: [String], default: undefined },
        draw: Boolean,
        scores: Schema.Types.Mixed,
        actionLog: Schema.Types.Mixed,
        endedAt: { type: Date, default: Date.now },
    }, { timestamps: true });
    schema.index({ gameName: 1, endedAt: -1 });
    return schema;
}
