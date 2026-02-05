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

export interface AudioEvent {
    type: string;
    /** 事件级音效 key（优先级最高） */
    audioKey?: SoundKey;
    /** 事件级音效分类（用于统一映射） */
    audioCategory?: AudioCategory;
    sfxKey?: SoundKey;
    [key: string]: unknown;
}

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
    // 事件类型 -> 音效 key
    eventSoundMap?: Record<string, SoundKey>;
    // 事件解析（用于复杂逻辑）
    eventSoundResolver?: (event: AudioEvent, context: AudioRuntimeContext) => SoundKey | null | undefined;
    // BGM 规则
    bgmRules?: Array<BgmRule>;
    // 状态触发器
    stateTriggers?: Array<AudioStateTrigger>;
    // 日志事件选择器（从原始 entry 提取 AudioEvent）
    eventSelector?: (entry: unknown) => AudioEvent | null | undefined;
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
