import mongoose, { Schema, Document } from 'mongoose';

export interface IMatchRecord extends Document {
    matchID: string;
    gameName: string;
    players: {
        id: string;
        name: string;
        result?: string; // 'win', 'loss', 'draw'
    }[];
    winnerID?: string; // ID of the winner, or null if draw
    /** 游戏结束时的操作日志快照 */
    actionLog?: unknown[];
    createdAt: Date;
    endedAt: Date;
}

const MatchRecordSchema = new Schema<IMatchRecord>(
    {
        matchID: { type: String, required: true, unique: true },
        gameName: { type: String, required: true },
        players: [
            {
                id: { type: String, required: true },
                name: { type: String },
                result: { type: String }
            }
        ],
        winnerID: { type: String },
        /** 游戏结束时的操作日志快照（ActionLogEntry[]） */
        actionLog: { type: Schema.Types.Mixed },
        endedAt: { type: Date, default: Date.now }
    },
    {
        timestamps: true
    }
);

export const MatchRecord = mongoose.model<IMatchRecord>('MatchRecord', MatchRecordSchema);
