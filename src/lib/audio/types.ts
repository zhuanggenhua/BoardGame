/**
 * 音频系统类型定义
 */

// 音效名称类型 (可扩展)
export type SoundKey = string;

// 音效映射配置
export interface SoundSprite {
    [key: string]: [number, number]; // [offset, duration] in ms
}

export type AudioCategoryGroup =
    | 'dice'
    | 'card'
    | 'combat'
    | 'status'
    | 'token'
    | 'ui'
    | 'system'
    | 'stinger'
    | 'bgm'
    | 'misc'
    | (string & {});

export interface AudioCategory {
    group: AudioCategoryGroup;
    sub?: string;
}

// 单个音效定义
export interface SoundDefinition {
    src: string | string[];
    volume?: number;
    loop?: boolean;
    sprite?: SoundSprite;
    category?: AudioCategory;
}

// BGM 定义
export interface BgmDefinition {
    key: string;
    name: string;
    src: string | string[];
    volume?: number;
    category?: AudioCategory;
}

export type BgmGroupId = 'normal' | 'battle' | (string & {});

/** feedbackResolver 的返回值：音效 key */
export type EventSoundResult = SoundKey;

/**
 * 音频事件元数据标记
 * 用于框架层自动过滤不应通过事件流播放音效的事件
 */
export interface AudioEventMetadata {
    /**
     * 是否为 UI 本地交互事件
     * - true: 音效由 UI 组件本地播放（如按钮点击），事件流不再播放
     * - false/undefined: 正常通过事件流播放音效
     * 
     * 典型场景：
     * - 选角/选派系确认按钮：用户点击时 GameButton 已播放点击音，
     *   事件广播到其他客户端时不应重复播放
     */
    isLocalUIEvent?: boolean;
}

export interface AudioEvent {
    type: string;
    /** 事件级音效 key（优先级最高） */
    audioKey?: SoundKey;
    /** 事件级音效分类（用于统一映射） */
    audioCategory?: AudioCategory;
    sfxKey?: SoundKey;
    /** 音频事件元数据（框架层自动过滤） */
    audioMetadata?: AudioEventMetadata;
    [key: string]: unknown;
}

/**
 * 统一反馈解析器：仅处理无动画的事件音效
 * - 返回 SoundKey：框架立即播放
 * - 返回 null：无音效（有动画的事件由动画层自行解析 key 并在 onImpact 播放）
 * 
 * 注意：框架层会自动过滤 `audioMetadata.isLocalUIEvent === true` 的事件，
 * 这些事件不会调用 feedbackResolver，因此无需在 resolver 中手动检查。
 */
export type FeedbackResolver = (
    event: AudioEvent,
    context: AudioRuntimeContext
) => EventSoundResult | null | undefined;

export interface AudioRuntimeContext<
    G = unknown,
    Ctx = unknown,
    Meta extends Record<string, unknown> = Record<string, unknown>
> {
    G: G;
    ctx: Ctx;
    meta?: Meta;
}

export interface BgmRule<
    G = unknown,
    Ctx = unknown,
    Meta extends Record<string, unknown> = Record<string, unknown>
> {
    when: (context: AudioRuntimeContext<G, Ctx, Meta>) => boolean;
    key: string;
    group?: BgmGroupId;
}

export interface AudioStateTrigger<
    G = unknown,
    Ctx = unknown,
    Meta extends Record<string, unknown> = Record<string, unknown>
> {
    condition: (prev: AudioRuntimeContext<G, Ctx, Meta>, next: AudioRuntimeContext<G, Ctx, Meta>) => boolean;
    sound?: SoundKey;
    resolveSound?: (prev: AudioRuntimeContext<G, Ctx, Meta>, next: AudioRuntimeContext<G, Ctx, Meta>) => SoundKey | null | undefined;
}

// 游戏音频配置
export interface GameAudioConfig {
    // 资源路径前缀
    basePath?: string;
    // 音效定义
    sounds?: Record<SoundKey, SoundDefinition>;
    // BGM 定义列表
    bgm?: BgmDefinition[];
    // BGM 分组（用于按阶段切换）
    bgmGroups?: Record<BgmGroupId, SoundKey[]>;
    /**
     * 统一反馈解析器（必传）
     * 每个事件必须显式返回 { key, timing } 或 null。
     * 不允许裸字符串——编译期强制声明播放时机。
     */
    feedbackResolver: FeedbackResolver;
    // BGM 规则
    bgmRules?: Array<BgmRule>;
    // 状态触发器
    stateTriggers?: Array<AudioStateTrigger>;
    // 日志事件选择器（从原始 entry 提取 AudioEvent）
    eventSelector?: (entry: unknown) => AudioEvent | null | undefined;
    /**
     * 关键音效列表（进入游戏后立即预加载）
     * 这些音效会在 registry 加载完成后立即创建 Howl 实例并下载，
     * 消除首次播放延迟。建议只放 5-15 个"第一回合就会触发"的高频音效。
     */
    criticalSounds?: SoundKey[];
    /**
     * 上下文预加载音效（选派系/卡组后增量预热）
     * 用于派系/卡组等可预测但不适合全量预加载的音效。
     */
    contextualPreloadKeys?: (context: AudioRuntimeContext) => SoundKey[];
}

// 音频上下文状态
export interface AudioState {
    muted: boolean;
    masterVolume: number;
    sfxVolume: number;
    bgmVolume: number;
    currentBgm: string | null;
    initialized: boolean;
}
