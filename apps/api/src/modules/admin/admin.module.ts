import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Friend, FriendSchema } from '../friend/schemas/friend.schema';
import { Message, MessageSchema } from '../message/schemas/message.schema';
import { Review, ReviewSchema } from '../review/schemas/review.schema';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import { UgcAsset, UgcAssetSchema } from '../ugc/schemas/ugc-asset.schema';
import { UgcPackage, UgcPackageSchema } from '../ugc/schemas/ugc-package.schema';
import { MatchRecord, MatchRecordSchema } from './schemas/match-record.schema';
import { ROOM_MATCH_MODEL_NAME, RoomMatchSchema } from './schemas/room-match.schema';
import { HybridStorageProvider } from '../../shared/providers/hybrid-storage.provider';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: MatchRecord.name, schema: MatchRecordSchema },
            { name: ROOM_MATCH_MODEL_NAME, schema: RoomMatchSchema },
            { name: Friend.name, schema: FriendSchema },
            { name: Message.name, schema: MessageSchema },
            { name: Review.name, schema: ReviewSchema },
            { name: UgcPackage.name, schema: UgcPackageSchema },
            { name: UgcAsset.name, schema: UgcAssetSchema },
        ]),
    ],
    controllers: [AdminController],
    providers: [AdminService, AdminGuard, JwtAuthGuard, Reflector, HybridStorageProvider],
})
export class AdminModule {}
