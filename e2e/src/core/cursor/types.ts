/**
 * 游戏光标主题类型定义
 *
 * 每个游戏可声明一个 cursorTheme，框架层自动注入对应的光标样式。
 * 光标图片使用 SVG data URI（32×32），通过 CSS cursor 属性应用。
 */

/** 光标各形态的预览 SVG（原始 SVG 字符串，用于设置弹窗预览） */
export interface CursorPreviewSvgs {
    default: string;
    pointer: string;
    grab?: string;
    grabbing?: string;
    zoomIn?: string;
    notAllowed?: string;
    help?: string;
}

/** 光标状态 → CSS cursor 值的映射 */
export interface CursorTheme {
    /** 主题 ID（全局唯一，如 'smashup-comic'） */
    id: string;
    /** 所属游戏 ID（如 'smashup'），同一游戏可有多个变体 */
    gameId: string;
    /** 显示名称（用于设置弹窗） */
    label: string;
    /** 风格变体名称（用于变体选择弹窗，如 '漫画风'、'像素风'） */
    variantLabel: string;
    /** 各形态的原始 SVG（用于预览） */
    previewSvgs: CursorPreviewSvgs;
    /** 默认光标 */
    default: string;
    /** 可点击元素（按钮、卡牌等） */
    pointer: string;
    /** 拖拽中 */
    grabbing?: string;
    /** 可拖拽 */
    grab?: string;
    /** 放大查看 */
    zoomIn?: string;
    /** 禁用状态 */
    notAllowed?: string;
    /** 帮助/提示（悬停查看更多信息） */
    help?: string;
    /**
     * 按玩家阵营切换的子主题映射。
     * key 为 playerID 字符串（如 '0'、'1'），value 为该阵营专属的光标 CSS 值集合。
     * GameCursorProvider 收到 playerID 后自动选择对应子主题；未匹配时回退到主题本身。
     * 其他游戏可通过同样机制实现阵营差异化光标。
     */
    playerThemes?: Record<string, Pick<CursorTheme, 'default' | 'pointer' | 'grabbing' | 'grab' | 'zoomIn' | 'notAllowed' | 'help' | 'previewSvgs'>>;
}

/** 用户光标偏好（持久化数据） */
export interface CursorPreference {
    /** 选中的光标主题 ID，'default' 表示系统默认 */
    cursorTheme: string;
    /** 覆盖范围：'home' 仅主页，'all' 覆盖所有游戏 */
    overrideScope: 'home' | 'all';
    /** 高对比模式：开启后光标加白色外描边，提升任意背景下的可见性 */
    highContrast: boolean;
    /** 每个游戏记住的变体 ID（gameId → themeId），通过"更换"弹窗保存 */
    gameVariants: Record<string, string>;
}
