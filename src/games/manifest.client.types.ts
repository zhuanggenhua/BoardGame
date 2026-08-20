import type { ReactNode } from 'react';
import type { GameTutorialSource, TutorialCollection, TutorialManifest } from '../engine/types';
import type { GameManifestEntry } from './manifest.types';
import type { AnyGameEngineConfig } from '../engine/transport/engineConfig';
import type { LatencyOptimizationConfig } from '../engine/transport/latency/types';
import type { CriticalImageResolver } from '../core/types';
import type { GameRuntimeAdapter } from './gameRuntimeAdapter';
import type { GameAudioConfig } from '../lib/audio/types';
import type { GameBoardRenderer } from '../engine/boardRenderer';

/** 游戏运行时实现（Board/engineConfig/tutorial/latencyConfig），按需懒加载 */
export interface GameClientRuntimeModule {
    engineConfig: AnyGameEngineConfig;
    // 各游戏 Board 组件的 props 都是具体的 GameBoardProps<...>，
    // 在统一 runtime 合同里使用宽类型避免被 Record<string, unknown> 误收窄。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 统一 runtime 合同需要接纳各游戏具体 Board props。
    board: React.ComponentType<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 允许具体游戏声明 Pixi/Phaser/Cocos 等自定义 Board 后端。
    boardRenderer?: GameBoardRenderer<any, any>;
    audioConfig?: GameAudioConfig;
    tutorial?: TutorialManifest;
    tutorialCatalog?: TutorialCollection;
    latencyConfig?: LatencyOptimizationConfig;
    runtimeAdapter?: GameRuntimeAdapter;
}

export interface GameClientManifestEntry {
    manifest: GameManifestEntry;
    thumbnail: ReactNode;
    /** 懒加载游戏运行时实现（仅 type=game 时存在） */
    loadRuntime?: () => Promise<GameClientRuntimeModule>;
    /** 懒加载教程清单（仅 tutorial.ts 存在时提供） */
    loadTutorial?: () => Promise<GameTutorialSource>;
    /** 懒加载关键图片解析器（用于 runtime 之前的首屏预热） */
    loadCriticalImageResolver?: () => Promise<CriticalImageResolver>;

    // ---- 以下字段已废弃，保留仅为向后兼容过渡 ----
    /** @deprecated 使用 loadRuntime() 替代 */
    engineConfig?: AnyGameEngineConfig;
    /** @deprecated 使用 loadRuntime() 替代 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 兼容旧 manifest 字段的游戏具体 Board props。
    board?: React.ComponentType<any>;
    /** @deprecated 使用 loadRuntime() 替代 */
    tutorial?: TutorialManifest;
    /** @deprecated 使用 loadRuntime() 替代 */
    tutorialCatalog?: TutorialCollection;
    /** @deprecated 使用 loadRuntime() 替代 */
    latencyConfig?: LatencyOptimizationConfig;
}
