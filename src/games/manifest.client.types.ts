import type { ReactNode } from 'react';
import type { GameTutorialSource, TutorialCollection, TutorialManifest } from '../engine/types';
import type { GameManifestEntry } from './manifest.types';
import type { GameEngineConfig } from '../engine/transport/server';
import type { LatencyOptimizationConfig } from '../engine/transport/latency/types';
import type { CriticalImageResolver } from '../core/types';

/** 游戏运行时实现（Board/engineConfig/tutorial/latencyConfig），按需懒加载 */
export interface GameClientRuntimeModule {
    engineConfig: GameEngineConfig;
    // 各游戏 Board 组件的 props 都是具体的 GameBoardProps<...>，
    // 在统一 runtime 合同里使用宽类型避免被 Record<string, unknown> 误收窄。
    board: React.ComponentType<any>;
    tutorial?: TutorialManifest;
    tutorialCatalog?: TutorialCollection;
    latencyConfig?: LatencyOptimizationConfig;
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
    engineConfig?: GameEngineConfig;
    /** @deprecated 使用 loadRuntime() 替代 */
    board?: React.ComponentType<any>;
    /** @deprecated 使用 loadRuntime() 替代 */
    tutorial?: TutorialManifest;
    /** @deprecated 使用 loadRuntime() 替代 */
    tutorialCatalog?: TutorialCollection;
    /** @deprecated 使用 loadRuntime() 替代 */
    latencyConfig?: LatencyOptimizationConfig;
}
