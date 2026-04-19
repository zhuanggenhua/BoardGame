import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import type { HydratedDocument } from 'mongoose';
import { USER_ROLES, type UserRole } from './user-role';

export type UserDocument = HydratedDocument<User> & {
    comparePassword: (candidatePassword: string) => Promise<boolean>;
};

@Schema({ timestamps: true })
export class User {
    // username 仅作为昵称，不再作为唯一身份标识。
    @Prop({
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 20,
    })
    username!: string;

    @Prop({
        type: String,
        required: true,
        minlength: 4,
    })
    password!: string;

    // 邮箱作为唯一标识（登录首选）；历史数据允许为空，但一旦存在则必须唯一。
    @Prop({
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, '请输入有效的邮箱地址'],
    })
    email?: string;

    @Prop({
        type: Boolean,
        default: false,
    })
    emailVerified!: boolean;

    @Prop({ type: Date, default: null })
    lastOnline?: Date | null;

    @Prop({ type: String, default: null, trim: true })
    avatar?: string | null;

    @Prop({ type: Date, default: null })
    notificationLastSeenAt?: Date | null;

    @Prop({
        type: String,
        enum: USER_ROLES,
        default: 'user',
    })
    role!: UserRole;

    @Prop({
        type: [String],
        default: [],
    })
    // 仅对 developer 角色生效，表示该开发者可管理的游戏更新日志范围。
    developerGameIds!: string[];

    @Prop({ type: Boolean, default: false })
    banned!: boolean;

    @Prop({ type: Date, default: null })
    bannedAt?: Date | null;

    @Prop({ type: String, default: null, trim: true })
    bannedReason?: string | null;

    createdAt!: Date;
    updatedAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre<UserDocument>('save', async function (this: UserDocument) {
    if (!this.isModified('password')) {
        return;
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (this: UserDocument, candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password as string);
};
