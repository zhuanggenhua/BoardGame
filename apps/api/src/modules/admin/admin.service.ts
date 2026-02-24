import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Cache } from 'cache-manager';
import { Types, type Model } from 'mongoose';
import { User, type UserDocument } from '../auth/schemas/user.schema';
import { Friend, type FriendDocument } from '../friend/schemas/friend.schema';
import { Message, type MessageDocument } from '../message/schemas/message.schema';
import { Review, type ReviewDocument } from '../review/schemas/review.schema';
import { UgcAsset, type UgcAssetDocument } from '../ugc/schemas/ugc-asset.schema';
import { UgcPackage, type UgcPackageDocument } from '../ugc/schemas/ugc-package.schema';
import type { QueryMatchesDto } from './dtos/query-matches.dto';
import type { QueryRoomsDto } from './dtos/query-rooms.dto';
import type { QueryUsersDto } from './dtos/query-users.dto';
import type { QueryUgcPackagesDto } from './dtos/query-ugc-packages.dto';
import type { RoomFilterDto } from './dtos/room-filter.dto';
import { MatchRecord, type MatchRecordDocument, type MatchRecordPlayer } from './schemas/match-record.schema';
import { ROOM_MATCH_MODEL_NAME, type RoomMatchDocument } from './schemas/room-match.schema';

const ADMIN_STATS_CACHE_KEY = 'admin:stats';
const ADMIN_STATS_TREND_CACHE_PREFIX = 'admin:stats:trend:';
const ADMIN_STATS_TTL_SECONDS = 300; // cache-manager-redis-store 使用 Redis SETEX，单位为秒
const RECENT_MATCH_LIMIT = 10;
const DEFAULT_TREND_DAYS = 7;
const ONLINE_KEY_PREFIX = 'social:online:';
const UNREAD_KEY_PREFIX = 'social:unread:';
const UNREAD_TOTAL_KEY_PREFIX = 'social:unread:total:';
const DELETED_USER_PLACEHOLDER = '[已删除用户]';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const resolveOwnerUserId = (ownerKey?: string) => {
    if (!ownerKey?.startsWith('user:')) return null;
    const trimmed = ownerKey.slice('user:'.length).trim();
    if (!trimmed.length) return null;
    return Types.ObjectId.isValid(trimmed) ? trimmed : null;
};

type AdminStatsBase = {
    totalUsers: number;
    todayUsers: number;
    bannedUsers: number;
    totalMatches: number;
    todayMatches: number;
    games: Array<{ name: string; count: number }>;
    playTimeStats: Array<{
        gameName: string;
        totalDuration: number;
        avgDuration: number;
        count: number;
    }>;
};

type AdminStats = AdminStatsBase & {
    onlineUsers: number;
    activeUsers24h: number;
};

type AggregateCount = {
    _id: string | null;
    count: number;
};

type DailyStatsItem = {
    date: string;
    count: number;
};

type AdminStatsTrend = {
    days: number;
    startDate: string;
    endDate: string;
    dailyUsers: DailyStatsItem[];
    dailyMatches: DailyStatsItem[];
    games: Array<{ name: string; count: number }>;
};

type LeanUser = {
    _id: Types.ObjectId;
    username: string;
    email?: string;
    emailVerified: boolean;
    role: 'user' | 'admin';
    banned: boolean;
    bannedAt?: Date | null;
    bannedReason?: string | null;
    createdAt: Date;
    lastOnline?: Date | null;
};

type LeanMatchRecord = {
    matchID: string;
    gameName: string;
    players: MatchRecordPlayer[];
    winnerID?: string;
    actionLog?: unknown[];
    createdAt: Date;
    endedAt: Date;
};

type UserListItem = {
    id: string;
    username: string;
    email?: string;
    emailVerified: boolean;
    role: 'user' | 'admin';
    banned: boolean;
    matchCount: number;
    createdAt: Date;
    lastOnline: Date | null;
};

type UserDetail = {
    user: {
        id: string;
        username: string;
        email?: string;
        emailVerified: boolean;
        role: 'user' | 'admin';
        banned: boolean;
        bannedAt: Date | null;
        bannedReason: string | null;
        createdAt: Date;
        lastOnline: Date | null;
    };
    stats: {
        totalMatches: number;
        wins: number;
        losses: number;
        draws: number;
        winRate: number;
    };
    recentMatches: Array<{
        matchID: string;
        gameName: string;
        result: string;
        opponent: string;
        endedAt: Date;
    }>;
};

type BanUserResult =
    | { ok: true; user: { id: string; username: string; banned: boolean; bannedAt: Date | null; bannedReason: string | null } }
    | { ok: false; code: 'notFound' | 'cannotBanAdmin' };

type DeleteUserResult =
    | { ok: true; user: { id: string; username: string } }
    | { ok: false; code: 'notFound' | 'cannotDeleteAdmin' };

type UserDetailResult =
    | { ok: true; data: UserDetail }
    | { ok: false; code: 'notFound' };

type BulkDeleteResult = {
    requested: number;
    deleted: number;
    skipped: Array<{ id: string; reason: 'invalidId' | 'notFound' | 'cannotDeleteAdmin' }>;
};

type RetentionItem = {
    label: string;
    rate: number;
    total: number;
    retained: number;
};

