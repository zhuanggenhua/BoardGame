import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';

export type UserUISettingsDocument = HydratedDocument<UserUISettings>;

@Schema({ timestamps: true })
export class UserUISettings {
    @Prop({ type: 'ObjectId', ref: 'User', required: true })
    userId!: Types.ObjectId;

    /** 用户主动收藏的游戏 ID；不复制游戏目录资料。 */
    @Prop({ type: [String], default: [] })
    favoriteGameIds!: string[];

    /** 已读过的提示 key 集合（如 'buff-icon-click-hint'） */
    @Prop({ type: [String], default: [] })
    seenHints!: string[];

    /** 光标主题 ID（'default' 表示系统默认） */
    @Prop({ type: String, default: 'default' })
    cursorTheme!: string;

    /** 光标覆盖范围：'home' 仅主页，'all' 覆盖所有游戏 */
    @Prop({ type: String, default: 'home' })
    cursorOverrideScope!: string;

    /** 光标高对比模式（白色外描边） */
    @Prop({ type: Boolean, default: false })
    cursorHighContrast!: boolean;

    /** 每个游戏记住的变体 ID（gameId → themeId） */
    @Prop({ type: Object, default: {} })
    cursorGameVariants!: Record<string, string>;

    /** 本地 AI 开局偏好（gameId → 最近一次配置） */
    @Prop({ type: Object, default: {} })
    localAiMatchPreferences!: Record<string, {
        numPlayers: number;
        seatControllers?: Record<string, unknown>;
        setupSelections?: Record<string, string | string[]>;
    }>;

    /** 大杀四方偏好是否已初始化（用于首登本地迁移） */
    @Prop({ type: Boolean, default: false })
    smashupPreferenceInitialized!: boolean;

    /** 大杀四方英文卡图中文覆盖层 */
    @Prop({ type: Boolean, default: true })
    smashupOverlayEnabled!: boolean;

    /** 大杀四方交互模式 */
    @Prop({ type: String, enum: ['click', 'drag'], default: 'click' })
    smashupInteractionMode!: 'click' | 'drag';

    createdAt!: Date;
    updatedAt!: Date;
}

export const UserUISettingsSchema = SchemaFactory.createForClass(UserUISettings);
UserUISettingsSchema.index({ userId: 1 }, { unique: true });
