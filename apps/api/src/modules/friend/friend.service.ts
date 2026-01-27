import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Cache } from 'cache-manager';
import type { Model } from 'mongoose';
import { SocialGateway } from '../../gateways/social.gateway';
import { User, type UserDocument } from '../auth/schemas/user.schema';
import { Friend, type FriendDocument } from './schemas/friend.schema';

const ONLINE_KEY_PREFIX = 'social:online:';
const SEARCH_LIMIT = 20;

type FriendRequestErrorCode = 'self' | 'userNotFound' | 'alreadyFriends' | 'requestExists' | 'incomingRequest';

type FriendRequestResult =
    | { ok: true; request: FriendDocument; targetUser: UserDocument; fromUser: UserDocument }
    | { ok: false; code: FriendRequestErrorCode };

type FriendUpdateResult =
    | { ok: true; friendUser: UserDocument }
    | { ok: false; code: 'requestNotFound' };

type FriendDeleteResult =
    | { ok: true }
    | { ok: false; code: 'friendNotFound' };

@Injectable()
export class FriendService {
    constructor(
        @InjectModel(Friend.name) private readonly friendModel: Model<FriendDocument>,
        @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
        @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
        @Inject(SocialGateway) private readonly socialGateway: SocialGateway
    ) {}

    async getFriendList(userId: string) {
        const relations = await this.friendModel
            .find({
                status: 'accepted',
                $or: [{ user: userId }, { friend: userId }],
            })
            .lean();

        const friendIds = relations.map(relation => (
            relation.user.toString() === userId ? relation.friend.toString() : relation.user.toString()
        ));

        if (friendIds.length === 0) {
            return [] as Array<{ id: string; username: string; online: boolean }>;
        }

        const users = await this.userModel
            .find({ _id: { $in: friendIds } })
            .select('username')
            .lean();

        const userMap = new Map(users.map(user => [user._id.toString(), user]));

        const items = await Promise.all(friendIds.map(async (friendId) => {
            const user = userMap.get(friendId);
            if (!user) return null;
            const online = await this.cacheManager.get(`${ONLINE_KEY_PREFIX}${friendId}`);
            return {
                id: user._id.toString(),
                username: user.username,
                online: Boolean(online),
            };
        }));

        return items.filter(Boolean) as Array<{ id: string; username: string; online: boolean }>;
    }

    async getPendingRequests(userId: string) {
        const requests = await this.friendModel
            .find({ friend: userId, status: 'pending' })
            .lean();

        if (requests.length === 0) return [] as Array<{ id: string; fromUser: { id: string; username: string } }>;

        const fromIds = requests.map(request => request.user.toString());
        const users = await this.userModel.find({ _id: { $in: fromIds } }).select('username').lean();
        const userMap = new Map(users.map(user => [user._id.toString(), user]));

        return requests
            .map(request => {
                const fromUser = userMap.get(request.user.toString());
                if (!fromUser) return null;
                return {
                    id: request._id.toString(),
                    fromUser: {
                        id: fromUser._id.toString(),
                        username: fromUser.username,
                    },
                };
            })
            .filter(Boolean) as Array<{ id: string; fromUser: { id: string; username: string } }>;
    }

    async searchUsers(currentUserId: string, query: string) {
        const keyword = query.trim();
        
        if (!keyword) return [] as Array<{ id: string; username: string; status: 'none' | 'pending' | 'incoming' | 'accepted' } >;

        const users = await this.userModel
            .find({
                _id: { $ne: currentUserId },
                username: { $regex: keyword, $options: 'i' },
            })
            .limit(SEARCH_LIMIT)
            .select('username')
            .lean();

        
        if (users.length === 0) return [] as Array<{ id: string; username: string; status: 'none' | 'pending' | 'incoming' | 'accepted' }>;

        const userIds = users.map(user => user._id.toString());
        const relations = await this.friendModel
            .find({
                $or: [
                    { user: currentUserId, friend: { $in: userIds } },
                    { friend: currentUserId, user: { $in: userIds } },
                ],
            })
            .lean();

        const relationMap = new Map<string, FriendDocument>();
        relations.forEach(relation => {
            const otherId = relation.user.toString() === currentUserId
                ? relation.friend.toString()
                : relation.user.toString();
            relationMap.set(otherId, relation as FriendDocument);
        });

        return users.map(user => {
            const relation = relationMap.get(user._id.toString());
            let status: 'none' | 'pending' | 'incoming' | 'accepted' = 'none';

            if (relation) {
                if (relation.status === 'accepted') {
                    status = 'accepted';
                } else if (relation.user.toString() === currentUserId) {
                    status = 'pending';
                } else {
                    status = 'incoming';
                }
            }

            return {
                id: user._id.toString(),
                username: user.username,
                status,
            };
        });
    }