type RetentionData = {
    items: RetentionItem[];
};

type ActivityTier = {
    label: string;
    count: number;
    color: string;
    description: string;
};

type ActivityTierData = {
    tiers: ActivityTier[];
    totalUsers: number;
};

type MatchListItem = {
    matchID: string;
    gameName: string;
    players: MatchRecordPlayer[];
    winnerID?: string;
    createdAt: Date;
    endedAt: Date;
};

type MatchDetail = {
    matchID: string;
    gameName: string;
    players: Array<MatchRecordPlayer & { userId?: string | null }>;
    winnerID?: string;
    actionLog?: unknown[];
    createdAt: Date;
    endedAt: Date;
    duration: number;
};

type UgcPackageActionResult =
    | { ok: true; package: UgcPackageListItem }
    | { ok: false; code: 'notFound' };

type UgcPackageDeleteResult =
    | { ok: true; assetsDeleted: number }
    | { ok: false; code: 'notFound' };

type RoomPlayerItem = {
    id: number;
    name?: string;
    isConnected?: boolean;
};

type RoomListItem = {
    matchID: string;
    gameName: string;
    roomName?: string;
    ownerKey?: string;
    ownerType?: 'user' | 'guest';
    ownerName?: string;
    isLocked: boolean;
    players: RoomPlayerItem[];
    createdAt: Date;
    updatedAt: Date;
};

