import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Model } from 'mongoose';
import { hasControlCharacters } from '../../../../../src/shared/externalGames';
import { EXTERNAL_ROOM_PASSWORD_REQUIRED, externalRoomPlayerLimits, externalRoomRosterKey, MAX_EXTERNAL_SIGNAL_LENGTH, type ExternalRoomListing, type ExternalRoomView } from '../../../../../src/shared/externalRoom';
import { User, type UserDocument } from '../auth/schemas/user.schema';
import { ExternalGamesService } from './external-games.service';
import { resolveExternalRoomSettings } from './external-room-setup';
import { ExternalRoomRecord, type ExternalRoomDocument } from './schemas/external-room.schema';

const expiry = () => new Date(Date.now() + 6 * 60 * 60 * 1000);
const liveRoomExpiry = () => new Date(Date.now() + 60_000);

@Injectable()
export class ExternalRoomsService {
    constructor(
        @InjectModel(ExternalRoomRecord.name) private readonly records: Model<ExternalRoomDocument>,
        @InjectModel(User.name) private readonly users: Model<UserDocument>,
        @Inject(ExternalGamesService) private readonly games: ExternalGamesService,
    ) {}

    async create(userId: string, gameId: string, input: { capacity?: unknown; nativeName?: unknown; expectedEntry?: unknown; settings?: unknown; roomName?: unknown; password?: unknown }) {
        const { capacity: requestedCapacity, nativeName, expectedEntry, settings: selectedSettings, roomName, password } = input;
        const game = await this.games.get(gameId);
        const native = nativeName !== undefined;
        if (native ? game.roomAdapter !== 'vale-webrtc' : !game.roomProtocol) {
            throw new BadRequestException('此游戏不支持此房间入口');
        }
        if ((native || expectedEntry !== undefined) && expectedEntry !== game.url) throw new ConflictException('游戏已更新，请重新打开游戏。');
        const { min, max } = native ? { min: 2, max: 4 } : externalRoomPlayerLimits(game.minPlayers, game.maxPlayers);
        const setup = native ? undefined : game.roomSetup;
        const capacity = !native && requestedCapacity === undefined ? setup?.playerCounts[0] ?? min : requestedCapacity;
        if (typeof capacity !== 'number' || !Number.isInteger(capacity)
            || (setup ? !setup.playerCounts.includes(capacity) : capacity < min || capacity > max)) {
            throw new BadRequestException('房间人数不在游戏支持范围内');
        }
        let settings;
        try { settings = resolveExternalRoomSettings(setup, selectedSettings); }
        catch { throw new BadRequestException('房间配置不符合游戏支持的选项'); }
        if (roomName !== undefined && (typeof roomName !== 'string' || roomName.length > 20 || hasControlCharacters(roomName))) {
            throw new BadRequestException('房间名称不能超过 20 个字符或包含控制字符');
        }
        if (password !== undefined && (native || typeof password !== 'string' || password.length > 10 || hasControlCharacters(password))) {
            throw new BadRequestException('房间密码不能超过 10 个字符或包含控制字符');
        }
        const member = await this.newMember(userId, nativeName);
        const trimmedPassword = password?.trim();
        const passwordHash = trimmedPassword ? await bcrypt.hash(trimmedPassword, 10) : undefined;
        const room = await this.records.create({ roomId: randomUUID(), gameId, title: game.name, entry: game.url,
            roomName: roomName?.trim() || undefined, passwordHash, capacity, settings, native, members: [member], expiresAt: liveRoomExpiry() });
        return this.view(room, userId);
    }

    async list(gameId: string): Promise<{ rooms: ExternalRoomListing[] }> {
        if (!await this.games.canListNativeRooms(gameId)) return { rooms: [] };
        const rooms = await this.records.find({ gameId, started: false, expiresAt: { $gt: new Date() } })
            .select('roomId roomName members.displayName capacity native passwordHash').sort({ _id: -1 }).limit(40).lean();
        return { rooms: rooms.map(({ roomId, roomName, members, capacity, native, passwordHash }) => ({
            roomId, roomName, hostName: members[0].displayName, playerNames: members.map(member => member.displayName),
            occupied: members.length, capacity, native, isLocked: Boolean(passwordHash),
        })) };
    }

