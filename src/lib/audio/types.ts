/**
 * 音频系统类型定义
 */

// 音效名称类型 (可扩展)
export type SoundKey = string;

// 音效映射配置
export interface SoundSprite {
    [key: string]: [number, number]; // [offset, duration] in ms
}

// 单个音效定义
export interface SoundDefinition {
    src: string | string[];
    volume?: number;
    loop?: boolean;
    sprite?: SoundSprite;
}

// 游戏音效配置
export interface GameAudioConfig {
    // 资源路径前缀
    basePath?: string;
    // 音效定义
    sounds: Record<SoundKey, SoundDefinition>;
    // Move 名称映射到音效
    moves?: Record<string, SoundKey>;
    // 状态触发器
    stateTriggers?: Array<{
        condition: (prevG: unknown, nextG: unknown, prevCtx: unknown, nextCtx: unknown) => boolean;
        sound: SoundKey;
    }>;
}

// 音频上下文状态
export interface AudioState {
    muted: boolean;
    volume: number;
    initialized: boolean;
}