type UgcPackageListItem = {
    packageId: string;
    name: string;
    description?: string;
    tags?: string[];
    ownerId: string;
    version?: string;
    gameId?: string;
    coverAssetId?: string;
    status: 'draft' | 'published';
    publishedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

type RoomMatchSetupData = {
    roomName?: string;
    ownerKey?: string;
    ownerType?: 'user' | 'guest';
    password?: string;
};

type RoomMatchLean = {
    matchID: string;
    gameName: string;
    state?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
};

const isValidStats = (value: unknown): value is AdminStatsBase => {
    if (!value || typeof value !== 'object') return false;
    const stats = value as AdminStatsBase;
    return (
        typeof stats.totalUsers === 'number'
        && typeof stats.todayUsers === 'number'
        && typeof stats.bannedUsers === 'number'
        && typeof stats.totalMatches === 'number'
        && typeof stats.todayMatches === 'number'
        && Array.isArray(stats.games)
        && Array.isArray(stats.playTimeStats)
    );
};

const isValidTrend = (value: unknown, days: number): value is AdminStatsTrend => {
    if (!value || typeof value !== 'object') return false;
    const trend = value as AdminStatsTrend;
    return (
        trend.days === days
        && typeof trend.startDate === 'string'
        && typeof trend.endDate === 'string'
        && Array.isArray(trend.dailyUsers)
        && Array.isArray(trend.dailyMatches)
        && Array.isArray(trend.games)
    );
};

@Injectable()
export class AdminService implements OnModuleInit {
    constructor(
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @InjectModel(Friend.name) private readonly friendModel: Model<FriendDocument>,
        @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
        @InjectModel(Review.name) private readonly reviewModel: Model<ReviewDocument>,
        @InjectModel(MatchRecord.name) private readonly matchRecordModel: Model<MatchRecordDocument>,
        @InjectModel(ROOM_MATCH_MODEL_NAME) private readonly roomMatchModel: Model<RoomMatchDocument>,
        @InjectModel(UgcPackage.name) private readonly ugcPackageModel: Model<UgcPackageDocument>,
        @InjectModel(UgcAsset.name) private readonly ugcAssetModel: Model<UgcAssetDocument>,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    ) { }

    /** 启动时清除 admin stats 缓存，防止 Redis 中残留永不过期的旧数据 */
    async onModuleInit() {
        await this.invalidateAdminStatsCache();
    }

    async getStats(): Promise<AdminStats> {
        const cached = await this.cacheManager.get<AdminStatsBase>(ADMIN_STATS_CACHE_KEY);
        const baseStats = cached && isValidStats(cached)
            ? cached
            : await this.buildStatsBase();
        const onlineUserIds = await this.getOnlineUserIds();
        const [onlineUsers, activeUsers24h] = await Promise.all([
            Promise.resolve(onlineUserIds.length),
            this.countActiveUsers24h(onlineUserIds),
        ]);
        return {
            ...baseStats,
            onlineUsers,
            activeUsers24h,
        };
    }

    async getStatsTrend(days?: number): Promise<AdminStatsTrend> {
        const rangeDays = this.resolveTrendDays(days);
        const cacheKey = `${ADMIN_STATS_TREND_CACHE_PREFIX}${rangeDays}`;
        const cached = await this.cacheManager.get<AdminStatsTrend>(cacheKey);
        if (cached && isValidTrend(cached, rangeDays)) {
            return cached;
        }

        const { startDate, endDate } = this.buildTrendRange(rangeDays);
        const timezone = this.resolveTimezoneOffset();
        const dateFormat = '%Y-%m-%d';

        const [userDailyRaw, matchDailyRaw, gameStats] = await Promise.all([
            this.userModel.aggregate<AggregateCount>([
                { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: dateFormat,
                                date: '$createdAt',
                                timezone,
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
            this.matchRecordModel.aggregate<AggregateCount>([
                { $match: { endedAt: { $gte: startDate, $lte: endDate } } },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: dateFormat,
                                date: '$endedAt',
                                timezone,
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
            this.matchRecordModel.aggregate<AggregateCount>([
                { $match: { endedAt: { $gte: startDate, $lte: endDate } } },
                { $group: { _id: '$gameName', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
        ]);

        const dailyUsers = this.buildDailySeries(rangeDays, startDate, userDailyRaw);
        const dailyMatches = this.buildDailySeries(rangeDays, startDate, matchDailyRaw);

        const trend: AdminStatsTrend = {
            days: rangeDays,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            dailyUsers,
            dailyMatches,
            games: gameStats.map(item => ({
                name: String(item._id),
                count: Number(item.count || 0),
            })),
        };

        await this.cacheManager.set(cacheKey, trend, ADMIN_STATS_TTL_SECONDS);
        return trend;
    }

    async getRooms(query: QueryRoomsDto) {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const filter = this.buildRoomFilter(query);

        const [records, total] = await Promise.all([
            this.roomMatchModel
                .find(filter)
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .select('matchID gameName metadata state createdAt updatedAt')
                .lean<RoomMatchLean[]>(),
            this.roomMatchModel.countDocuments(filter),
        ]);

        const items: RoomListItem[] = records.map(record => this.buildRoomListItem(record));
        const ownerUserIds = Array.from(
            new Set(items.map(item => resolveOwnerUserId(item.ownerKey)).filter(Boolean) as string[])
        );
        if (ownerUserIds.length > 0) {
            const owners = await this.userModel
                .find({ _id: { $in: ownerUserIds } })
                .select('_id username')
                .lean<Pick<LeanUser, '_id' | 'username'>[]>();
            const ownerMap = new Map(owners.map(owner => [owner._id.toString(), owner.username]));
            items.forEach(item => {
                const ownerId = resolveOwnerUserId(item.ownerKey);
                if (ownerId) {
                    item.ownerName = ownerMap.get(ownerId);
                }
            });
        }

        return {
            items,
            page,
            limit,
            total,
            hasMore: page * limit < total,
        };
    }

    async getUgcPackages(query: QueryUgcPackagesDto) {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const filter: Record<string, unknown> = {};

        const search = query.search?.trim();
        if (search) {
            const escaped = escapeRegExp(search);
            filter.$or = [
                { packageId: { $regex: escaped, $options: 'i' } },
                { name: { $regex: escaped, $options: 'i' } },
                { gameId: { $regex: escaped, $options: 'i' } },
                { ownerId: { $regex: escaped, $options: 'i' } },
            ];
        }

        if (query.status) {
            filter.status = query.status;
        }

        if (query.ownerId) {
            filter.ownerId = query.ownerId.trim();
        }

        const [items, total] = await Promise.all([
            this.ugcPackageModel
                .find(filter)
                .sort({ updatedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean<UgcPackageDocument[]>(),
            this.ugcPackageModel.countDocuments(filter),
        ]);

        return {
            items: items.map((pkg) => this.toUgcPackageListItem(pkg)),
            page,
            limit,
            total,
            hasMore: page * limit < total,
        };
    }

    async unpublishUgcPackage(packageId: string): Promise<UgcPackageActionResult> {
        const pkg = await this.ugcPackageModel.findOne({ packageId });
        if (!pkg) {
            return { ok: false, code: 'notFound' };
        }
        pkg.status = 'draft';
        pkg.publishedAt = null;
        await pkg.save();
        return { ok: true, package: this.toUgcPackageListItem(pkg) };
    }

    async deleteUgcPackage(packageId: string): Promise<UgcPackageDeleteResult> {
        const pkg = await this.ugcPackageModel.findOne({ packageId }).lean<UgcPackageDocument | null>();
        if (!pkg) {
            return { ok: false, code: 'notFound' };
        }
        const assetResult = await this.ugcAssetModel.deleteMany({ packageId: pkg.packageId });
        await this.ugcPackageModel.deleteOne({ packageId: pkg.packageId });
        return { ok: true, assetsDeleted: assetResult.deletedCount ?? 0 };
    }

    async deleteMatch(matchID: string): Promise<boolean> {
        const result = await this.matchRecordModel.deleteOne({ matchID });
        const deleted = (result.deletedCount ?? 0) > 0;
        if (deleted) {
            await this.invalidateAdminStatsCache();
        }
        return deleted;
    }

    async bulkDeleteMatches(matchIDs: string[]) {
        const uniqueIds = Array.from(new Set(matchIDs.filter(Boolean)));
        if (!uniqueIds.length) {
            return { requested: 0, deleted: 0 };
        }
        const result = await this.matchRecordModel.deleteMany({ matchID: { $in: uniqueIds } });
        if ((result.deletedCount ?? 0) > 0) {
            await this.invalidateAdminStatsCache();
        }
        return { requested: uniqueIds.length, deleted: result.deletedCount ?? 0 };
    }

    async bulkDeleteUsers(userIds: string[]): Promise<BulkDeleteResult> {
        const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
        const skipped: BulkDeleteResult['skipped'] = [];
        if (!uniqueIds.length) {
            return { requested: 0, deleted: 0, skipped };
        }

        const validIds = uniqueIds.filter(id => Types.ObjectId.isValid(id));
        const invalidIds = uniqueIds.filter(id => !Types.ObjectId.isValid(id));
        invalidIds.forEach(id => skipped.push({ id, reason: 'invalidId' }));

        const users = await this.userModel.find({ _id: { $in: validIds } }).lean<LeanUser[]>();
        const userMap = new Map(users.map(user => [user._id.toString(), user]));

        validIds
            .filter(id => !userMap.has(id))
            .forEach(id => skipped.push({ id, reason: 'notFound' }));

        const deletableUsers = users.filter(user => user.role !== 'admin');
        users
            .filter(user => user.role === 'admin')
            .forEach(user => skipped.push({ id: user._id.toString(), reason: 'cannotDeleteAdmin' }));

        if (deletableUsers.length === 0) {
            return { requested: uniqueIds.length, deleted: 0, skipped };
        }

        const deletableIds = deletableUsers.map(user => user._id.toString());
        const usernames = deletableUsers.map(user => user.username).filter(Boolean);

        await Promise.all([
            this.friendModel.deleteMany({ $or: [{ user: { $in: deletableIds } }, { friend: { $in: deletableIds } }] }),
            this.messageModel.deleteMany({ $or: [{ from: { $in: deletableIds } }, { to: { $in: deletableIds } }] }),
            this.reviewModel.deleteMany({ user: { $in: deletableIds } }),
            this.userModel.deleteMany({ _id: { $in: deletableIds } }),
            usernames.length
                ? this.matchRecordModel.updateMany(
                    { 'players.name': { $in: usernames } },
                    { $set: { 'players.$[player].name': DELETED_USER_PLACEHOLDER } },
                    { arrayFilters: [{ 'player.name': { $in: usernames } }] }
                )
                : Promise.resolve(),
        ]);

        await Promise.all(deletableIds.map(id => this.clearUserCache(id)));
        await this.invalidateAdminStatsCache();

        return {
            requested: uniqueIds.length,
            deleted: deletableIds.length,
            skipped,
        };
    }

    async destroyRoom(matchID: string): Promise<boolean> {
        const result = await this.roomMatchModel.deleteOne({ matchID });
        return (result.deletedCount ?? 0) > 0;
    }

    async bulkDestroyRooms(matchIDs: string[]) {
        const uniqueIds = Array.from(new Set(matchIDs.filter(Boolean)));
        if (!uniqueIds.length) {
            return { requested: 0, deleted: 0 };
        }
        const result = await this.roomMatchModel.deleteMany({ matchID: { $in: uniqueIds } });
        return { requested: uniqueIds.length, deleted: result.deletedCount ?? 0 };
    }

    async bulkDestroyRoomsByFilter(filterDto: RoomFilterDto) {
        const filter = this.buildRoomFilter(filterDto);
        const total = await this.roomMatchModel.countDocuments(filter);
        if (total === 0) {
            return { requested: 0, deleted: 0 };
        }
        const result = await this.roomMatchModel.deleteMany(filter);
        return { requested: total, deleted: result.deletedCount ?? 0 };
    }

    async getUsers(query: QueryUsersDto) {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const filter: Record<string, unknown> = {};

        if (query.search) {
            const escaped = escapeRegExp(query.search.trim());
            filter.$or = [
                { username: { $regex: escaped, $options: 'i' } },
                { email: { $regex: escaped, $options: 'i' } },
            ];
        }

        if (typeof query.banned === 'boolean') {
            filter.banned = query.banned;
        }

        if (query.role) {
            filter.role = query.role;
        }

        const [users, total] = await Promise.all([
            this.userModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean<LeanUser[]>(),
            this.userModel.countDocuments(filter),
        ]);

        const usernames = users.map(user => user.username).filter(Boolean);
        const matchCountMap = await this.buildMatchCountMap(usernames);

        const items: UserListItem[] = users.map(user => ({
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            emailVerified: user.emailVerified,
            role: user.role,
            banned: user.banned,
            matchCount: matchCountMap.get(user.username) ?? 0,
            createdAt: user.createdAt,
            lastOnline: user.lastOnline ?? null,
        }));

        return {
            items,
            page,
            limit,
            total,
            hasMore: page * limit < total,
        };
    }

    async getUserDetail(userId: string): Promise<UserDetailResult> {
        const user = await this.userModel.findById(userId).lean<LeanUser | null>();
        if (!user) {
            return { ok: false, code: 'notFound' };
        }

        const [stats, recentMatches] = await Promise.all([
            this.getUserStatsByName(user.username),
            this.getRecentMatchesByName(user.username),
        ]);

        return {
            ok: true,
            data: {
                user: {
                    id: user._id.toString(),
                    username: user.username,
                    email: user.email,
                    emailVerified: user.emailVerified,
                    role: user.role,
                    banned: user.banned,
                    bannedAt: user.bannedAt ?? null,
                    bannedReason: user.bannedReason ?? null,
                    createdAt: user.createdAt,
                    lastOnline: user.lastOnline ?? null,
                },
                stats,
                recentMatches,
            },
        };
    }

    async deleteUser(userId: string): Promise<DeleteUserResult> {
        const user = await this.userModel.findById(userId).lean<LeanUser | null>();
        if (!user) {
            return { ok: false, code: 'notFound' };
        }
        if (user.role === 'admin') {
            return { ok: false, code: 'cannotDeleteAdmin' };
        }

        const username = user.username;
        await Promise.all([
            this.friendModel.deleteMany({ $or: [{ user: userId }, { friend: userId }] }),
            this.messageModel.deleteMany({ $or: [{ from: userId }, { to: userId }] }),
            this.reviewModel.deleteMany({ user: userId }),
            this.userModel.deleteOne({ _id: userId }),
            this.matchRecordModel.updateMany(
                { 'players.name': username },
                { $set: { 'players.$[player].name': DELETED_USER_PLACEHOLDER } },
                { arrayFilters: [{ 'player.name': username }] }
            ),
        ]);

        await this.clearUserCache(userId);
        await this.invalidateAdminStatsCache();

        return {
            ok: true,
            user: {
                id: userId,
                username,
            },
        };
    }

    async banUser(userId: string, reason: string): Promise<BanUserResult> {
        const user = await this.userModel.findById(userId).lean();
        if (!user) {
            return { ok: false, code: 'notFound' };
        }

        if (user.role === 'admin') {
            return { ok: false, code: 'cannotBanAdmin' };
        }

        const bannedAt = new Date();
        const next = await this.userModel.findByIdAndUpdate(
            userId,
            { banned: true, bannedAt, bannedReason: reason },
            { new: true }
        );

        if (!next) {
            return { ok: false, code: 'notFound' };
        }

        return {
            ok: true,
            user: {
                id: next._id.toString(),
                username: next.username,
                banned: next.banned,
                bannedAt: next.bannedAt ?? null,
                bannedReason: next.bannedReason ?? null,
            },
        };
    }

    async unbanUser(userId: string): Promise<BanUserResult> {
        const next = await this.userModel.findByIdAndUpdate(
            userId,
            { banned: false, bannedAt: null, bannedReason: null },
            { new: true }
        );

        if (!next) {
            return { ok: false, code: 'notFound' };
        }

        return {
            ok: true,
            user: {
                id: next._id.toString(),
                username: next.username,
                banned: next.banned,
                bannedAt: next.bannedAt ?? null,
                bannedReason: next.bannedReason ?? null,
            },
        };
    }

    async getMatches(query: QueryMatchesDto) {
        const page = query.page || 1;
        const limit = query.limit || 20;
        const filter: Record<string, unknown> = {};

        if (query.gameName) {
            const escaped = escapeRegExp(query.gameName.trim());
            filter.gameName = { $regex: `^${escaped}$`, $options: 'i' };
        }

        if (query.search) {
            const escaped = escapeRegExp(query.search.trim());
            filter.$or = [
                { matchID: { $regex: escaped, $options: 'i' } },
                { 'players.name': { $regex: escaped, $options: 'i' } },
            ];
        }

        const endedAtFilter: Record<string, Date | boolean | null> = {
            $exists: true,
            $ne: null,
        };
        if (query.startDate) {
            endedAtFilter.$gte = new Date(query.startDate);
        }
        if (query.endDate) {
            endedAtFilter.$lte = new Date(query.endDate);
        }
        filter.endedAt = endedAtFilter;

        const [records, total] = await Promise.all([
            this.matchRecordModel
                .find(filter)
                .select('-actionLog')
                .sort({ endedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean<LeanMatchRecord[]>(),
            this.matchRecordModel.countDocuments(filter),
        ]);

        const items: MatchListItem[] = records.map(record => ({
            matchID: record.matchID,
            gameName: record.gameName,
            players: record.players,
            winnerID: record.winnerID,
            createdAt: record.createdAt,
            endedAt: record.endedAt,
        }));

        return {
            items,
            page,
            limit,
            total,
            hasMore: page * limit < total,
        };
    }

    async getMatchDetail(matchID: string): Promise<MatchDetail | null> {
        const match = await this.matchRecordModel.findOne({ matchID }).lean<LeanMatchRecord | null>();
        if (!match) return null;

        const usernames = match.players
            .map(player => player.name)
            .filter((name): name is string => Boolean(name));
        const users = usernames.length
            ? await this.userModel
                .find({ username: { $in: usernames } })
                .select('username')
                .lean<Array<{ _id: Types.ObjectId; username: string }>>()
            : [];
        const userMap = new Map(users.map(user => [user.username, user._id.toString()]));

        const durationMs = match.endedAt && match.createdAt
            ? Math.max(0, match.endedAt.getTime() - match.createdAt.getTime())
            : 0;

        return {
            matchID: match.matchID,
            gameName: match.gameName,
            players: match.players.map(player => ({
                ...player,
                userId: player.name ? userMap.get(player.name) ?? null : null,
            })),
            winnerID: match.winnerID,
            actionLog: match.actionLog,
            createdAt: match.createdAt,
            endedAt: match.endedAt,
            duration: Math.round(durationMs / 1000),
        };
    }

    private async buildMatchCountMap(usernames: string[]) {
        if (!usernames.length) return new Map<string, number>();

        const results = await this.matchRecordModel.aggregate<AggregateCount>([
            { $match: { 'players.name': { $in: usernames }, endedAt: { $exists: true, $ne: null } } },
            { $unwind: '$players' },
            { $match: { 'players.name': { $in: usernames } } },
            { $group: { _id: '$players.name', count: { $sum: 1 } } },
        ]);

        return new Map(results.map(item => [String(item._id), Number(item.count || 0)]));
    }

    private async getUserStatsByName(username: string) {
        const totalMatches = await this.matchRecordModel.countDocuments({ 'players.name': username, endedAt: { $exists: true, $ne: null } });
        if (!totalMatches) {
            return {
                totalMatches: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                winRate: 0,
            };
        }

        const results = await this.matchRecordModel.aggregate<AggregateCount>([
            { $match: { 'players.name': username, endedAt: { $exists: true, $ne: null } } },
            { $unwind: '$players' },
            { $match: { 'players.name': username } },
            { $group: { _id: '$players.result', count: { $sum: 1 } } },
        ]);

        const resultMap = new Map(results.map(item => [String(item._id), Number(item.count || 0)]));
        const wins = resultMap.get('win') ?? 0;
        const losses = resultMap.get('loss') ?? 0;
        const draws = totalMatches - wins - losses;

        return {
            totalMatches,
            wins,
            losses,
            draws,
            winRate: totalMatches ? wins / totalMatches : 0,
        };
    }

    private async getRecentMatchesByName(username: string) {
        const records = await this.matchRecordModel
            .find({ 'players.name': username, endedAt: { $exists: true, $ne: null } })
            .sort({ endedAt: -1 })
            .limit(RECENT_MATCH_LIMIT)
            .lean<LeanMatchRecord[]>();

        return records.map(record => {
            const current = record.players.find(player => player.name === username);
            const opponent = record.players.find(player => player.name && player.name !== username)?.name ?? '未知';
            return {
                matchID: record.matchID,
                gameName: record.gameName,
                result: current?.result ?? 'draw',
                opponent,
                endedAt: record.endedAt,
            };
        });
    }

    private async buildStatsBase(): Promise<AdminStatsBase> {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const matchEndedFilter = { endedAt: { $exists: true, $ne: null } };
        const [totalUsers, todayUsers, bannedUsers, totalMatches, todayMatches, gameStats] = await Promise.all([
            this.userModel.countDocuments(),
            this.userModel.countDocuments({ createdAt: { $gte: todayStart } }),
            this.userModel.countDocuments({ banned: true }),
            this.matchRecordModel.countDocuments(matchEndedFilter),
            this.matchRecordModel.countDocuments({ endedAt: { $gte: todayStart } }),
            this.matchRecordModel.aggregate<AggregateCount>([
                { $match: matchEndedFilter },
                { $group: { _id: '$gameName', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
        ]);

        const stats: AdminStatsBase = {
            totalUsers,
            todayUsers,
            bannedUsers,
            totalMatches,
            todayMatches,
            games: gameStats.map(item => ({
                name: String(item._id),
                count: Number(item.count || 0),
            })),
            playTimeStats: await this.getGamePlayStats(),
        };

        await this.cacheManager.set(ADMIN_STATS_CACHE_KEY, stats, ADMIN_STATS_TTL_SECONDS);
        return stats;
    }

    private buildRoomListItem(record: RoomMatchLean): RoomListItem {
        const metadata = record.metadata as { players?: Record<string, { name?: string; isConnected?: boolean }>; setupData?: RoomMatchSetupData } | null | undefined;
        const state = record.state as { G?: { __setupData?: RoomMatchSetupData } } | null | undefined;
        const setupDataFromMeta = metadata?.setupData;
        const setupDataFromState = state?.G?.__setupData;
        const setupData: RoomMatchSetupData = {
            roomName: setupDataFromMeta?.roomName ?? setupDataFromState?.roomName,
            ownerKey: setupDataFromMeta?.ownerKey ?? setupDataFromState?.ownerKey,
            ownerType: setupDataFromMeta?.ownerType ?? setupDataFromState?.ownerType,
            password: setupDataFromMeta?.password ?? setupDataFromState?.password,
        };
        const playersObj = metadata?.players ?? {};
        const players: RoomPlayerItem[] = Object.entries(playersObj).map(([id, data]) => ({
            id: Number(id),
            name: data?.name,
            isConnected: data?.isConnected,
        }));
        const isLocked = Boolean(setupData.password && String(setupData.password).length > 0);

        return {
            matchID: record.matchID,
            gameName: record.gameName,
            roomName: setupData.roomName,
            ownerKey: setupData.ownerKey,
            ownerType: setupData.ownerType,
            isLocked,
            players,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        };
    }

    private toUgcPackageListItem(pkg: UgcPackageDocument): UgcPackageListItem {
        return {
            packageId: pkg.packageId,
            name: pkg.name,
            description: pkg.description,
            tags: pkg.tags,
            ownerId: pkg.ownerId,
            version: pkg.version,
            gameId: pkg.gameId,
            coverAssetId: pkg.coverAssetId,
            status: pkg.status,
            publishedAt: pkg.publishedAt ?? null,
            createdAt: pkg.createdAt,
            updatedAt: pkg.updatedAt,
        };
    }

    private buildRoomFilter(query: RoomFilterDto) {
        const filter: Record<string, unknown> = {};
        const gameName = query.gameName?.trim();
        const search = query.search?.trim();

        if (gameName) {
            const escaped = escapeRegExp(gameName);
            filter.gameName = { $regex: `^${escaped}$`, $options: 'i' };
        }

        if (search) {
            const escaped = escapeRegExp(search);
            filter.$or = [
                { matchID: { $regex: escaped, $options: 'i' } },
                { 'metadata.setupData.roomName': { $regex: escaped, $options: 'i' } },
                { 'metadata.roomName': { $regex: escaped, $options: 'i' } },
                { 'state.G.__setupData.roomName': { $regex: escaped, $options: 'i' } },
            ];
        }

        return filter;
    }

    private async getOnlineUserIds(): Promise<string[]> {
        const keys = await this.getCacheKeys(`${ONLINE_KEY_PREFIX}*`);
        return this.extractOnlineUserIds(keys);
    }

    private extractOnlineUserIds(keys: string[]) {
        return keys
            .filter(key => key.startsWith(ONLINE_KEY_PREFIX))
            .map(key => key.slice(ONLINE_KEY_PREFIX.length))
            .filter(Boolean);
    }

    private async removeCacheByPattern(pattern: string) {
        const keys = await this.getCacheKeys(pattern);
        if (!keys.length) return;
        const store = this.cacheManager.store as { getClient?: () => any; client?: any };
        const client = store?.getClient ? store.getClient() : store?.client;
        if (client?.del) {
            const result = client.del.length >= 2
                ? new Promise<void>((resolve, reject) => {
                    client.del(keys, (err: Error | null) => {
                        if (err) return reject(err);
                        resolve();
                    });
                })
                : client.del(keys);
            await Promise.resolve(result);
            return;
        }
        await Promise.all(keys.map(key => this.cacheManager.del(key)));
    }

    private async getCacheKeys(pattern: string): Promise<string[]> {
        const store = this.cacheManager.store as { getClient?: () => any; client?: any; keys?: (pattern: string) => Promise<string[]> | string[] };
        try {
            if (store?.getClient) {
                const client = store.getClient();
                return await this.resolveRedisKeys(client, pattern);
            }
            if (store?.client) {
                return await this.resolveRedisKeys(store.client, pattern);
            }
            if (store?.keys) {
                const keys = await Promise.resolve(store.keys(pattern));
                return Array.isArray(keys) ? keys : [];
            }
        } catch {
            return [];
        }
        return [];
    }

    private async getGamePlayStats() {
        // Only consider matches that have ended and have valid duration
        const stats = await this.matchRecordModel.aggregate([
            {
                $match: {
                    endedAt: { $exists: true, $ne: null },
                    createdAt: { $exists: true, $ne: null }
                }
            },
            {
                $project: {
                    gameName: 1,
                    duration: { $subtract: ["$endedAt", "$createdAt"] }
                }
            },
            // Filter reasonable durations (e.g., > 1 min, < 24 hours) - optional but good for data quality
            {
                $match: {
                    duration: { $gt: 1000 * 60, $lt: 1000 * 60 * 60 * 24 }
                }
            },
            {
                $group: {
                    _id: "$gameName",
                    totalDuration: { $sum: "$duration" },
                    avgDuration: { $avg: "$duration" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { totalDuration: -1 } }
        ]);

        return stats.map(s => ({
            gameName: s._id || 'Unknown',
            totalDuration: Math.round(s.totalDuration || 0),
            avgDuration: Math.round(s.avgDuration || 0),
            count: s.count || 0
        }));
    }

    private async resolveRedisKeys(client: { keys?: (...args: any[]) => any } | null, pattern: string): Promise<string[]> {
        if (!client?.keys) return [];
        const result = client.keys.length >= 2
            ? new Promise<string[]>((resolve, reject) => {
                client.keys?.(pattern, (err: Error | null, keys: string[]) => {
                    if (err) return reject(err);
                    resolve(keys);
                });
            })
            : client.keys(pattern);
        const keys = await Promise.resolve(result);
        return Array.isArray(keys) ? keys : [];
    }

    private async countActiveUsers24h(onlineUserIds: string[]): Promise<number> {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const onlineObjectIds = onlineUserIds
            .filter(id => Types.ObjectId.isValid(id))
            .map(id => new Types.ObjectId(id));
        const conditions: Record<string, unknown>[] = [
            { lastOnline: { $gte: since } },
        ];
        if (onlineObjectIds.length > 0) {
            conditions.push({ _id: { $in: onlineObjectIds } });
        }
        return this.userModel.countDocuments({ $or: conditions });
    }

    private resolveTrendDays(days?: number) {
        return days === 30 ? 30 : DEFAULT_TREND_DAYS;
    }

    private buildTrendRange(days: number) {
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - (days - 1));
        startDate.setHours(0, 0, 0, 0);
        return { startDate, endDate };
    }

    private resolveTimezoneOffset() {
        const offsetMinutes = -new Date().getTimezoneOffset();
        const sign = offsetMinutes >= 0 ? '+' : '-';
        const abs = Math.abs(offsetMinutes);
        const hours = String(Math.floor(abs / 60)).padStart(2, '0');
        const minutes = String(abs % 60).padStart(2, '0');
        return `${sign}${hours}:${minutes}`;
    }

    private buildDailySeries(days: number, startDate: Date, raw: AggregateCount[]): DailyStatsItem[] {
        const map = new Map(raw.map(item => [String(item._id), Number(item.count || 0)]));
        const items: DailyStatsItem[] = [];
        for (let index = 0; index < days; index += 1) {
            const current = new Date(startDate);
            current.setDate(startDate.getDate() + index);
            const key = this.formatDate(current);
            items.push({
                date: key,
                count: map.get(key) ?? 0,
            });
        }
        return items;
    }

    private formatDate(date: Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private async clearUserCache(userId: string) {
        await this.cacheManager.del(`${ONLINE_KEY_PREFIX}${userId}`);
        await this.cacheManager.del(`${UNREAD_TOTAL_KEY_PREFIX}${userId}`);
        await this.removeCacheByPattern(`${UNREAD_KEY_PREFIX}${userId}:*`);
        await this.removeCacheByPattern(`${UNREAD_KEY_PREFIX}*:${userId}`);
    }

    private async invalidateAdminStatsCache() {
        await this.cacheManager.del(ADMIN_STATS_CACHE_KEY);
        await this.cacheManager.del('admin:retention');
        await this.cacheManager.del('admin:activity-tiers');
        await this.removeCacheByPattern(`${ADMIN_STATS_TREND_CACHE_PREFIX}*`);
    }

    // ─── 留存分析 ───────────────────────────────────────────────
    async getRetention(): Promise<RetentionData> {
        const cacheKey = 'admin:retention';
        const cached = await this.cacheManager.get<RetentionData>(cacheKey);
        if (cached) return cached;

        const now = new Date();
        const periods = [
            { label: '次日留存', offsetDays: 1 },
            { label: '3日留存', offsetDays: 3 },
            { label: '7日留存', offsetDays: 7 },
            { label: '14日留存', offsetDays: 14 },
            { label: '30日留存', offsetDays: 30 },
        ];

        // 计算每个留存周期：取注册日期在 [offsetDays+7, offsetDays] 天前的用户（一周窗口，样本更稳定）
        const items: RetentionItem[] = await Promise.all(
            periods.map(async ({ label, offsetDays }) => {
                const windowEnd = new Date(now);
                windowEnd.setDate(windowEnd.getDate() - offsetDays);
                windowEnd.setHours(23, 59, 59, 999);
                const windowStart = new Date(windowEnd);
                windowStart.setDate(windowStart.getDate() - 7);
                windowStart.setHours(0, 0, 0, 0);

                const cohortUsers = await this.userModel.find(
                    { createdAt: { $gte: windowStart, $lte: windowEnd } },
                    { _id: 1, createdAt: 1, lastOnline: 1 },
                ).lean<Array<{ _id: unknown; createdAt: Date; lastOnline?: Date | null }>>();

                const total = cohortUsers.length;
                if (total === 0) return { label, rate: 0, total: 0, retained: 0 };

                const retained = cohortUsers.filter(u => {
                    if (!u.lastOnline) return false;
                    const threshold = new Date(u.createdAt);
                    threshold.setDate(threshold.getDate() + offsetDays);
                    return u.lastOnline >= threshold;
                }).length;

                return { label, rate: total > 0 ? retained / total : 0, total, retained };
            }),
        );

        const result: RetentionData = { items };
        await this.cacheManager.set(cacheKey, result, ADMIN_STATS_TTL_SECONDS);
        return result;
    }

    // ─── 用户活跃度分层 ─────────────────────────────────────────
    async getUserActivityTiers(): Promise<ActivityTierData> {
        const cacheKey = 'admin:activity-tiers';
        const cached = await this.cacheManager.get<ActivityTierData>(cacheKey);
        if (cached) return cached;

        const now = new Date();
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const onlineUserIds = await this.getOnlineUserIds();
        const onlineObjectIds = onlineUserIds
            .filter(id => Types.ObjectId.isValid(id))
            .map(id => new Types.ObjectId(id));

        const [totalUsers, bannedUsers, activeCount, silentCount] = await Promise.all([
            this.userModel.countDocuments(),
            this.userModel.countDocuments({ banned: true }),
            // 活跃：7 天内有 lastOnline 或当前在线
            this.userModel.countDocuments({
                banned: { $ne: true },
                $or: [
                    { lastOnline: { $gte: d7 } },
                    ...(onlineObjectIds.length > 0 ? [{ _id: { $in: onlineObjectIds } }] : []),
                ],
            }),
            // 沉默：lastOnline 在 7-30 天之间
            this.userModel.countDocuments({
                banned: { $ne: true },
                lastOnline: { $gte: d30, $lt: d7 },
                ...(onlineObjectIds.length > 0 ? { _id: { $nin: onlineObjectIds } } : {}),
            }),
        ]);

        // 流失 = 总数 - 活跃 - 沉默 - 封禁
        const churned = Math.max(0, totalUsers - activeCount - silentCount - bannedUsers);

        const tiers: ActivityTier[] = [
            { label: '活跃', count: activeCount, color: '#10b981', description: '7 天内活跃' },
            { label: '沉默', count: silentCount, color: '#f59e0b', description: '7-30 天未活跃' },
            { label: '流失', count: churned, color: '#94a3b8', description: '30 天以上未活跃' },
            { label: '封禁', count: bannedUsers, color: '#f43f5e', description: '已封禁' },
        ];

        const result: ActivityTierData = { tiers, totalUsers };
        await this.cacheManager.set(cacheKey, result, ADMIN_STATS_TTL_SECONDS);
        return result;
    }
}