    async join(roomId: string, userId: string, native: boolean, password?: unknown) {
        const initial = await this.read(roomId);
        if (Boolean(initial.native) !== native) throw new NotFoundException('房间入口已变更');
        if (initial.members.some(player => player.userId === userId)) return this.view(initial, userId);
        if (!await this.games.canListNativeRooms(initial.gameId)) throw new NotFoundException('游戏尚未公开');
        if (initial.started || initial.members.length >= initial.capacity) throw new ConflictException('房间已满或已开局');
        if (initial.passwordHash && (typeof password !== 'string' || password.length > 10
            || !await bcrypt.compare(password.trim(), initial.passwordHash))) {
            throw new ForbiddenException({
                code: EXTERNAL_ROOM_PASSWORD_REQUIRED,
                message: password === undefined ? '请输入房间密码' : '房间密码错误',
            });
        }
        const member = await this.newMember(userId);
        return this.change(roomId, userId, room => {
            if (room.members.some(player => player.userId === userId)) return false;
            if (room.started || room.members.length >= room.capacity) throw new ConflictException('房间已满或已开局');
            room.members.push(member);
            if (!room.native) this.resetConnections(room);
            return true;
        });
    }

    async getEntry(roomId: string) {
        const { gameId, native } = await this.read(roomId);
        if (!await this.games.canListNativeRooms(gameId)) throw new NotFoundException('游戏尚未公开');
        return { gameId, native: Boolean(native) };
    }

    async get(roomId: string, userId: string) {
        const room = await this.read(roomId);
        const view = this.view(room, userId);
        if (!room.started && view.room.seatId === view.room.hostSeatId && room.expiresAt.getTime() < Date.now() + 40_000) {
            await this.records.updateOne({ roomId, version: room.version }, { $set: { expiresAt: liveRoomExpiry() } });
        }
        return view;
    }

    async leave(roomId: string, userId: string) {
        await this.change(roomId, userId, room => {
            this.view(room, userId);
            if (room.started) return false;
            if (room.members[0].userId === userId) room.expiresAt = new Date();
            else {
                const seatId = room.members.find(player => player.userId === userId)?.seatId;
                room.members = room.members.filter(player => player.userId !== userId);
                if (room.native) room.signals = room.signals.filter(signal => signal.fromSeatId !== seatId && signal.toSeatId !== seatId);
                else this.resetConnections(room);
            }
            return true;
        }, false);
    }

    async action(roomId: string, userId: string, action: Record<string, unknown>) {
        return this.change(roomId, userId, room => {
            const { room: snapshot } = this.view(room, userId);
            const member = room.members.find(player => player.seatId === snapshot.seatId)!;
            if (room.started) return false;
            if (!room.native && room.members.length !== room.capacity) throw new ConflictException('请等待玩家入座');
            if (!room.native && (action?.type === 'ready' || action?.type === 'signal') && action.rosterKey !== externalRoomRosterKey(room.members)) return false;
            switch (action?.type) {
                case 'ready':
                    if (typeof action.ready !== 'boolean') throw new BadRequestException('无效的就绪状态');
                    if (member.ready === action.ready) return false;
                    member.ready = action.ready;
                    return true;
                case 'start':
                    if (snapshot.hostSeatId !== member.seatId) throw new ForbiddenException('只有房主可以开始对局');
                    if (!room.native && !room.members.every(player => player.ready)) throw new ConflictException('还有玩家未连接');
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

    private async newMember(userId: string, nativeName?: unknown) {
        if (nativeName !== undefined) {
            if (typeof nativeName !== 'string' || !nativeName.trim() || nativeName.length > 8 || hasControlCharacters(nativeName)) {
                throw new BadRequestException('请填写游戏昵称');
            }
            return { userId, seatId: randomUUID(), displayName: nativeName.trim(), ready: false };
        }
        if (userId.startsWith('guest:')) {
            const alias = createHash('sha256').update(userId).digest('hex').slice(0, 4);
            return { userId, seatId: randomUUID(), displayName: '游客' + alias, ready: false };
        }
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
        const { roomId, gameId, capacity, settings, title, entry, started, native, members, signals } = record;
        const member = members.find(player => player.userId === userId);
        if (!member) throw new ForbiddenException('请先加入房间');
        const players = members.map(({ seatId, displayName, ready }) => ({ seatId, displayName, ready }));
        return { gameId, capacity, title, entry, started, native,
            room: { roomId, seatId: member.seatId, hostSeatId: members[0].seatId, players, settings },
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
