import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import type { Model } from 'mongoose';
import { externalRoomPlayerLimits, externalRoomRosterKey, MAX_EXTERNAL_SIGNAL_LENGTH, type ExternalRoomView } from '../../../../../src/shared/externalRoom';
import { User, type UserDocument } from '../auth/schemas/user.schema';
import { ExternalGamesService } from './external-games.service';
import { ExternalRoomRecord, type ExternalRoomDocument } from './schemas/external-room.schema';

const expiry = () => new Date(Date.now() + 6 * 60 * 60 * 1000);

@Injectable()
export class ExternalRoomsService {
    constructor(
        @InjectModel(ExternalRoomRecord.name) private readonly records: Model<ExternalRoomDocument>,
        @InjectModel(User.name) private readonly users: Model<UserDocument>,
        @Inject(ExternalGamesService) private readonly games: ExternalGamesService,
    ) {}

    async create(userId: string, gameId: string, capacity: unknown) {
        const game = await this.games.get(gameId);
        if (!game.roomProtocol) throw new BadRequestException('该游戏未接入易桌游房间');
        const limits = externalRoomPlayerLimits(game.minPlayers, game.maxPlayers);
        if (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity < limits.min || capacity > limits.max) {
            throw new BadRequestException('房间人数不在游戏支持范围内');
        }
        const member = await this.newMember(userId);
        const room = await this.records.create({ roomId: randomUUID(), gameId, title: game.name, entry: game.url,
            capacity, members: [member], expiresAt: expiry() });
        return this.view(room, userId);
    }

    async join(roomId: string, userId: string) {
        const member = await this.newMember(userId);
        return this.change(roomId, userId, room => {
            if (room.members.some(player => player.userId === userId)) return false;
            if (room.started || room.members.length >= room.capacity) throw new ConflictException('房间已满或已开局');
            room.members.push(member);
            this.resetConnections(room);
            return true;
        });
    }

    async get(roomId: string, userId: string) {
        return this.view(await this.read(roomId), userId);
    }

    async leave(roomId: string, userId: string) {
        await this.change(roomId, userId, room => {
            this.view(room, userId);
            if (room.started) return false;
            if (room.members[0].userId === userId) room.expiresAt = new Date();
            else {
                room.members = room.members.filter(player => player.userId !== userId);
                this.resetConnections(room);
            }
            return true;
        }, false);
    }

    async action(roomId: string, userId: string, action: Record<string, unknown>) {
        return this.change(roomId, userId, room => {
            const { room: snapshot } = this.view(room, userId);
            const member = room.members.find(player => player.seatId === snapshot.seatId)!;
            if (room.started) return false;
            if (room.members.length !== room.capacity) throw new ConflictException('请等待玩家入座');
            if ((action?.type === 'ready' || action?.type === 'signal') && action.rosterKey !== externalRoomRosterKey(room.members)) return false;
            switch (action?.type) {
                case 'ready':
                    if (typeof action.ready !== 'boolean') throw new BadRequestException('无效的就绪状态');
                    if (member.ready === action.ready) return false;
                    member.ready = action.ready;
                    return true;
                case 'start':
                    if (snapshot.hostSeatId !== member.seatId) throw new ForbiddenException('只有房主可以开始对局');
                    if (!room.members.every(player => player.ready)) throw new ConflictException('还有玩家未连接');
                    room.started = true;
                    room.expiresAt = expiry();
                    return true;
                case 'signal': {
                    const { toSeatId, kind, value } = action;
                    const destination = room.members.find(player => player.seatId === toSeatId && player.seatId !== member.seatId);
                    const permitted = member.seatId === snapshot.hostSeatId
                        ? kind === 'offer' : kind === 'answer' && toSeatId === snapshot.hostSeatId;
                    if (!destination || !permitted || typeof value !== 'string' || !value || value.length > MAX_EXTERNAL_SIGNAL_LENGTH) {
                        throw new BadRequestException('无效的房间信令');
                    }
                    const exists = room.signals.find(signal => signal.fromSeatId === member.seatId && signal.toSeatId === toSeatId);
                    if (exists?.value === value) return false;
                    room.signals = room.signals.filter(signal => signal !== exists);
                    room.signals.push({ id: randomUUID(), fromSeatId: member.seatId, toSeatId: destination.seatId,
                        kind: member.seatId === snapshot.hostSeatId ? 'offer' : 'answer', value });
                    return true;
                }
                default: throw new BadRequestException('不支持的房间操作');
            }
        });
    }

    private async newMember(userId: string) {
        const user = await this.users.findById(userId).select('username').lean();
        if (!user) throw new ForbiddenException('请登录后进入房间');
        return { userId, seatId: randomUUID(), displayName: user.username, ready: false };
    }

    private resetConnections(room: ExternalRoomRecord) {
        room.signals = [];
        room.members.forEach(player => { player.ready = false; });
    }

    private async read(roomId: string) {
        const room = await this.records.findOne({ roomId, expiresAt: { $gt: new Date() } }).lean();
        if (!room) throw new NotFoundException('房间不存在或已关闭');
        return room;
    }

    private view(record: ExternalRoomRecord, userId: string): ExternalRoomView {
        const { roomId, gameId, capacity, title, entry, started, members, signals } = record;
        const member = members.find(player => player.userId === userId);
        if (!member) throw new ForbiddenException('请先加入房间');
        const players = members.map(({ seatId, displayName, ready }) => ({ seatId, displayName, ready }));
        return { gameId, capacity, title, entry, started,
            room: { roomId, seatId: member.seatId, hostSeatId: members[0].seatId, players },
            signals: signals.filter(signal => signal.toSeatId === member.seatId) };
    }

    private async change(roomId: string, userId: string, apply: (room: ExternalRoomRecord) => boolean, returnView = true) {
        for (let retry = 0; retry < 5; retry++) {
            const room = await this.read(roomId);
            if (apply(room)) {
                const { members, signals, started, expiresAt, version } = room;
                const saved = await this.records.updateOne({ roomId, version }, { $set: { members, signals, started, expiresAt }, $inc: { version: 1 } });
                if (!saved.modifiedCount) continue;
            }
            return returnView ? this.view(room, userId) : undefined;
        }
        throw new ConflictException('房间状态已更新，请重试');
    }
}
