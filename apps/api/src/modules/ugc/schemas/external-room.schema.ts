import { Schema, type HydratedDocument } from 'mongoose';
import type { ExternalRoomPlayer, ExternalRoomSettings, ExternalRoomSignal } from '../../../../../../src/shared/externalRoom';

export interface ExternalRoomMember extends ExternalRoomPlayer { userId: string }

export class ExternalRoomRecord {
    roomId!: string;
    gameId!: string;
    title!: string;
    roomName?: string;
    passwordHash?: string;
    entry!: string;
    capacity!: number;
    settings?: ExternalRoomSettings;
    started!: boolean;
    native?: boolean;
    members!: ExternalRoomMember[];
    signals!: ExternalRoomSignal[];
    expiresAt!: Date;
    version!: number;
}

export type ExternalRoomDocument = HydratedDocument<ExternalRoomRecord>;
const member = new Schema<ExternalRoomMember>({
    userId: String, seatId: String, displayName: String, ready: Boolean,
}, { _id: false });
const signal = new Schema<ExternalRoomSignal>({
    id: String, fromSeatId: String, toSeatId: String, kind: String, value: String,
}, { _id: false });

export const ExternalRoomSchema = new Schema<ExternalRoomRecord>({
    roomId: { type: String, unique: true },
    gameId: String,
    title: String,
    roomName: String,
    passwordHash: String,
    entry: String,
    capacity: Number,
    settings: { type: Schema.Types.Mixed },
    started: { type: Boolean, default: false },
    native: Boolean,
    members: [member],
    signals: [signal],
    expiresAt: { type: Date, expires: 0 },
    version: { type: Number, default: 0 },
});
ExternalRoomSchema.index({ gameId: 1, native: 1, started: 1, expiresAt: 1 });
