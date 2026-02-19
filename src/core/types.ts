/**
 * 框架核心类型定义
 * 
 * 定义游戏实现注册的核心接口。
 * 禁止使用 `any` 类型。
 */

import type { TutorialManifest } from '../engine/types';
import type { GameEngineConfig } from '../engine/transport/server';

// ============================================================================
// 游戏实现注册类型
// ============================================================================

/**
 * 游戏实现配置
 * 用于在 registry 中注册一个完整的游戏
 */
export interface GameImplementation {
    /** 引擎配置 */
    engineConfig: GameEngineConfig;
    /** React 棋盘组件 */
    board: React.ComponentType<Record<string, unknown>>;
    /** 可选的教程配置 */
    tutorial?: TutorialManifest;
    /** 延迟优化配置（可选，不传则不启用任何优化） */
    latencyConfig?: import('../engine/transport/latency/types').LatencyOptimizationConfig;
}

// ============================================================================
// 资源管理类型
// ============================================================================

/**
 * 精灵图集定义
 */
export interface SpriteAtlasDefinition {
    id: string;
    /** 图集图片路径（相对于 /assets/） */
    imagePath: string;
    /** 帧定义 */
    frames: SpriteFrame[];
}

/**
 * 精灵帧定义
 */
export interface SpriteFrame {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * 游戏资源清单
 */
export interface GameAssets {
    /** 图片资源映射 { key: 相对路径 } */
    images?: Record<string, string>;
    /** 音频资源映射 { key: 相对路径 } */
    audio?: Record<string, string>;
    /** 精灵图集 */
    sprites?: SpriteAtlasDefinition[];
    /** 关键图片路径列表（相对于 /assets/），进入对局前必须加载完成 */
    criticalImages?: string[];
    /** 暖加载图片路径列表（相对于 /assets/），进入对局后后台预取 */
    warmImages?: string[];
}

/**
 * 关键图片解析器返回值
 * 解析器基于对局状态动态生成关键/暖图片列表，与静态清单合并
 */
export interface CriticalImageResolverResult {
    critical: string[];
    warm: string[];
    /** 可选的阶段标识，变化时 CriticalImageGate 会重新触发预加载 */
    phaseKey?: string;
}

/**
 * 关键图片解析器函数签名
 * @param gameState 当前对局状态（由各游戏自行断言类型）
 * @param locale 可选的语言代码
 * @param playerID 当前玩家 ID（用于区分自己/对手的资源优先级）
 */
export type CriticalImageResolver = (
    gameState: unknown,
    locale?: string,
    playerID?: string | null,
) => CriticalImageResolverResult;

// ============================================================================
// 工具类型
// ============================================================================

/**
 * 深度只读类型
 */
export type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * 确保类型不是 any
 * 用于编译时检查，防止意外使用 any
 */
export type NoAny<T> = T extends never ? never : unknown extends T ? never : T;

// ============================================================================
// 卡牌预览类型（UI 通用）
// ============================================================================

/**
 * 卡牌预览引用（必须可序列化）
 */
export type CardPreviewRef =
    | {
        type: 'image';
        src: string;
        /** 卡牌宽高比（宽/高），用于预览尺寸自适应；未提供时使用默认竖向比例 */
        aspectRatio?: number;
    }
    | {
        type: 'atlas';
        atlasId: string;
        index: number;
        /** 卡牌宽高比（宽/高），用于预览尺寸自适应；未提供时使用默认竖向比例 */
        aspectRatio?: number;
    }
    | {
        type: 'svg';
        svgId: string;
        props?: Record<string, string | number>;
    }
    | {
        type: 'renderer';
        rendererId: string;
        payload?: Record<string, unknown>;
    };
