import { Schema, type HydratedDocument } from 'mongoose';
import type { ExternalRoomPlayer, ExternalRoomSignal } from '../../../../../../src/shared/externalRoom';

export interface ExternalRoomMember extends ExternalRoomPlayer { userId: string }

export class ExternalRoomRecord {
    roomId!: string;
    gameId!: string;
    title!: string;
    entry!: string;
    capacity!: number;
    started!: boolean;
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
    entry: String,
    capacity: Number,
    started: { type: Boolean, default: false },
    members: [member],
    signals: [signal],
    expiresAt: { type: Date, expires: 0 },
    version: { type: Number, default: 0 },
});