    async createRequest(userId: string, targetUserId: string): Promise<FriendRequestResult> {
        
        if (userId === targetUserId) {
            return { ok: false, code: 'self' };
        }

        const [fromUser, targetUser] = await Promise.all([
            this.userModel.findById(userId).select('username').lean(),
            this.userModel.findById(targetUserId).select('username').lean(),
        ]);

        
        if (!targetUser || !fromUser) {
            return { ok: false, code: 'userNotFound' };
        }

        const existing = await this.friendModel
            .findOne({
                $or: [
                    { user: userId, friend: targetUserId },
                    { user: targetUserId, friend: userId },
                ],
            })
            .lean();

        if (existing) {
            if (existing.status === 'accepted') {
                return { ok: false, code: 'alreadyFriends' };
            }
            if (existing.user.toString() === userId) {
                return { ok: false, code: 'requestExists' };
            }
            return { ok: false, code: 'incomingRequest' };
        }

        const request = await this.friendModel.create({
            user: userId,
            friend: targetUserId,
            status: 'pending',
        });

        await this.socialGateway.emitFriendRequest(targetUserId, {
            id: request._id.toString(),
            fromUser: {
                id: userId,
                username: fromUser.username,
            },
        });

        return { ok: true, request, targetUser: targetUser as UserDocument, fromUser: fromUser as UserDocument };
    }

    async acceptRequest(requestId: string, currentUserId: string): Promise<FriendUpdateResult> {
        const request = await this.friendModel
            .findOneAndUpdate(
                { _id: requestId, friend: currentUserId, status: 'pending' },
                { status: 'accepted' },
                { new: true }
            )
            .lean();

        if (!request) {
            return { ok: false, code: 'requestNotFound' };
        }

        const friendUserId = request.user.toString();
        const friendUser = await this.userModel.findById(friendUserId).select('username').lean();
        if (!friendUser) {
            return { ok: false, code: 'requestNotFound' };
        }

        return { ok: true, friendUser: friendUser as UserDocument };
    }

    async rejectRequest(requestId: string, currentUserId: string): Promise<FriendUpdateResult> {
        const request = await this.friendModel.findOneAndDelete({ _id: requestId, friend: currentUserId, status: 'pending' }).lean();
        if (!request) {
            return { ok: false, code: 'requestNotFound' };
        }

        const friendUser = await this.userModel.findById(request.user).select('username').lean();
        if (!friendUser) {
            return { ok: false, code: 'requestNotFound' };
        }

        return { ok: true, friendUser: friendUser as UserDocument };
    }

    async deleteFriend(currentUserId: string, friendUserId: string): Promise<FriendDeleteResult> {
        const result = await this.friendModel.deleteMany({
            $or: [
                { user: currentUserId, friend: friendUserId },
                { user: friendUserId, friend: currentUserId },
            ],
        });

        if (!result.deletedCount) {
            return { ok: false, code: 'friendNotFound' };
        }

        return { ok: true };
    }

    async isFriend(userId: string, targetUserId: string): Promise<boolean> {
        const relation = await this.friendModel.findOne({
            status: 'accepted',
            $or: [
                { user: userId, friend: targetUserId },
                { user: targetUserId, friend: userId },
            ],
        });
        return Boolean(relation);
    }
}
