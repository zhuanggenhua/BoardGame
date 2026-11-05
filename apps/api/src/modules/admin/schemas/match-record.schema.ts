import type { HydratedDocument } from 'mongoose';
import type { PersistedMatchRecord } from '../../../../../../src/shared/matchRecord';
import { createMatchRecordSchema } from '../../../../../../src/server/models/matchRecordSchema';

export type MatchRecordDocument = HydratedDocument<MatchRecord>;

export type { MatchRecordPlayer } from '../../../../../../src/shared/matchRecord';

export class MatchRecord implements PersistedMatchRecord {
    declare matchID: string;
    declare gameName: string;
    declare players: PersistedMatchRecord['players'];
    declare winnerID?: string;
    declare winnerIDs?: string[];
    declare draw?: boolean;
    declare scores?: Record<string, number>;
    declare actionLog?: unknown[];
    declare endedAt: Date;
    declare createdAt: Date;
    declare updatedAt: Date;
}

export const MatchRecordSchema = createMatchRecordSchema();
