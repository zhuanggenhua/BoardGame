import mongoose from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import type { PersistedMatchRecord } from '../../shared/matchRecord';
import { createMatchRecordSchema } from './matchRecordSchema';

export type IMatchRecord = HydratedDocument<PersistedMatchRecord>;
export const MatchRecord = mongoose.model<PersistedMatchRecord>('MatchRecord', createMatchRecordSchema());
